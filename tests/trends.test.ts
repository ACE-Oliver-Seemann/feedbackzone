import { beforeEach, describe, expect, it } from "vitest";
import { GET as getHeatmap } from "@/app/api/hr/heatmap/route";
import { GET as getTrend } from "@/app/api/teams/[id]/trend/route";
import { MIN_GROUP_SIZE } from "@/config/privacy";
import { db } from "@/lib/db";
import { FIXED_TOPIC_LABEL, HEATMAP_WINDOW_DAYS } from "@/server/trends";
import { createRound, params, request, resetDb, type Fixture } from "./helpers";

// IT-08: results over time and across teams, only above the threshold.

let fx: Fixture;
beforeEach(async () => {
  fx = await resetDb();
  // q1 fixed trend question, q2 + q3 one topic, q4 a reversed scale in another.
  await db.question.update({
    where: { id: fx.questions[0].id },
    data: { fixed: true, topic: "Stála otázka", scale: "QUALITY" },
  });
  await db.question.update({ where: { id: fx.questions[1].id }, data: { topic: "Jasnosť" } });
  await db.question.update({ where: { id: fx.questions[2].id }, data: { topic: "Jasnosť" } });
  await db.question.update({
    where: { id: fx.questions[3].id },
    data: { topic: "Záťaž", scale: "OVERTIME" },
  });
});

type User = { id: string };
const DAY = 24 * 60 * 60 * 1000;

const trend = (as: User | undefined, teamId: string) =>
  getTrend(request(`/api/teams/${teamId}/trend`, { as }), params({ id: teamId }));
const heatmap = (as: User | undefined) =>
  getHeatmap(request("/api/hr/heatmap", { as }), undefined);

/** Closed round where `count` people all answered `values`. */
async function closedRound(
  team: Fixture["a"],
  values: number[],
  closedDaysAgo: number,
  count = MIN_GROUP_SIZE,
  name = `Kolo pred ${closedDaysAgo} dňami`,
) {
  const round = await createRound(fx, team.team.id, "CLOSED");
  await db.round.update({
    where: { id: round.id },
    data: { name, closedAt: new Date(Date.now() - closedDaysAgo * DAY) },
  });
  const members = [...team.employees, team.manager];
  for (let index = 0; index < count; index++) {
    await db.participation.create({ data: { roundId: round.id, userId: members[index].id } });
    await db.response.create({
      data: {
        roundId: round.id,
        teamId: team.team.id,
        v1: values[0],
        v2: values[1],
        v3: values[2],
        v4: values[3],
        comment: "Komentár, ktorý sa do grafov nesmie dostať",
      },
    });
  }
  return round;
}

describe("team trend [IT-08]", () => {
  it("returns closed rounds oldest first with the fixed score and topic scores", async () => {
    const newer = await closedRound(fx.a, [4, 3, 5, 2], 5);
    const older = await closedRound(fx.a, [2, 2, 2, 4], 30);
    await createRound(fx, fx.a.team.id, "OPEN"); // ignored

    const response = await trend(fx.a.manager, fx.a.team.id);
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.team).toEqual({ id: fx.a.team.id, name: fx.a.team.name });
    expect(body.topics).toEqual(["Jasnosť", "Záťaž"]);
    expect(body.points.map((point: { roundId: string }) => point.roundId)).toEqual([
      older.id,
      newer.id,
    ]);
    // Jasnosť = mean of q2 and q3; Záťaž is reversed: 6 − average.
    expect(body.points[0]).toMatchObject({
      status: "ok",
      responded: MIN_GROUP_SIZE,
      fixed: 2,
      topics: { Jasnosť: 2, Záťaž: 2 },
    });
    expect(body.points[1]).toMatchObject({
      status: "ok",
      fixed: 4,
      topics: { Jasnosť: 4, Záťaž: 4 },
    });
  });

  it("a round below the threshold is a gap without any number [NFR-02]", async () => {
    await closedRound(fx.a, [4, 3, 5, 2], 20);
    const small = await closedRound(fx.a, [1, 1, 1, 5], 5, MIN_GROUP_SIZE - 1);

    const body = await (await trend(fx.a.manager, fx.a.team.id)).json();
    const gap = body.points.find((point: { roundId: string }) => point.roundId === small.id);
    expect(gap).toEqual({
      roundId: small.id,
      roundName: expect.any(String),
      closedAt: expect.any(String),
      responded: MIN_GROUP_SIZE - 1,
      status: "insufficient_responses",
    });
  });

  it("a round without the fixed question has topic scores but no fixed score", async () => {
    await db.question.update({ where: { id: fx.questions[0].id }, data: { fixed: false, topic: "Tím" } });
    await closedRound(fx.a, [4, 3, 5, 2], 5);
    const body = await (await trend(fx.a.manager, fx.a.team.id)).json();
    expect(body.points[0].fixed).toBeNull();
    expect(body.points[0].topics).toMatchObject({ Tím: 4 });
  });

  it("is for the team's manager and HR only [NFR-03]", async () => {
    await closedRound(fx.a, [4, 3, 5, 2], 5);
    expect((await trend(undefined, fx.a.team.id)).status).toBe(401);
    for (const user of [fx.a.employees[0], fx.b.manager, fx.b.employees[0]]) {
      expect((await trend(user, fx.a.team.id)).status).toBe(403);
    }
    expect((await trend(fx.a.manager, fx.a.team.id)).status).toBe(200);
    expect((await trend(fx.hr, fx.a.team.id)).status).toBe(200);
    expect((await trend(fx.a.manager, "no-such-team")).status).toBe(403);
    expect((await trend(fx.hr, "no-such-team")).status).toBe(404);
  });

  it("contains no comments, answers or people [NFR-01]", async () => {
    await closedRound(fx.a, [4, 3, 5, 2], 5);
    const raw = JSON.stringify(await (await trend(fx.hr, fx.a.team.id)).json());
    expect(raw).not.toContain("Komentár");
    expect(raw).not.toContain("distribution");
    for (const user of await db.user.findMany()) {
      expect(raw).not.toContain(user.id);
      expect(raw).not.toContain(user.name);
    }
  });
});

