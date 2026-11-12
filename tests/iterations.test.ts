import { beforeEach, describe, expect, it } from "vitest";
import { GET as getOverview } from "@/app/api/hr/overview/route";
import { GET as getQuestions } from "@/app/api/questions/route";
import { POST as closeRoute } from "@/app/api/rounds/[id]/close/route";
import { GET as getResults } from "@/app/api/rounds/[id]/results/route";
import { GET as getRound } from "@/app/api/rounds/[id]/route";
import { GET as getRounds, POST as postRound } from "@/app/api/rounds/route";
import { db } from "@/lib/db";
import { createRound, dateInDays, params, request, resetDb, type Fixture } from "./helpers";

// Requirements from docs/requirements/iteracie.md.

let fx: Fixture;
beforeEach(async () => {
  fx = await resetDb();
});

type User = { id: string };
const DAY = 24 * 60 * 60 * 1000;

const addFixedQuestion = () =>
  db.question.create({
    data: { text: "Stála testovacia otázka", topic: "Stála otázka", scale: "QUALITY", fixed: true },
  });

function create(as: User, pickedIds: string[]) {
  return postRound(
    request("/api/rounds", {
      method: "POST",
      as,
      body: { name: "Pulse", teamId: fx.a.team.id, closesAt: dateInDays(7), questionIds: pickedIds },
    }),
    undefined,
  );
}

const picked = (count: number) => fx.questions.slice(0, count).map((question) => question.id);

async function roundQuestions(roundId: string) {
  const rows = await db.roundQuestion.findMany({
    where: { roundId },
    orderBy: { position: "asc" },
    select: { questionId: true, position: true },
  });
  return rows;
}

describe("fixed trend question in every round [IT-04]", () => {
  it("is added automatically as the first question", async () => {
    const fixed = await addFixedQuestion();
    const response = await create(fx.hr, picked(3));
    expect(response.status).toBe(201);

    const rows = await roundQuestions((await response.json()).round.id);
    expect(rows.map((row) => row.questionId)).toEqual([fixed.id, ...picked(3)]);
    expect(rows.map((row) => row.position)).toEqual([1, 2, 3, 4]);
  });

  it("counts towards the 3–5 limit of the whole round [MVP-04]", async () => {
    await addFixedQuestion();
    const tooFew = await create(fx.hr, picked(1)); // 1 fixed + 1 = 2
    expect(tooFew.status).toBe(400);
    expect((await tooFew.json()).fields.questionIds).toBe("too_few");

    expect((await create(fx.hr, picked(2))).status).toBe(201); // 3 in total
    expect((await create(fx.hr, picked(4))).status).toBe(201); // 5 in total

    const tooMany = await create(fx.hr, picked(5)); // 6 in total
    expect(tooMany.status).toBe(400);
    expect((await tooMany.json()).fields.questionIds).toBe("too_many");
  });

  it("is not duplicated when the client sends it too", async () => {
    const fixed = await addFixedQuestion();
    const response = await create(fx.hr, [fixed.id, ...picked(2)]);
    expect(response.status).toBe(201);
    const rows = await roundQuestions((await response.json()).round.id);
    expect(rows.map((row) => row.questionId)).toEqual([fixed.id, ...picked(2)]);
  });

  it("without a fixed question in the library a round works as in the MVP", async () => {
    const response = await create(fx.hr, picked(3));
    expect(response.status).toBe(201);
    expect(await roundQuestions((await response.json()).round.id)).toHaveLength(3);
  });
});

