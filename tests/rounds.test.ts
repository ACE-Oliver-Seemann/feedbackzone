import { beforeEach, describe, expect, it } from "vitest";
import { GET as getQuestions } from "@/app/api/questions/route";
import { POST as closeRoute } from "@/app/api/rounds/[id]/close/route";
import { POST as openRoute } from "@/app/api/rounds/[id]/open/route";
import { GET as getRounds, POST as postRound } from "@/app/api/rounds/route";
import { db } from "@/lib/db";
import { dateInDays, params, request, resetDb, type Fixture } from "./helpers";

let fx: Fixture;
beforeEach(async () => {
  fx = await resetDb();
});

type User = { id: string };

function create(as: User | undefined, overrides: Record<string, unknown> = {}) {
  const body = {
    name: "Pulse test",
    teamId: fx.a.team.id,
    closesAt: dateInDays(7),
    questionIds: fx.questions.slice(0, 4).map((question) => question.id),
    ...overrides,
  };
  return postRound(request("/api/rounds", { method: "POST", as, body }), undefined);
}

async function createdId(as: User, overrides: Record<string, unknown> = {}): Promise<string> {
  const response = await create(as, overrides);
  expect(response.status).toBe(201);
  return (await response.json()).round.id;
}

const open = (as: User | undefined, id: string) =>
  openRoute(request(`/api/rounds/${id}/open`, { method: "POST", as }), params({ id }));
const close = (as: User | undefined, id: string) =>
  closeRoute(request(`/api/rounds/${id}/close`, { method: "POST", as }), params({ id }));

async function list(as: User) {
  const response = await getRounds(request("/api/rounds", { as }), undefined);
  expect(response.status).toBe(200);
  return (await response.json()).rounds as Array<Record<string, unknown>>;
}

describe("create round [MVP-04]", () => {
  it("HR creates a draft for any team with questions in the chosen order", async () => {
    const id = await createdId(fx.hr, { teamId: fx.b.team.id });
    const round = await db.round.findUniqueOrThrow({
      where: { id },
      include: { questions: { orderBy: { position: "asc" } } },
    });
    expect(round.status).toBe("DRAFT");
    expect(round.teamId).toBe(fx.b.team.id);
    expect(round.questions.map((item) => item.questionId)).toEqual(
      fx.questions.slice(0, 4).map((question) => question.id),
    );
  });

  it("a manager creates a round for their own team, also without sending teamId", async () => {
    const id = await createdId(fx.a.manager, { teamId: undefined });
    const round = await db.round.findUniqueOrThrow({ where: { id } });
    expect(round.teamId).toBe(fx.a.team.id);
  });

  it.each([
    [2, "too_few"],
    [6, "too_many"],
  ])("rejects %i questions", async (count, code) => {
    const response = await create(fx.hr, {
      questionIds: fx.questions.slice(0, count).map((question) => question.id),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).fields.questionIds).toBe(code);
    expect(await db.round.count()).toBe(0);
  });

  it.each([3, 5])("accepts %i questions", async (count) => {
    const response = await create(fx.hr, {
      questionIds: fx.questions.slice(0, count).map((question) => question.id),
    });
    expect(response.status).toBe(201);
  });

  it("rejects duplicate and unknown questions", async () => {
    const [first, second] = fx.questions.map((question) => question.id);
    const duplicate = await create(fx.hr, { questionIds: [first, first, second] });
    expect(duplicate.status).toBe(400);

    const unknown = await create(fx.hr, { questionIds: [first, second, "no-such-question"] });
    expect(unknown.status).toBe(400);
    expect(await db.round.count()).toBe(0);
  });

  it("rejects a missing name, a bad date and a deadline in the past", async () => {
    expect((await create(fx.hr, { name: "   " })).status).toBe(400);
    expect((await create(fx.hr, { closesAt: "2026-02-31" })).status).toBe(400);
    expect((await create(fx.hr, { closesAt: "tomorrow" })).status).toBe(400);
    expect((await create(fx.hr, { closesAt: dateInDays(-1) })).status).toBe(400);
    expect((await create(fx.hr, { teamId: undefined })).status).toBe(400);
  });
});

