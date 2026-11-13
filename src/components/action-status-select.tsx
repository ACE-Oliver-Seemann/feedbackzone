"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui/cx";
import { IconCheck, IconChevronDown } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { errorForStatus, t } from "@/lib/texts.sk";

// Mirrors ACTION_STATUSES in src/server/actions.ts; the server validates.
const STATUSES = ["PLANNED", "IN_PROGRESS", "DONE"] as const;
type Status = (typeof STATUSES)[number];

// Same dot colors as the read-only status badges (neutral, info, success).
const DOT: Record<Status, string> = {
  PLANNED: "bg-slate-400",
  IN_PROGRESS: "bg-sky-500",
  DONE: "bg-emerald-500",
};

// How long the small check next to the select stays after a step is marked done.
const DONE_CHECK_MS = 1800;

export function ActionStatusSelect({ actionId, status }: { actionId: string; status: Status }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState<Status>(status);
  // The status can change elsewhere (another tab, another person). When the
  // page data is refreshed, show what the server has (E2E2-002).
  const [serverStatus, setServerStatus] = useState<Status>(status);
  if (serverStatus !== status) {
    setServerStatus(status);
    setValue(status);
  }
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneCheck, setDoneCheck] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function change(next: Status) {
    const previous = value;
    setValue(next);
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/actions/${actionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) throw new Error(String(response.status));
      router.refresh();
      toast.success(t.toasts.actionStatusSaved);
      // Confirmation only after the server accepted the change: a toast (also
      // announced) for every status, plus a small check next to "Hotové".
      clearTimeout(timer.current);
      setDoneCheck(next === "DONE");
      if (next === "DONE") timer.current = setTimeout(() => setDoneCheck(false), DONE_CHECK_MS);
    } catch (caught) {
      setValue(previous);
      setError(errorForStatus(caught instanceof Error ? Number(caught.message) : 0));
    }
    setPending(false);
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="relative inline-flex">
        {doneCheck && (
          <span
            className="pointer-events-none absolute top-1/2 right-full mr-1.5 -translate-y-1/2"
            aria-hidden="true"
          >
            <span className="grid size-6 animate-pop place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <IconCheck size={14} strokeWidth={2.25} />
            </span>
          </span>
        )}
        <span
          className={cx(
            "pointer-events-none absolute top-1/2 left-3 size-1.5 -translate-y-1/2 rounded-full transition-colors duration-200",
            DOT[value],
          )}
          aria-hidden="true"
        />
        <select
          aria-label={t.actions.status}
          value={value}
          disabled={pending}
          aria-busy={pending}
          onChange={(event) => change(event.target.value as Status)}
          className={cx(
            "h-8 appearance-none rounded-full pointer-coarse:h-11 bg-surface pr-8 pl-6 text-sm font-medium text-ink",
            "ring-1 ring-inset ring-line-strong transition-[box-shadow,opacity] duration-150",
            "hover:ring-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
            "disabled:cursor-wait disabled:opacity-60",
          )}
        >
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {t.actions.statuses[item]}
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
