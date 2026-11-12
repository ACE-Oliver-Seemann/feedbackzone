"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  /** Path prefixes that belong to this item; "/" matches only the home page. */
  match: string[];
};

/** Main menu with the current area marked, so it is always clear where you are (IT-12). */
export function NavLinks({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  const isActive = (item: NavItem) =>
    item.match.some((prefix) =>
      prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

  return (
    <nav aria-label={label} className="mx-auto flex max-w-4xl flex-wrap gap-x-1 px-2 pb-2">
      {items.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-3 text-sm font-medium ${
              active
                ? "bg-teal-50 text-teal-900"
                : "text-slate-700 hover:bg-slate-100 hover:text-teal-800"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
