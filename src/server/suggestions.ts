import { MIN_GROUP_SIZE } from "@/config/privacy";
import { SCALES, toScaleKey } from "@/config/scales";
import { FALLBACK_SUGGESTIONS, SUGGESTIONS } from "@/config/suggestions";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";
import { computeQuestionResults, loadRoundForResults } from "@/server/results";

// IT-09: two suggested actions for the manager after a round.
//
// What a provider is given is deliberately narrow: question texts, topics and
// averages of one round that is already above the confidentiality threshold.
// It never receives comments, individual answers or anything about people.
// The same input type is the contract for a future AI provider.

export const SUGGESTION_COUNT = 2;

export type SuggestionInput = {
  questions: {
    text: string;
    topic: string;
    average: number;
    /** 1–5 where higher is always better (reversed scales are flipped). */
    favourability: number;
  }[];
};

export type Suggestion = {
  topic: string;
  /** The question the suggestion reacts to, with its average. */
  questionText: string;
  average: number;
  suggestion: string;
};

export interface SuggestionProvider {
  /** Shown in the UI so that nobody mistakes rules for AI. */
  readonly kind: "rules" | "ai";
  suggest(input: SuggestionInput): Promise<Suggestion[]>;
}

/**
 * Rule-based provider: the two weakest questions, from different topics when
 * possible, each paired with a prepared action for its topic. Deterministic —
 * the same results always give the same suggestions.
 */
export const ruleBasedProvider: SuggestionProvider = {
  kind: "rules",
  async suggest({ questions }) {
    const weakestFirst = [...questions].sort(
      (a, b) => a.favourability - b.favourability || a.text.localeCompare(b.text, "sk"),
    );

    const chosen: typeof weakestFirst = [];
    for (const question of weakestFirst) {
      if (chosen.length === SUGGESTION_COUNT) break;
      if (!chosen.some((item) => item.topic === question.topic)) chosen.push(question);
    }
    // Fewer topics than suggestions: fill up with the next weakest questions.
    for (const question of weakestFirst) {
      if (chosen.length === SUGGESTION_COUNT) break;
      if (!chosen.includes(question)) chosen.push(question);
    }

    const usedPerTopic = new Map<string, number>();
    return chosen.map((question) => {
      const pool = SUGGESTIONS[question.topic] ?? FALLBACK_SUGGESTIONS;
      const index = usedPerTopic.get(question.topic) ?? 0;
      usedPerTopic.set(question.topic, index + 1);
      return {
        topic: question.topic,
        questionText: question.text,
        average: question.average,
        suggestion: pool[index % pool.length],
      };
    });
  },
};

/** The only place that decides which provider is used. AI is not wired in. */
export function getSuggestionProvider(): SuggestionProvider {
  return ruleBasedProvider;
}

export type RoundSuggestions =
  | { status: "not_closed" }
  | { status: "insufficient_responses"; responseCount: number }
  | { status: "ok"; provider: SuggestionProvider["kind"]; suggestions: Suggestion[] };

/**
 * GET /api/rounds/:id/suggestions — manager of the team and HR, same rule as
 * results. Nothing is suggested for an open round or below the threshold.
 */
export async function getRoundSuggestions(
  user: SessionUser,
  roundId: string,
): Promise<RoundSuggestions> {
  const round = await loadRoundForResults(user, roundId);
  if (round.status !== "CLOSED") return { status: "not_closed" };

  const responses = await db.response.findMany({
    where: { roundId: round.id },
    // Values only. Comments are never read here.
    select: { v1: true, v2: true, v3: true, v4: true, v5: true },
  });
  if (responses.length < MIN_GROUP_SIZE) {
    return { status: "insufficient_responses", responseCount: responses.length };
  }

  const results = computeQuestionResults(round.questions, responses);
  const questions = round.questions
    .map((item, index) => ({ item, result: results[index] }))
    // The fixed trend question says how things are, not what to change.
    .filter(({ item }) => !item.question.fixed)
    .map(({ item, result }) => ({
      text: item.question.text,
      topic: item.question.topic,
      average: result.average,
      favourability: SCALES[toScaleKey(item.question.scale)].higherIsBetter
        ? result.average
        : 6 - result.average,
    }));

  const provider = getSuggestionProvider();
  return { status: "ok", provider: provider.kind, suggestions: await provider.suggest({ questions }) };
}
