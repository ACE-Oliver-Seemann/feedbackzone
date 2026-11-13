import type {
  ResponsibilityKind,
  ResponsibilityOptions,
  ResponsibilityPriority,
  ResponsibilityStatus,
} from "@/server/responsibilities";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cx } from "@/components/ui/cx";
import { IconClipboard, IconClock, IconUser, IconUsers } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { t } from "@/lib/texts.sk";

// IT-14: shared look of status, priority, kind and "overdue" of a responsibility.
// Mirrors RESPONSIBILITY_STATUSES / _PRIORITIES in src/server/responsibilities.ts
// (only types are imported from there, so client components stay free of server code).

export const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING", "DONE"] as const satisfies readonly ResponsibilityStatus[];
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const satisfies readonly ResponsibilityPriority[];
export const KINDS = ["HR_ASSIGNED", "TEAM", "PERSONAL"] as const satisfies readonly ResponsibilityKind[];
// Mirror src/config/owner-groups.ts; the server validates again.
export const OWNER_GROUPS = ["FACILITY", "IT_SUPPORT", "HR", "MANAGEMENT", "TEAM_MANAGER", "OTHER"] as const;
export const SOURCES = ["SURVEY", "MEETING", "OTHER"] as const;

export const STATUS_TONE: Record<ResponsibilityStatus, BadgeTone> = {
  OPEN: "neutral",
  IN_PROGRESS: "info",
  WAITING: "warning",
  DONE: "success",
};

/** Dot colors of the status select (same as the badge dots). */
export const STATUS_DOT: Record<ResponsibilityStatus, string> = {
  OPEN: "bg-slate-400",
  IN_PROGRESS: "bg-sky-500",
  WAITING: "bg-amber-500",
  DONE: "bg-emerald-500",
};

export function StatusBadge({ status }: { status: ResponsibilityStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{t.responsibilities.statuses[status]}</Badge>;
}

const PRIORITY_LEVEL: Record<ResponsibilityPriority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 };
const PRIORITY_COLOR: Record<ResponsibilityPriority, string> = {
  LOW: "text-ink-soft",
  MEDIUM: "text-sky-800",
  HIGH: "text-amber-800",
  URGENT: "text-red-700",
};

/**
 * Priority as text with a "signal bars" icon: the number of filled bars
 * repeats the level, so priority is not carried by color alone.
 */
export function PriorityLabel({
  priority,
  className,
}: {
  priority: ResponsibilityPriority;
  className?: string;
}) {
  const level = PRIORITY_LEVEL[priority];
  const label = t.responsibilities.priorities[priority];
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap text-xs font-semibold",
        PRIORITY_COLOR[priority],
        className,
      )}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
        {[0, 1, 2, 3].map((index) => (
          <rect
            key={index}
            x={index * 3.5 + 0.5}
            y={10 - index * 2.5}
            width="2.5"
            height={3 + index * 2.5}
            rx="0.75"
            fill="currentColor"
            opacity={index < level ? 1 : 0.22}
          />
        ))}
      </svg>
      <span className="sr-only">{t.responsibilities.priorityLabel(label)}</span>
      <span aria-hidden="true">{label}</span>
    </span>
  );
}

const KIND_ICON: Record<ResponsibilityKind, typeof IconUser> = {
  HR_ASSIGNED: IconClipboard,
  TEAM: IconUsers,
  PERSONAL: IconUser,
};
const KIND_COLOR: Record<ResponsibilityKind, string> = {
  HR_ASSIGNED: "text-brand-700",
  TEAM: "text-violet-700",
  PERSONAL: "text-ink-soft",
};

/** Small labeled marker: assigned by HR, team, or personal reminder. */
export function KindMarker({ kind, className }: { kind: ResponsibilityKind; className?: string }) {
  const Icon = KIND_ICON[kind];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 text-xs font-semibold tracking-wide uppercase",
        KIND_COLOR[kind],
        className,
      )}
    >
      <Icon size={14} />
      {t.responsibilities.kinds[kind]}
    </span>
  );
}

/** 401 after a save: what happened and a login link in a new tab (input stays). */
export function SessionExpiredNotice({ className }: { className?: string }) {
  return (
    <Notice tone="error" role="alert" title={t.responsibilities.sessionExpiredTitle} className={className}>
      <p>{t.responsibilities.sessionExpiredText}</p>
      <a
        href="/login"
        target="_blank"
        rel="noopener"
        className="mt-1 inline-block rounded font-semibold underline underline-offset-2 hover:text-red-950"
      >
        {t.responsibilities.sessionExpiredLink}
      </a>
    </Notice>
  );
}

/** Message for a failed save other than 400 and 401. */
export function failureMessage(status: number): string {
  if (status === 403) return t.responsibilities.forbidden;
  if (status === 404) return t.responsibilities.notFound;
  return t.errors.generic;
}

/** yyyy-mm-dd of a date in the app's time zone, for <input type="date">. */
export function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bratislava" }).format(new Date(iso));
}

type Person = ResponsibilityOptions["assignees"][number];

/** People of a select, grouped by team; people without a team come first. */
export function PersonOptions({ people }: { people: Person[] }) {
  const groups = new Map<string, Person[]>();
  for (const person of people) {
    const key = person.teamName ?? "";
    groups.set(key, [...(groups.get(key) ?? []), person]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b, "sk")))
    .map(([teamName, list]) => {
      const options = list.map((person) => (
        <option key={person.id} value={person.id}>
          {person.name}
        </option>
      ));
      return teamName ? (
        <optgroup key={teamName} label={teamName}>
          {options}
        </optgroup>
      ) : (
        options
      );
    });
}

/** "Po termíne": red pill with a clock icon (not color alone). */
export function OverdueBadge() {
  return (
    <Badge tone="danger" dot={false}>
      <IconClock size={13} className="-ml-0.5" />
      {t.responsibilities.overdue}
    </Badge>
  );
}
