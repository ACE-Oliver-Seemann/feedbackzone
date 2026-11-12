import { parseLocalDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { assertCanViewTeam, assertCanWriteActions, requireRole } from "@/lib/authz";
import { conflict, forbidden, validationError } from "@/lib/errors";
import type { SessionUser } from "@/lib/session";
import { charLength, cleanText } from "@/lib/text";
import { closeExpiredRounds } from "@/server/rounds";
import { loadRoundForResults } from "@/server/results";

// "Krok" in the UI is `Action` in code (MVP-13).

export const ACTION_STATUSES = ["PLANNED", "IN_PROGRESS", "DONE"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

const MAX_TOPIC_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;

export type ActionItem = {
  id: string;
  roundId: string;
  topic: string;
  description: string;
  dueDate: string;
  status: ActionStatus;
};

const ACTION_SELECT = {
  id: true,
  roundId: true,
  topic: true,
  description: true,
  dueDate: true,
  status: true,
} as const;

type ActionRow = {
  id: string;
  roundId: string;
  topic: string;
  description: string;
  dueDate: Date;
  status: string;
};

const toItem = (row: ActionRow): ActionItem => ({
  ...row,
  dueDate: row.dueDate.toISOString(),
  status: row.status as ActionStatus,
});

const isActionStatus = (value: unknown): value is ActionStatus =>
  typeof value === "string" && (ACTION_STATUSES as readonly string[]).includes(value);

/** POST /api/rounds/:id/actions — the team's manager adds an action to a closed round. */
export async function createAction(
  user: SessionUser,
  roundId: string,
  input: Record<string, unknown>,
): Promise<ActionItem> {
  requireRole(user, "MANAGER");
  await closeExpiredRounds();
  const round = await db.round.findUnique({
    where: { id: roundId },
    select: { id: true, teamId: true, status: true },
  });
  if (!round) throw forbidden();
  assertCanWriteActions(user, round.teamId);
  if (round.status !== "CLOSED") throw conflict("round_not_closed");

  const fields: Record<string, string> = {};

  const topic = cleanText(input.topic);
  if (!topic) fields.topic = "required";
  else if (charLength(topic) > MAX_TOPIC_LENGTH) fields.topic = "too_long";

  const description = cleanText(input.description);
  if (!description) fields.description = "required";
  else if (charLength(description) > MAX_DESCRIPTION_LENGTH) fields.description = "too_long";

  const dueDate = parseLocalDate(input.dueDate);
  if (!dueDate) fields.dueDate = "invalid";

  const status = input.status === undefined ? "PLANNED" : input.status;
  if (!isActionStatus(status)) fields.status = "invalid";

  if (Object.keys(fields).length > 0) throw validationError(fields);

  const action = await db.action.create({
    data: { roundId: round.id, topic, description, dueDate: dueDate!, status: status as string },
    select: ACTION_SELECT,
  });
  return toItem(action);
}

/** PATCH /api/actions/:id — the team's manager changes the status. */
export async function updateActionStatus(
  user: SessionUser,
  actionId: string,
  input: Record<string, unknown>,
): Promise<ActionItem> {
  requireRole(user, "MANAGER");
  const action = await db.action.findUnique({
    where: { id: actionId },
    select: { id: true, round: { select: { teamId: true } } },
  });
  if (!action) throw forbidden();
  assertCanWriteActions(user, action.round.teamId);

  if (!isActionStatus(input.status)) throw validationError({ status: "invalid" });

  const updated = await db.action.update({
    where: { id: action.id },
    data: { status: input.status },
    select: ACTION_SELECT,
  });
  return toItem(updated);
}

/** Actions of one round, for the results screen (manager of the team, HR). */
export async function listRoundActions(user: SessionUser, roundId: string): Promise<ActionItem[]> {
  const round = await loadRoundForResults(user, roundId);
  const actions = await db.action.findMany({
    where: { roundId: round.id },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    select: ACTION_SELECT,
  });
  return actions.map(toItem);
}

/**
 * Actions of the team's most recently closed round, shown after a response
 * is submitted (MVP-09, MVP-14). Null when the team has no closed round.
 */
export async function listLatestClosedRoundActions(
  user: SessionUser,
  teamId: string,
): Promise<{ roundName: string; actions: ActionItem[] } | null> {
  assertCanViewTeam(user, teamId);
  await closeExpiredRounds();
  const rounds = await db.round.findMany({
    where: { teamId, status: "CLOSED" },
    select: {
      id: true,
      name: true,
      closesAt: true,
      closedAt: true,
      actions: { orderBy: [{ dueDate: "asc" }, { id: "asc" }], select: ACTION_SELECT },
    },
  });
  // The round closed last, not the one with the latest deadline (QA E2E-002).
  const closedTime = (item: { closedAt: Date | null; closesAt: Date }) =>
    (item.closedAt ?? item.closesAt).getTime();
  const round = rounds.sort(
    (a, b) => closedTime(b) - closedTime(a) || a.id.localeCompare(b.id),
  )[0];
  if (!round) return null;
  return { roundName: round.name, actions: round.actions.map(toItem) };
}
