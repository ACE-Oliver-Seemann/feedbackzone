import Link from "next/link";

/**
 * Second level of navigation as always-visible tabs inside a page (IT-12).
 * Visible on purpose: navigation hidden behind an icon is found less often.
 */
export function SubNav({
  items,
  current,
  label,
}: {
  items: { href: string; label: string }[];
  /** The href of the tab that is open. */
  current: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
      {items.map((item) => {
        const active = item.href === current;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-3 text-sm font-medium ${
              active
                ? "border-teal-700 text-teal-900"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
