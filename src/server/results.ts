import { randomInt } from "node:crypto";
import { MIN_GROUP_SIZE } from "@/config/privacy";
import { toScaleKey, type ScaleKey } from "@/config/scales";
import { db } from "@/lib/db";
import { assertCanViewResults, requireRole } from "@/lib/authz";
import { forbidden, notFound } from "@/lib/errors";
import type { SessionUser } from "@/lib/session";
import { closeExpiredRounds, type RoundStatus } from "@/server/rounds";

export type QuestionResult = {
  position: number;
  text: string;
  /** What the five points mean; for some scales a higher value is worse. */
  scale: ScaleKey;
  /** Rounded to two decimals. */
  average: number;
  /** Number of answers with value 1, 2, 3, 4, 5. */
  distribution: [number, number, number, number, number];
};

type RoundHeader = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  status: RoundStatus;
  closesAt: string;
};

export type RoundResults = {
  round: RoundHeader;
  participation: { responded: number; teamSize: number };
} & (
  | { status: "not_closed" }
  | { status: "insufficient_responses"; responseCount: number }
  | { status: "ok"; responseCount: number; questions: QuestionResult[]; comments: string[] }
);

/** Loads a round for a manager or HR; 403 for a foreign team. */
export async function loadRoundForResults(user: SessionUser, roundId: string) {
  requireRole(user, "MANAGER", "HR");
  await closeExpiredRounds();
  const round = await db.round.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      name: true,
      teamId: true,
      status: true,
      closesAt: true,
      team: { select: { name: true, _count: { select: { members: true } } } },
      questions: {
        orderBy: { position: "asc" },
        select: {
          position: true,
          question: { select: { text: true, scale: true, topic: true, fixed: true } },
        },
      },
    },
  });
  // A manager must not learn whether a foreign round exists.
  if (!round) throw user.role === "HR" ? notFound() : forbidden();
  assertCanViewResults(user, round.teamId);
  return round;
}

type ResponseValues = { v1: number; v2: number; v3: number; v4: number | null; v5: number | null };

/** Average and distribution per question. Callers check the threshold first. */
export function computeQuestionResults(
  questions: { position: number; question: { text: string; scale: string } }[],
  responses: ResponseValues[],
): QuestionResult[] {
  return questions.map((item) => {
    const key = `v${item.position}` as keyof ResponseValues;
    const values = responses.map((response) => response[key]).filter((v) => v !== null);
    const distribution: QuestionResult["distribution"] = [0, 0, 0, 0, 0];
    for (const value of values) distribution[value - 1]++;
    const sum = values.reduce((total, value) => total + value, 0);
    return {
      position: item.position,
      text: item.question.text,
      scale: toScaleKey(item.question.scale),
      average: values.length ? Math.round((sum / values.length) * 100) / 100 : 0,
      distribution,
    };
  });
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/**
 * GET /api/rounds/:id/results (MVP-10, MVP-11, NFR-02).
 *
 * - Not closed yet: participation only.
 * - Closed with fewer than MIN_GROUP_SIZE responses: `insufficient_responses`
 *   and the count. No averages, no distribution, no comments.
 * - Otherwise: average and distribution per question, comments in random order.
 *
 * NFR-01: nothing here can carry an author — the Response table has none.
 */
export async function getRoundResults(user: SessionUser, roundId: string): Promise<RoundResults> {
  const round = await loadRoundForResults(user, roundId);
  const responseCount = await db.response.count({ where: { roundId: round.id } });

  const base = {
    round: {
      id: round.id,
      name: round.name,
      teamId: round.teamId,
      teamName: round.team.name,
      status: round.status as RoundStatus,
      closesAt: round.closesAt.toISOString(),
    },
    participation: { responded: responseCount, teamSize: round.team._count.members },
  };

  if (round.status !== "CLOSED") return { ...base, status: "not_closed" };

  if (responseCount < MIN_GROUP_SIZE) {
    return { ...base, status: "insufficient_responses", responseCount };
  }

  const responses = await db.response.findMany({
    where: { roundId: round.id },
    select: { v1: true, v2: true, v3: true, v4: true, v5: true, comment: true },
  });

  const questions = computeQuestionResults(round.questions, responses);

  const comments = shuffle(
    responses.map((response) => response.comment).filter((c): c is string => c !== null),
  );

  return { ...base, status: "ok", responseCount, questions, comments };
}
