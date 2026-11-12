import { cx } from "./cx";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "info";

const TONES: Record<BadgeTone, { badge: string; dot: string }> = {
  neutral: { badge: "bg-slate-100 text-ink-soft", dot: "bg-slate-400" },
  brand: { badge: "bg-brand-50 text-brand-800", dot: "bg-brand-500" },
  success: { badge: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  warning: { badge: "bg-amber-50 text-amber-900", dot: "bg-amber-500" },
  info: { badge: "bg-sky-50 text-sky-900", dot: "bg-sky-500" },
};

/** Status pill. The dot repeats the tone so status is not carried by text color alone. */
export function Badge({
  tone = "neutral",
  dot = true,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium",
        TONES[tone].badge,
        className,
      )}
    >
      {dot && <span className={cx("size-1.5 rounded-full", TONES[tone].dot)} aria-hidden="true" />}
      {children}
    </span>
  );
}
