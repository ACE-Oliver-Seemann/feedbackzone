import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";
import { closeExpiredRounds } from "@/server/rounds";

// IT-11: "what needs doing now" on the home page. At most MAX_TASKS tasks per
// user, most urgent first, each with one link to the exact place.
//
// A task is built only from the state of rounds, actions and issues. It never
// contains anything from a response, so no confidentiality threshold applies.

export const MAX_TASKS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A manager is nudged to start a round after this many days without one. */
export const QUIET_DAYS = 14;
/** HR is told about an open round closing this soon with under half the team in. */
export const CLOSING_SOON_DAYS = 3;

export type HomeTask =
  | { kind: "fill_survey"; href: string; roundName: string; questionCount: number }
  | { kind: "round_awaiting_action"; href: string; roundName: string; daysWaiting: number }
  | { kind: "actions_overdue"; href: string; count: number }
  | { kind: "start_round"; href: string; daysSinceLast: number | null }
  | {
      kind: "rounds_awaiting_action";
      href: string;
      count: number;
      longestTeam: string;
      longestDays: number;
    }
  | { kind: "issues_overdue"; href: string; count: number }
  | {
      kind: "low_participation";
      href: string;
      roundName: string;
      teamName: string;
      responded: number;
      teamSize: number;
      daysLeft: number;
    };

const daysBetween = (from: Date, to: number) => Math.max(0, Math.floor((to - from.getTime()) / DAY_MS));
const closedTime = (round: { closedAt: Date | null; closesAt: Date }) => round.closedAt ?? round.closesAt;

/** Open rounds of the user's team that the user has not answered yet. */
async function surveysToFill(user: SessionUser): Promise<HomeTask[]> {
  if (!user.teamId) return [];
  const rounds = await db.round.findMany({
    where: {
      teamId: user.teamId,
      status: "OPEN",
      participations: { none: { userId: user.id } },
    },
    orderBy: [{ closesAt: "asc" }, { id: "asc" }],
    select: { id: true, name: true, _count: { select: { questions: true } } },
  });
  return rounds.map((round) => ({
    kind: "fill_survey",
    href: `/rounds/${round.id}/fill`,
    roundName: round.name,
    questionCount: round._count.questions,
  }));
}

async function managerTasks(user: SessionUser, now: number): Promise<HomeTask[]> {
  const teamId = user.teamId;
  if (!teamId) return [];
  const tasks: HomeTask[] = [];

  // 1. Closed rounds nobody reacted to — the step the whole cycle depends on.
  const awaiting = await db.round.findMany({
    where: { teamId, status: "CLOSED", actions: { none: {} } },
    select: { id: true, name: true, closedAt: true, closesAt: true },
  });
  awaiting
    .sort((a, b) => closedTime(a).getTime() - closedTime(b).getTime())
    .forEach((round) =>
      tasks.push({
        kind: "round_awaiting_action",
        href: `/rounds/${round.id}/results`,
        roundName: round.name,
        daysWaiting: daysBetween(closedTime(round), now),
      }),
    );

  // 2. Promised actions past their due date.
  const overdue = await db.action.findMany({
    where: { round: { teamId }, status: { not: "DONE" }, dueDate: { lt: new Date(now) } },
    orderBy: { dueDate: "asc" },
    select: { roundId: true },
  });
  if (overdue.length > 0) {
    tasks.push({
      kind: "actions_overdue",
      href: `/rounds/${overdue[0].roundId}/results`,
      count: overdue.length,
    });
  }

  // 3. The manager's own survey.
  tasks.push(...(await surveysToFill(user)));

  // 4. Nothing running and nothing prepared for a while.
  // A draft past its deadline can no longer be opened, so it does not count (QA BE-010).
  const active = await db.round.count({
    where: {
      teamId,
      OR: [{ status: "OPEN" }, { status: "DRAFT", closesAt: { gte: new Date(now) } }],
    },
  });
  if (active === 0) {
    const closed = await db.round.findMany({
      where: { teamId, status: "CLOSED" },
      select: { closedAt: true, closesAt: true },
    });
    const last = closed.length
      ? Math.max(...closed.map((round) => closedTime(round).getTime()))
      : null;
    const daysSinceLast = last === null ? null : Math.floor((now - last) / DAY_MS);
    if (daysSinceLast === null || daysSinceLast >= QUIET_DAYS) {
      tasks.push({ kind: "start_round", href: "/rounds/new", daysSinceLast });
    }
  }
  return tasks;
}

async function hrTasks(now: number): Promise<HomeTask[]> {
  const tasks: HomeTask[] = [];

  const awaiting = await db.round.findMany({
    where: { status: "CLOSED", actions: { none: {} } },
    select: { closedAt: true, closesAt: true, team: { select: { name: true } } },
  });
  if (awaiting.length > 0) {
    const longest = awaiting.reduce((a, b) => (closedTime(a) <= closedTime(b) ? a : b));
    tasks.push({
      kind: "rounds_awaiting_action",
      href: "/hr/overview",
      count: awaiting.length,
      longestTeam: longest.team.name,
      longestDays: daysBetween(closedTime(longest), now),
    });
  }

  const issuesOverdue = await db.issue.count({
    where: { status: { not: "DONE" }, dueDate: { lt: new Date(now) } },
  });
  if (issuesOverdue > 0) {
    tasks.push({ kind: "issues_overdue", href: "/hr/issues", count: issuesOverdue });
  }

  const closingSoon = await db.round.findMany({
    where: { status: "OPEN", closesAt: { lt: new Date(now + CLOSING_SOON_DAYS * DAY_MS) } },
    orderBy: { closesAt: "asc" },
    select: {
      id: true,
      name: true,
      closesAt: true,
      team: { select: { name: true, _count: { select: { members: true } } } },
      _count: { select: { participations: true } },
    },
  });
  for (const round of closingSoon) {
    const teamSize = round.team._count.members;
    if (round._count.participations * 2 < teamSize) {
      tasks.push({
        kind: "low_participation",
        href: `/rounds/${round.id}/results`,
        roundName: round.name,
        teamName: round.team.name,
        responded: round._count.participations,
        teamSize,
        daysLeft: Math.max(0, Math.ceil((round.closesAt.getTime() - now) / DAY_MS)),
      });
    }
  }
  return tasks;
}

/** Tasks for the home page of the logged-in user; only their own scope. */
export async function getHomeTasks(user: SessionUser, now = Date.now()): Promise<HomeTask[]> {
  await closeExpiredRounds(new Date(now));
  const tasks =
    user.role === "HR"
      ? await hrTasks(now)
      : user.role === "MANAGER"
        ? await managerTasks(user, now)
        : await surveysToFill(user);
  return tasks.slice(0, MAX_TASKS);
}
