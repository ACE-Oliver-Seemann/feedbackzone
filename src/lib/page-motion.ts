/**
 * View transition types for <Link transitionTypes>. Styles: the
 * ::view-transition-*(.nav-forward / .nav-back) rules in globals.css, mapped by
 * src/components/ui/page-transition.tsx. Navigations without a type
 * (browser back/forward, router.refresh) do not animate.
 */
export const FORWARD: string[] = ["nav-forward"];
export const BACK: string[] = ["nav-back"];
