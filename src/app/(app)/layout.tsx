import Link from "next/link";
import { AppNav, type NavItem } from "@/components/app-nav";
import { LogoutButton } from "@/components/logout-button";
import { MotionMenu } from "@/components/motion-menu";
import { BrandMark } from "@/components/ui/brand-mark";
import { ToastProvider } from "@/components/ui/toast";
import { requirePageUser } from "@/lib/page-auth";
import { FORWARD } from "@/lib/page-motion";
import { homePathFor, type Role } from "@/lib/session";
import { t } from "@/lib/texts.sk";

// Menu by role (MVP-03). Links are a convenience only; every page and
// endpoint checks permissions again on the server.
function navFor(teamId: string | null): (NavItem & { roles: Role[] })[] {
  return [
    { href: "/", label: t.nav.mySurveys, roles: ["EMPLOYEE", "MANAGER"] },
    { href: "/hr/rounds", label: t.nav.hrRounds, roles: ["HR"] },
    // HR has no team of its own; it reaches team pages from the round overview.
    ...(teamId
      ? [{ href: `/team/${teamId}`, label: t.nav.myTeam, roles: ["EMPLOYEE", "MANAGER"] as Role[] }]
      : []),
    { href: "/rounds/new", label: t.nav.newRound, roles: ["MANAGER", "HR"] },
    { href: "/kudos", label: t.nav.kudos, roles: ["EMPLOYEE", "MANAGER", "HR"] },
  ];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requirePageUser();
  const items = navFor(user.teamId)
    .filter((item) => item.roles.includes(user.role))
    .map(({ href, label }) => ({ href, label }));

  return (
    <ToastProvider>
      <div className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-[var(--shadow-raised)]"
        >
          {t.ui.skipToContent}
        </a>
        <header className="sticky top-0 z-30 border-b border-line/80 bg-surface/80 backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="flex h-16 items-center justify-between gap-3 sm:gap-4">
              <Link href={homePathFor(user.role)} transitionTypes={FORWARD} className="shrink-0 rounded-lg">
                <BrandMark />
              </Link>
              <div className="hidden min-w-0 flex-1 justify-center lg:flex">
                <AppNav items={items} />
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                <span className="flex items-center gap-2.5">
                  <span
                    className="grid size-8 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800"
                    aria-hidden="true"
                  >
                    {initials(user.name)}
                  </span>
                  <span className="hidden text-sm leading-tight sm:block">
                    <span className="block font-medium text-ink">{user.name}</span>
                    <span className="block text-xs text-muted">{t.roles[user.role]}</span>
                  </span>
                  <span className="sr-only sm:hidden">
                    {user.name}, {t.roles[user.role]}
                  </span>
                </span>
                <span className="flex items-center gap-0.5 sm:gap-1">
                  <MotionMenu />
                  <LogoutButton />
                </span>
              </div>
            </div>
            <div className="pb-3 lg:hidden">
              <AppNav items={items} />
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-5xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
