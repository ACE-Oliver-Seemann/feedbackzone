import { parseLocalDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { assertCanManageRounds, requireRole } from "@/lib/authz";
import { conflict, forbidden, notFound, validationError } from "@/lib/errors";
import type { SessionUser } from "@/lib/session";

export type RoundStatus = "DRAFT" | "OPEN" | "CLOSED";

export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 5;
const MAX_NAME_LENGTH = 120;

export type RoundListItem = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  status: RoundStatus;
  closesAt: string;
  questionCount: number;
  /** Whether the current user already answered. Only for team members. */
  submitted?: boolean;
  /** Manager and HR only. */
  participation?: { responded: number; teamSize: number };
  /** Manager and HR only: closed round without any action (MVP-15). */
  awaitingAction?: boolean;
};

/**
 * MVP-05: a round closes automatically on the first load after its deadline.
 * Called by every read that depends on round status.
 */
export async function closeExpiredRounds(now = new Date()): Promise<void> {
  const expired = await db.round.findMany({
    where: { status: "OPEN", closesAt: { lt: now } },
    select: { id: true, closesAt: true },
  });
  for (const round of expired) {
    // The round counts as closed at its deadline, not at the moment someone
    // happened to load the page (IT-05 measures reaction time from here).
    await db.round.updateMany({
      where: { id: round.id, status: "OPEN" },
      data: { status: "CLOSED", closedAt: round.closesAt },
    });
  }
}

/**
 * GET /api/rounds — rounds by role (MVP-06, MVP-12):
 * employee: open rounds of own team; manager: all rounds of own team;
 * HR: all rounds.
 */
export async function listRounds(user: SessionUser): Promise<RoundListItem[]> {
  await closeExpiredRounds();

  const isMember = user.role !== "HR";
  const seesManagement = user.role !== "EMPLOYEE";
  if (isMember && !user.teamId) return [];

  const rounds = await db.round.findMany({
    where:
      user.role === "HR"
        ? {}
        : user.role === "MANAGER"
          ? { teamId: user.teamId! }
          : { teamId: user.teamId!, status: "OPEN" },
    orderBy: [{ closesAt: "desc" }, { id: "asc" }],
    include: {
      team: { select: { name: true, _count: { select: { members: true } } } },
      _count: { select: { questions: true, participations: true, actions: true } },
      participations: isMember
        ? { where: { userId: user.id }, select: { userId: true } }
        : false,
    },
  });

  return rounds.map((round) => ({
    id: round.id,
    name: round.name,
    teamId: round.teamId,
    teamName: round.team.name,
    status: round.status as RoundStatus,
    closesAt: round.closesAt.toISOString(),
    questionCount: round._count.questions,
    ...(isMember ? { submitted: round.participations.length > 0 } : {}),
    ...(seesManagement
      ? {
          participation: {
            responded: round._count.participations,
            teamSize: round.team._count.members,
          },
          awaitingAction: round.status === "CLOSED" && round._count.actions === 0,
        }
      : {}),
  }));
}

/** POST /api/rounds — creates a draft (MVP-04). */
export async function createRound(
  user: SessionUser,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  requireRole(user, "MANAGER", "HR");

  const fields: Record<string, string> = {};

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) fields.name = "required";
  else if (name.length > MAX_NAME_LENGTH) fields.name = "too_long";

  // A manager may omit the team; it defaults to their own.
  const teamId =
    typeof input.teamId === "string" && input.teamId
      ? input.teamId
      : user.role === "MANAGER"
        ? user.teamId
        : null;
  if (!teamId) fields.teamId = "required";

  const closesAt = parseLocalDate(input.closesAt);
  if (!closesAt) fields.closesAt = "invalid";
  else if (closesAt.getTime() < Date.now()) fields.closesAt = "in_past";

  // Permission is checked before anything about the target team is revealed.
  if (teamId) assertCanManageRounds(user, teamId);

  // IT-04: fixed (trend) questions open every round. The author picks the
  // rest; the 3–5 limit from MVP-04 applies to the total.
  const fixedIds = (
    await db.question.findMany({
      where: { fixed: true },
      orderBy: { id: "asc" },
      select: { id: true },
    })
  ).map((question) => question.id);

  const rawIds = Array.isArray(input.questionIds) ? input.questionIds : null;
  const pickedIds =
    rawIds && rawIds.every((id): id is string => typeof id === "string") ? rawIds : null;
  let questionIds: string[] | null = null;
  if (!pickedIds) fields.questionIds = "invalid";
  else if (new Set(pickedIds).size !== pickedIds.length) fields.questionIds = "duplicate";
  else {
    // A fixed question sent by the client is not counted twice.
    questionIds = [...fixedIds, ...pickedIds.filter((id) => !fixedIds.includes(id))];
    if (questionIds.length < MIN_QUESTIONS) fields.questionIds = "too_few";
    else if (questionIds.length > MAX_QUESTIONS) fields.questionIds = "too_many";
  }

  if (Object.keys(fields).length > 0) throw validationError(fields);

  const [team, knownQuestions] = await Promise.all([
    db.team.findUnique({ where: { id: teamId! }, select: { id: true } }),
    db.question.findMany({
      where: { id: { in: questionIds! } },
      select: { id: true, teamId: true },
    }),
  ]);
  if (!team) throw validationError({ teamId: "unknown" });
  if (knownQuestions.length !== questionIds!.length) {
    throw validationError({ questionIds: "unknown" });
  }
  // IT-07: an own question may be used only in rounds of the team that owns it.
  // Reported like an unknown question, so nothing about other teams leaks.
  if (knownQuestions.some((question) => question.teamId !== null && question.teamId !== team.id)) {
    throw validationError({ questionIds: "unknown" });
  }

  const round = await db.round.create({
    data: {
      name,
      teamId: team.id,
      closesAt: closesAt!,
      status: "DRAFT",
      questions: {
        create: questionIds!.map((questionId, index) => ({ questionId, position: index + 1 })),
      },
    },
    select: { id: true },
  });
  return round;
}

