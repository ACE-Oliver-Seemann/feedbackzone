import { NewRoundForm } from "@/components/new-round-form";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { t } from "@/lib/texts.sk";
import { listManageableTeams, listQuestions } from "@/server/catalog";
import { suggestRoundQuestions } from "@/server/rounds";

/** ISO 8601 week number, the way weeks are counted in Slovakia. */
function isoWeek(date: Date): number {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  return Math.ceil(((day.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Screen "Nové kolo" for manager and HR (MVP-04).
export default async function NewRoundPage() {
  const user = await requirePageUser("MANAGER", "HR");
  const [questions, teams] = await pageData(() =>
    Promise.all([listQuestions(user), listManageableTeams(user)]),
  );
  // IT-13: a round that can be created in two clicks.
  const defaults = Object.fromEntries(
    await pageData(() =>
      Promise.all(
        teams.map(async (team) => [team.id, await suggestRoundQuestions(user, team.id)] as const),
      ),
    ),
  );
  const closes = new Date();
  closes.setDate(closes.getDate() + 7);
  const pad = (value: number) => String(value).padStart(2, "0");
  const defaultClosesAt = `${closes.getFullYear()}-${pad(closes.getMonth() + 1)}-${pad(closes.getDate())}`;

  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-semibold">{t.newRound.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{t.newRound.intro}</p>
      <NewRoundForm
        questions={questions}
        teams={teams}
        redirectTo={user.role === "HR" ? "/hr/rounds" : "/rounds"}
        canAddQuestion={user.role === "MANAGER"}
        defaults={defaults}
        defaultName={t.newRound.defaultName(isoWeek(new Date()))}
        defaultClosesAt={defaultClosesAt}
      />
    </section>
  );
}
