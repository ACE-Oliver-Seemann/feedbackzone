import { cx } from "./cx";
import { IconChevronDown } from "./icons";

/**
 * "Essentials first, detail on click" (IT-13): a native <details>, so it works
 * without JavaScript and with the keyboard. The summary should carry a count
 * ("Komentáre (3)") so that collapsed content is not overlooked.
 *
 * `variant="panel"` is a white surface of its own; "inline" is a quiet link
 * for detail inside an existing row.
 */
export function Disclosure({
  summary,
  variant = "panel",
  open,
  className,
  children,
}: {
  summary: React.ReactNode;
  variant?: "panel" | "inline";
  open?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (variant === "inline") {
    return (
      <details open={open} className={cx("group", className)}>
        <summary className="-ml-1 inline-flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-md px-1 text-sm font-medium text-brand-700 hover:text-brand-900 pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
          {summary}
          <IconChevronDown
            size={15}
            className="shrink-0 transition-transform duration-200 group-open:rotate-180"
          />
        </summary>
        {children}
      </details>
    );
  }
  return (
    <details
      open={open}
      className={cx(
        "group overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-panel)] ring-1 ring-line",
        className,
      )}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[0.9375rem] font-semibold text-ink transition-colors duration-150 hover:bg-canvas/70 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">{summary}</span>
        <IconChevronDown
          size={16}
          className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-line">{children}</div>
    </details>
  );
}
