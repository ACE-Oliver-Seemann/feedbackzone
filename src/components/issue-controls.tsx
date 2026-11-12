"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cx } from "@/components/ui/cx";
import { IconChevronDown } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { errorForStatus, t } from "@/lib/texts.sk";

const OWNER_GROUPS = ["FACILITY", "IT_SUPPORT", "HR", "MANAGEMENT", "TEAM_MANAGER", "OTHER"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "DONE"] as const;
type OwnerGroup = (typeof OWNER_GROUPS)[number];
type Status = (typeof STATUSES)[number];

// Same dot colors as the read-only status badges (neutral, info, success).
const DOT: Record<Status, string> = {
  OPEN: "bg-slate-400",
  IN_PROGRESS: "bg-sky-500",
  DONE: "bg-emerald-500",
};

// Small pill select, the same look as ActionStatusSelect.
const selectClass = cx(
  "h-8 max-w-full appearance-none rounded-full pointer-coarse:h-11 bg-surface pr-8 text-sm font-medium text-ink",
  "ring-1 ring-inset ring-line-strong transition-[box-shadow,opacity] duration-150",
  "hover:ring-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
  "disabled:cursor-wait disabled:opacity-60",
);

/** Status and owner group of one issue, changed in place (IT-10). */
export function IssueControls({
  issueId,
  status,
  ownerGroup,
}: {
  issueId: string;
  status: Status;
  ownerGroup: OwnerGroup;
}) {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState({ status, ownerGroup });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(patch: { status?: Status; ownerGroup?: OwnerGroup }) {
    const previous = current;
    setCurrent({ ...current, ...patch });
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/hr/issues/${issueId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error(String(response.status));
      router.refresh();
      toast.success(t.toasts.issueSaved);
    } catch (caught) {
      setCurrent(previous);
      setError(errorForStatus(caught instanceof Error ? Number(caught.message) : 0));
    }
    setPending(false);
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="relative inline-flex max-w-full">
        <select
          aria-label={t.issues.ownerGroup}
          value={current.ownerGroup}
          disabled={pending}
          aria-busy={pending}
          onChange={(event) => change({ ownerGroup: event.target.value as OwnerGroup })}
          className={cx(selectClass, "pl-3")}
        >
          {OWNER_GROUPS.map((group) => (
            <option key={group} value={group}>
              {t.ownerGroups[group]}
            </option>
          ))}
        </select>
        <IconChevronDown
          size={14}
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted"
        />
      </span>
      <span className="relative inline-flex max-w-full">
        <span
          className={cx(
            "pointer-events-none absolute top-1/2 left-3 size-1.5 -translate-y-1/2 rounded-full transition-colors duration-200",
            DOT[current.status],
          )}
          aria-hidden="true"
        />
        <select
          aria-label={t.issues.status}
          value={current.status}
          disabled={pending}
          aria-busy={pending}
          onChange={(event) => change({ status: event.target.value as Status })}
          className={cx(selectClass, "pl-6")}
        >
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {t.issueStatuses[item]}
            </option>
          ))}
        </select>
        <IconChevronDown
          size={14}
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted"
        />
      </span>
      {error && (
        <span role="alert" className="animate-rise text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
