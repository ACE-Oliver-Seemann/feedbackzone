import {
  ISSUE_SOURCES,
  ISSUE_STATUSES,
  OWNER_GROUPS,
  type IssueSource,
  type IssueStatus,
  type OwnerGroup,
} from "@/config/owner-groups";
import { parseLocalDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { notFound, validationError } from "@/lib/errors";
import type { SessionUser } from "@/lib/session";
import { charLength, cleanText } from "@/lib/text";

// IT-10: HR's list of issues ("podnety") and notes from offline meetings.
// Everything here is for HR only.
//
// Confidentiality: an issue may point to a round and a team, never to a
// response. Nothing in this module reads the Response table, so a comment can
// get into an issue only if HR retypes it — the form tells HR not to copy
// comments word for word.

/** Filter value for "everything that is not done yet" (IT-13). */
export const ACTIVE_FILTER = "ACTIVE";
/** Filter value for "no restriction on status". */
export const ALL_FILTER = "ALL";

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;
const MAX_NOTE_TEXT = 10000;

export type IssueItem = {
  id: string;
  title: string;
  description: string;
  source: IssueSource;
  ownerGroup: OwnerGroup;
  status: IssueStatus;
  dueDate: string | null;
  createdAt: string;
  round: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  note: { id: string; title: string } | null;
};

export type NoteItem = {
  id: string;
  title: string;
  meetingDate: string;
  text: string;
  createdAt: string;
  issues: { id: string; title: string; status: IssueStatus }[];
};

const ISSUE_SELECT = {
  id: true,
  title: true,
  description: true,
  source: true,
  ownerGroup: true,
  status: true,
  dueDate: true,
  createdAt: true,
  round: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
  note: { select: { id: true, title: true } },
} as const;

type IssueRow = {
  id: string;
  title: string;
  description: string;
  source: string;
  ownerGroup: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
  round: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  note: { id: string; title: string } | null;
};

const toIssue = (row: IssueRow): IssueItem => ({
  ...row,
  source: row.source as IssueSource,
  ownerGroup: row.ownerGroup as OwnerGroup,
  status: row.status as IssueStatus,
  dueDate: row.dueDate ? row.dueDate.toISOString() : null,
  createdAt: row.createdAt.toISOString(),
});

const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

const optionalId = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** Absent, null and "" mean "not given"; anything else must be a string. */
const isOptionalString = (value: unknown) =>
  value === undefined || value === null || typeof value === "string";

/** GET /api/hr/issues — optionally filtered by owner group and status. */
export async function listIssues(
  user: SessionUser,
  filter: { ownerGroup?: string | null; status?: string | null } = {},
): Promise<IssueItem[]> {
  requireRole(user, "HR");
  // An unknown filter is a mistake to report, not a reason to show everything (QA BE-009).
  const fields: Record<string, string> = {};
  if (filter.ownerGroup && !oneOf(OWNER_GROUPS, filter.ownerGroup)) fields.group = "invalid";
  if (
    filter.status &&
    filter.status !== ACTIVE_FILTER &&
    filter.status !== ALL_FILTER &&
    !oneOf(ISSUE_STATUSES, filter.status)
  ) {
    fields.status = "invalid";
  }
  if (Object.keys(fields).length > 0) throw validationError(fields);

  const issues = await db.issue.findMany({
    where: {
      ...(oneOf(OWNER_GROUPS, filter.ownerGroup) ? { ownerGroup: filter.ownerGroup } : {}),
      ...(filter.status === ACTIVE_FILTER
        ? { status: { in: ["OPEN", "IN_PROGRESS"] } }
        : oneOf(ISSUE_STATUSES, filter.status)
          ? { status: filter.status }
          : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: ISSUE_SELECT,
  });
  return issues.map(toIssue);
}

/** POST /api/hr/issues */
export async function createIssue(
  user: SessionUser,
  input: Record<string, unknown>,
): Promise<IssueItem> {
  requireRole(user, "HR");
  const fields: Record<string, string> = {};

  const title = cleanText(input.title);
  if (charLength(title) < 3) fields.title = "too_short";
  else if (charLength(title) > MAX_TITLE) fields.title = "too_long";

  const description = cleanText(input.description);
  if (charLength(description) > MAX_DESCRIPTION) fields.description = "too_long";

  // A wrongly typed optional field is rejected instead of being dropped (QA BE-008).
  if (!isOptionalString(input.description)) fields.description = "invalid";
  for (const key of ["roundId", "teamId", "noteId"] as const) {
    if (!isOptionalString(input[key])) fields[key] = "invalid";
  }

  if (!oneOf(ISSUE_SOURCES, input.source)) fields.source = "invalid";
  if (!oneOf(OWNER_GROUPS, input.ownerGroup)) fields.ownerGroup = "invalid";

  let dueDate: Date | null = null;
  if (input.dueDate !== undefined && input.dueDate !== null && input.dueDate !== "") {
    dueDate = parseLocalDate(input.dueDate);
    if (!dueDate) fields.dueDate = "invalid";
  }

  const roundId = optionalId(input.roundId);
  const noteId = optionalId(input.noteId);
  let teamId = optionalId(input.teamId);

  const [round, note] = await Promise.all([
    roundId
      ? db.round.findUnique({ where: { id: roundId }, select: { id: true, teamId: true } })
      : null,
    noteId ? db.meetingNote.findUnique({ where: { id: noteId }, select: { id: true } }) : null,
  ]);
  if (roundId && !round) fields.roundId = "unknown";
  if (noteId && !note) fields.noteId = "unknown";
  // An issue raised from a round belongs to that round's team.
  if (round) teamId = round.teamId;
  if (teamId && !round) {
    const team = await db.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!team) fields.teamId = "unknown";
  }

  if (Object.keys(fields).length > 0) throw validationError(fields);

  const issue = await db.issue.create({
    data: {
      title,
      description,
      source: input.source as string,
      ownerGroup: input.ownerGroup as string,
      dueDate,
      roundId: round?.id ?? null,
      teamId,
      noteId: note?.id ?? null,
      createdById: user.id,
    },
    select: ISSUE_SELECT,
  });
  return toIssue(issue);
}

/** PATCH /api/hr/issues/:id — status, owner group and due date can change. */
export async function updateIssue(
  user: SessionUser,
  issueId: string,
  input: Record<string, unknown>,
): Promise<IssueItem> {
  requireRole(user, "HR");
  const existing = await db.issue.findUnique({ where: { id: issueId }, select: { id: true } });
  if (!existing) throw notFound();

  const fields: Record<string, string> = {};
  const data: { status?: string; ownerGroup?: string; dueDate?: Date | null } = {};

  if (input.status !== undefined) {
    if (oneOf(ISSUE_STATUSES, input.status)) data.status = input.status;
    else fields.status = "invalid";
  }
  if (input.ownerGroup !== undefined) {
    if (oneOf(OWNER_GROUPS, input.ownerGroup)) data.ownerGroup = input.ownerGroup;
    else fields.ownerGroup = "invalid";
  }
  if (input.dueDate !== undefined) {
    if (input.dueDate === null || input.dueDate === "") data.dueDate = null;
    else {
      const parsed = parseLocalDate(input.dueDate);
      if (parsed) data.dueDate = parsed;
      else fields.dueDate = "invalid";
    }
  }
  if (Object.keys(fields).length > 0) throw validationError(fields);
  if (Object.keys(data).length === 0) throw validationError({ status: "required" });

  const issue = await db.issue.update({ where: { id: issueId }, data, select: ISSUE_SELECT });
  return toIssue(issue);
}

/** GET /api/hr/notes — notes from offline meetings, newest meeting first. */
export async function listNotes(user: SessionUser): Promise<NoteItem[]> {
  requireRole(user, "HR");
  const notes = await db.meetingNote.findMany({
    orderBy: [{ meetingDate: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      meetingDate: true,
      text: true,
      createdAt: true,
      issues: {
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, status: true },
      },
    },
  });
  return notes.map((note) => ({
    ...note,
    meetingDate: note.meetingDate.toISOString(),
    createdAt: note.createdAt.toISOString(),
    issues: note.issues.map((issue) => ({ ...issue, status: issue.status as IssueStatus })),
  }));
}

/** POST /api/hr/notes — typed text only, no attachments. */
export async function createNote(
  user: SessionUser,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  requireRole(user, "HR");
  const fields: Record<string, string> = {};

  const title = cleanText(input.title);
  if (charLength(title) < 3) fields.title = "too_short";
  else if (charLength(title) > MAX_TITLE) fields.title = "too_long";

  const text = cleanText(input.text);
  if (!text) fields.text = "required";
  else if (charLength(text) > MAX_NOTE_TEXT) fields.text = "too_long";

  const meetingDate = parseLocalDate(input.meetingDate);
  if (!meetingDate) fields.meetingDate = "invalid";

  if (Object.keys(fields).length > 0) throw validationError(fields);

  return db.meetingNote.create({
    data: { title, text, meetingDate: meetingDate!, createdById: user.id },
    select: { id: true },
  });
}

/** Prefill for the issue form when it is opened from a round or a note. */
export async function getIssuePrefill(
  user: SessionUser,
  ids: { roundId?: string; noteId?: string },
): Promise<{
  round: { id: string; name: string; teamName: string } | null;
  note: { id: string; title: string } | null;
}> {
  requireRole(user, "HR");
  const [round, note] = await Promise.all([
    ids.roundId
      ? db.round.findUnique({
          where: { id: ids.roundId },
          select: { id: true, name: true, team: { select: { name: true } } },
        })
      : null,
    ids.noteId
      ? db.meetingNote.findUnique({ where: { id: ids.noteId }, select: { id: true, title: true } })
      : null,
  ]);
  return {
    round: round ? { id: round.id, name: round.name, teamName: round.team.name } : null,
    note,
  };
}
