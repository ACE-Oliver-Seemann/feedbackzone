import type { Prisma } from "@prisma/client";
import {
  ISSUE_SOURCES,
  OWNER_GROUPS,
  type IssueSource,
  type OwnerGroup,
} from "@/config/owner-groups";
import { requireRole } from "@/lib/authz";
import { parseLocalDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { forbidden, notFound, validationError } from "@/lib/errors";
import type { Role, SessionUser } from "@/lib/session";
import { charLength, cleanText } from "@/lib/text";

// IT-14 Zodpovednosti: HR's issues (IT-10) become responsibilities that the
// responsible manager or employee can see and work on.
//
// CONTRACT between backend and frontend. The exported types and function
// signatures below are fixed; the backend agent implements the bodies (and the
// API routes under src/app/api/responsibilities/**), the frontend agent builds
// the UI against them. Do not change a signature without telling the other side.
//
// Data: the existing Issue table, extended (assignee, related employee,
// priority, WAITING status, completedAt) + one new IssueComment table.
//
// Visibility (checked on the server for EVERY read and write, NFR-03):
// - HR: everything.
// - MANAGER: issues assigned to them, issues assigned to a member of their
//   team, and issues they created. Nothing else (other teams → 403).
// - EMPLOYEE: issues assigned to them only.
// Never sent to non-HR: the linked meeting note (`note` is null) and comments
// marked internal.

export const RESPONSIBILITY_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING", "DONE"] as const;
export type ResponsibilityStatus = (typeof RESPONSIBILITY_STATUSES)[number];

export const RESPONSIBILITY_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type ResponsibilityPriority = (typeof RESPONSIBILITY_PRIORITIES)[number];

/**
 * How the card relates to the viewer (for the visual distinction in the UI):
 * HR_ASSIGNED = created by HR; PERSONAL = created by the viewer for themselves;
 * TEAM = created by a manager for a team member (or seen by that member).
 */
export type ResponsibilityKind = "HR_ASSIGNED" | "PERSONAL" | "TEAM";

export type PersonRef = { id: string; name: string; role: Role };

export type ResponsibilityComment = {
  id: string;
  text: string;
  /** HR-only comment; never returned to managers or employees. */
  internal: boolean;
  createdAt: string;
  author: PersonRef;
};

export type ResponsibilityPermissions = {
  /** Change title, description, priority, deadline. */
  canEdit: boolean;
  /** Change the responsible person, related employee or team. */
  canReassign: boolean;
  canChangeStatus: boolean;
  canComment: boolean;
  /** Write HR-only comments (HR only). */
  canCommentInternal: boolean;
};

export type ResponsibilityItem = {
  id: string;
  title: string;
  description: string;
  status: ResponsibilityStatus;
  priority: ResponsibilityPriority;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  /** Deadline passed and not DONE (computed on the server, Europe/Bratislava day). */
  overdue: boolean;
  kind: ResponsibilityKind;
  createdBy: PersonRef;
  assignee: PersonRef | null;
  relatedEmployee: PersonRef | null;
  team: { id: string; name: string } | null;
  ownerGroup: OwnerGroup;
  source: IssueSource;
  round: { id: string; name: string } | null;
  /** HR meeting note; always null for non-HR viewers. */
  note: { id: string; title: string } | null;
  /** Comments visible to the viewer. */
  commentCount: number;
  permissions: ResponsibilityPermissions;
};

export type ResponsibilityDetail = ResponsibilityItem & {
  comments: ResponsibilityComment[];
};

export type ResponsibilityFilter = {
  /** "ACTIVE" = not DONE (default), "ALL" = no restriction. */
  status?: ResponsibilityStatus | "ACTIVE" | "ALL" | null;
  priority?: ResponsibilityPriority | null;
  teamId?: string | null;
  assigneeId?: string | null;
  relatedUserId?: string | null;
  kind?: ResponsibilityKind | null;
  overdue?: boolean | null;
  /** Default "deadline": overdue first, then nearest deadline, then priority. */
  sort?: "deadline" | "priority" | "created" | null;
};

export type ResponsibilityOptions = {
  canCreate: boolean;
  /** People the viewer may set as responsible person (HR: all managers and employees; manager: self + own team). */
  assignees: (PersonRef & { teamId: string | null; teamName: string | null })[];
  /** People the viewer may link as related employee (HR: all employees; manager: own team). */
  relatedEmployees: (PersonRef & {
    teamId: string | null;
    teamName: string | null;
  })[];
  /** Teams the viewer may choose (HR: all; manager: own team only). */
  teams: { id: string; name: string }[];
};

/** Input of create / update (API body). All strings; empty string = not set. */
export type ResponsibilityInput = {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  relatedUserId?: string | null;
  teamId?: string | null;
  ownerGroup?: string;
  priority?: string;
  dueDate?: string | null;
  status?: string;
  /** HR only, create only: link to round / meeting note (as in IT-10). */
  source?: string;
  roundId?: string | null;
  noteId?: string | null;
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;
const MAX_COMMENT = 2000;

const PRIORITY_RANK: Record<ResponsibilityPriority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};
const KINDS: readonly ResponsibilityKind[] = ["HR_ASSIGNED", "PERSONAL", "TEAM"];
const SORTS = ["deadline", "priority", "created"] as const;

const PERSON = { select: { id: true, name: true, role: true } } as const;

const ROW_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  createdAt: true,
  completedAt: true,
  ownerGroup: true,
  source: true,
  createdById: true,
  assigneeId: true,
  createdBy: PERSON,
  assignee: { select: { id: true, name: true, role: true, teamId: true } },
  relatedUser: PERSON,
  team: { select: { id: true, name: true } },
  round: { select: { id: true, name: true } },
  note: { select: { id: true, title: true } },
  comments: { select: { internal: true } },
} satisfies Prisma.IssueSelect;

