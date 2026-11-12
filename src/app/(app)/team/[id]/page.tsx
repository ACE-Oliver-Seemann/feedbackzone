import { ActionList } from "@/components/action-list";
import { KudosList } from "@/components/kudos-list";
import { MIN_GROUP_SIZE } from "@/config/privacy";
import { SCALES } from "@/config/scales";
import { SubNav } from "@/components/sub-nav";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { formatDate, t } from "@/lib/texts.sk";
import { getTeamSummary } from "@/server/teams";

// Screen "Stránka tímu" for team members and HR (MVP-14, MVP-17).
export const metadata = { title: t.team.title };

export default async function TeamPage({ params }: PageProps<"/team/[id]">) {
  const user = await requirePageUser();
  const { id } = await params;
  const summary = await pageData(() => getTeamSummary(user, id));

  return (
    <div className="max-w-2xl">
      {/* Trend is for the manager and HR only (IT-08); the page checks again. */}
      {user.role !== "EMPLOYEE" && (
        <SubNav
          label={summary.team.name}
          current={`/team/${summary.team.id}`}
          items={[
            { href: `/team/${summary.team.id}`, label: t.team.title },
            { href: `/team/${summary.team.id}/trend`, label: t.nav.teamTrend },
          ]}
        />
      )}
      <p className="text-sm font-medium text-teal-800">{summary.team.name}</p>
      <h1 className="mt-1 text-xl font-semibold">{t.team.title}</h1>


      {summary.rounds.length === 0 ? (
        <p className="mt-3 text-slate-600">{t.team.roundsEmpty}</p>
      ) : (
        <ul className="mt-4 space-y-6">
          {summary.rounds.map((round) => (
            <li key={round.id} className="rounded-lg border border-slate-200 bg-slate-100/60 p-4">
              <h2 className="text-lg font-semibold">{round.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {t.team.closed(formatDate(round.closedAt))} ·{" "}
                {t.team.participation(round.participation.responded, round.participation.teamSize)}
              </p>

              {round.results.status === "ok" ? (
                <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                  {round.results.questions.map((question) => (
                    <li
                      key={question.position}
                      className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
                    >
                      <span>
                        {question.text}
                        {!SCALES[question.scale].higherIsBetter && (
                          <span className="mt-0.5 block text-xs text-amber-800">
                            {t.scales.lowerIsBetter}
                          </span>
                        )}
                      </span>
                      <span
                        className="shrink-0 text-base font-semibold tabular-nums text-teal-800"
                        aria-label={t.team.average}
                      >
                        {question.average.toLocaleString("sk-SK", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  {t.team.insufficient(MIN_GROUP_SIZE)}
                </p>
              )}

              <h3 className="mt-4 font-semibold">{t.team.actionsTitle}</h3>
              <ActionList actions={round.actions} emptyText={t.team.actionsEmpty} />
            </li>
          ))}
        </ul>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{t.team.kudosTitle}</h2>
        <KudosList kudos={summary.kudos} mode="feed" emptyText={t.team.kudosEmpty} />
      </section>
    </div>
  );
}