describe("question library flags and scales [IT-03]", () => {
  it("lists the fixed question first and exposes starter, fixed and scale", async () => {
    const fixed = await addFixedQuestion();
    await db.question.update({ where: { id: fx.questions[0].id }, data: { starter: true } });
    await db.question.update({ where: { id: fx.questions[1].id }, data: { scale: "OVERTIME" } });

    const response = await getQuestions(request("/api/questions", { as: fx.hr }), undefined);
    const questions = (await response.json()).questions as Array<Record<string, unknown>>;

    expect(questions[0]).toMatchObject({ id: fixed.id, fixed: true, scale: "QUALITY" });
    const byId = new Map(questions.map((question) => [question.id, question]));
    expect(byId.get(fx.questions[0].id)).toMatchObject({ starter: true, fixed: false });
    expect(byId.get(fx.questions[1].id)).toMatchObject({ scale: "OVERTIME", starter: false });
    expect(byId.get(fx.questions[2].id)).toMatchObject({ scale: "AGREEMENT" });
  });

  it("an unknown scale in the database falls back to agreement", async () => {
    await db.question.update({ where: { id: fx.questions[0].id }, data: { scale: "BOGUS" } });
    const response = await getQuestions(request("/api/questions", { as: fx.hr }), undefined);
    const question = (await response.json()).questions.find(
      (item: { id: string }) => item.id === fx.questions[0].id,
    );
    expect(question.scale).toBe("AGREEMENT");
  });

  it("the scale travels with the question to the fill-in form and to the results", async () => {
    await db.question.update({ where: { id: fx.questions[1].id }, data: { scale: "FREQUENCY" } });
    const round = await createRound(fx, fx.a.team.id, "OPEN");

    const fill = await getRound(
      request(`/api/rounds/${round.id}`, { as: fx.a.employees[0] }),
      params({ id: round.id }),
    );
    expect((await fill.json()).round.questions.map((q: { scale: string }) => q.scale)).toEqual([
      "AGREEMENT",
      "FREQUENCY",
      "AGREEMENT",
      "AGREEMENT",
    ]);

    for (const member of [...fx.a.employees]) {
      await db.participation.create({ data: { roundId: round.id, userId: member.id } });
      await db.response.create({
        data: { roundId: round.id, teamId: fx.a.team.id, v1: 4, v2: 2, v3: 3, v4: 5 },
      });
    }
    await db.round.update({ where: { id: round.id }, data: { status: "CLOSED" } });
    const results = await getResults(
      request(`/api/rounds/${round.id}/results`, { as: fx.a.manager }),
      params({ id: round.id }),
    );
    const body = await results.json();
    expect(body.questions[1]).toMatchObject({ scale: "FREQUENCY", average: 2 });
  });
});

