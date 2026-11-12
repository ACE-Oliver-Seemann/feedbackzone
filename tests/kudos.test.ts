import { beforeEach, describe, expect, it } from "vitest";
import { GET as getMyKudos } from "@/app/api/kudos/me/route";
import { POST as postKudos } from "@/app/api/kudos/route";
import { GET as getSummary } from "@/app/api/teams/[id]/summary/route";
import { db } from "@/lib/db";
import { params, request, resetDb, type Fixture } from "./helpers";

let fx: Fixture;
beforeEach(async () => {
  fx = await resetDb();
});

type User = { id: string };

const TEXT = "Ďakujem za pomoc s nasadením, veľmi to pomohlo.";

function send(as: User | undefined, overrides: Record<string, unknown> = {}) {
  const body = {
    toUserId: fx.a.employees[1].id,
    text: TEXT,
    value: "HELPING",
    visibility: "TEAM",
    ...overrides,
  };
  return postKudos(request("/api/kudos", { method: "POST", as, body }), undefined);
}

const mine = async (as: User) =>
  (await (await getMyKudos(request("/api/kudos/me", { as }), undefined)).json()).kudos as Array<
    Record<string, unknown>
  >;

const feed = async (as: User, teamId: string) =>
  (
    await (
      await getSummary(request(`/api/teams/${teamId}/summary`, { as }), params({ id: teamId }))
    ).json()
  ).kudos as Array<Record<string, unknown>>;

describe("send kudos [MVP-16]", () => {
  it("stores kudos signed with the sender's name", async () => {
    const sender = fx.a.employees[0];
    const response = await send(sender);
    expect(response.status).toBe(201);
    expect((await response.json()).kudos).toMatchObject({
      fromName: sender.name,
      toName: fx.a.employees[1].name,
      text: TEXT,
      value: "HELPING",
      visibility: "TEAM",
    });
    expect((await db.kudos.findFirstOrThrow()).fromUserId).toBe(sender.id);
  });

  it("every role can send kudos, also across teams", async () => {
    expect((await send(fx.hr)).status).toBe(201);
    expect((await send(fx.a.manager)).status).toBe(201);
    expect((await send(fx.b.employees[0])).status).toBe(201);
    expect((await send(fx.a.employees[0], { toUserId: fx.hr.id })).status).toBe(201);
  });

  it("requires a session", async () => {
    expect((await send(undefined)).status).toBe(401);
    expect((await getMyKudos(request("/api/kudos/me"), undefined)).status).toBe(401);
  });

  it.each([
    ["kudos to oneself", () => ({ toUserId: fx.a.employees[0].id })],
    ["an unknown recipient", () => ({ toUserId: "no-such-user" })],
    ["a missing recipient", () => ({ toUserId: undefined })],
    ["text of 19 characters", () => ({ text: "x".repeat(19) })],
    ["text of 501 characters", () => ({ text: "x".repeat(501) })],
    ["text padded with spaces to 20", () => ({ text: `${"x".repeat(10)}${" ".repeat(10)}` })],
    // BE-002: 10 emoji are 10 characters, not 20.
    ["10 emoji (20 UTF-16 code units)", () => ({ text: "🎉".repeat(10) })],
    // BE-003: invisible characters do not count.
    ["text of only zero-width characters", () => ({ text: "​".repeat(30) })],
    ["10 letters padded with zero-width spaces", () => ({ text: `${"x".repeat(10)}${"​".repeat(15)}` })],
    ["501 emoji", () => ({ text: "🎉".repeat(501) })],
    ["an unknown value", () => ({ value: "LUCK" })],
    ["an unknown visibility", () => ({ visibility: "PUBLIC" })],
  ])("rejects %s", async (_label, override) => {
    expect((await send(fx.a.employees[0], override())).status).toBe(400);
    expect(await db.kudos.count()).toBe(0);
  });

  it("accepts text of exactly 20 and 500 characters", async () => {
    expect((await send(fx.a.employees[0], { text: "x".repeat(20) })).status).toBe(201);
    expect((await send(fx.a.employees[0], { text: "x".repeat(500) })).status).toBe(201);
  });

  it("counts characters, not UTF-16 code units: 260 emoji fit into 500 [BE-002]", async () => {
    expect((await send(fx.a.employees[0], { text: "🎉".repeat(260) })).status).toBe(201);
    expect((await send(fx.a.employees[0], { text: "🎉".repeat(500) })).status).toBe(201);
  });
});

describe("kudos feed and 'Moje kudos' [MVP-17]", () => {
  it("the team page shows public kudos of the team, newest first", async () => {
    await send(fx.a.employees[0], { text: "Prvé kudos pre kolegu z tímu." });
    await db.kudos.updateMany({ data: { createdAt: new Date(Date.now() - 60_000) } });
    await send(fx.a.manager, { text: "Druhé kudos pre kolegu z tímu." });
    await send(fx.a.employees[0], { toUserId: fx.b.employees[0].id, text: "Kudos do druhého tímu." });

    const teamA = await feed(fx.a.employees[2], fx.a.team.id);
    expect(teamA.map((item) => item.text)).toEqual([
      "Druhé kudos pre kolegu z tímu.",
      "Prvé kudos pre kolegu z tímu.",
    ]);
    const teamB = await feed(fx.b.manager, fx.b.team.id);
    expect(teamB.map((item) => item.text)).toEqual(["Kudos do druhého tímu."]);
  });

  it("private kudos are visible only to the recipient — not to the manager, HR or the team", async () => {
    const recipient = fx.a.employees[1];
    await send(fx.a.employees[0], { visibility: "PRIVATE", text: "Súkromné poďakovanie iba pre teba." });

    // Not on the team page, for anyone.
    for (const user of [fx.a.manager, fx.hr, fx.a.employees[2], recipient]) {
      expect(await feed(user, fx.a.team.id)).toEqual([]);
    }
    // Not in anybody else's "Moje kudos" — including the sender's.
    for (const user of [fx.a.manager, fx.hr, fx.a.employees[2], fx.a.employees[0]]) {
      expect(await mine(user)).toEqual([]);
    }
    // Only the recipient sees it.
    const received = await mine(recipient);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      text: "Súkromné poďakovanie iba pre teba.",
      visibility: "PRIVATE",
      fromName: fx.a.employees[0].name,
    });
  });

  it("'Moje kudos' lists received public and private kudos, newest first", async () => {
    const recipient = fx.a.employees[1];
    await send(fx.a.employees[0], { text: "Staršie verejné kudos pre teba." });
    await db.kudos.updateMany({ data: { createdAt: new Date(Date.now() - 60_000) } });
    await send(fx.hr, { visibility: "PRIVATE", text: "Novšie súkromné kudos pre teba." });
    await send(recipient, { toUserId: fx.a.employees[0].id, text: "Kudos, ktoré som poslal ja." });

    expect((await mine(recipient)).map((item) => item.text)).toEqual([
      "Novšie súkromné kudos pre teba.",
      "Staršie verejné kudos pre teba.",
    ]);
  });
});
