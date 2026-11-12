import { ActionList } from "@/components/action-list";
import { FillBackLink, FillNotice, FillWizard } from "@/components/fill-wizard";
import { Page } from "@/components/ui/page";
import { Section } from "@/components/ui/surface";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { t } from "@/lib/texts.sk";
import { listLatestClosedRoundActions } from "@/server/actions";
import { getRoundForFill } from "@/server/responses";

// Screen "Vypĺňanie kola" for employee and manager (MVP-07 to MVP-09).
export default async function FillPage({ params }: PageProps<"/rounds/[id]/fill">) {
  const user = await requirePageUser("EMPLOYEE", "MANAGER");
  const { id } = await params;
  const round = await pageData(() => getRoundForFill(user, id));

  if (round.submitted || round.status !== "OPEN") {
    return (
      <Page width="narrow">
        <FillNotice
          kind={round.submitted ? "already" : "closed"}
          title={round.submitted ? t.fill.alreadySubmittedTitle : t.fill.closedTitle}
          text={round.submitted ? t.fill.alreadySubmittedText : t.fill.closedText}
        />
        <FillBackLink />
      </Page>
    );
  }

  // Actions of the team's last closed round, shown after submitting (MVP-09, MVP-14).
  const latest = await pageData(() => listLatestClosedRoundActions(user, round.teamId));

  return (
    <Page width="narrow">
      <FillWizard roundId={round.id} roundName={round.name} questions={round.questions}>
        {latest && (
          <Section
            title={t.fill.latestActionsTitle(latest.roundName)}
            className="animate-rise [animation-delay:120ms]"
          >
            <ActionList actions={latest.actions} emptyText={t.fill.latestActionsEmpty} />
          </Section>
        )}
      </FillWizard>
    </Page>
  );
}
