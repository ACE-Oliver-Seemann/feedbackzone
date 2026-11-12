"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { t } from "@/lib/texts.sk";

// "Spustiť" / "Uzavrieť" (MVP-05).
export function RoundTransitionButton({
  roundId,
  action,
}: {
  roundId: string;
  action: "open" | "close";
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  // The dialog is mounted only while open (a list renders many of these
  // buttons), so focus is handed back to the trigger once it closes.
  useEffect(() => {
    if (wasConfirming.current && !confirming) triggerRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/rounds/${roundId}/${action}`, { method: "POST" });
      if (response.ok) {
        router.refresh();
        toast.success(action === "open" ? t.toasts.roundOpened : t.toasts.roundClosed);
      } else if (response.status === 409) {
        const { error: code } = await response.json();
        setError(code === "deadline_passed" ? t.rounds.deadlinePassed : t.rounds.invalidState);
      } else {
        setError(t.errors.generic);
      }
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  const label = action === "open" ? t.rounds.open : t.rounds.close;

  return (
    <div className="inline-flex max-w-full flex-col items-start gap-1.5">
      <Button
        ref={triggerRef}
        variant={action === "open" ? "primary" : "secondary"}
        size="sm"
        onClick={() => {
          if (!pending) setConfirming(true);
        }}
        // aria-disabled instead of disabled: a disabled button cannot take
        // focus, and focus returns here right after the dialog is confirmed.
        aria-disabled={pending || undefined}
        aria-haspopup="dialog"
        pending={pending}
      >
        {label}
      </Button>
      {error && (
        <span role="alert" className="max-w-56 animate-rise text-xs leading-snug text-red-700">
          {error}
        </span>
      )}
      {confirming && (
        <ConfirmDialog
          open
          title={action === "open" ? t.rounds.confirmOpenTitle : t.rounds.confirmCloseTitle}
          text={action === "open" ? t.rounds.confirmOpenText : t.rounds.confirmCloseText}
          confirmLabel={label}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            void run();
          }}
        />
      )}
    </div>
  );
}
