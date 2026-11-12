import { beforeEach, describe, expect, it } from "vitest";
import { GET as getSummary } from "@/app/api/teams/[id]/summary/route";
import { MIN_GROUP_SIZE } from "@/config/privacy";
import { db } from "@/lib/db";
import { createRound, params, request, resetDb, type Fixture } from "./helpers";

let fx: Fixture;
beforeEach(async () => {
  fx = await resetDb();
});

type User = { id: string };

const summary = (as: User | undefined, teamId: string) =>
  getSummary(request(`/api/teams/${teamId}/summary`, { as }), params({ id: teamId }));

/** A closed round of team A with `count` identical responses, written directly. */
async function closedRound(count: number, name: string, daysAgo: number, comment?: string) {
  const round = await createRound(fx, fx.a.team.id, "CLOSED");
  await db.round.update({
    where: { id: round.id },
    data: { name, closesAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) },
  });
  const members = [...fx.a.employees, fx.a.manager];
  for (let index = 0; index < count; index++) {
    await db.participation.create({ data: { roundId: round.id, userId: members[index].id } });
    await db.response.create({
      data: { roundId: round.id, teamId: fx.a.team.id, v1: 4, v2: 2, v3: 5, v4: 3, comment },
    });
  }
  return round;
}

describe("team page 'Povedali ste, urobili sme' [MVP-14]", () => {
  it("lists closed rounds newest first with participation, averages and actions", async () => {
    const older = await closedRound(MIN_GROUP_SIZE, "Staršie kolo", 20);
    const newer = await closedRound(MIN_GROUP_SIZE, "Novšie kolo", 2);
    await createRound(fx, fx.a.team.id, "OPEN");
    await createRound(fx, fx.a.team.id, "DRAFT");
    await db.action.create({
      data: {
        roundId: newer.id,
        topic: "Vyťaženosť",
        description: "Prerozdelíme úlohy.",
        dueDate: new Date(),
        status: "IN_PROGRESS",
      },
    });

    const response = await summary(fx.a.employees[0], fx.a.team.id);
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.team).toEqual({ id: fx.a.team.id, name: fx.a.team.name });
    expect(body.rounds.map((round: { id: string }) => round.id)).toEqual([newer.id, older.id]);
    expect(body.rounds[0].participation).toEqual({ responded: MIN_GROUP_SIZE, teamSize: 6 });
    expect(body.rounds[0].results).toEqual({
      status: "ok",
      questions: [
        { position: 1, text: fx.questions[0].text, scale: "AGREEMENT", average: 4 },
        { position: 2, text: fx.questions[1].text, scale: "AGREEMENT", average: 2 },
        { position: 3, text: fx.questions[2].text, scale: "AGREEMENT", average: 5 },
        { position: 4, text: fx.questions[3].text, scale: "AGREEMENT", average: 3 },
      ],
    });
    expect(body.rounds[0].actions).toHaveLength(1);
    expect(body.rounds[0].actions[0]).toMatchObject({ topic: "Vyťaženosť", status: "IN_PROGRESS" });
    expect(body.rounds[1].actions).toEqual([]);
  });

  it("hides averages below the threshold [NFR-02, MVP-11]", async () => {
    await closedRound(MIN_GROUP_SIZE - 1, "Málo odpovedí", 2);
    const body = await (await summary(fx.a.employees[0], fx.a.team.id)).json();
    expect(body.rounds[0].results).toEqual({ status: "insufficient_responses" });
    expect(body.rounds[0].participation.responded).toBe(MIN_GROUP_SIZE - 1);
    expect(JSON.stringify(body)).not.toContain("average");
  });

  it("never contains comments or distributions, for any role", async () => {
    await closedRound(MIN_GROUP_SIZE, "S komentármi", 2, "Komentár iba pre manažéra");
    for (const user of [fx.a.employees[0], fx.a.manager, fx.hr]) {
      const raw = JSON.stringify(await (await summary(user, fx.a.team.id)).json());
      expect(raw).not.toContain("Komentár iba pre manažéra");
      expect(raw).not.toContain("comment");
      expect(raw).not.toContain("distribution");
    }
  });

  it("closes an expired round on load, so it appears on the page [MVP-05]", async () => {
    const round = await createRound(fx, fx.a.team.id, "OPEN");
    await db.round.update({
      where: { id: round.id },
      data: { closesAt: new Date(Date.now() - 1000) },
    });
    const body = await (await summary(fx.a.employees[0], fx.a.team.id)).json();
    expect(body.rounds.map((item: { id: string }) => item.id)).toEqual([round.id]);
  });
});

describe("team page permissions [NFR-03]", () => {
  it("members and HR may see the team; other teams may not", async () => {
    const teamA = fx.a.team.id;
    expect((await summary(undefined, teamA)).status).toBe(401);
    for (const user of [fx.a.employees[0], fx.a.manager, fx.hr]) {
      expect((await summary(user, teamA)).status).toBe(200);
    }
    for (const user of [fx.b.employees[0], fx.b.manager]) {
      expect((await summary(user, teamA)).status).toBe(403);
    }
  });

  it("an unknown team is 403 for members and 404 for HR", async () => {
    expect((await summary(fx.a.manager, "no-such-team")).status).toBe(403);
    expect((await summary(fx.hr, "no-such-team")).status).toBe(404);
  });
});