type Row = Prisma.IssueGetPayload<{ select: typeof ROW_SELECT }>;

const COMMENT_SELECT = {
  id: true,
  text: true,
  internal: true,
  createdAt: true,
  author: PERSON,
} satisfies Prisma.IssueCommentSelect;

type CommentRow = Prisma.IssueCommentGetPayload<{
  select: typeof COMMENT_SELECT;
}>;

const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

const optionalId = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** Absent, null and "" mean "not given"; anything else must be a string. */
const isOptionalString = (value: unknown) =>
  value === undefined || value === null || typeof value === "string";

const given = (value: unknown) => value !== undefined && value !== null && value !== "";

const person = (value: { id: string; name: string; role: string }): PersonRef => ({
  id: value.id,
  name: value.name,
  role: value.role as Role,
});

// --- Visibility (NFR-03) ----------------------------------------------------

/** Database filter for the cards the viewer may see. */
function visibleWhere(user: SessionUser): Prisma.IssueWhereInput {
  if (user.role === "HR") return {};
  if (user.role === "MANAGER") {
    const or: Prisma.IssueWhereInput[] = [{ assigneeId: user.id }, { createdById: user.id }];
    if (user.teamId) or.push({ assignee: { teamId: user.teamId } });
    return { OR: or };
  }
  return { assigneeId: user.id };
}

/** Same rule as visibleWhere, for one loaded card. */
function canSee(user: SessionUser, row: Row): boolean {
  if (user.role === "HR") return true;
  if (row.assigneeId === user.id) return true;
  if (user.role === "MANAGER") {
    if (row.createdById === user.id) return true;
    return user.teamId !== null && row.assignee?.teamId === user.teamId;
  }
  return false;
}

function permissionsFor(user: SessionUser, row: Row): ResponsibilityPermissions {
  if (user.role === "HR") {
    return {
      canEdit: true,
      canReassign: true,
      canChangeStatus: true,
      canComment: true,
      canCommentInternal: true,
    };
  }
  const own = user.role === "MANAGER" && row.createdById === user.id;
  return {
    canEdit: own,
    canReassign: own,
    canChangeStatus: true,
    canComment: true,
    canCommentInternal: false,
  };
}

