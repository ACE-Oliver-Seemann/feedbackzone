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

// Menu by role (MVP-03): at most five areas (IT-12). Pages inside an area are
// reached through the tabs on the page. Links are a convenience only; every
// page and endpoint checks permissions again on the server.
function navFor(role: Role, teamId: string | null): NavItem[] {
  const home: NavItem = { href: "/", label: t.nav.home, match: ["/"] };
  const kudos: NavItem = { href: "/kudos", label: t.nav.kudos, match: ["/kudos"] };
  // IT-14: for HR this area also holds the meeting notes (tabs on the page).
  const responsibilities: NavItem = {
    href: "/responsibilities",
    label: t.nav.responsibilities,
    match: ["/responsibilities", "/hr/issues", "/hr/notes"],
  };
  const team: NavItem[] = teamId
    ? [{ href: `/team/${teamId}`, label: t.nav.myTeam, match: ["/team"] }]
    : [];

  if (role === "HR") {
    return [
      home,
      { href: "/hr/rounds", label: t.nav.rounds, match: ["/hr/rounds", "/rounds"] },
      { href: "/hr/overview", label: t.nav.hrInsights, match: ["/hr/overview", "/hr/heatmap", "/team"] },
      responsibilities,
      kudos,
    ];
  }
  if (role === "MANAGER") {
    return [home, { href: "/rounds", label: t.nav.rounds, match: ["/rounds"] }, ...team, responsibilities, kudos];
  }
  // An employee reaches the questionnaire from the home page, so it stays marked there.
  return [{ ...home, match: ["/", "/rounds"] }, ...team, responsibilities, kudos];
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
  const items = navFor(user.role, user.teamId);

  return (
    <ToastProvider>
      <div className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-[var(--shadow-raised)]"
        >
          {t.ui.skipToContent}
        </a>
        <header className="sticky top-0 z-30 border-b border-line/80 bg-surface/80 backdrop-blur-xl backdrop-saturate-150 print:hidden">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex h-16 items-center justify-between gap-3 sm:gap-4">
              <Link href={homePathFor(user.role)} transitionTypes={FORWARD} className="inline-flex shrink-0 items-center rounded-lg pointer-coarse:min-h-11">
                <BrandMark />
              </Link>
              <div className="hidden min-w-0 flex-1 justify-center xl:flex">
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
            <div className="pb-3 xl:hidden">
              <AppNav items={items} />
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-5xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12 print:p-0">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
