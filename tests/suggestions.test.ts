import { beforeEach, describe, expect, it } from "vitest";
import { GET as getSuggestions } from "@/app/api/rounds/[id]/suggestions/route";
import { MIN_GROUP_SIZE } from "@/config/privacy";
import { FALLBACK_SUGGESTIONS, SUGGESTIONS } from "@/config/suggestions";
import { db } from "@/lib/db";
import { ruleBasedProvider, SUGGESTION_COUNT } from "@/server/suggestions";
import { createRound, params, request, resetDb, type Fixture } from "./helpers";

// IT-09: two suggested actions for the manager, by rules, never from comments.

let fx: Fixture;
beforeEach(async () => {
  fx = await resetDb();
});

type User = { id: string };

const suggestions = (as: User | undefined, id: string) =>
  getSuggestions(request(`/api/rounds/${id}/suggestions`, { as }), params({ id }));

/** Closed round of team A where every one of `count` people gave `values`. */
async function closedRound(values: number[], count = MIN_GROUP_SIZE, comment?: string) {
  const round = await createRound(fx, fx.a.team.id, "CLOSED", values.length);
  const members = [...fx.a.employees, fx.a.manager];
  for (let index = 0; index < count; index++) {
    await db.participation.create({ data: { roundId: round.id, userId: members[index].id } });
    await db.response.create({
      data: {
        roundId: round.id,
        teamId: fx.a.team.id,
        v1: values[0],
        v2: values[1],
        v3: values[2],
        v4: values[3] ?? null,
        v5: values[4] ?? null,
        comment,
      },
    });
  }
  return round;
}

const setQuestion = (index: number, data: { topic?: string; scale?: string; fixed?: boolean }) =>
  db.question.update({ where: { id: fx.questions[index].id }, data });

