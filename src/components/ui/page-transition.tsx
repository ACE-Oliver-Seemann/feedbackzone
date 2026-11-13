"use client";

import { ViewTransition } from "react";

// "page" is the older type name; it still slides forward.
const DIRECTIONS = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  page: "nav-forward",
  default: "none",
};

/**
 * Slides the page content when the user navigates with a link tagged
 * transitionTypes={FORWARD} or {BACK} (src/lib/page-motion.ts). Untyped
 * navigations – browser back/forward, router.refresh() – stay instant.
 * Styles: ::view-transition-*(.nav-forward / .nav-back) in globals.css; the
 * header is a separate, still group. Browsers without the View Transitions
 * API simply navigate without animation.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={DIRECTIONS} exit={DIRECTIONS} default="none">
      {children}
    </ViewTransition>
  );
}
