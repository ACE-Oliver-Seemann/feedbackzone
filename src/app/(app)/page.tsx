import Link from "next/link";
import { redirect } from "next/navigation";
import { ManagedRoundList, MySurveyList } from "@/components/round-list";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { t } from "@/lib/texts.sk";
import { listRounds } from "@/server/rounds";

// Screen "Moje prieskumy" for employee and manager (MVP-06).
// The manager also sees all rounds of their team here (MVP-05, MVP-15).
export default async function HomePage() {
  const user = await requirePageUser();
  if (user.role === "HR") redirect("/hr/rounds");

  const rounds = await pageData(() => listRounds(user));
  const openRounds = rounds.filter((round) => round.status === "OPEN");

  return (
    <>
      <section>
        <h1 className="text-xl font-semibold">{t.rounds.mySurveysTitle}</h1>
        <MySurveyList rounds={openRounds} />
      </section>

      {user.role === "MANAGER" && (
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">{t.rounds.teamRoundsTitle}</h2>
            <Link
              href="/rounds/new"
              className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
            >
              {t.rounds.createFirst}
            </Link>
          </div>
          <ManagedRoundList rounds={rounds} />
        </section>
      )}
    </>
  );
}
