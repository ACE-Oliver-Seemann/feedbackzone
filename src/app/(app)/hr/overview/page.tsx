import Link from "next/link";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { t } from "@/lib/texts.sk";
import { getReactionOverview, type ReactionSummary } from "@/server/hr-overview";

// Screen "Plnenie reakcie" for HR (IT-05).
export default async function HrOverviewPage() {
  const user = await requirePageUser("HR");
  const overview = await pageData(() => getReactionOverview(user));

  return (
    <section className="max-w-3xl">
      <h1 className="text-xl font-semibold">{t.hrOverview.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{t.hrOverview.intro}</p>

      {overview.total.closedRounds === 0 ? (
        <p className="mt-4 text-slate-600">{t.hrOverview.empty}</p>
      ) : (
        <>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">{t.hrOverview.totalTitle}</h2>
            <SummaryFigures summary={overview.total} />
          </div>

          <ul className="mt-4 space-y-4">
            {overview.teams.map((team) => (
              <li key={team.teamId} className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="font-semibold">
                  <Link href={`/team/${team.teamId}`} className="text-teal-800 underline">
                    {team.teamName}
                  </Link>
                </h2>
                <SummaryFigures summary={team} />
                {team.awaitingRounds.length > 0 && (
                  <div className="mt-3 rounded-md bg-amber-50 px-3 py-2">
                    <h3 className="text-sm font-medium text-amber-950">
                      {t.hrOverview.awaitingRoundsTitle}
                    </h3>
                    <ul className="mt-1 space-y-0.5 text-sm text-amber-950">
                      {team.awaitingRounds.map((round) => (
                        <li key={round.id}>
                          <Link href={`/rounds/${round.id}/results`} className="underline">
                            {round.name}
                          </Link>{" "}
                          ({t.hrOverview.awaitingSince(round.daysWaiting)})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">{t.hrOverview.reactionTimeHint}</p>
        </>
      )}
    </section>
  );
}

function SummaryFigures({ summary }: { summary: ReactionSummary }) {
  const figures: { label: string; value: string }[] = [
    { label: t.hrOverview.closedRounds, value: String(summary.closedRounds) },
    {
      label: t.hrOverview.withAction,
      value:
        summary.sharePercent === null
          ? "–"
          : `${summary.roundsWithAction} (${t.hrOverview.share(summary.sharePercent)})`,
    },
    {
      label: t.hrOverview.reactionTime,
      value:
        summary.medianDaysToFirstAction === null
          ? summary.closedRounds === 0
            ? "–"
            : t.hrOverview.reactionTimeUnknown
          : t.hrOverview.days(summary.medianDaysToFirstAction),
    },
    {
      label: t.hrOverview.actionsTitle,
      value: [
        `${t.actions.statuses.PLANNED}: ${summary.actions.planned}`,
        `${t.actions.statuses.IN_PROGRESS}: ${summary.actions.inProgress}`,
        `${t.actions.statuses.DONE}: ${summary.actions.done}`,
      ].join(", "),
    },
    { label: t.hrOverview.overdue, value: String(summary.actions.overdue) },
  ];
  return (
    <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {figures.map((figure) => (
        <div key={figure.label} className="flex justify-between gap-4 border-b border-slate-100 py-1">
          <dt className="text-slate-600">{figure.label}</dt>
          <dd className="text-right font-medium">{figure.value}</dd>
        </div>
      ))}
    </dl>
  );
}
