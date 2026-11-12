import type { Metadata } from "next";
import Link from "next/link";
import { SubNav } from "@/components/sub-nav";
import { Disclosure } from "@/components/ui/disclosure";
import { IconChart } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { EmptyState, Page, PageHeader } from "@/components/ui/page";
import { InsetList, InsetRow, Panel } from "@/components/ui/surface";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { FORWARD } from "@/lib/page-motion";
import { t } from "@/lib/texts.sk";
import {
  getReactionOverview,
  type ReactionOverview,
  type ReactionSummary,
} from "@/server/hr-overview";

// Screen "Plnenie reakcie" for HR (IT-05).
export const metadata: Metadata = { title: t.hrOverview.title };

const linkClass =
  "rounded font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900";

export default async function HrOverviewPage() {
  const user = await requirePageUser("HR");
  const overview = await pageData(() => getReactionOverview(user));
  const someWaiting = overview.teams.some((team) => team.awaitingRounds.length > 0);

  return (
    <Page>
      <SubNav
        label={t.nav.hrInsights}
        current="/hr/overview"
        items={[
          { href: "/hr/overview", label: t.nav.hrOverview },
          { href: "/hr/heatmap", label: t.nav.hrHeatmap },
        ]}
      />
      <PageHeader title={t.hrOverview.title} description={t.hrOverview.intro} />

      {overview.total.closedRounds === 0 ? (
        <EmptyState icon={<IconChart size={20} />} title={t.hrOverview.empty} />
      ) : (
        <>
          <Notice tone={someWaiting ? "warning" : "success"}>
            <p className="font-medium">{headline(overview)}</p>
          </Notice>

          <Panel className="mt-6 px-5 py-5 sm:px-6">
            <h2 className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">
              {t.hrOverview.totalTitle}
            </h2>
            <SummaryFigures summary={overview.total} />
          </Panel>

          <InsetList className="mt-6">
            {overview.teams.map((team) => (
              <InsetRow key={team.teamId} className="py-5">
                <h2 className="text-[0.9375rem] font-semibold text-ink">
                  <Link href={`/team/${team.teamId}`} transitionTypes={FORWARD} className={linkClass}>
                    {team.teamName}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {t.hrOverview.teamLine(team.roundsWithAction, team.closedRounds)}
                </p>
                <Disclosure variant="inline" summary={t.hrOverview.details} className="mt-1">
                  <SummaryFigures summary={team} />
                </Disclosure>
                {team.awaitingRounds.length > 0 && (
                  <Notice
                    tone="warning"
                    title={<span role="heading" aria-level={3}>{t.hrOverview.awaitingRoundsTitle}</span>}
                    className="mt-3"
                  >
                    <ul className="space-y-0.5">
                      {team.awaitingRounds.map((round) => (
                        <li key={round.id}>
                          <Link
                            href={`/rounds/${round.id}/results`}
                            transitionTypes={FORWARD}
                            className="rounded font-medium underline underline-offset-2"
                          >
                            {round.name}
                          </Link>{" "}
                          ({t.hrOverview.awaitingSince(round.daysWaiting)})
                        </li>
                      ))}
                    </ul>
                  </Notice>
                )}
              </InsetRow>
            ))}
          </InsetList>
          <p className="mt-3 text-xs leading-relaxed text-muted">{t.hrOverview.reactionTimeHint}</p>
        </>
      )}
    </Page>
  );
}

/** The one sentence HR needs before any table (IT-13). */
function headline(overview: ReactionOverview): string {
  const waiting = overview.teams
    .flatMap((team) => team.awaitingRounds.map((round) => ({ team: team.teamName, ...round })))
    .sort((a, b) => b.daysWaiting - a.daysWaiting);
  if (waiting.length === 0) return t.hrOverview.headlineAllDone(overview.total.closedRounds);
  return t.hrOverview.headlineWaiting(
    waiting.length,
    overview.total.closedRounds,
    waiting[0].team,
    waiting[0].daysWaiting,
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
    <dl className="mt-3 grid gap-x-8 text-sm sm:grid-cols-2">
      {figures.map((figure) => (
        <div key={figure.label} className="flex justify-between gap-4 border-b border-line py-2">
          <dt className="text-muted">{figure.label}</dt>
          <dd className="text-right font-medium text-ink tabular-nums">{figure.value}</dd>
        </div>
      ))}
    </dl>
  );
}
