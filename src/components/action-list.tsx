import { ActionStatusSelect } from "@/components/action-status-select";
import { Badge } from "@/components/round-list";
import { formatDate, t } from "@/lib/texts.sk";
import type { ActionItem, ActionStatus } from "@/server/actions";

const STATUS_STYLE: Record<ActionStatus, string> = {
  PLANNED: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-sky-100 text-sky-800",
  DONE: "bg-emerald-100 text-emerald-800",
};

/** Actions ("kroky") with their status. `editable` adds the status selector (MVP-13). */
export function ActionList({
  actions,
  editable = false,
  emptyText = t.actions.empty,
}: {
  actions: ActionItem[];
  editable?: boolean;
  emptyText?: string;
}) {
  if (actions.length === 0) {
    return <p className="mt-3 text-sm text-slate-600">{emptyText}</p>;
  }
  return (
    <ul className="mt-3 space-y-3">
      {actions.map((action) => (
        <li key={action.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-medium">{action.topic}</h3>
            {editable ? (
              <ActionStatusSelect actionId={action.id} status={action.status} />
            ) : (
              <Badge className={STATUS_STYLE[action.status]}>
                {t.actions.statuses[action.status]}
              </Badge>
            )}
          </div>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{action.description}</p>
          <p className="mt-2 text-xs text-slate-500">{t.actions.due(formatDate(action.dueDate))}</p>
        </li>
      ))}
    </ul>
  );
}
