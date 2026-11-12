import type { Metadata } from "next";
import { NewRoundForm } from "@/components/new-round-form";
import { Page, PageHeader } from "@/components/ui/page";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { homePathFor } from "@/lib/session";
import { t } from "@/lib/texts.sk";
import { listManageableTeams, listQuestions } from "@/server/catalog";

export const metadata: Metadata = { title: t.newRound.title };

// Screen "Nové kolo" for manager and HR (MVP-04).
export default async function NewRoundPage() {
  const user = await requirePageUser("MANAGER", "HR");
  const [questions, teams] = await pageData(() =>
    Promise.all([listQuestions(user), listManageableTeams(user)]),
  );

  return (
    <Page width="narrow">
      <PageHeader title={t.newRound.title} description={t.newRound.intro} />
      <NewRoundForm questions={questions} teams={teams} redirectTo={homePathFor(user.role)} />
    </Page>
  );
}
