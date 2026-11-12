import Link from "next/link";
import { TrendChart } from "@/components/trend-chart";
import { SubNav } from "@/components/sub-nav";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { formatDate, t } from "@/lib/texts.sk";
import { FIXED_TOPIC_LABEL, getTeamTrend } from "@/server/trends";

const number = (value: number) =>
  value.toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

// Screen "Vývoj tímu" for the team's manager and HR (IT-08).
export const metadata = { title: t.trend.title };

export default async function TeamTrendPage({ params }: PageProps<"/team/[id]/trend">) {
  const user = await requirePageUser("MANAGER", "HR");
  const { id } = await params;
  const trend = await pageData(() => getTeamTrend(user, id));

  const measured = trend.points.filter((point) => point.status === "ok");
  const withFixed = measured.filter((point) => point.fixed !== null);
  const hasFixedColumn = withFixed.length > 0;

  return (
    <section className="max-w-3xl">
      <SubNav
        label={trend.team.name}
        current={`/team/${trend.team.id}/trend`}
        items={[
          { href: `/team/${trend.team.id}`, label: t.team.title },
          { href: `/team/${trend.team.id}/trend`, label: t.nav.teamTrend },
        ]}
      />
      <p className="text-sm font-medium text-teal-800">{trend.team.name}</p>
      <h1 className="mt-1 text-xl font-semibold">{t.trend.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{t.trend.intro}</p>

      {trend.points.length === 0 ? (
        <p className="mt-4 text-slate-600">{t.trend.empty}</p>
      ) : (
        <>
          <h2 className="mt-6 text-lg font-semibold">{t.trend.chartTitle}</h2>
          {withFixed.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">{t.trend.noFixed}</p>
          ) : (
            <>
              {/* A line through one or two rounds looks more certain than it is. */}
              {withFixed.length < 3 && (
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {t.trend.fewRounds(withFixed.length)}
                </p>
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

          <h2 className="mt-8 text-lg font-semibold">{t.trend.tableTitle}</h2>
          <p className="mt-1 text-sm text-slate-600">{t.trend.tableHint}</p>
          <p className="mt-1 text-xs text-slate-600">{t.trend.scrollHint}</p>
          <div
            // Focusable, so that the table can be scrolled with the keyboard (QA FE-011).
            tabIndex={0}
            role="region"
            aria-label={t.trend.tableTitle}
            className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white"
          >
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
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
                  <tr key={point.roundId} className="border-b border-slate-100 last:border-0">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      <Link href={`/rounds/${point.roundId}/results`} className="underline">
                        {point.roundName}
                      </Link>
                      <span className="block text-xs text-slate-500">
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
        </>
      )}
    </section>
  );
}
