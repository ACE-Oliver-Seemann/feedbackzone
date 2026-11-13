import Link from "next/link";
import { cx } from "@/components/ui/cx";
import { t } from "@/lib/texts.sk";

/**
 * Second level of navigation as always-visible tabs inside a page (IT-12).
 * Visible on purpose: navigation hidden behind an icon is found less often.
 * Looks like the segmented control of the kudos page.
 */
export function SubNav({
  items,
  current,
  label = t.ui.subNav,
}: {
  items: { href: string; label: string }[];
  /** The href of the tab that is open. */
  current: string;
  label?: string;
}) {
  return (
    <nav aria-label={label} className="mb-6 print:hidden">
      <ul className="inline-flex max-w-full flex-wrap gap-1 rounded-full bg-slate-200/60 p-1">
        {items.map((item) => {
          const active = item.href === current;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap pointer-coarse:h-11",
                  "transition-colors duration-150",
                  active
                    ? "bg-surface text-ink shadow-[var(--shadow-panel)]"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