// --- Mapping ----------------------------------------------------------------

const pad = (value: number) => String(value).padStart(2, "0");

/** Today's date in Bratislava as YYYY-MM-DD. */
function todayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bratislava",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The calendar day of a deadline; parseLocalDate stores it as the end of that day in server time. */
const dueKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const isOverdue = (row: { status: string; dueDate: Date | null }, today: string) =>
  row.status !== "DONE" && row.dueDate !== null && dueKey(row.dueDate) < today;

function kindOf(row: Row): ResponsibilityKind {
  if (row.createdBy.role === "HR") return "HR_ASSIGNED";
  if (row.assigneeId === null || row.assigneeId === row.createdById) return "PERSONAL";
  return "TEAM";
}

function toItem(user: SessionUser, row: Row, today: string): ResponsibilityItem {
  const isHr = user.role === "HR";
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as ResponsibilityStatus,
    priority: (oneOf(RESPONSIBILITY_PRIORITIES, row.priority)
      ? row.priority
      : "MEDIUM") as ResponsibilityPriority,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    overdue: isOverdue(row, today),
    kind: kindOf(row),
    createdBy: person(row.createdBy),
    assignee: row.assignee ? person(row.assignee) : null,
    relatedEmployee: row.relatedUser ? person(row.relatedUser) : null,
    team: row.team,
    ownerGroup: row.ownerGroup as OwnerGroup,
    source: row.source as IssueSource,
    round: row.round,
    // Confidential HR meeting notes never leave HR.
    note: isHr ? row.note : null,
    commentCount: row.comments.filter((comment) => isHr || !comment.internal).length,
    permissions: permissionsFor(user, row),
  };
}

const toComment = (row: CommentRow): ResponsibilityComment => ({
  id: row.id,
  text: row.text,
  internal: row.internal,
  createdAt: row.createdAt.toISOString(),
  author: person(row.author),
});

/** Loads a card for the viewer: 404 when it does not exist, 403 when it is not theirs. */
async function loadVisible(user: SessionUser, id: string): Promise<Row> {
  const row = await db.issue.findUnique({ where: { id }, select: ROW_SELECT });
  if (!row) throw notFound();
  if (!canSee(user, row)) throw forbidden();
  return row;
}

