import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import type { SessionUser } from "@/lib/session";
import { closeExpiredRounds } from "@/server/rounds";

// IT-05 (spec DASH-08): how reliably and how fast teams react to results.
// Built only from rounds and actions — it never touches responses, so there
// is nothing confidential in it and no threshold applies.

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReactionSummary = {
  closedRounds: number;
  roundsWithAction: number;
  /** Share of closed rounds that have at least one action; null without closed rounds. */
  sharePercent: number | null;
  /** Median days from closing a round to its first action; null without any action. */
  medianDaysToFirstAction: number | null;
  actions: { planned: number; inProgress: number; done: number; overdue: number };
};

export type TeamReaction = ReactionSummary & {
  teamId: string;
  teamName: string;
  /** Closed rounds without an action, longest waiting first. */
  awaitingRounds: { id: string; name: string; daysWaiting: number }[];
};

export type ReactionOverview = { total: ReactionSummary; teams: TeamReaction[] };

type RoundRow = {
  id: string;
  name: string;
  closesAt: Date;
  closedAt: Date | null;
  actions: { status: string; dueDate: Date; createdAt: Date }[];
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(value * 10) / 10;
}

/** Rounds closed before IT-05 have no closedAt; their deadline stands in. */
const closedTime = (round: RoundRow) => (round.closedAt ?? round.closesAt).getTime();

function summarize(rounds: RoundRow[], now: number): ReactionSummary {
  const withAction = rounds.filter((round) => round.actions.length > 0);
  const daysToFirstAction = withAction.map((round) => {
    const first = Math.min(...round.actions.map((action) => action.createdAt.getTime()));
    return Math.max(0, first - closedTime(round)) / DAY_MS;
  });
  const actions = rounds.flatMap((round) => round.actions);
  return {
    closedRounds: rounds.length,
    roundsWithAction: withAction.length,
    sharePercent: rounds.length ? Math.round((withAction.length / rounds.length) * 100) : null,
    medianDaysToFirstAction: median(daysToFirstAction),
    actions: {
      planned: actions.filter((action) => action.status === "PLANNED").length,
      inProgress: actions.filter((action) => action.status === "IN_PROGRESS").length,
      done: actions.filter((action) => action.status === "DONE").length,
      overdue: actions.filter(
        (action) => action.status !== "DONE" && action.dueDate.getTime() < now,
      ).length,
    },
  };
}

/** GET /api/hr/overview — HR only. */
export async function getReactionOverview(user: SessionUser): Promise<ReactionOverview> {
  requireRole(user, "HR");
  await closeExpiredRounds();
  const now = Date.now();

  const teams = await db.team.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      rounds: {
        where: { status: "CLOSED" },
        select: {
          id: true,
          name: true,
          closesAt: true,
          closedAt: true,
          actions: { select: { status: true, dueDate: true, createdAt: true } },
        },
      },
    },
  });

  return {
    total: summarize(
      teams.flatMap((team) => team.rounds),
      now,
    ),
    teams: teams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      ...summarize(team.rounds, now),
      awaitingRounds: team.rounds
        .filter((round) => round.actions.length === 0)
        .map((round) => ({
          id: round.id,
          name: round.name,
          daysWaiting: Math.max(0, Math.floor((now - closedTime(round)) / DAY_MS)),
        }))
        .sort((a, b) => b.daysWaiting - a.daysWaiting),
    })),
  };
}
