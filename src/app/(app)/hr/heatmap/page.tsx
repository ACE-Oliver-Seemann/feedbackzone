import Link from "next/link";
import { SubNav } from "@/components/sub-nav";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { t } from "@/lib/texts.sk";
import { getHeatmap } from "@/server/trends";

// Sequential scale: one hue, light to dark, higher score = darker. The steps
// stay light enough for dark text, so the number in the cell is always readable
// and the colour is never the only carrier of the value.
const STEPS: { from: number; className: string }[] = [
  { from: 4.5, className: "bg-teal-400" },
  { from: 4, className: "bg-teal-300" },
  { from: 3.5, className: "bg-teal-200" },
  { from: 3, className: "bg-teal-100" },
  { from: 0, className: "bg-teal-50" },
];
const stepFor = (score: number) => STEPS.find((step) => score >= step.from)!.className;

const number = (value: number) =>
  value.toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

// Screen "Porovnanie tímov" for HR (IT-08).
export const metadata = { title: t.heatmap.title };

export default async function HrHeatmapPage() {
  const user = await requirePageUser("HR");
  const heatmap = await pageData(() => getHeatmap(user));
  const hasData = heatmap.teams.some((team) => team.roundsCounted > 0);

  return (
    <section className="max-w-4xl">
      <SubNav
        label={t.nav.hrInsights}
        current="/hr/heatmap"
        items={[
          { href: "/hr/overview", label: t.nav.hrOverview },
          { href: "/hr/heatmap", label: t.nav.hrHeatmap },
        ]}
      />
      <h1 className="text-xl font-semibold">{t.heatmap.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{t.heatmap.intro(heatmap.windowDays)}</p>

      {!hasData ? (
        <p className="mt-4 text-slate-600">{t.heatmap.empty}</p>
      ) : (
        <>
          <p className="mt-3 text-xs text-slate-600">{t.trend.scrollHint}</p>
          <div
            tabIndex={0}
            role="region"
            aria-label={t.heatmap.title}
            className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white"
          >
            <table className="w-full min-w-max border-separate border-spacing-0.5 text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t.heatmap.colTeam}
                  </th>
                  {heatmap.topics.map((topic) => (
                    <th key={topic} scope="col" className="max-w-32 px-3 py-2 text-right font-medium">
                      {topic}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.teams.map((team) => (
                  <tr key={team.teamId}>
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      <Link href={`/team/${team.teamId}/trend`} className="font-medium underline">
                        {team.teamName}
                      </Link>
                      <span className="block text-xs text-slate-500">
                        {t.heatmap.roundsCounted(team.roundsCounted)}
                      </span>
                    </th>
                    {heatmap.topics.map((topic) => {
                      const score = team.cells[topic];
                      return score === undefined ? (
                        <td
                          key={topic}
                          className="px-3 py-2 text-right text-slate-600"
                          title={t.heatmap.noData}
                        >
                          –
                        </td>
                      ) : (
                        <td
                          key={topic}
                          className={`rounded-sm px-3 py-2 text-right font-medium tabular-nums text-slate-900 ${stepFor(score)}`}
                          title={`${team.teamName}, ${topic}: ${number(score)}`}
                        >
                          {number(score)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <span>{t.heatmap.legend}</span>
            {[...STEPS].reverse().map((step, index, all) => (
              <span key={step.className} className="inline-flex items-center gap-1.5">
                <span className={`inline-block h-3 w-5 rounded-sm ${step.className}`} />
                {/* "pod 3,0", "od 3,0", "od 3,5"…: every score falls into exactly one step. */}
                {index === 0
                  ? t.heatmap.legendBelow(number(all[1].from))
                  : t.heatmap.legendFrom(number(step.from))}
              </span>
            ))}
            <span>{t.heatmap.legendNoData}</span>
          </div>
          <p className="mt-2 text-xs text-slate-600">{t.heatmap.scoreHint}</p>
        </>
      )}
    </section>
  );
}
