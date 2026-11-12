import { LogoutButton } from "@/components/logout-button";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { requirePageUser } from "@/lib/page-auth";
import type { Role } from "@/lib/session";
import { t } from "@/lib/texts.sk";

// Menu by role (MVP-03): at most five areas (IT-12). Pages inside an area are
// reached through the tabs on the page. Links are a convenience only; every
// page and endpoint checks permissions again on the server.
function navFor(role: Role, teamId: string | null): NavItem[] {
  const home: NavItem = { href: "/", label: t.nav.home, match: ["/"] };
  const kudos: NavItem = { href: "/kudos/new", label: t.nav.kudos, match: ["/kudos"] };
  const team: NavItem[] = teamId
    ? [{ href: `/team/${teamId}`, label: t.nav.myTeam, match: ["/team"] }]
    : [];

  if (role === "HR") {
    return [
      home,
      { href: "/hr/rounds", label: t.nav.rounds, match: ["/hr/rounds", "/rounds"] },
      { href: "/hr/overview", label: t.nav.hrInsights, match: ["/hr/overview", "/hr/heatmap", "/team"] },
      { href: "/hr/issues", label: t.nav.hrIssues, match: ["/hr/issues", "/hr/notes"] },
      kudos,
    ];
  }
  if (role === "MANAGER") {
    return [home, { href: "/rounds", label: t.nav.rounds, match: ["/rounds"] }, ...team, kudos];
  }
  // An employee reaches the questionnaire from the home page, so it stays marked there.
  return [{ ...home, match: ["/", "/rounds"] }, ...team, kudos];
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requirePageUser();
  const items = navFor(user.role, user.teamId);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <span className="font-semibold text-teal-800">{t.app.name}</span>
          <div className="flex items-center gap-3">
            <span className="text-right text-sm leading-tight">
              <span className="block font-medium">{user.name}</span>
              <span className="block text-xs text-slate-500">{t.roles[user.role]}</span>
            </span>
            <LogoutButton />
          </div>
        </div>
        <NavLinks items={items} label={t.nav.mainLabel} />
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