async function detail(user: SessionUser, id: string): Promise<ResponsibilityDetail> {
  const row = await loadVisible(user, id);
  const comments = await db.issueComment.findMany({
    where: { issueId: id, ...(user.role === "HR" ? {} : { internal: false }) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: COMMENT_SELECT,
  });
  return {
    ...toItem(user, row, todayKey()),
    comments: comments.map(toComment),
  };
}

// --- Sorting ----------------------------------------------------------------

type Sortable = ResponsibilityItem;

const byDeadline = (a: Sortable, b: Sortable) => {
  if (a.dueDate === b.dueDate) return 0;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
};
const byPriority = (a: Sortable, b: Sortable) =>
  PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
const byNewest = (a: Sortable, b: Sortable) =>
  a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1;
const byOverdue = (a: Sortable, b: Sortable) => Number(b.overdue) - Number(a.overdue);

const chain =
  (...comparators: ((a: Sortable, b: Sortable) => number)[]) =>
  (a: Sortable, b: Sortable) => {
    for (const compare of comparators) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };

const SORTERS = {
  deadline: chain(byOverdue, byDeadline, byPriority, byNewest),
  priority: chain(byPriority, byOverdue, byDeadline, byNewest),
  created: chain(byNewest),
} as const;

// --- Read -------------------------------------------------------------------

/** GET /api/responsibilities — cards the viewer may see, filtered and sorted. */
export async function listResponsibilities(
  user: SessionUser,
  filter: ResponsibilityFilter = {},
): Promise<ResponsibilityItem[]> {
  // An unknown filter is a mistake to report, not a reason to show everything (QA BE-009).
  const fields: Record<string, string> = {};
  const status = filter.status ?? "ACTIVE";
  if (status !== "ACTIVE" && status !== "ALL" && !oneOf(RESPONSIBILITY_STATUSES, status)) {
    fields.status = "invalid";
  }
  if (filter.priority && !oneOf(RESPONSIBILITY_PRIORITIES, filter.priority)) {
    fields.priority = "invalid";
  }
  if (filter.kind && !oneOf(KINDS, filter.kind)) fields.kind = "invalid";
  if (filter.sort && !oneOf(SORTS, filter.sort)) fields.sort = "invalid";
  if (
    filter.overdue !== undefined &&
    filter.overdue !== null &&
    typeof filter.overdue !== "boolean"
  ) {
    fields.overdue = "invalid";
  }
  for (const key of ["teamId", "assigneeId", "relatedUserId"] as const) {
    if (!isOptionalString(filter[key])) fields[key] = "invalid";
  }
  if (Object.keys(fields).length > 0) throw validationError(fields);

  const where: Prisma.IssueWhereInput = {
    AND: [
      visibleWhere(user),
      status === "ACTIVE" ? { status: { not: "DONE" } } : status === "ALL" ? {} : { status },
      filter.priority ? { priority: filter.priority } : {},
      filter.teamId ? { teamId: filter.teamId } : {},
      filter.assigneeId ? { assigneeId: filter.assigneeId } : {},
      filter.relatedUserId ? { relatedUserId: filter.relatedUserId } : {},
    ],
  };

  const rows = await db.issue.findMany({ where, select: ROW_SELECT });
  const today = todayKey();
  let items = rows.map((row) => toItem(user, row, today));
  if (filter.kind) items = items.filter((item) => item.kind === filter.kind);
  if (filter.overdue === true) items = items.filter((item) => item.overdue);
  if (filter.overdue === false) items = items.filter((item) => !item.overdue);
  return items.sort(SORTERS[filter.sort ?? "deadline"]);
}

/** GET /api/responsibilities/:id — one card with the comments the viewer may see. 404 unknown, 403 not visible. */
export async function getResponsibility(
  user: SessionUser,
  id: string,
): Promise<ResponsibilityDetail> {
  return detail(user, id);
}

// --- People the viewer may pick --------------------------------------------

type Candidate = {
  id: string;
  name: string;
  role: string;
  teamId: string | null;
};

/** Who the viewer may set as the responsible person. Null = nobody (cannot create). */
function assigneeAllowed(user: SessionUser, candidate: Candidate): boolean {
  if (user.role === "HR") return candidate.role === "MANAGER" || candidate.role === "EMPLOYEE";
  if (user.role === "MANAGER") {
    if (candidate.id === user.id) return true;
    return (
      candidate.role === "EMPLOYEE" && user.teamId !== null && candidate.teamId === user.teamId
    );
  }
  return false;
}

/** Who the viewer may link as the related employee. */
function relatedAllowed(user: SessionUser, candidate: Candidate): boolean {
  if (candidate.role !== "EMPLOYEE") return false;
  if (user.role === "HR") return true;
  return user.role === "MANAGER" && user.teamId !== null && candidate.teamId === user.teamId;
}

const findCandidate = (id: string) =>
  db.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true, teamId: true },
  });

/**
 * Validates a person field: "unknown" when the id does not exist, "not_allowed"
 * when the viewer may not pick that person (e.g. another team's employee).
 */
async function checkPerson(
  value: string,
  allowed: (candidate: Candidate) => boolean,
): Promise<{ candidate: Candidate | null; error: string | null }> {
  const candidate = await findCandidate(value);
  if (!candidate) return { candidate: null, error: "unknown" };
  if (!allowed(candidate)) return { candidate, error: "not_allowed" };
  return { candidate, error: null };
}

