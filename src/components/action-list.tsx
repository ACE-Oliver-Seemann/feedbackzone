import { ActionStatusSelect } from "@/components/action-status-select";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { IconCalendar, IconClipboard } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/page";
import { InsetList, InsetRow } from "@/components/ui/surface";
import { formatDate, t } from "@/lib/texts.sk";
import type { ActionItem, ActionStatus } from "@/server/actions";

const STATUS_TONE: Record<ActionStatus, BadgeTone> = {
  PLANNED: "neutral",
  IN_PROGRESS: "info",
  DONE: "success",
};

/**
 * Actions ("kroky") with their status. `editable` adds the status selector (MVP-13).
 * `compact` renders the empty state as a single line (used inside the team timeline).
 */
export function ActionList({
  actions,
  editable = false,
  compact = false,
  emptyText = t.actions.empty,
}: {
  actions: ActionItem[];
  editable?: boolean;
  compact?: boolean;
  emptyText?: string;
}) {
  if (actions.length === 0) {
    return compact ? (
      <p className="text-sm text-muted">{emptyText}</p>
    ) : (
      <EmptyState icon={<IconClipboard size={20} />} title={emptyText} />
    );
  }
  return (
    <InsetList>
      {actions.map((action) => (
        <InsetRow key={action.id}>
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <h3 className="min-w-0 pt-0.5 font-semibold tracking-[-0.005em] text-ink">
              {action.topic}
            </h3>
            {editable ? (
              <ActionStatusSelect actionId={action.id} status={action.status} />
            ) : (
              <Badge tone={STATUS_TONE[action.status]}>{t.actions.statuses[action.status]}</Badge>
            )}
          </div>
          <p className="mt-1 whitespace-pre-line break-words text-[0.9375rem] leading-relaxed text-ink-soft">
            {action.description}
          </p>
          <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-muted">
            <IconCalendar size={14} />
            {t.actions.due(formatDate(action.dueDate))}
          </p>
        </InsetRow>
      ))}
    </InsetList>
  );
}
