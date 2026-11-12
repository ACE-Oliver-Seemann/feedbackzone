"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorForStatus, t } from "@/lib/texts.sk";

// Mirrors ACTION_STATUSES in src/server/actions.ts; the server validates.
const STATUSES = ["PLANNED", "IN_PROGRESS", "DONE"] as const;
type Status = (typeof STATUSES)[number];

export function ActionStatusSelect({ actionId, status }: { actionId: string; status: Status }) {
  const router = useRouter();
  const [value, setValue] = useState<Status>(status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (caught) {
      setValue(previous);
      setError(errorForStatus(caught instanceof Error ? Number(caught.message) : 0));
    }
    setPending(false);
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <select
        aria-label={t.actions.status}
        value={value}
        disabled={pending}
        onChange={(event) => change(event.target.value as Status)}
        className="rounded-md border border-slate-300 bg-white px-2 py-3 text-sm disabled:opacity-60"
      >
        {STATUSES.map((item) => (
          <option key={item} value={item}>
            {t.actions.statuses[item]}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
