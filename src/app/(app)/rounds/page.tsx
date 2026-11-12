import Link from "next/link";
import { redirect } from "next/navigation";
import { ManagedRoundList } from "@/components/round-list";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { t } from "@/lib/texts.sk";
import { listRounds } from "@/server/rounds";

// Screen "Prieskumy" for a manager: all rounds of their team (MVP-05, MVP-15).
// Moved here from the home page, which now shows what needs doing (IT-11, IT-12).
export default async function TeamRoundsPage() {
  const user = await requirePageUser("MANAGER", "HR");
  if (user.role === "HR") redirect("/hr/rounds");
  const rounds = await pageData(() => listRounds(user));

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t.rounds.teamRoundsTitle}</h1>
        <Link
          href="/rounds/new"
          className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
        >
          {t.rounds.createFirst}
        </Link>
      </div>
      <ManagedRoundList rounds={rounds} />
    </section>
  );
}