describe("comparison of teams for HR [IT-08]", () => {
  it("averages round scores per team and topic inside the window", async () => {
    await closedRound(fx.a, [4, 3, 5, 2], 5); // fixed 4, Jasnosť 4, Záťaž 4
    await closedRound(fx.a, [2, 2, 2, 4], 30); // fixed 2, Jasnosť 2, Záťaž 2
    await closedRound(fx.b, [5, 5, 5, 1], 10); // fixed 5, Jasnosť 5, Záťaž 5

    const body = await (await heatmap(fx.hr)).json();
    expect(body.windowDays).toBe(HEATMAP_WINDOW_DAYS);
    expect(body.topics).toEqual([FIXED_TOPIC_LABEL, "Jasnosť", "Záťaž"]);

    const teamA = body.teams.find((team: { teamId: string }) => team.teamId === fx.a.team.id);
    const teamB = body.teams.find((team: { teamId: string }) => team.teamId === fx.b.team.id);
    expect(teamA).toMatchObject({
      teamName: fx.a.team.name,
      roundsCounted: 2,
      cells: { [FIXED_TOPIC_LABEL]: 3, Jasnosť: 3, Záťaž: 3 },
    });
    expect(teamB).toMatchObject({
      roundsCounted: 1,
      cells: { [FIXED_TOPIC_LABEL]: 5, Jasnosť: 5, Záťaž: 5 },
    });
  });

  it("ignores rounds below the threshold even inside an average [NFR-02]", async () => {
    await closedRound(fx.a, [5, 5, 5, 1], 5); // counted
    await closedRound(fx.a, [1, 1, 1, 5], 6, MIN_GROUP_SIZE - 1); // must not pull the score down
    await closedRound(fx.b, [1, 1, 1, 5], 6, MIN_GROUP_SIZE - 1); // team with small rounds only

    const body = await (await heatmap(fx.hr)).json();
    const teamA = body.teams.find((team: { teamId: string }) => team.teamId === fx.a.team.id);
    const teamB = body.teams.find((team: { teamId: string }) => team.teamId === fx.b.team.id);
    expect(teamA).toMatchObject({ roundsCounted: 1, cells: { Jasnosť: 5 } });
    expect(teamB).toEqual({
      teamId: fx.b.team.id,
      teamName: fx.b.team.name,
      roundsCounted: 0,
      cells: {},
    });
  });

  it("ignores rounds closed before the window", async () => {
    await closedRound(fx.a, [1, 1, 1, 5], HEATMAP_WINDOW_DAYS + 5);
    await closedRound(fx.a, [4, 4, 4, 2], 10);
    const body = await (await heatmap(fx.hr)).json();
    const teamA = body.teams.find((team: { teamId: string }) => team.teamId === fx.a.team.id);
    expect(teamA).toMatchObject({ roundsCounted: 1, cells: { Jasnosť: 4 } });
  });

  it("is for HR only [NFR-03]", async () => {
    expect((await heatmap(undefined)).status).toBe(401);
    for (const user of [fx.a.employees[0], fx.a.manager, fx.b.manager]) {
      expect((await heatmap(user)).status).toBe(403);
    }
    expect((await heatmap(fx.hr)).status).toBe(200);
  });

  it("contains no comments or people [NFR-01]", async () => {
    await closedRound(fx.a, [4, 3, 5, 2], 5);
    const raw = JSON.stringify(await (await heatmap(fx.hr)).json());
    expect(raw).not.toContain("Komentár");
    for (const user of await db.user.findMany()) {
      expect(raw).not.toContain(user.id);
      expect(raw).not.toContain(user.name);
    }
  });
});
