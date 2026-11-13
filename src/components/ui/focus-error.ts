import { useEffect, type RefObject } from "react";

/**
 * After a failed submit, moves focus to the first invalid field of the form
 * (or to the error message when no field is marked) and scrolls it into view.
 * Without it an error above or below the visible part of a long form goes
 * unnoticed and the button seems to do nothing (FE2-001, FE2-007).
 *
 * `signals` are the form's error states; the effect runs when any of them changes.
 */
export function useFocusFirstError(
  ref: RefObject<HTMLElement | null>,
  ...signals: unknown[]
) {
  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    const target =
      form.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      form.querySelector<HTMLElement>('[role="alert"]');
    if (!target) return;
    if (!target.matches("input, select, textarea, button, a[href]")) target.tabIndex = -1;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, ...signals]);
}
