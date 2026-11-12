"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorForStatus, t } from "@/lib/texts.sk";

// "Spustiť" / "Uzavrieť" (MVP-05).
export function RoundTransitionButton({
  roundId,
  action,
}: {
  roundId: string;
  action: "open" | "close";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!window.confirm(action === "open" ? t.rounds.confirmOpen : t.rounds.confirmClose)) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/rounds/${roundId}/${action}`, { method: "POST" });
      if (response.ok) {
        router.refresh();
      } else if (response.status === 409) {
        const { error: code } = await response.json();
        setError(code === "deadline_passed" ? t.rounds.deadlinePassed : t.rounds.invalidState);
      } else {
        setError(errorForStatus(response.status));
      }
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={
          action === "open"
            ? "rounded-md bg-teal-700 px-3 py-3 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            : "rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60"
        }
      >
        {action === "open" ? t.rounds.open : t.rounds.close}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
