import { redirect } from "next/navigation";
import { ManagedRoundList, MySurveyList } from "@/components/round-list";
import { ButtonLink } from "@/components/ui/button";
import { IconPlus } from "@/components/ui/icons";
import { Page, PageHeader } from "@/components/ui/page";
import { Section } from "@/components/ui/surface";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { FORWARD } from "@/lib/page-motion";
import { t } from "@/lib/texts.sk";
import { listRounds } from "@/server/rounds";

// Screen "Moje prieskumy" for employee and manager (MVP-06).
// The manager also sees all rounds of their team here (MVP-05, MVP-15).
export default async function HomePage() {
  const user = await requirePageUser();
  if (user.role === "HR") redirect("/hr/rounds");

  const rounds = await pageData(() => listRounds(user));
  const openRounds = rounds.filter((round) => round.status === "OPEN");
  const isManager = user.role === "MANAGER";

  return (
    // The manager's round table needs the wide layout; employees get a calmer reading width.
    <Page width={isManager ? "wide" : "default"}>
      <PageHeader title={t.rounds.mySurveysTitle} />
      <MySurveyList rounds={openRounds} />

      {isManager && (
        <Section
          title={t.rounds.teamRoundsTitle}
          actions={
            <ButtonLink href="/rounds/new" transitionTypes={FORWARD} size="sm">
              <IconPlus size={16} className="-ml-0.5" />
              {t.rounds.createFirst}
            </ButtonLink>
          }
        >
          <ManagedRoundList rounds={rounds} />
        </Section>
      )}
    </Page>
  );
}
