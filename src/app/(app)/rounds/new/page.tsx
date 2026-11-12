import { NewRoundForm } from "@/components/new-round-form";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { homePathFor } from "@/lib/session";
import { t } from "@/lib/texts.sk";
import { listManageableTeams, listQuestions } from "@/server/catalog";

// Screen "Nové kolo" for manager and HR (MVP-04).
export default async function NewRoundPage() {
  const user = await requirePageUser("MANAGER", "HR");
  const [questions, teams] = await pageData(() =>
    Promise.all([listQuestions(user), listManageableTeams(user)]),
  );

  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-semibold">{t.newRound.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{t.newRound.intro}</p>
      <NewRoundForm
        questions={questions}
        teams={teams}
        redirectTo={homePathFor(user.role)}
        canAddQuestion={user.role === "MANAGER"}
      />
    </section>
  );
}
