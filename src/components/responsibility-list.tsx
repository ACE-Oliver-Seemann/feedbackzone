import Link from "next/link";
import type { ResponsibilityItem } from "@/server/responsibilities";
import { cx } from "@/components/ui/cx";
import { IconCalendar, IconMessage, IconUser, IconUsers } from "@/components/ui/icons";
import { InsetList, InsetRow } from "@/components/ui/surface";
import { FORWARD } from "@/lib/page-motion";
import { formatDate, t } from "@/lib/texts.sk";
import { KindMarker, OverdueBadge, PriorityLabel, StatusBadge } from "./responsibility-meta";

const r = t.responsibilities;

/** Cards of responsibilities (IT-14). The whole row opens the detail. */
export function ResponsibilityList({ items }: { items: ResponsibilityItem[] }) {
  return (
    <InsetList>
      {items.map((item) => (
        <ResponsibilityRow key={item.id} item={item} />
      ))}
    </InsetList>
  );
}

function ResponsibilityRow({ item }: { item: ResponsibilityItem }) {
  const done = item.status === "DONE";
  return (
    <InsetRow
      interactive
      className={cx(
        "py-5",
        // Overdue: a red accent bar on the left, plus the "Po termíne" label (not color alone).
        item.overdue && "before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-red-500",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <KindMarker kind={item.kind} />
        {item.team && <span className="text-xs text-muted">{item.team.name}</span>}
      </div>
      <h2 className="mt-1.5 text-[0.9375rem] leading-snug font-semibold break-words text-ink">
        <Link
          href={`/responsibilities/${item.id}`}
          transitionTypes={FORWARD}
          className={cx(
            "rounded after:absolute after:inset-0 after:content-['']",
            done && "text-ink-soft",
          )}
        >
          {item.title}
        </Link>
      </h2>
      {item.description && (
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed break-words text-ink-soft">
          {item.description}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <StatusBadge status={item.status} />
        <PriorityLabel priority={item.priority} />
        {item.overdue && <OverdueBadge />}
      </div>
      <p className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <IconUser size={14} />
          <span className="sr-only">{r.assignee}: </span>
          {item.assignee?.name ?? r.assigneeNone}
        </span>
        {item.relatedEmployee && (
          <span className="inline-flex items-center gap-1">
            <IconUsers size={14} />
            <span className="sr-only">{r.relatedEmployee}: </span>
            {item.relatedEmployee.name}
          </span>
        )}
        <span
          className={cx(
            "inline-flex items-center gap-1",
            item.overdue && "font-semibold text-red-700",
          )}
        >
          <IconCalendar size={14} />
          {item.dueDate ? r.due(formatDate(item.dueDate)) : r.dueNone}
        </span>
        <span className="inline-flex items-center gap-1">
          <IconMessage size={14} />
          {r.comments(item.commentCount)}
        </span>
        <span>{r.createdByLine(item.createdBy.name, t.roles[item.createdBy.role], formatDate(item.createdAt))}</span>
      </p>
    </InsetRow>
  );
}