describe("round permissions [NFR-03, MVP-03]", () => {
  it("returns 401 without a session", async () => {
    expect((await create(undefined)).status).toBe(401);
    expect((await getRounds(request("/api/rounds"), undefined)).status).toBe(401);
    expect((await getQuestions(request("/api/questions"), undefined)).status).toBe(401);
  });

  it("an employee cannot create a round or read the question library", async () => {
    const employee = fx.a.employees[0];
    expect((await create(employee)).status).toBe(403);
    expect(
      (await getQuestions(request("/api/questions", { as: employee }), undefined)).status,
    ).toBe(403);
    expect(await db.round.count()).toBe(0);
  });

  it("a manager cannot create a round for another team", async () => {
    const response = await create(fx.b.manager, { teamId: fx.a.team.id });
    expect(response.status).toBe(403);
    expect(await db.round.count()).toBe(0);
  });

  it("the manager of team B cannot open or close a round of team A", async () => {
    const id = await createdId(fx.a.manager);
    expect((await open(fx.b.manager, id)).status).toBe(403);
    expect((await open(fx.a.manager, id)).status).toBe(200);
    expect((await close(fx.b.manager, id)).status).toBe(403);
    expect((await db.round.findUniqueOrThrow({ where: { id } })).status).toBe("OPEN");
  });

  it("an employee cannot open or close a round of their own team", async () => {
    const id = await createdId(fx.a.manager);
    expect((await open(fx.a.employees[0], id)).status).toBe(403);
    await open(fx.a.manager, id);
    expect((await close(fx.a.employees[0], id)).status).toBe(403);
  });

  it("manager and HR can read the question library", async () => {
    for (const user of [fx.a.manager, fx.hr]) {
      const response = await getQuestions(request("/api/questions", { as: user }), undefined);
      expect(response.status).toBe(200);
      expect((await response.json()).questions).toHaveLength(fx.questions.length);
    }
  });
});

describe("round lifecycle [MVP-05]", () => {
  it("goes draft → open → closed and rejects every other transition", async () => {
    const id = await createdId(fx.hr);
    const status = async () => (await db.round.findUniqueOrThrow({ where: { id } })).status;

    expect((await close(fx.hr, id)).status).toBe(409); // draft cannot be closed
    expect((await open(fx.hr, id)).status).toBe(200);
    expect(await status()).toBe("OPEN");
    expect((await open(fx.hr, id)).status).toBe(409); // already open
    expect((await close(fx.hr, id)).status).toBe(200);
    expect(await status()).toBe("CLOSED");
    expect((await open(fx.hr, id)).status).toBe(409); // closed cannot be reopened
    expect((await close(fx.hr, id)).status).toBe(409);
  });

  it("sets the start time when the round is opened", async () => {
    const id = await createdId(fx.hr);
    expect((await db.round.findUniqueOrThrow({ where: { id } })).startsAt).toBeNull();
    await open(fx.hr, id);
    expect((await db.round.findUniqueOrThrow({ where: { id } })).startsAt).toBeInstanceOf(Date);
  });

  it("closes an open round automatically on the first load after the deadline", async () => {
    const id = await createdId(fx.a.manager);
    await open(fx.a.manager, id);
    await db.round.update({ where: { id }, data: { closesAt: new Date(Date.now() - 1000) } });

    const rounds = await list(fx.a.manager);
    expect(rounds.find((round) => round.id === id)?.status).toBe("CLOSED");
    expect((await db.round.findUniqueOrThrow({ where: { id } })).status).toBe("CLOSED");
  });

  it("returns 404 to HR for an unknown round", async () => {
    expect((await open(fx.hr, "no-such-round")).status).toBe(404);
  });
});

describe("list rounds [MVP-06, MVP-12]", () => {
  it("shows each role its own scope", async () => {
    const draftA = await createdId(fx.a.manager, { name: "A draft" });
    const openA = await createdId(fx.a.manager, { name: "A open" });
    await open(fx.a.manager, openA);
    const openB = await createdId(fx.b.manager, { name: "B open", teamId: fx.b.team.id });
    await open(fx.b.manager, openB);

    const ids = async (user: User) => (await list(user)).map((round) => round.id).sort();

    expect(await ids(fx.hr)).toEqual([draftA, openA, openB].sort());
    expect(await ids(fx.a.manager)).toEqual([draftA, openA].sort());
    expect(await ids(fx.a.employees[0])).toEqual([openA]);
    expect(await ids(fx.b.employees[0])).toEqual([openB]);
  });

  it("gives management fields to manager and HR only", async () => {
    const id = await createdId(fx.a.manager);
    await open(fx.a.manager, id);

    const [forEmployee] = await list(fx.a.employees[0]);
    expect(forEmployee.submitted).toBe(false);
    expect(forEmployee).not.toHaveProperty("participation");
    expect(forEmployee).not.toHaveProperty("awaitingAction");

    const [forManager] = await list(fx.a.manager);
    expect(forManager.participation).toEqual({ responded: 0, teamSize: 6 });
    expect(forManager.submitted).toBe(false);

    const [forHr] = await list(fx.hr);
    expect(forHr.participation).toEqual({ responded: 0, teamSize: 6 });
    expect(forHr).not.toHaveProperty("submitted");
  });

  it("marks a closed round without an action as awaiting action [MVP-15]", async () => {
    const id = await createdId(fx.a.manager);
    await open(fx.a.manager, id);
    await close(fx.a.manager, id);
    expect((await list(fx.a.manager))[0].awaitingAction).toBe(true);

    await db.action.create({
      data: { roundId: id, topic: "Test", description: "Test", dueDate: new Date() },
    });
    expect((await list(fx.hr))[0].awaitingAction).toBe(false);
  });
});
