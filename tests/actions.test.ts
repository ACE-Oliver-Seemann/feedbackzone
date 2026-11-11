import { beforeEach, describe, expect, it } from "vitest";
import { PATCH as patchAction } from "@/app/api/actions/[id]/route";
import { POST as postAction } from "@/app/api/rounds/[id]/actions/route";
import { GET as getRounds } from "@/app/api/rounds/route";
import { db } from "@/lib/db";
import { createRound, dateInDays, params, request, resetDb, type Fixture } from "./helpers";

let fx: Fixture;
beforeEach(async () => {
  fx = await resetDb();
});

type User = { id: string };

const validAction = () => ({
  topic: "Vyťaženosť",
  description: "Prerozdelíme úlohy na najbližší šprint.",
  dueDate: dateInDays(14),
});

const add = (as: User | undefined, roundId: string, body: unknown = validAction()) =>
  postAction(
    request(`/api/rounds/${roundId}/actions`, { method: "POST", as, body }),
    params({ id: roundId }),
  );

const patch = (as: User | undefined, id: string, body: unknown) =>
  patchAction(request(`/api/actions/${id}`, { method: "PATCH", as, body }), params({ id }));

describe("actions on a closed round [MVP-13]", () => {
  it("the manager adds an action with the default status", async () => {
    const round = await createRound(fx, fx.a.team.id, "CLOSED");
    const response = await add(fx.a.manager, round.id);
    expect(response.status).toBe(201);
    expect((await response.json()).action).toMatchObject({
      roundId: round.id,
      topic: "Vyťaženosť",
      description: "Prerozdelíme úlohy na najbližší šprint.",
      status: "PLANNED",
    });
  });

  it("allows several actions on one round", async () => {
    const round = await createRound(fx, fx.a.team.id, "CLOSED");
    await add(fx.a.manager, round.id);
    await add(fx.a.manager, round.id, { ...validAction(), topic: "Tím", status: "IN_PROGRESS" });
    expect(await db.action.count({ where: { roundId: round.id } })).toBe(2);
  });

  it("the status can be changed through all three values", async () => {
    const round = await createRound(fx, fx.a.team.id, "CLOSED");
    const { action } = await (await add(fx.a.manager, round.id)).json();

    for (const status of ["IN_PROGRESS", "DONE", "PLANNED"]) {
      const response = await patch(fx.a.manager, action.id, { status });
      expect(response.status).toBe(200);
      expect((await response.json()).action.status).toBe(status);
    }
  });

  it("rejects an action on a draft or open round", async () => {
    for (const status of ["DRAFT", "OPEN"] as const) {
      const round = await createRound(fx, fx.a.team.id, status);
      const response = await add(fx.a.manager, round.id);
      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe("round_not_closed");
    }
    expect(await db.action.count()).toBe(0);
  });

  it.each([
    ["missing topic", { topic: " " }],
    ["missing description", { description: "" }],
    ["invalid date", { dueDate: "2026-13-01" }],
    ["unknown status", { status: "CANCELLED" }],
    ["topic too long", { topic: "x".repeat(121) }],
  ])("rejects %s", async (_label, override) => {
    const round = await createRound(fx, fx.a.team.id, "CLOSED");
    expect((await add(fx.a.manager, round.id, { ...validAction(), ...override })).status).toBe(400);
    expect(await db.action.count()).toBe(0);
  });

  it("rejects an unknown status on update and keeps the old one", async () => {
    const round = await createRound(fx, fx.a.team.id, "CLOSED");
    const { action } = await (await add(fx.a.manager, round.id)).json();
    expect((await patch(fx.a.manager, action.id, { status: "nope" })).status).toBe(400);
    expect((await patch(fx.a.manager, action.id, {})).status).toBe(400);
    expect((await db.action.findUniqueOrThrow({ where: { id: action.id } })).status).toBe("PLANNED");
  });

  it("clears the 'awaiting action' flag of the round [MVP-15]", async () => {
    const round = await createRound(fx, fx.a.team.id, "CLOSED");
    const flag = async (user: User) =>
      (await (await getRounds(request("/api/rounds", { as: user }), undefined)).json()).rounds[0]
        .awaitingAction;

    expect(await flag(fx.a.manager)).toBe(true);
    expect(await flag(fx.hr)).toBe(true);
    await add(fx.a.manager, round.id);
    expect(await flag(fx.a.manager)).toBe(false);
    expect(await flag(fx.hr)).toBe(false);
  });
});

describe("action permissions [NFR-03]", () => {
  it("only the manager of the team may add an action — not HR, not another manager, not an employee", async () => {
    const round = await createRound(fx, fx.a.team.id, "CLOSED");
    expect((await add(undefined, round.id)).status).toBe(401);
    for (const user of [fx.hr, fx.b.manager, fx.a.employees[0], fx.b.employees[0]]) {
      expect((await add(user, round.id)).status).toBe(403);
    }
    expect(await db.action.count()).toBe(0);
  });

  it("only the manager of the team may change the status", async () => {
    const round = await createRound(fx, fx.a.team.id, "CLOSED");
    const { action } = await (await add(fx.a.manager, round.id)).json();

    expect((await patch(undefined, action.id, { status: "DONE" })).status).toBe(401);
    for (const user of [fx.hr, fx.b.manager, fx.a.employees[0]]) {
      expect((await patch(user, action.id, { status: "DONE" })).status).toBe(403);
    }
    expect((await db.action.findUniqueOrThrow({ where: { id: action.id } })).status).toBe("PLANNED");
  });

  it("an unknown round or action is 403", async () => {
    expect((await add(fx.a.manager, "no-such-round")).status).toBe(403);
    expect((await patch(fx.a.manager, "no-such-action", { status: "DONE" })).status).toBe(403);
  });
});
