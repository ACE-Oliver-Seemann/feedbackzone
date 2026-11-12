import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-brand-700 active:bg-brand-800",
  secondary:
    "bg-surface text-ink ring-1 ring-inset ring-line-strong hover:bg-canvas hover:ring-brand-300 active:bg-brand-50",
  ghost: "text-brand-700 hover:bg-brand-50 active:bg-brand-100",
  danger: "bg-red-700 text-white hover:bg-red-800 active:bg-red-900",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-5 text-base",
};

const SPINNER_SIZES: Record<ButtonSize, string> = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-[1.125rem]",
};

/** Class string for anything that should look like a button (button, Link, label). */
export function buttonClass({
  variant = "primary",
  size = "md",
  pending = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Request in flight: no clicks, full colour (not the faded disabled look). */
  pending?: boolean;
  className?: string;
} = {}): string {
  return cx(
    "inline-flex select-none items-center justify-center whitespace-nowrap rounded-[var(--radius-control)] font-medium",
    "transition-[background-color,box-shadow,color,scale,opacity] duration-150 ease-out active:scale-[0.98]",
    pending
      ? "pointer-events-none cursor-wait opacity-90"
      : "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

/** Small ring spinner in the current text colour. Decorative. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent opacity-80",
        className,
      )}
    />
  );
}

type Common = { variant?: ButtonVariant; size?: ButtonSize };

/**
 * `pending` shows a spinner in place of the leading icon and sets aria-busy.
 * It does not disable the button by itself: callers decide (a submit button
 * passes disabled={pending}; a dialog trigger keeps focusability).
 */
export function Button({
  variant,
  size = "md",
  pending = false,
  className,
  type = "button",
  children,
  ...props
}: ComponentProps<"button"> & Common & { pending?: boolean }) {
  return (
    <button
      type={type}
      aria-busy={pending || undefined}
      className={buttonClass({ variant, size, pending, className })}
      {...props}
    >
      {pending && <Spinner className={SPINNER_SIZES[size]} />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & Common) {
  return <Link className={buttonClass({ variant, size, className })} {...props} />;
}