describe("time of closing a round [IT-05]", () => {
  it("a manual close records the moment of closing", async () => {
    const round = await createRound(fx, fx.a.team.id, "OPEN");
    const before = Date.now();
    await closeRoute(
      request(`/api/rounds/${round.id}/close`, { method: "POST", as: fx.a.manager }),
      params({ id: round.id }),
    );
    const closedAt = (await db.round.findUniqueOrThrow({ where: { id: round.id } })).closedAt;
    expect(closedAt).toBeInstanceOf(Date);
    expect(closedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(closedAt!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("an automatic close records the deadline, not the moment of the first load", async () => {
    const round = await createRound(fx, fx.a.team.id, "OPEN");
    const deadline = new Date(Date.now() - 3 * DAY);
    await db.round.update({ where: { id: round.id }, data: { closesAt: deadline } });

    await getRounds(request("/api/rounds", { as: fx.a.manager }), undefined);
    const stored = await db.round.findUniqueOrThrow({ where: { id: round.id } });
    expect(stored.status).toBe("CLOSED");
    expect(stored.closedAt?.getTime()).toBe(deadline.getTime());
  });
});

describe("HR overview of reaction to results [IT-05]", () => {
  const overview = (as: User | undefined) =>
    getOverview(request("/api/hr/overview", { as }), undefined);

  async function closedRound(teamId: string, closedDaysAgo: number, name = "Kolo") {
    const round = await createRound(fx, teamId, "CLOSED");
    return db.round.update({
      where: { id: round.id },
      data: { name, closedAt: new Date(Date.now() - closedDaysAgo * DAY) },
    });
  }

  const addAction = (
    roundId: string,
    createdDaysAgo: number,
    status = "PLANNED",
    dueInDays = 7,
  ) =>
    db.action.create({
      data: {
        roundId,
        topic: "Téma",
        description: "Opis",
        status,
        dueDate: new Date(Date.now() + dueInDays * DAY),
        createdAt: new Date(Date.now() - createdDaysAgo * DAY),
      },
    });

  it("is available to HR only [NFR-03]", async () => {
    expect((await overview(undefined)).status).toBe(401);
    for (const user of [fx.a.employees[0], fx.a.manager, fx.b.manager]) {
      expect((await overview(user)).status).toBe(403);
    }
    expect((await overview(fx.hr)).status).toBe(200);
  });

  it("returns zeros and nulls when nothing is closed", async () => {
    await createRound(fx, fx.a.team.id, "OPEN");
    const body = await (await overview(fx.hr)).json();
    expect(body.total).toMatchObject({
      closedRounds: 0,
      roundsWithAction: 0,
      sharePercent: null,
      medianDaysToFirstAction: null,
    });
    expect(body.teams).toHaveLength(2);
  });

  it("computes share, reaction time, action states and waiting rounds per team", async () => {
    // Team A: three closed rounds. First action after 2, 4 days; third has none.
    const first = await closedRound(fx.a.team.id, 10, "Prvé");
    await addAction(first.id, 8, "DONE"); // 2 days after closing
    await addAction(first.id, 1, "PLANNED"); // later actions do not count
    const second = await closedRound(fx.a.team.id, 6, "Druhé");
    await addAction(second.id, 2, "IN_PROGRESS", -1); // 4 days after closing, overdue
    await closedRound(fx.a.team.id, 5, "Tretie bez kroku");
    // Team B: one closed round without an action, plus an open one that is ignored.
    await closedRound(fx.b.team.id, 9, "Beta bez kroku");
    await createRound(fx, fx.b.team.id, "OPEN");

    const body = await (await overview(fx.hr)).json();
    const teamA = body.teams.find((team: { teamId: string }) => team.teamId === fx.a.team.id);
    const teamB = body.teams.find((team: { teamId: string }) => team.teamId === fx.b.team.id);

    expect(teamA).toMatchObject({
      teamName: fx.a.team.name,
      closedRounds: 3,
      roundsWithAction: 2,
      sharePercent: 67,
      medianDaysToFirstAction: 3,
      actions: { planned: 1, inProgress: 1, done: 1, overdue: 1 },
    });
    expect(teamA.awaitingRounds).toEqual([
      { id: expect.any(String), name: "Tretie bez kroku", daysWaiting: 5 },
    ]);

    expect(teamB).toMatchObject({
      closedRounds: 1,
      roundsWithAction: 0,
      sharePercent: 0,
      medianDaysToFirstAction: null,
    });
    expect(teamB.awaitingRounds[0]).toMatchObject({ name: "Beta bez kroku", daysWaiting: 9 });

    expect(body.total).toMatchObject({
      closedRounds: 4,
      roundsWithAction: 2,
      sharePercent: 50,
      medianDaysToFirstAction: 3,
    });
  });

  it("a finished action past its due date is not overdue", async () => {
    const round = await closedRound(fx.a.team.id, 10);
    await addAction(round.id, 9, "DONE", -3);
    const body = await (await overview(fx.hr)).json();
    expect(body.total.actions).toEqual({ planned: 0, inProgress: 0, done: 1, overdue: 0 });
  });

  it("contains nothing about responses or people [NFR-01]", async () => {
    const round = await closedRound(fx.a.team.id, 3);
    await db.participation.create({ data: { roundId: round.id, userId: fx.a.employees[0].id } });
    await db.response.create({
      data: { roundId: round.id, teamId: fx.a.team.id, v1: 1, v2: 1, v3: 1, comment: "Tajné" },
    });
    const raw = JSON.stringify(await (await overview(fx.hr)).json());
    expect(raw).not.toContain("Tajné");
    for (const user of await db.user.findMany()) {
      expect(raw).not.toContain(user.id);
      expect(raw).not.toContain(user.name);
    }
  });
});
