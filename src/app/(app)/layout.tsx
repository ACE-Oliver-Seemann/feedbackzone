import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { requirePageUser } from "@/lib/page-auth";
import type { Role } from "@/lib/session";
import { t } from "@/lib/texts.sk";

// Menu by role (MVP-03). Links are a convenience only; every page and
// endpoint checks permissions again on the server.
type NavItem = { href: string; label: string; roles: Role[] };

function navFor(teamId: string | null): NavItem[] {
  return [
    { href: "/", label: t.nav.mySurveys, roles: ["EMPLOYEE", "MANAGER"] },
    { href: "/hr/rounds", label: t.nav.hrRounds, roles: ["HR"] },
    { href: "/hr/overview", label: t.nav.hrOverview, roles: ["HR"] },
    { href: "/hr/issues", label: t.nav.hrIssues, roles: ["HR"] },
    { href: "/hr/notes", label: t.nav.hrNotes, roles: ["HR"] },
    // HR has no team of its own; it reaches team pages from the round overview.
    ...(teamId
      ? [{ href: `/team/${teamId}`, label: t.nav.myTeam, roles: ["EMPLOYEE", "MANAGER"] as Role[] }]
      : []),
    { href: "/rounds/new", label: t.nav.newRound, roles: ["MANAGER", "HR"] },
    { href: "/kudos/new", label: t.nav.sendKudos, roles: ["EMPLOYEE", "MANAGER", "HR"] },
    { href: "/kudos/me", label: t.nav.myKudos, roles: ["EMPLOYEE", "MANAGER", "HR"] },
  ];
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requirePageUser();
  const items = navFor(user.teamId).filter((item) => item.roles.includes(user.role));

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
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
        <nav className="mx-auto flex max-w-4xl flex-wrap gap-x-1 px-2 pb-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-teal-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
