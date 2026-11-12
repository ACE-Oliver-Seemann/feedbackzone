import Link from "next/link";
import { ManagedRoundList } from "@/components/round-list";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { t } from "@/lib/texts.sk";
import { listRounds } from "@/server/rounds";

// Screen "Prehľad kôl" for HR (MVP-12, MVP-15).
export const metadata = { title: t.nav.rounds };

export default async function HrRoundsPage() {
  const user = await requirePageUser("HR");
  const rounds = await pageData(() => listRounds(user));

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t.rounds.allRoundsTitle}</h1>
        <Link
          href="/rounds/new"
          className="rounded-md bg-teal-700 px-3 py-3 text-sm font-medium text-white hover:bg-teal-800"
        >
          {t.rounds.createFirst}
        </Link>
      </div>
      <ManagedRoundList rounds={rounds} showTeam />
    </section>
  );
}
