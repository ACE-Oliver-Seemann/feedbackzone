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
    expect(
      (await send(fx.a.employees[0], { toUserId: fx.hr.id, visibility: "PRIVATE" })).status,
    ).toBe(201);
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
});

describe("quick kudos with an emoji [IT-06]", () => {
  it("an emoji alone is enough; the text may be empty", async () => {
    const response = await send(fx.a.employees[0], { text: "", emoji: "👏" });
    expect(response.status).toBe(201);
    expect((await response.json()).kudos).toMatchObject({ emoji: "👏", text: "" });

    const withoutText = await send(fx.a.employees[0], { text: undefined, emoji: "🎉" });
    expect(withoutText.status).toBe(201);
  });

  it("an emoji can accompany a short or a long text", async () => {
    expect((await send(fx.a.employees[0], { text: "Vďaka!", emoji: "❤️" })).status).toBe(201);
    expect((await send(fx.a.employees[0], { emoji: "⭐" })).status).toBe(201); // default long text
    const stored = await db.kudos.findMany({ orderBy: { createdAt: "asc" } });
    expect(stored.map((item) => item.emoji).sort()).toEqual(["❤️", "⭐"].sort());
  });

  it("without an emoji the 20-character minimum still applies [MVP-16]", async () => {
    expect((await send(fx.a.employees[0], { text: "Vďaka!" })).status).toBe(400);
    expect((await send(fx.a.employees[0], { text: "", emoji: null })).status).toBe(400);
    expect((await send(fx.a.employees[0], { text: "", emoji: "" })).status).toBe(400);
    expect(await db.kudos.count()).toBe(0);
  });

  it.each([
    ["an emoji outside the set", { text: "", emoji: "💩" }],
    ["free text instead of an emoji", { text: "", emoji: "super" }],
    ["two emoji", { text: "", emoji: "👏👏" }],
    ["a wrong type", { text: "", emoji: 5 }],
    ["text over 500 characters next to an emoji", { text: "x".repeat(501), emoji: "👏" }],
  ])("rejects %s", async (_label, override) => {
    expect((await send(fx.a.employees[0], override)).status).toBe(400);
    expect(await db.kudos.count()).toBe(0);
  });

  it("the emoji shows in the team feed and in 'Moje kudos'", async () => {
    await send(fx.a.employees[0], { text: "", emoji: "🙌" });
    expect((await feed(fx.a.employees[2], fx.a.team.id))[0]).toMatchObject({
      emoji: "🙌",
      fromName: fx.a.employees[0].name,
    });
    expect((await mine(fx.a.employees[1]))[0]).toMatchObject({ emoji: "🙌", text: "" });
  });

  it("kudos without an emoji returns emoji null", async () => {
    await send(fx.a.employees[0]);
    expect((await mine(fx.a.employees[1]))[0].emoji).toBeNull();
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
