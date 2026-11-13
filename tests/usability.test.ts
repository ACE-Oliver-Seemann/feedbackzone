import { beforeEach, describe, expect, it } from "vitest";
import { GET as getIssues } from "@/app/api/hr/issues/route";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";
import { getHomeTasks, MAX_TASKS, QUIET_DAYS } from "@/server/home";
import { summarizeResults, type QuestionResult } from "@/server/results";
import { DEFAULT_PICKED_QUESTIONS, suggestRoundQuestions } from "@/server/rounds";
import { createRound, request, resetDb, type Fixture } from "./helpers";

// IT-11 (home tasks) and IT-13 (essentials first).

let fx: Fixture;
beforeEach(async () => {
  fx = await resetDb();
});

const DAY = 24 * 60 * 60 * 1000;
const asUser = (user: { id: string; name: string; role: string; teamId: string | null }) =>
  ({ id: user.id, name: user.name, role: user.role, teamId: user.teamId }) as SessionUser;

async function closedRound(teamId: string, closedDaysAgo: number, name: string) {
  const round = await createRound(fx, teamId, "CLOSED");
  return db.round.update({
    where: { id: round.id },
    data: { name, closedAt: new Date(Date.now() - closedDaysAgo * DAY) },
  });
}
const addAction = (roundId: string, dueInDays: number, status = "PLANNED") =>
  db.action.create({
    data: {
      roundId,
      topic: "Téma",
      description: "Opis",
      status,
      dueDate: new Date(Date.now() + dueInDays * DAY),
    },
  });

describe("home tasks for an employee [IT-11]", () => {
  it("shows an open survey of the own team until it is filled in", async () => {
    const employee = fx.a.employees[0];
    const round = await createRound(fx, fx.a.team.id, "OPEN");
    await createRound(fx, fx.b.team.id, "OPEN"); // another team: never shown
    await createRound(fx, fx.a.team.id, "DRAFT"); // not started: never shown

    expect(await getHomeTasks(asUser(employee))).toEqual([
      { kind: "fill_survey", href: `/rounds/${round.id}/fill`, roundName: round.name, questionCount: 4 },
    ]);

    await db.participation.create({ data: { roundId: round.id, userId: employee.id } });
    expect(await getHomeTasks(asUser(employee))).toEqual([]);
    // A colleague still has it.
    expect(await getHomeTasks(asUser(fx.a.employees[1]))).toHaveLength(1);
  });
});

describe("home tasks for a manager [IT-11]", () => {
  it("puts a closed round without an action first, then overdue actions, then the own survey", async () => {
    const manager = asUser(fx.a.manager);
    const waiting = await closedRound(fx.a.team.id, 6, "Čaká na krok");
    const handled = await closedRound(fx.a.team.id, 20, "Má krok");
    await addAction(handled.id, -2); // overdue
    await addAction(handled.id, -5, "DONE"); // done: not overdue
    const open = await createRound(fx, fx.a.team.id, "OPEN");

    expect(await getHomeTasks(manager)).toEqual([
      {
        kind: "round_awaiting_action",
        href: `/rounds/${waiting.id}/results`,
        roundName: "Čaká na krok",
        daysWaiting: 6,
      },
      { kind: "actions_overdue", href: `/rounds/${handled.id}/results`, count: 1 },
      { kind: "fill_survey", href: `/rounds/${open.id}/fill`, roundName: open.name, questionCount: 4 },
    ]);
  });

  it("suggests starting a round when the team never had one or has been quiet", async () => {
    const manager = asUser(fx.a.manager);
    expect(await getHomeTasks(manager)).toEqual([
      { kind: "start_round", href: "/rounds/new", daysSinceLast: null },
    ]);

    const old = await closedRound(fx.a.team.id, QUIET_DAYS + 3, "Staré");
    await addAction(old.id, 10);
    expect(await getHomeTasks(manager)).toEqual([
      { kind: "start_round", href: "/rounds/new", daysSinceLast: QUIET_DAYS + 3 },
    ]);

    // A draft or an open round means something is already under way.
    await createRound(fx, fx.a.team.id, "DRAFT");
    expect(await getHomeTasks(manager)).toEqual([]);
  });

  it("never shows anything about another team [NFR-03]", async () => {
    await closedRound(fx.b.team.id, 6, "Kolo tímu B");
    await createRound(fx, fx.b.team.id, "OPEN");
    const tasks = await getHomeTasks(asUser(fx.a.manager));
    expect(JSON.stringify(tasks)).not.toContain("Kolo tímu B");
    expect(tasks.map((task) => task.kind)).toEqual(["start_round"]);
  });

  it("returns at most three tasks", async () => {
    for (let index = 0; index < 5; index++) {
      await closedRound(fx.a.team.id, index + 1, `Kolo ${index}`);
    }
    expect(await getHomeTasks(asUser(fx.a.manager))).toHaveLength(MAX_TASKS);
  });
});

