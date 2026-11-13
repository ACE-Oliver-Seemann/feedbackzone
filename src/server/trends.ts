import { MIN_GROUP_SIZE } from "@/config/privacy";
import { SCALES, toScaleKey } from "@/config/scales";
import { db } from "@/lib/db";
import { assertCanViewResults, requireRole } from "@/lib/authz";
import { forbidden, notFound } from "@/lib/errors";
import type { SessionUser } from "@/lib/session";
import { closeExpiredRounds } from "@/server/rounds";

// IT-08: results over time and across teams. Everything here is built from
// rounds that are closed AND above the confidentiality threshold on their own.
// A round below the threshold contributes nothing — not even to an average
// over several rounds, because that would let small rounds leak through.

const DAY_MS = 24 * 60 * 60 * 1000;
export const HEATMAP_WINDOW_DAYS = 90;
/** Label under which the fixed trend question appears next to the topics. */
export const FIXED_TOPIC_LABEL = "Stála otázka";

const round2 = (value: number) => Math.round(value * 100) / 100;
const mean = (values: number[]) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;

const ROUND_SELECT = {
  id: true,
  name: true,
  closesAt: true,
  closedAt: true,
  questions: {
    orderBy: { position: "asc" },
    select: {
      position: true,
      question: { select: { text: true, scale: true, topic: true, fixed: true } },
    },
  },
  responses: { select: { v1: true, v2: true, v3: true, v4: true, v5: true } },
} as const;

type RoundRow = {
  id: string;
  name: string;
  closesAt: Date;
  closedAt: Date | null;
  questions: {
    position: number;
    question: { text: string; scale: string; topic: string; fixed: boolean };
  }[];
  responses: { v1: number; v2: number; v3: number; v4: number | null; v5: number | null }[];
};

const closedTime = (round: RoundRow) => round.closedAt ?? round.closesAt;

/**
 * Unrounded scores of one round, or null below the threshold. A score is 1–5
 * where higher is always better: averages on reversed scales are flipped (6 − x).
 */
function scoreRound(round: RoundRow): { fixed: number | null; topics: Map<string, number> } | null {
  if (round.responses.length < MIN_GROUP_SIZE) return null;

  const fixedScores: number[] = [];
  const byTopic = new Map<string, number[]>();
  round.questions.forEach((item) => {
    // Exact mean of the answers; rounding happens once, when a number is shown (QA E2E-009).
    const key = `v${item.position}` as "v1" | "v2" | "v3" | "v4" | "v5";
    const values = round.responses.map((response) => response[key]).filter((v) => v !== null);
    if (values.length === 0) return;
    const average = values.reduce((total, value) => total + value, 0) / values.length;
    const score = SCALES[toScaleKey(item.question.scale)].higherIsBetter ? average : 6 - average;
    if (item.question.fixed) fixedScores.push(score);
    else byTopic.set(item.question.topic, [...(byTopic.get(item.question.topic) ?? []), score]);
  });

  return {
    fixed: mean(fixedScores),
    topics: new Map([...byTopic].map(([topic, scores]) => [topic, mean(scores)!])),
  };
}

export type TrendPoint = {
  roundId: string;
  roundName: string;
  closedAt: string;
  responded: number;
} & (
  | { status: "ok"; fixed: number | null; topics: Record<string, number> }
  | { status: "insufficient_responses" }
);

export type TeamTrend = {
  team: { id: string; name: string };
  /** Topics that appear in at least one round above the threshold, sorted. */
  topics: string[];
  /** Closed rounds, oldest first. */
  points: TrendPoint[];
};

/** GET /api/teams/:id/trend — manager of the team and HR. */
export async function getTeamTrend(user: SessionUser, teamId: string): Promise<TeamTrend> {
  requireRole(user, "MANAGER", "HR");
  // Check first, so that a manager cannot probe ids of other teams.
  if (user.role !== "HR") assertCanViewResults(user, teamId);
  await closeExpiredRounds();

  const team = await db.team.findUnique({ where: { id: teamId }, select: { id: true, name: true } });
  if (!team) throw user.role === "HR" ? notFound() : forbidden();

  const rounds: RoundRow[] = await db.round.findMany({
    where: { teamId: team.id, status: "CLOSED" },
    select: ROUND_SELECT,
  });
  rounds.sort((a, b) => closedTime(a).getTime() - closedTime(b).getTime() || a.id.localeCompare(b.id));

  const topics = new Set<string>();
  const points = rounds.map((round): TrendPoint => {
    const base = {
      roundId: round.id,
      roundName: round.name,
      closedAt: closedTime(round).toISOString(),
      responded: round.responses.length,
    };
    const scores = scoreRound(round);
    if (!scores) return { ...base, status: "insufficient_responses" };
    for (const topic of scores.topics.keys()) topics.add(topic);
    return {
      ...base,
      status: "ok",
      fixed: scores.fixed === null ? null : round2(scores.fixed),
      topics: Object.fromEntries([...scores.topics].map(([topic, score]) => [topic, round2(score)])),
    };
  });

  return { team, topics: [...topics].sort((a, b) => a.localeCompare(b, "sk")), points };
}

export type Heatmap = {
  windowDays: number;
  /** Column order: the fixed question first, then topics alphabetically. */
  topics: string[];
  teams: {
    teamId: string;
    teamName: string;
    /** Closed rounds above the threshold inside the window. */
    roundsCounted: number;
    /** Score per topic; a topic without data is absent. */
    cells: Record<string, number>;
  }[];
};

/**
 * GET /api/hr/heatmap — HR only. Teams × topics, the mean of round scores
 * over the last HEATMAP_WINDOW_DAYS days.
 */
export async function getHeatmap(user: SessionUser, now = new Date()): Promise<Heatmap> {
  requireRole(user, "HR");
  await closeExpiredRounds(now);
  const windowStart = now.getTime() - HEATMAP_WINDOW_DAYS * DAY_MS;

  const teams = await db.team.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, rounds: { where: { status: "CLOSED" }, select: ROUND_SELECT } },
  });

  const allTopics = new Set<string>();
  let anyFixed = false;
  const rows = teams.map((team) => {
    const scored = (team.rounds as RoundRow[])
      .filter((round) => closedTime(round).getTime() >= windowStart)
      .map(scoreRound)
      .filter((scores) => scores !== null);

    const collected = new Map<string, number[]>();
    for (const scores of scored) {
      if (scores.fixed !== null) {
        anyFixed = true;
        collected.set(FIXED_TOPIC_LABEL, [...(collected.get(FIXED_TOPIC_LABEL) ?? []), scores.fixed]);
      }
      for (const [topic, score] of scores.topics) {
        allTopics.add(topic);
        collected.set(topic, [...(collected.get(topic) ?? []), score]);
      }
    }
    return {
      teamId: team.id,
      teamName: team.name,
      roundsCounted: scored.length,
      cells: Object.fromEntries(
        [...collected].map(([topic, scores]) => [topic, round2(mean(scores)!)]),
      ),
    };
  });

  return {
    windowDays: HEATMAP_WINDOW_DAYS,
    topics: [
      ...(anyFixed ? [FIXED_TOPIC_LABEL] : []),
      ...[...allTopics].sort((a, b) => a.localeCompare(b, "sk")),
    ],
    teams: rows,
  };
}
