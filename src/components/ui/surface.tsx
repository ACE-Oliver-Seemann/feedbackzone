import type { ComponentProps } from "react";
import { cx } from "./cx";

/**
 * Panel: a white surface for a single block of content (a form, a result).
 * Lists of similar items use InsetList instead of one Panel per item.
 */
export function Panel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-panel)] ring-1 ring-line",
        className,
      )}
      {...props}
    />
  );
}

/** Grouped list in one container, rows separated by hairlines (Apple "inset grouped" style). */
export function InsetList({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={cx(
        "divide-y divide-line overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-panel)] ring-1 ring-line",
        className,
      )}
      {...props}
    />
  );
}

/**
 * One row of an InsetList. `interactive` for rows that act as a whole (e.g. a
 * stretched link inside): a quiet hover tint, no lift.
 */
export function InsetRow({
  className,
  interactive = false,
  ...props
}: ComponentProps<"li"> & { interactive?: boolean }) {
  return (
    <li
      className={cx(
        "px-4 py-4 sm:px-5",
        interactive && "relative transition-colors duration-150 ease-out hover:bg-canvas/70",
        className,
      )}
      {...props}
    />
  );
}

/** Section inside a page: a heading, optional description and actions, then content. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  headingLevel = 2,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className={cx("mt-10 first:mt-0", className)}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Heading className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">
            {title}
          </Heading>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
