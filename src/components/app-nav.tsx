"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { cx } from "@/components/ui/cx";
import { isReducedMotion } from "@/lib/motion";
import { BACK, FORWARD } from "@/lib/page-motion";
import { t } from "@/lib/texts.sk";

export type NavItem = {
  href: string;
  label: string;
  /** Path prefixes that belong to this item (IT-12); "/" matches only the home page. Defaults to href. */
  match?: string[];
};

function isActive(pathname: string, item: NavItem): boolean {
  return (item.match ?? [item.href]).some((prefix) =>
    prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Slide direction: items to the right of the active one go forward. */
function directionFor(target: number, active: number): string[] | undefined {
  if (active < 0 || target > active) return FORWARD;
  if (target < active) return BACK;
  return undefined;
}

/**
 * Pending hint on the clicked nav link while a slow navigation loads (FE-008).
 * Always rendered with a fixed size, only the opacity changes (no layout
 * shift); the short delay keeps it from flashing on fast navigations. It is an
 * opacity pulse, so it stays acceptable under reduced motion.
 */
function NavPendingHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={cx(
        "pointer-events-none absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-brand-600 transition-opacity duration-150",
        pending ? "animate-pulse opacity-100 delay-150" : "opacity-0",
      )}
    />
  );
}

/**
 * Main navigation: a segmented row with one pill that slides to the active
 * item. On narrow screens it scrolls horizontally instead of hiding behind a
 * menu button, so every section stays one tap away.
 *
 * Until the pill is measured (server HTML, before hydration) the active link
 * paints its own background; once measured, the list gets data-ready and the
 * pill takes over. The pill moves with transform/width (CSS .nav-pill); under
 * reduced motion it jumps and fades in instead.
 */
export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const activeIndex = items.findIndex((item) => isActive(pathname, item));
  const navRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const list = listRef.current;
    const pill = pillRef.current;
    if (!nav || !list || !pill) return;
    const link = activeIndex >= 0 ? list.querySelectorAll<HTMLElement>("a")[activeIndex] : undefined;

    const place = (animate: boolean) => {
      if (!link || link.offsetWidth === 0) {
        // No active item, or this copy of the nav is hidden (display: none).
        pill.style.opacity = "0";
        delete pill.dataset.animate;
        return;
      }
      const wasVisible = pill.style.opacity === "1";
      const moving = animate && wasVisible && !isReducedMotion();
      if (moving) pill.dataset.animate = "";
      else delete pill.dataset.animate;
      pill.style.width = `${link.offsetWidth}px`;
      pill.style.transform = `translateX(${link.offsetLeft}px)`;
      pill.style.opacity = "1";
      list.dataset.ready = "";
      if (animate && wasVisible && !moving && typeof pill.animate === "function") {
        // Reduced motion: no slide, a short crossfade into the new place.
        pill.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "ease-out" });
      }

      // Keep the active item visible in the horizontally scrolling (mobile) nav.
      const left = link.offsetLeft - nav.scrollLeft;
      const right = left + link.offsetWidth;
      if (left < 0 || right > nav.clientWidth) {
        nav.scrollTo({
          left: link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2,
          behavior: animate && !isReducedMotion() ? "smooth" : "auto",
        });
      }
    };

    place(true);
    // Layout changes (font load, breakpoint switch, resize) reposition without animating.
    const observer = new ResizeObserver(() => place(false));
    observer.observe(list);
    if (link) observer.observe(link);
    return () => observer.disconnect();
  }, [activeIndex]);

  return (
    <nav
      ref={navRef}
      aria-label={t.ui.mainNav}
      // On phones the row scrolls sideways; the soft right edge hints that more items follow.
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_right,#000_85%,transparent)] sm:mx-0 sm:px-0"
    >
      <div ref={listRef} className="group relative isolate w-max sm:w-auto">
        <span
          ref={pillRef}
          aria-hidden="true"
          className="nav-pill pointer-events-none absolute inset-y-0 left-0 -z-10 rounded-full bg-brand-50"
          style={{ opacity: 0 }}
        />
        <ul className="flex gap-1">
          {items.map((item, index) => {
            const active = index === activeIndex;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  transitionTypes={directionFor(index, activeIndex)}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium whitespace-nowrap pointer-coarse:h-11",
                    "transition-colors duration-150",
                    active
                      ? "bg-brand-50 text-brand-800 group-data-ready:bg-transparent"
                      : "text-ink-soft hover:bg-slate-100 hover:text-ink",
                  )}
                >
                  {item.label}
                  <NavPendingHint />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