describe("suggested actions [IT-09]", () => {
  it("suggests an action for the two weakest questions from different topics", async () => {
    await setQuestion(0, { topic: "Záťaž a energia" });
    await setQuestion(1, { topic: "Záťaž a energia" });
    await setQuestion(2, { topic: "Jasnosť a priority" });
    await setQuestion(3, { topic: "Tím a psychologické bezpečie" });
    // Averages: q1 = 2, q2 = 1 (weakest), q3 = 3, q4 = 5.
    const round = await closedRound([2, 1, 3, 5]);

    const response = await suggestions(fx.a.manager, round.id);
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.provider).toBe("rules");
    expect(body.suggestions).toHaveLength(SUGGESTION_COUNT);
    // q2 is the weakest; q1 shares its topic, so the second one is q3.
    expect(body.suggestions[0]).toEqual({
      topic: "Záťaž a energia",
      questionText: fx.questions[1].text,
      average: 1,
      suggestion: SUGGESTIONS["Záťaž a energia"][0],
    });
    expect(body.suggestions[1]).toMatchObject({
      topic: "Jasnosť a priority",
      questionText: fx.questions[2].text,
      average: 3,
      suggestion: SUGGESTIONS["Jasnosť a priority"][0],
    });
  });

  it("gives the same suggestions every time", async () => {
    const round = await closedRound([2, 1, 3, 5]);
    const first = await (await suggestions(fx.a.manager, round.id)).json();
    const second = await (await suggestions(fx.hr, round.id)).json();
    expect(second).toEqual(first);
  });

  it("treats a high value as bad on scales where lower is better", async () => {
    await setQuestion(0, { topic: "Záťaž a energia", scale: "OVERTIME" });
    await setQuestion(1, { topic: "Jasnosť a priority" });
    await setQuestion(2, { topic: "Tím a psychologické bezpečie" });
    await setQuestion(3, { topic: "Rast, uznanie a silné stránky" });
    // q1 = 5 on a reversed scale → favourability 1, the weakest of all.
    const round = await closedRound([5, 3, 4, 4]);
    const body = await (await suggestions(fx.a.manager, round.id)).json();
    expect(body.suggestions[0]).toMatchObject({
      questionText: fx.questions[0].text,
      average: 5,
      topic: "Záťaž a energia",
    });
    expect(body.suggestions[1].questionText).toBe(fx.questions[1].text);
  });

  it("never reacts to the fixed trend question", async () => {
    await setQuestion(0, { fixed: true, topic: "Stála otázka" });
    await setQuestion(1, { topic: "Jasnosť a priority" });
    await setQuestion(2, { topic: "Tím a psychologické bezpečie" });
    await setQuestion(3, { topic: "Rast, uznanie a silné stránky" });
    const round = await closedRound([1, 4, 3, 5]); // the fixed one is the lowest
    const body = await (await suggestions(fx.a.manager, round.id)).json();
    const texts = body.suggestions.map((item: { questionText: string }) => item.questionText);
    expect(texts).toEqual([fx.questions[2].text, fx.questions[1].text]);
  });

  it("uses a generic suggestion for a topic without its own library, e.g. own questions", async () => {
    // The fixture questions all have the topic "Test".
    const round = await closedRound([2, 3, 4, 5]);
    const body = await (await suggestions(fx.a.manager, round.id)).json();
    // One topic only: both suggestions come from it and differ from each other.
    expect(body.suggestions.map((item: { suggestion: string }) => item.suggestion)).toEqual([
      FALLBACK_SUGGESTIONS[0],
      FALLBACK_SUGGESTIONS[1],
    ]);
  });

  it("returns nothing below the confidentiality threshold [NFR-02]", async () => {
    const round = await closedRound([1, 1, 1, 1], MIN_GROUP_SIZE - 1);
    const body = await (await suggestions(fx.a.manager, round.id)).json();
    expect(body).toEqual({ status: "insufficient_responses", responseCount: MIN_GROUP_SIZE - 1 });
  });

  it("returns nothing for an open round", async () => {
    const round = await createRound(fx, fx.a.team.id, "OPEN");
    expect(await (await suggestions(fx.a.manager, round.id)).json()).toEqual({
      status: "not_closed",
    });
  });

  it("never contains or depends on comments [NFR-01]", async () => {
    const withComment = await closedRound([2, 1, 3, 5], MIN_GROUP_SIZE, "Tajný komentár o porade");
    const body = await (await suggestions(fx.a.manager, withComment.id)).json();
    expect(JSON.stringify(body)).not.toContain("Tajný komentár");

    // The same answers without comments give exactly the same suggestions.
    const withoutComment = await closedRound([2, 1, 3, 5]);
    const other = await (await suggestions(fx.a.manager, withoutComment.id)).json();
    expect(other).toEqual(body);
  });

  it("is limited to the manager of the team and HR [NFR-03]", async () => {
    const round = await closedRound([2, 1, 3, 5]);
    expect((await suggestions(undefined, round.id)).status).toBe(401);
    for (const user of [fx.a.employees[0], fx.b.manager, fx.b.employees[0]]) {
      expect((await suggestions(user, round.id)).status).toBe(403);
    }
    expect((await suggestions(fx.a.manager, round.id)).status).toBe(200);
    expect((await suggestions(fx.hr, round.id)).status).toBe(200);
  });
});

describe("suggestion library [IT-09]", () => {
  it("has at least two suggestions for every topic and for the fallback", () => {
    for (const [topic, items] of Object.entries(SUGGESTIONS)) {
      expect(items.length, topic).toBeGreaterThanOrEqual(2);
      expect(new Set(items).size, topic).toBe(items.length);
    }
    expect(FALLBACK_SUGGESTIONS.length).toBeGreaterThanOrEqual(2);
  });

  it("the rule-based provider declares itself as rules, not AI", () => {
    expect(ruleBasedProvider.kind).toBe("rules");
  });

  it("covers every topic of the seeded question library", async () => {
    const { readFileSync } = await import("node:fs");
    const seed = readFileSync("prisma/seed.ts", "utf8");
    const block = seed.slice(seed.indexOf("const QUESTIONS"), seed.indexOf("// Invented people."));
    const topics = [...block.matchAll(/^ {2}"([^"]+)": \[/gm)].map((match) => match[1]);
    expect(topics.length).toBeGreaterThanOrEqual(8);
    for (const topic of topics) {
      expect(SUGGESTIONS[topic], topic).toBeDefined();
    }
  });
});