describe("home tasks for HR [IT-11]", () => {
  it("summarises rounds awaiting an action, overdue issues and low participation", async () => {
    await closedRound(fx.a.team.id, 3, "A čaká");
    await closedRound(fx.b.team.id, 12, "B čaká najdlhšie");
    const done = await closedRound(fx.a.team.id, 30, "A vybavené");
    await addAction(done.id, 5);

    await db.issue.create({
      data: {
        title: "Po termíne",
        source: "OTHER",
        ownerGroup: "FACILITY",
        dueDate: new Date(Date.now() - 2 * DAY),
        createdById: fx.hr.id,
      },
    });
    await db.issue.create({
      data: {
        title: "Hotový po termíne",
        source: "OTHER",
        ownerGroup: "FACILITY",
        status: "DONE",
        dueDate: new Date(Date.now() - 2 * DAY),
        createdById: fx.hr.id,
      },
    });

    const closing = await createRound(fx, fx.a.team.id, "OPEN");
    await db.round.update({
      where: { id: closing.id },
      data: { name: "Končí zajtra", closesAt: new Date(Date.now() + 1 * DAY) },
    });
    await db.participation.create({ data: { roundId: closing.id, userId: fx.a.employees[0].id } });

    expect(await getHomeTasks(asUser(fx.hr))).toEqual([
      {
        kind: "rounds_awaiting_action",
        href: "/hr/overview",
        count: 2,
        longestTeam: fx.b.team.name,
        longestDays: 12,
      },
      { kind: "issues_overdue", href: "/hr/issues", count: 1 },
      {
        kind: "low_participation",
        href: `/rounds/${closing.id}/results`,
        roundName: "Končí zajtra",
        teamName: fx.a.team.name,
        responded: 1,
        teamSize: 6,
        daysLeft: 1,
      },
    ]);
  });

  it("is empty when everything is handled", async () => {
    expect(await getHomeTasks(asUser(fx.hr))).toEqual([]);
  });

  it("carries nothing from responses [NFR-01]", async () => {
    const round = await closedRound(fx.a.team.id, 3, "Kolo");
    await db.participation.create({ data: { roundId: round.id, userId: fx.a.employees[0].id } });
    await db.response.create({
      data: { roundId: round.id, teamId: fx.a.team.id, v1: 1, v2: 1, v3: 1, comment: "Tajný komentár" },
    });
    for (const user of [fx.hr, fx.a.manager, fx.a.employees[0]]) {
      const raw = JSON.stringify(await getHomeTasks(asUser(user)));
      expect(raw).not.toContain("Tajný komentár");
      expect(raw).not.toContain(fx.a.employees[0].id);
    }
  });
});

describe("summary of results [IT-13]", () => {
  const question = (position: number, average: number, scale: QuestionResult["scale"] = "AGREEMENT") =>
    ({ position, text: `Otázka ${position}`, scale, average, distribution: [0, 0, 0, 0, 0] }) as QuestionResult;

  it("names the best and the worst rated question", () => {
    const summary = summarizeResults([question(1, 3.2), question(2, 4.6), question(3, 2.1)]);
    expect(summary?.strongest.position).toBe(2);
    expect(summary?.weakest.position).toBe(3);
  });

  it("treats a high average on a reversed scale as bad", () => {
    // Overtime 4.5 ("almost daily") is the worst result even though it is the highest number.
    const summary = summarizeResults([question(1, 3.0), question(2, 4.5, "OVERTIME"), question(3, 3.5)]);
    expect(summary?.weakest.position).toBe(2);
    expect(summary?.strongest.position).toBe(3);
  });

  it("returns null when there is nothing to compare", () => {
    expect(summarizeResults([question(1, 3)])).toBeNull();
    expect(summarizeResults([])).toBeNull();
  });
});

