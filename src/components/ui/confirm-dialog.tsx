"use client";

import { useEffect, useId, useRef } from "react";
import { t } from "@/lib/texts.sk";
import { Button, type ButtonVariant } from "./button";

/**
 * Modal confirmation built on the native <dialog>: focus trapping, Esc to
 * close and the backdrop come from the browser. Open/close animation lives in
 * the .ui-dialog styles in globals.css (rise + scale; a plain fade under
 * reduced motion).
 */
export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  text?: string;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (event.target === event.currentTarget) onCancel();
      }}
      aria-labelledby={titleId}
      className="ui-dialog m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-surface p-0 text-ink shadow-[var(--shadow-raised)]"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-semibold tracking-[-0.01em]">
          {title}
        </h2>
        {text && <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{text}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} autoFocus>
            {t.ui.cancel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