/** GET /api/responsibilities/options — choices for the create/edit form. */
export async function getResponsibilityOptions(user: SessionUser): Promise<ResponsibilityOptions> {
  if (user.role === "EMPLOYEE") {
    return { canCreate: false, assignees: [], relatedEmployees: [], teams: [] };
  }
  const teamFilter = user.role === "HR" ? {} : { teamId: user.teamId ?? "__none__" };
  const [people, teams] = await Promise.all([
    db.user.findMany({
      where:
        user.role === "HR"
          ? { role: { in: ["MANAGER", "EMPLOYEE"] } }
          : { OR: [{ id: user.id }, { ...teamFilter, role: "EMPLOYEE" }] },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        role: true,
        teamId: true,
        team: { select: { name: true } },
      },
    }),
    db.team.findMany({
      where: user.role === "HR" ? {} : { id: user.teamId ?? "__none__" },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  const entry = (item: (typeof people)[number]) => ({
    ...person(item),
    teamId: item.teamId,
    teamName: item.team?.name ?? null,
  });
  return {
    canCreate: true,
    assignees: people.filter((item) => assigneeAllowed(user, item)).map(entry),
    relatedEmployees: people.filter((item) => relatedAllowed(user, item)).map(entry),
    teams,
  };
}

// --- Write ------------------------------------------------------------------

function checkTitle(value: unknown, fields: Record<string, string>): string {
  if (!isOptionalString(value)) {
    fields.title = "invalid";
    return "";
  }
  const title = cleanText(value);
  if (charLength(title) < 3) fields.title = "too_short";
  else if (charLength(title) > MAX_TITLE) fields.title = "too_long";
  return title;
}

function checkDescription(value: unknown, fields: Record<string, string>): string {
  if (!isOptionalString(value)) {
    fields.description = "invalid";
    return "";
  }
  const description = cleanText(value);
  if (charLength(description) > MAX_DESCRIPTION) fields.description = "too_long";
  return description;
}

function checkDueDate(value: unknown, fields: Record<string, string>): Date | null {
  if (!given(value)) return null;
  const parsed = parseLocalDate(value);
  if (!parsed) fields.dueDate = "invalid";
  return parsed;
}

const completedAtFor = (
  status: string,
  previous: { status: string; completedAt: Date | null } | null,
) =>
  status === "DONE"
    ? previous?.status === "DONE"
      ? (previous.completedAt ?? new Date())
      : new Date()
    : null;

/** POST /api/responsibilities — HR (anyone, any team) or MANAGER (self or own team). Employee → 403. */
export async function createResponsibility(
  user: SessionUser,
  input: Record<string, unknown>,
): Promise<ResponsibilityDetail> {
  requireRole(user, "HR", "MANAGER");
  if (user.role === "MANAGER" && !user.teamId) throw forbidden();
  const isHr = user.role === "HR";
  const fields: Record<string, string> = {};

  const title = checkTitle(input.title, fields);
  const description = checkDescription(input.description, fields);
  for (const key of [
    "assigneeId",
    "relatedUserId",
    "teamId",
    "ownerGroup",
    "priority",
    "dueDate",
    "status",
    "source",
    "roundId",
    "noteId",
  ] as const) {
    if (!isOptionalString(input[key])) fields[key] = "invalid";
  }

  const priority = given(input.priority) ? input.priority : "MEDIUM";
  if (!oneOf(RESPONSIBILITY_PRIORITIES, priority)) fields.priority = "invalid";
  const status = given(input.status) ? input.status : "OPEN";
  if (!oneOf(RESPONSIBILITY_STATUSES, status)) fields.status = "invalid";
  const dueDate = checkDueDate(input.dueDate, fields);

  // Responsible person: a manager defaults to themselves.
  const assigneeId = optionalId(input.assigneeId) ?? (isHr ? null : user.id);
  let assignee: Candidate | null = null;
  if (assigneeId && !fields.assigneeId) {
    const checked = await checkPerson(assigneeId, (candidate) => assigneeAllowed(user, candidate));
    if (checked.error) fields.assigneeId = checked.error;
    assignee = checked.candidate;
  }

  const relatedUserId = optionalId(input.relatedUserId);
  let related: Candidate | null = null;
  if (relatedUserId && !fields.relatedUserId) {
    const checked = await checkPerson(relatedUserId, (candidate) =>
      relatedAllowed(user, candidate),
    );
    if (checked.error) fields.relatedUserId = checked.error;
    related = checked.candidate;
  }

  let teamId = optionalId(input.teamId);
  const roundId = optionalId(input.roundId);
  const noteId = optionalId(input.noteId);
  let ownerGroup: string;
  let source: string;

  const round = roundId
    ? await db.round.findUnique({
        where: { id: roundId },
        select: { id: true, teamId: true },
      })
    : null;
  if (roundId && !round) fields.roundId = "unknown";

  if (isHr) {
    ownerGroup = given(input.ownerGroup)
      ? String(input.ownerGroup)
      : assignee
        ? "TEAM_MANAGER"
        : "";
    if (!oneOf(OWNER_GROUPS, ownerGroup)) fields.ownerGroup = "invalid";
    source = given(input.source) ? String(input.source) : "OTHER";
    if (!oneOf(ISSUE_SOURCES, source)) fields.source = "invalid";
    if (noteId) {
      const note = await db.meetingNote.findUnique({
        where: { id: noteId },
        select: { id: true },
      });
      if (!note) fields.noteId = "unknown";
    }
    // A card raised from a round belongs to that round's team; otherwise the
    // given team, or the team of the responsible / related person.
    if (round) teamId = round.teamId;
    else if (teamId) {
      const team = await db.team.findUnique({
        where: { id: teamId },
        select: { id: true },
      });
      if (!team) fields.teamId = "unknown";
    } else {
      teamId = assignee?.teamId ?? related?.teamId ?? null;
    }
  } else {
    // A manager's card always belongs to their own team.
    ownerGroup = "TEAM_MANAGER";
    source = "OTHER";
    if (teamId && teamId !== user.teamId) fields.teamId = "not_allowed";
    if (noteId) fields.noteId = "not_allowed";
    if (round && round.teamId !== user.teamId) fields.roundId = "not_allowed";
    teamId = user.teamId;
  }

  if (Object.keys(fields).length > 0) throw validationError(fields);

  const created = await db.issue.create({
    data: {
      title,
      description,
      priority: priority as string,
      status: status as string,
      completedAt: completedAtFor(status as string, null),
      dueDate,
      ownerGroup,
      source,
      teamId,
      roundId: round?.id ?? null,
      noteId: isHr ? noteId : null,
      assigneeId: assignee?.id ?? null,
      relatedUserId: related?.id ?? null,
      createdById: user.id,
    },
    select: { id: true },
  });
  return detail(user, created.id);
}

/** PATCH /api/responsibilities/:id — fields allowed by the viewer's permissions. */
export async function updateResponsibility(
  user: SessionUser,
  id: string,
  input: Record<string, unknown>,
): Promise<ResponsibilityDetail> {
  const row = await loadVisible(user, id);
  const permissions = permissionsFor(user, row);
  const isHr = user.role === "HR";

  const has = (key: string) => input[key] !== undefined;
  // A field the viewer may not change is refused as a whole, never half-applied.
  const editKeys = ["title", "description", "priority", "dueDate"];
  const reassignKeys = ["assigneeId", "relatedUserId", "teamId", "ownerGroup"];
  if (editKeys.some(has) && !permissions.canEdit) throw forbidden();
  if (reassignKeys.some(has) && !permissions.canReassign) throw forbidden();
  if (has("status") && !permissions.canChangeStatus) throw forbidden();
  // Only HR may change the owner group or move a card to another team.
  // (A manager's card always stays in the manager's own team.)
  if ((has("ownerGroup") || has("teamId")) && !isHr) throw forbidden();

  const fields: Record<string, string> = {};
  const data: Prisma.IssueUncheckedUpdateInput = {};

  if (has("title")) data.title = checkTitle(input.title, fields);
  if (has("description")) data.description = checkDescription(input.description, fields);
  if (has("priority")) {
    if (oneOf(RESPONSIBILITY_PRIORITIES, input.priority)) data.priority = input.priority;
    else fields.priority = "invalid";
  }
  if (has("dueDate")) {
    if (!isOptionalString(input.dueDate)) fields.dueDate = "invalid";
    else data.dueDate = checkDueDate(input.dueDate, fields);
  }
  if (has("status")) {
    if (oneOf(RESPONSIBILITY_STATUSES, input.status)) {
      data.status = input.status;
      data.completedAt = completedAtFor(input.status, {
        status: row.status,
        completedAt: row.completedAt,
      });
    } else fields.status = "invalid";
  }
  if (has("ownerGroup")) {
    if (oneOf(OWNER_GROUPS, input.ownerGroup)) data.ownerGroup = input.ownerGroup;
    else fields.ownerGroup = "invalid";
  }
  if (has("assigneeId")) {
    if (!isOptionalString(input.assigneeId)) fields.assigneeId = "invalid";
    else {
      const assigneeId = optionalId(input.assigneeId);
      if (!assigneeId) {
        // A manager's card always has someone responsible; HR may leave it unassigned.
        if (isHr) data.assigneeId = null;
        else fields.assigneeId = "required";
      } else {
        const checked = await checkPerson(assigneeId, (candidate) =>
          assigneeAllowed(user, candidate),
        );
        if (checked.error) fields.assigneeId = checked.error;
        else {
          data.assigneeId = assigneeId;
          // Reassigning to someone in another team moves the card to that team,
          // unless HR sets the team explicitly in the same request (QA IT-14 #1).
          if (isHr && !has("teamId") && checked.candidate?.teamId) {
            data.teamId = checked.candidate.teamId;
          }
        }
      }
    }
  }
  if (has("relatedUserId")) {
    if (!isOptionalString(input.relatedUserId)) fields.relatedUserId = "invalid";
    else {
      const relatedUserId = optionalId(input.relatedUserId);
      if (!relatedUserId) data.relatedUserId = null;
      else {
        const checked = await checkPerson(relatedUserId, (candidate) =>
          relatedAllowed(user, candidate),
        );
        if (checked.error) fields.relatedUserId = checked.error;
        else data.relatedUserId = relatedUserId;
      }
    }
  }
  if (has("teamId")) {
    if (!isOptionalString(input.teamId)) fields.teamId = "invalid";
    else {
      const teamId = optionalId(input.teamId);
      if (!teamId) data.teamId = null;
      else {
        const team = await db.team.findUnique({
          where: { id: teamId },
          select: { id: true },
        });
        if (team) data.teamId = teamId;
        else fields.teamId = "unknown";
      }
    }
  }

  if (Object.keys(fields).length > 0) throw validationError(fields);
  if (Object.keys(data).length === 0) throw validationError({ status: "required" });

  await db.issue.update({ where: { id }, data });
  return detail(user, id);
}

/** POST /api/responsibilities/:id/comments — body { text, internal? }. */
export async function addResponsibilityComment(
  user: SessionUser,
  id: string,
  input: Record<string, unknown>,
): Promise<ResponsibilityComment> {
  const row = await loadVisible(user, id);
  const permissions = permissionsFor(user, row);
  if (!permissions.canComment) throw forbidden();

  const fields: Record<string, string> = {};
  if (input.internal !== undefined && typeof input.internal !== "boolean") {
    fields.internal = "invalid";
  }
  const internal = input.internal === true;
  if (internal && !permissions.canCommentInternal) throw forbidden();

  if (typeof input.text !== "string") fields.text = "required";
  const text = cleanText(input.text);
  if (!fields.text) {
    if (!text) fields.text = "required";
    else if (charLength(text) > MAX_COMMENT) fields.text = "too_long";
  }
  if (Object.keys(fields).length > 0) throw validationError(fields);

  const comment = await db.issueComment.create({
    data: { issueId: id, authorId: user.id, text, internal },
    select: COMMENT_SELECT,
  });
  return toComment(comment);
}
