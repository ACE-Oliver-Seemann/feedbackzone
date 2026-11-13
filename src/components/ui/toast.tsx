"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/lib/texts.sk";
import { cx } from "./cx";
import { IconAlert, IconCheck, IconX } from "./icons";

/*
 * Short confirmations ("Uložené") after a successful server response.
 * One polite live region; up to 3 toasts, each dismissed after 3.5 s.
 * Enter/leave animation: .ui-toast in globals.css (fade only under reduce).
 */

type Kind = "success" | "error";
type Toast = { id: number; kind: Kind; message: string; leaving: boolean };
type ToastApi = { success(message: string): void; error(message: string): void };

const MAX_TOASTS = 3;
const DURATION_MS = 3500;
const LEAVE_MS = 200; // matches the .ui-toast transition

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: number) => {
    const map = timers.current;
    clearTimeout(map.get(id));
    map.delete(id);
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      const map = timers.current;
      clearTimeout(map.get(id));
      setToasts((list) => list.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
      map.set(
        id,
        setTimeout(() => remove(id), LEAVE_MS),
      );
    },
    [remove],
  );

  const show = useCallback(
    (kind: Kind, message: string) => {
      const id = nextId.current++;
      setToasts((list) => {
        const visible = list.filter((toast) => !toast.leaving);
        const overflow = visible.slice(0, Math.max(0, visible.length - (MAX_TOASTS - 1)));
        const dropped = new Set(overflow.map((toast) => toast.id));
        for (const toastId of dropped) clearTimeout(timers.current.get(toastId));
        return [...list.filter((toast) => !dropped.has(toast.id)), { id, kind, message, leaving: false }];
      });
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) clearTimeout(timer);
      map.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => show("success", message),
      error: (message) => show("error", message),
    }),
    [show],
  );

  return (
    <ToastContext value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-label={t.motion.toastRegion}
        className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-toast={toast.kind}
            data-leaving={toast.leaving ? "" : undefined}
            className={cx(
              "ui-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-surface py-3 pr-2 pl-4 text-sm text-ink",
              "shadow-[var(--shadow-raised)] ring-1 ring-line",
            )}
          >
            <span
              aria-hidden="true"
              className={cx(
                "mt-px grid size-5 shrink-0 place-items-center rounded-full",
                toast.kind === "success" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-700",
              )}
            >
              {toast.kind === "success" ? <IconCheck size={14} /> : <IconAlert size={14} />}
            </span>
            <p className="min-w-0 flex-1 py-px leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t.motion.toastDismiss}
              className="-my-1 grid size-7 shrink-0 place-items-center rounded-full pointer-coarse:size-12 text-muted transition-colors duration-150 hover:bg-canvas hover:text-ink"
            >
              <IconX size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

const NO_TOASTS: ToastApi = { success() {}, error() {} };

/** Shows a toast. Outside <ToastProvider> it does nothing (never crashes a page). */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NO_TOASTS;
}
