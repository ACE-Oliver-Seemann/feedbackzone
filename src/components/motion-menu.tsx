"use client";

import { useEffect, useId, useRef } from "react";
import { IconSparkle } from "@/components/ui/icons";
import { type MotionPreference, useMotionPreference, useSystemReducedMotion } from "@/lib/motion";
import { t } from "@/lib/texts.sk";

const OPTIONS: MotionPreference[] = ["system", "on", "reduced"];

/** Puts the (position: fixed) panel right under the button. */
function place(button: HTMLElement | null, panel: HTMLElement | null) {
  if (!button || !panel) return;
  const rect = button.getBoundingClientRect();
  panel.style.top = `${Math.round(rect.bottom + 8)}px`;
  panel.style.right = `${Math.max(16, Math.round(window.innerWidth - rect.right))}px`;
}

/**
 * Header button with the animation setting. A native popover gives Esc,
 * light dismiss and the top layer for free; it is placed under the button
 * when it opens. Open/close animation: .ui-popover in globals.css.
 */
export function MotionMenu() {
  const [preference, setPreference] = useMotionPreference();
  const systemReduced = useSystemReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const panelId = `${id}-panel`;
  const hintId = `${id}-hint`;

  const hint =
    preference === "on"
      ? t.motion.hintOn
      : preference === "reduced"
        ? t.motion.hintReduced
        : systemReduced
          ? t.motion.hintSystemReduced
          : t.motion.hintSystemFull;

  // The button moves when the window is resized; an open panel follows it (FE-011).
  useEffect(() => {
    const onResize = () => {
      const panel = panelRef.current;
      if (panel?.matches(":popover-open")) place(buttonRef.current, panel);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        popoverTarget={panelId}
        aria-label={t.motion.menuButton}
        title={t.motion.menuButton}
        className="grid size-9 place-items-center rounded-full text-ink-soft pointer-coarse:size-11 transition-colors duration-150 hover:bg-slate-100 hover:text-ink"
      >
        <IconSparkle />
      </button>
      <div
        ref={panelRef}
        id={panelId}
        popover="auto"
        onBeforeToggle={(event) => {
          if (event.newState === "open") place(buttonRef.current, panelRef.current);
        }}
        className="ui-popover fixed inset-auto m-0 w-[min(18rem,calc(100vw-2rem))] rounded-xl bg-surface p-4 text-ink shadow-[var(--shadow-raised)] ring-1 ring-line"
      >
        <fieldset aria-describedby={hintId}>
          <legend className="text-sm font-semibold">{t.motion.legend}</legend>
          <div className="mt-2 flex flex-col gap-0.5">
            {OPTIONS.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-canvas has-checked:bg-brand-50 has-checked:text-brand-800"
              >
                <input
                  type="radio"
                  name={`${id}-motion`}
                  value={option}
                  checked={preference === option}
                  onChange={() => setPreference(option)}
                  className="size-4 accent-brand-600"
                />
                {t.motion.options[option]}
              </label>
            ))}
          </div>
          <p id={hintId} className="mt-2 text-xs leading-relaxed text-muted">
            {hint}
          </p>
        </fieldset>
      </div>
    </>
  );
}
