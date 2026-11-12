import { HomeTasks } from "@/components/home-tasks";
import { MySurveyList } from "@/components/round-list";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { t } from "@/lib/texts.sk";
import { getHomeTasks } from "@/server/home";
import { listRounds } from "@/server/rounds";

// Home page of every role: what needs doing now (IT-11), and for team members
// the list of their open surveys (MVP-06).
export default async function HomePage() {
  const user = await requirePageUser();
  const [tasks, rounds] = await pageData(() =>
    Promise.all([getHomeTasks(user), user.role === "HR" ? [] : listRounds(user)]),
  );
  const openRounds = rounds.filter((round) => round.status === "OPEN");

  return (
    <>
      <section>
        <h1 className="text-xl font-semibold">{t.home.title}</h1>
        <HomeTasks tasks={tasks} emptyText={t.home.empty[user.role]} />
      </section>

      {user.role !== "HR" && openRounds.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">{t.rounds.mySurveysTitle}</h2>
          {/* The button to fill in is in the task above; here is only the state. */}
          <MySurveyList rounds={openRounds} showFillLink={false} />
        </section>
      )}
    </>
  );
}
