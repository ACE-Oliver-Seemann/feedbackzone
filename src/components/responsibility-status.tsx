"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ResponsibilityStatus } from "@/server/responsibilities";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cx } from "@/components/ui/cx";
import { IconCheck, IconChevronDown } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { t } from "@/lib/texts.sk";
import { failureMessage, SessionExpiredNotice, STATUS_DOT, STATUSES } from "./responsibility-meta";

const r = t.responsibilities;

// Pill select, the same look as ActionStatusSelect and IssueControls.
const selectClass = cx(
  "h-10 max-w-full appearance-none rounded-full bg-surface pr-9 pl-7 text-sm font-medium text-ink pointer-coarse:h-11",
  "ring-1 ring-inset ring-line-strong transition-[box-shadow,opacity] duration-150",
  "hover:ring-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
  "disabled:cursor-wait disabled:opacity-60",
);

/** Status of one responsibility + "Označiť ako dokončené" (IT-14). */
export function ResponsibilityStatusControl({ id, status }: { id: string; status: ResponsibilityStatus }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(status);
  // Another session may have changed it; after a refresh show what the server has.
  const [server, setServer] = useState(status);
  if (server !== status) {
    setServer(status);
    setValue(status);
  }
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function change(next: ResponsibilityStatus) {
    const previous = value;
    setValue(next);
    setPending(true);
    setError(null);
    setSessionExpired(false);
    try {
      const response = await fetch(`/api/responsibilities/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (response.ok) {
        toast.success(next === "DONE" ? t.toasts.responsibilityDone : t.toasts.responsibilityStatusSaved);
        router.refresh();
      } else {
        setValue(previous);
        if (response.status === 401) setSessionExpired(true);
        else setError(failureMessage(response.status));
      }
    } catch {
      setValue(previous);
      setError(t.errors.generic);
    }
    setPending(false);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="relative inline-flex max-w-full">
          <span
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute top-1/2 left-3 size-2 -translate-y-1/2 rounded-full transition-colors duration-200",
              STATUS_DOT[value],
            )}
          />
          <select
            aria-label={r.statusLabel}
            value={value}
            disabled={pending}
            aria-busy={pending}
            onChange={(event) => change(event.target.value as ResponsibilityStatus)}
            className={selectClass}
          >
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {r.statuses[item]}
              </option>
            ))}
          </select>
          <IconChevronDown
            size={14}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
          />
        </span>
        {value !== "DONE" && (
          <Button variant="secondary" onClick={() => setConfirming(true)} disabled={pending}>
            <IconCheck size={16} className="-ml-0.5 text-emerald-600" />
            {r.markDone}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 animate-rise text-sm text-red-700">
          {error}
        </p>
      )}
      {sessionExpired && <SessionExpiredNotice className="mt-3" />}
      <ConfirmDialog
        open={confirming}
        title={r.markDoneConfirmTitle}
        text={r.markDoneConfirmText}
        confirmLabel={r.markDone}
        onConfirm={() => {
          setConfirming(false);
          void change("DONE");
        }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
