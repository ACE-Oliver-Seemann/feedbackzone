import Link from "next/link";
import { cx } from "./cx";
import { IconChevronLeft } from "./icons";
import { BACK } from "@/lib/page-motion";
import { PageTransition } from "./page-transition";

/**
 * Wrapper of every screen inside the app shell: page transition + width.
 * `width="narrow"` for focused tasks (forms, filling in), "default" for reading.
 */
export function Page({
  width = "default",
  className,
  children,
}: {
  width?: "narrow" | "default" | "wide";
  className?: string;
  children: React.ReactNode;
}) {
  const max = { narrow: "max-w-xl", default: "max-w-3xl", wide: "max-w-5xl" }[width];
  return (
    <PageTransition>
      <div className={cx("mx-auto w-full", max, className)}>{children}</div>
    </PageTransition>
  );
}

/** Screen title with optional back link, context line, description and actions. */
export function PageHeader({
  title,
  context,
  description,
  actions,
  back,
}: {
  title: React.ReactNode;
  /** Small line under the title, e.g. team and deadline. */
  context?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-8">
      {back && (
        <Link
          href={back.href}
          transitionTypes={BACK}
          className="-ml-1 mb-3 inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 pointer-coarse:min-h-11 text-sm font-medium text-brand-700 hover:text-brand-900"
        >
          <IconChevronLeft size={16} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-tight font-medium tracking-[-0.02em] text-ink sm:text-[2rem]">
            {title}
          </h1>
          {context && <div className="mt-1.5 text-sm text-muted">{context}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {description && (
        <p className="mt-3 max-w-[65ch] text-[0.9375rem] leading-relaxed text-ink-soft">
          {description}
        </p>
      )}
    </header>
  );
}

/** Friendly empty state: what is missing and, if possible, what to do. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** Optional second line, e.g. what to do next. */
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-panel)] border border-dashed border-line-strong px-6 py-10 text-center">
      {icon && (
        <span className="mb-3 grid size-11 place-items-center rounded-full bg-brand-50 text-brand-600">
          {icon}
        </span>
      )}
      <p
        className={cx(
          "max-w-sm text-[0.9375rem]",
          description ? "font-medium text-ink" : "text-ink-soft",
        )}
      >
        {title}
      </p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
