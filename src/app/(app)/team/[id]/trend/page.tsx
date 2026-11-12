import type { Metadata } from "next";
import Link from "next/link";
import { SubNav } from "@/components/sub-nav";
import { TrendChart } from "@/components/trend-chart";
import { IconChart, IconUsers } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { EmptyState, Page, PageHeader } from "@/components/ui/page";
import { Section } from "@/components/ui/surface";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { FORWARD } from "@/lib/page-motion";
import { formatDate, t } from "@/lib/texts.sk";
import { FIXED_TOPIC_LABEL, getTeamTrend } from "@/server/trends";

const number = (value: number) =>
  value.toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

// Screen "Vývoj tímu" for the team's manager and HR (IT-08).
export const metadata: Metadata = { title: t.trend.title };

export default async function TeamTrendPage({ params }: PageProps<"/team/[id]/trend">) {
  const user = await requirePageUser("MANAGER", "HR");
  const { id } = await params;
  const trend = await pageData(() => getTeamTrend(user, id));

  const measured = trend.points.filter((point) => point.status === "ok");
  const withFixed = measured.filter((point) => point.fixed !== null);
  const hasFixedColumn = withFixed.length > 0;

  return (
    <Page>
      <SubNav
        label={trend.team.name}
        current={`/team/${trend.team.id}/trend`}
        items={[
          { href: `/team/${trend.team.id}`, label: t.team.title },
          { href: `/team/${trend.team.id}/trend`, label: t.nav.teamTrend },
        ]}
      />
      <PageHeader
        title={t.trend.title}
        context={
          <span className="inline-flex items-center gap-1.5">
            <IconUsers size={16} />
            {trend.team.name}
          </span>
        }
        description={t.trend.intro}
      />

      {trend.points.length === 0 ? (
        <EmptyState icon={<IconChart size={20} />} title={t.trend.empty} />
      ) : (
        <>
          <Section title={t.trend.chartTitle}>
          {withFixed.length === 0 ? (
            <Notice>{t.trend.noFixed}</Notice>
          ) : (
            <>
              {/* A line through one or two rounds looks more certain than it is. */}
              {withFixed.length < 3 && (
                <Notice tone="warning" className="mb-3">
                  {t.trend.fewRounds(withFixed.length)}
                </Notice>
              )}
              <TrendChart
                title={t.trend.chartTitle}
                points={trend.points.map((point) => ({
                  label: point.roundName,
                  date: point.closedAt,
                  value: point.status === "ok" ? point.fixed : null,
                }))}
              />
            </>
          )}
          </Section>

          <Section title={t.trend.tableTitle} description={t.trend.tableHint}>
          <p className="mb-2 text-xs text-muted">{t.trend.scrollHint}</p>
          <div
            // Focusable, so that the table can be scrolled with the keyboard (QA FE-011).
            tabIndex={0}
            role="region"
            aria-label={t.trend.tableTitle}
            className="overflow-x-auto rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-panel)] ring-1 ring-line"
          >
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-left text-xs text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t.trend.colRound}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t.trend.colResponded}
                  </th>
                  {hasFixedColumn && (
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      {FIXED_TOPIC_LABEL}
                    </th>
                  )}
                  {trend.topics.map((topic) => (
                    <th key={topic} scope="col" className="px-3 py-2 text-right font-medium">
                      {topic}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Newest first: the latest round is what people look for. */}
                {[...trend.points].reverse().map((point) => (
                  <tr key={point.roundId} className="border-b border-line last:border-0">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      <Link
                        href={`/rounds/${point.roundId}/results`}
                        transitionTypes={FORWARD}
                        className="rounded font-medium text-brand-700 hover:text-brand-900 hover:underline"
                      >
                        {point.roundName}
                      </Link>
                      <span className="block text-xs text-muted">
                        {formatDate(point.closedAt)}
                      </span>
                    </th>
                    <td className="px-3 py-2 tabular-nums">{point.responded}</td>
                    {point.status === "ok" ? (
                      <>
                        {hasFixedColumn && (
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            {point.fixed === null ? "–" : number(point.fixed)}
                          </td>
                        )}
                        {trend.topics.map((topic) => (
                          <td key={topic} className="px-3 py-2 text-right tabular-nums">
                            {topic in point.topics ? number(point.topics[topic]) : "–"}
                          </td>
                        ))}
                      </>
                    ) : (
                      <td
                        colSpan={trend.topics.length + (hasFixedColumn ? 1 : 0)}
                        className="px-3 py-2 text-amber-900"
                      >
                        {t.results.insufficientTitle}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </Section>
        </>
      )}
    </Page>
  );
}