/** How many rotating questions are preselected for a new round (IT-13). */
export const DEFAULT_PICKED_QUESTIONS = 3;

/**
 * Questions preselected for a new round of a team (IT-13): recommended
 * (starter) questions, least recently used by the team first, from different
 * topics. Defaults are followed much more often than not, so they must rotate
 * — otherwise every round would ask the same three things.
 */
export async function suggestRoundQuestions(user: SessionUser, teamId: string): Promise<string[]> {
  requireRole(user, "MANAGER", "HR");
  assertCanManageRounds(user, teamId);

  const [starters, used] = await Promise.all([
    db.question.findMany({
      where: { starter: true, fixed: false, teamId: null },
      orderBy: [{ topic: "asc" }, { text: "asc" }],
      select: { id: true, topic: true },
    }),
    db.roundQuestion.findMany({
      where: { round: { teamId } },
      select: { questionId: true, round: { select: { closesAt: true } } },
    }),
  ]);

  const lastUsed = new Map<string, number>();
  for (const item of used) {
    const time = item.round.closesAt.getTime();
    if ((lastUsed.get(item.questionId) ?? 0) < time) lastUsed.set(item.questionId, time);
  }
  // Never used first, then the longest unused. The sort is stable, so ties keep topic order.
  const candidates = [...starters].sort(
    (a, b) => (lastUsed.get(a.id) ?? 0) - (lastUsed.get(b.id) ?? 0),
  );

  const picked: typeof candidates = [];
  for (const question of candidates) {
    if (picked.length === DEFAULT_PICKED_QUESTIONS) break;
    if (!picked.some((item) => item.topic === question.topic)) picked.push(question);
  }
  for (const question of candidates) {
    if (picked.length === DEFAULT_PICKED_QUESTIONS) break;
    if (!picked.includes(question)) picked.push(question);
  }
  return picked.map((question) => question.id);
}

async function loadManagedRound(user: SessionUser, roundId: string) {
  requireRole(user, "MANAGER", "HR");
  const round = await db.round.findUnique({
    where: { id: roundId },
    select: { id: true, teamId: true, status: true, closesAt: true },
  });
  // A manager must not learn whether a foreign round exists.
  if (!round) throw user.role === "HR" ? notFound() : forbidden();
  assertCanManageRounds(user, round.teamId);
  return round;
}

/** POST /api/rounds/:id/open — DRAFT → OPEN (MVP-05). */
export async function openRound(user: SessionUser, roundId: string): Promise<void> {
  const round = await loadManagedRound(user, roundId);
  if (round.status !== "DRAFT") throw conflict("invalid_state");
  if (round.closesAt.getTime() < Date.now()) throw conflict("deadline_passed");

  const updated = await db.round.updateMany({
    where: { id: round.id, status: "DRAFT" },
    data: { status: "OPEN", startsAt: new Date() },
  });
  if (updated.count === 0) throw conflict("invalid_state");
}

/** POST /api/rounds/:id/close — OPEN → CLOSED (MVP-05). */
export async function closeRound(user: SessionUser, roundId: string): Promise<void> {
  const round = await loadManagedRound(user, roundId);
  await closeExpiredRounds();

  const updated = await db.round.updateMany({
    where: { id: round.id, status: "OPEN" },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  if (updated.count === 0) throw conflict("invalid_state");
}
