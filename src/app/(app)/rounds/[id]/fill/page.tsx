import Link from "next/link";
import { ActionList } from "@/components/action-list";
import { FillNotice, FillWizard } from "@/components/fill-wizard";
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
      <div className="mx-auto max-w-md">
        <FillNotice
          title={round.submitted ? t.fill.alreadySubmittedTitle : t.fill.closedTitle}
          text={round.submitted ? t.fill.alreadySubmittedText : t.fill.closedText}
        />
        <Link href="/" className="mt-6 inline-block text-sm font-medium text-teal-800 underline">
          {t.fill.backToSurveys}
        </Link>
      </div>
    );
  }

  // Actions of the team's last closed round, shown after submitting (MVP-09, MVP-14).
  const latest = await pageData(() => listLatestClosedRoundActions(user, round.teamId));

  return (
    <div className="mx-auto max-w-md">
      <FillWizard roundId={round.id} roundName={round.name} questions={round.questions}>
        {latest && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">{t.fill.latestActionsTitle(latest.roundName)}</h2>
            <ActionList actions={latest.actions} emptyText={t.fill.latestActionsEmpty} />
          </section>
        )}
      </FillWizard>
    </div>
  );
}