describe("preselected questions for a new round [IT-13]", () => {
  /** Marks fixture questions as recommended, two per topic. */
  async function starters() {
    const topics = ["Záťaž", "Záťaž", "Tím", "Tím", "Rast", "Rast"];
    for (const [index, topic] of topics.entries()) {
      await db.question.update({
        where: { id: fx.questions[index].id },
        data: { starter: true, topic },
      });
    }
  }
  const topicsOf = async (ids: string[]) =>
    (await db.question.findMany({ where: { id: { in: ids } }, select: { topic: true } }))
      .map((item) => item.topic)
      .sort();

  it("picks three recommended questions from different topics", async () => {
    await starters();
    const ids = await suggestRoundQuestions(asUser(fx.a.manager), fx.a.team.id);
    expect(ids).toHaveLength(DEFAULT_PICKED_QUESTIONS);
    expect(await topicsOf(ids)).toEqual(["Rast", "Tím", "Záťaž"]);
  });

  it("rotates: questions the team just had are not offered again", async () => {
    await starters();
    const first = await suggestRoundQuestions(asUser(fx.a.manager), fx.a.team.id);
    await db.round.create({
      data: {
        teamId: fx.a.team.id,
        name: "Minulé kolo",
        status: "CLOSED",
        closesAt: new Date(Date.now() - DAY),
        questions: { create: first.map((questionId, index) => ({ questionId, position: index + 1 })) },
      },
    });

    const second = await suggestRoundQuestions(asUser(fx.a.manager), fx.a.team.id);
    expect(second).toHaveLength(DEFAULT_PICKED_QUESTIONS);
    expect(second.filter((id) => first.includes(id))).toEqual([]);
    // Another team is not affected by what team A was asked.
    expect(await suggestRoundQuestions(asUser(fx.b.manager), fx.b.team.id)).toEqual(first);
  });

  it("never offers a fixed, a non-recommended or another team's own question", async () => {
    await starters();
    await db.question.update({ where: { id: fx.questions[0].id }, data: { fixed: true } });
    await db.question.create({
      data: { text: "Vlastná otázka tímu B", topic: "Vlastné", starter: true, teamId: fx.b.team.id },
    });
    const ids = await suggestRoundQuestions(asUser(fx.a.manager), fx.a.team.id);
    const picked = await db.question.findMany({ where: { id: { in: ids } } });
    expect(picked.every((item) => item.starter && !item.fixed && item.teamId === null)).toBe(true);
  });

  it("returns fewer when the library has fewer recommended questions", async () => {
    await db.question.update({ where: { id: fx.questions[0].id }, data: { starter: true } });
    expect(await suggestRoundQuestions(asUser(fx.hr), fx.a.team.id)).toEqual([fx.questions[0].id]);
  });

  it("is limited to the manager of the team and HR [NFR-03]", async () => {
    await starters();
    await expect(suggestRoundQuestions(asUser(fx.b.manager), fx.a.team.id)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      suggestRoundQuestions(asUser(fx.a.employees[0]), fx.a.team.id),
    ).rejects.toMatchObject({ status: 403 });
    await expect(suggestRoundQuestions(asUser(fx.hr), fx.b.team.id)).resolves.toHaveLength(3);
  });
});

describe("issues filter 'not done yet' [IT-13]", () => {
  it("returns open and in-progress issues only", async () => {
    for (const [title, status] of [
      ["Otvorený", "OPEN"],
      ["Rieši sa", "IN_PROGRESS"],
      ["Hotový", "DONE"],
    ]) {
      await db.issue.create({
        data: { title, status, source: "OTHER", ownerGroup: "OTHER", createdById: fx.hr.id },
      });
    }
    const titles = async (query: string) =>
      (
        await (await getIssues(request(`/api/hr/issues${query}`, { as: fx.hr }), undefined)).json()
      ).issues
        .map((issue: { title: string }) => issue.title)
        .sort();

    expect(await titles("?status=ACTIVE")).toEqual(["Otvorený", "Rieši sa"]);
    expect(await titles("?status=ALL")).toEqual(["Hotový", "Otvorený", "Rieši sa"]);
    expect(await titles("")).toHaveLength(3);
  });
});
