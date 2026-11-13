import { cloneElement, isValidElement, useId, type ComponentProps, type ReactElement } from "react";
import { cx } from "./cx";
import { IconChevronDown } from "./icons";

/** Shared look of text inputs, textareas and selects. */
export const controlClass = cx(
  "block w-full rounded-[var(--radius-control)] bg-surface px-3.5 text-base text-ink",
  "ring-1 ring-inset ring-line-strong placeholder:text-slate-500",
  "transition-[box-shadow,background-color] duration-150 ease-out hover:ring-brand-300",
  "focus:outline-none focus:ring-2 focus:ring-brand-600",
  "disabled:cursor-not-allowed disabled:bg-canvas disabled:opacity-70",
  "aria-[invalid=true]:ring-red-500",
);

/**
 * Label + control + hint + error. The control is passed as children, so the
 * <label> wraps it and gives it its name. Hint and error are linked to the
 * control with aria-describedby, and an error also sets aria-invalid unless
 * the control sets it itself (FE-007).
 */
export function Field({
  label,
  hint,
  error,
  aside,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Shown right of the hint, e.g. a character counter. */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  let control = children;
  if (isValidElement(children)) {
    const props = (children as ReactElement<Record<string, unknown>>).props;
    const describedBy = [props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ");
    control = cloneElement(children as ReactElement<Record<string, unknown>>, {
      "aria-describedby": describedBy || undefined,
      "aria-invalid": props["aria-invalid"] ?? (error ? true : undefined),
    });
  }

  // Only the label text and the control sit inside <label>, so hint, counter
  // and error do not become part of the control's accessible name.
  return (
    <div className={cx("block", className)}>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
        {control}
      </label>
      {(hint || aside) && (
        <span className="mt-1.5 flex justify-between gap-3 text-xs text-muted">
          <span id={hintId}>{hint}</span>
          {aside && <span className="tabular-nums">{aside}</span>}
        </span>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <span id={id} role="alert" className="mt-1.5 block animate-rise text-sm text-red-700">
      {children}
    </span>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(controlClass, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(controlClass, "py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select className={cx(controlClass, "h-11 appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <IconChevronDown
        size={16}
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted"
      />
    </span>
  );
}
