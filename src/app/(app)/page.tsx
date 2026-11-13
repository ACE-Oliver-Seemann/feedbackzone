import type { Metadata } from "next";
import { HomeTasks } from "@/components/home-tasks";
import { MySurveyList } from "@/components/round-list";
import { Page, PageHeader } from "@/components/ui/page";
import { Section } from "@/components/ui/surface";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { t } from "@/lib/texts.sk";
import { getHomeTasks } from "@/server/home";
import { listRounds } from "@/server/rounds";

export const metadata: Metadata = { title: t.nav.home };

// Home page of every role: what needs doing now (IT-11), and for team members
// the list of their open surveys (MVP-06).
export default async function HomePage() {
  const user = await requirePageUser();
  const [tasks, rounds] = await pageData(() =>
    Promise.all([getHomeTasks(user), user.role === "HR" ? [] : listRounds(user)]),
  );
  const openRounds = rounds.filter((round) => round.status === "OPEN");

  return (
    <Page>
      <PageHeader title={t.home.title} />
      <HomeTasks tasks={tasks} emptyText={t.home.empty[user.role]} />

      {user.role !== "HR" && openRounds.length > 0 && (
        // Keeps its own "Vyplniť" button: the tasks above are capped at three,
        // so a survey may not be among them (BUG-004).
        <Section title={t.rounds.mySurveysTitle}>
          <MySurveyList rounds={openRounds} headingLevel={3} />
        </Section>
      )}
    </Page>
  );
}
