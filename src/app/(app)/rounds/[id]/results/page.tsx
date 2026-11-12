import Link from "next/link";
import { ActionForm, SuggestionText } from "@/components/action-form";
import { ActionList } from "@/components/action-list";
import { Badge, StatusBadge } from "@/components/round-list";
import { MIN_GROUP_SIZE } from "@/config/privacy";
import { SCALES } from "@/config/scales";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { formatDate, t } from "@/lib/texts.sk";
import { listRoundActions } from "@/server/actions";
import { getRoundResults, summarizeResults, type QuestionResult } from "@/server/results";
import { getRoundSuggestions } from "@/server/suggestions";

// Screen "Výsledky kola a kroky" for manager and HR (MVP-10, MVP-11, MVP-13, MVP-15).
export const metadata = { title: t.results.title };

export default async function ResultsPage({ params }: PageProps<"/rounds/[id]/results">) {
  const user = await requirePageUser("MANAGER", "HR");
  const { id } = await params;
  const [results, actions, suggested] = await pageData(() =>
    Promise.all([
      getRoundResults(user, id),
      listRoundActions(user, id),
      getRoundSuggestions(user, id),
    ]),
  );
  // IT-09: only for a closed round above the confidentiality threshold.
  const suggestions = suggested.status === "ok" ? suggested.suggestions : [];
  // IT-13: the two sentences a manager needs first; everything else is below.
  const summary = results.status === "ok" ? summarizeResults(results.questions) : null;
  const average = (value: number) =>
    value.toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const { round, participation } = results;
  const isClosed = round.status === "CLOSED";
  // Only the team's manager writes actions; HR reads them (permission matrix).
  const canWriteActions = user.role === "MANAGER";

  return (
    <div className="max-w-2xl">
      <p className="text-sm font-medium text-teal-800">{t.results.title}</p>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
        <h1 className="text-xl font-semibold">{round.name}</h1>
        <span className="flex flex-wrap gap-1.5">
          <StatusBadge status={round.status} />
          {isClosed && actions.length === 0 && (
            <Badge className="bg-amber-100 text-amber-900">{t.rounds.awaitingAction}</Badge>
          )}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {round.teamName} · {t.rounds.deadline(formatDate(round.closesAt))}
      </p>

      {isClosed && (
        <Link
          href={`/rounds/${round.id}/report`}
          className="mr-2 mt-3 inline-block rounded-md border border-teal-700 px-3 py-3 text-sm font-medium text-teal-800 hover:bg-teal-50"
        >
          {t.report.open}
        </Link>
      )}
      {user.role === "HR" && isClosed && (
        <Link
          href={`/hr/issues?round=${round.id}#new`}
          className="mt-3 inline-block rounded-md border border-teal-700 px-3 py-3 text-sm font-medium text-teal-800 hover:bg-teal-50"
        >
          {t.issues.createFromRound}
        </Link>
      )}

      {round.status !== "DRAFT" && (
        <p className="mt-4 rounded-lg border border-slate-200 bg-white p-4 font-medium">
          {t.results.participation(participation.responded, participation.teamSize)}
        </p>
      )}

      {results.status === "not_closed" && (
        <p className="mt-4 text-slate-700">
          {round.status === "DRAFT" ? t.results.draft : t.results.notClosed}
        </p>
      )}

      {results.status === "insufficient_responses" && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-950">{t.results.insufficientTitle}</h2>
          <p className="mt-1 text-sm text-amber-950">
            {t.results.insufficientText(results.responseCount, MIN_GROUP_SIZE)}
          </p>
        </div>
      )}

      {results.status === "ok" && (
        <>
          {summary && (
            <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4">
              <h2 className="font-semibold text-teal-950">{t.results.summaryTitle}</h2>
              <p className="mt-1 text-sm">
                {t.results.strongest(summary.strongest.text, average(summary.strongest.average))}
              </p>
              <p className="mt-1 text-sm">
                {t.results.weakest(summary.weakest.text, average(summary.weakest.average))}
              </p>
              {suggestions[0] && (
                <p className="mt-2 text-sm">
                  <span className="font-medium">{t.results.suggestedStep}</span>{" "}
                  {suggestions[0].suggestion}{" "}
                  <a href="#kroky" className="font-medium text-teal-800 underline">
                    {t.results.toActions}
                  </a>
                </p>
              )}
            </div>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-semibold">{t.results.questionsTitle}</h2>
            <ul className="mt-3 space-y-3">
              {results.questions.map((question) => (
                <QuestionCard key={question.position} question={question} />
              ))}
            </ul>
          </section>

          {/* Collapsed, with the count in the heading so it is not overlooked. */}
          <details className="mt-8">
            <summary className="cursor-pointer text-lg font-semibold">
              {t.results.commentsTitle} ({results.comments.length})
            </summary>
            <p className="mt-1 text-sm text-slate-600">{t.results.commentsHint}</p>
            {results.comments.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">{t.results.commentsEmpty}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {results.comments.map((comment, index) => (
                  <li
                    key={index}
                    className="whitespace-pre-line rounded-lg border border-slate-200 bg-white p-3 text-sm"
                  >
                    {comment}
                  </li>
                ))}
              </ul>
            )}
          </details>
        </>
      )}

      <section id="kroky" className="mt-8 scroll-mt-4">
        <h2 className="text-lg font-semibold">{t.actions.title}</h2>
        {isClosed ? (
          <>
            <ActionList actions={actions} editable={canWriteActions} />
            {suggestions.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold">{t.suggestions.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{t.suggestions.rulesNote}</p>
                {/* HR reads the suggestions; the manager gets them with a button in the form. */}
                {!canWriteActions && (
                  <ul className="mt-3 space-y-3">
                    {suggestions.map((suggestion) => (
                      <li
                        key={suggestion.questionText}
                        className="rounded-lg border border-teal-200 bg-teal-50 p-4"
                      >
                        <SuggestionText suggestion={suggestion} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {canWriteActions && <ActionForm roundId={round.id} suggestions={suggestions} />}
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-600">{t.actions.onlyAfterClose}</p>
        )}
      </section>
    </div>
  );
}

function QuestionCard({ question }: { question: QuestionResult }) {
  const max = Math.max(...question.distribution, 1);
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium leading-snug">{question.text}</h3>
          {!SCALES[question.scale].higherIsBetter && (
            <p className="mt-1 text-xs text-amber-800">{t.scales.lowerIsBetter}</p>
          )}
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-xs text-slate-500">{t.results.average}</span>
          <span className="block text-2xl font-semibold tabular-nums text-teal-800">
            {question.average.toLocaleString("sk-SK", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 2,
            })}
          </span>
        </p>
      </div>
      <details className="mt-2">
        <summary className="inline-block cursor-pointer py-2 text-sm font-medium text-teal-800">
          {t.results.showDistribution}
        </summary>
      <ul className="mt-3 space-y-1">
        {question.distribution.map((count, index) => (
          <li
            key={index}
            className="flex items-center gap-2 text-sm"
            aria-label={t.results.distributionLabel(index + 1, count)}
            title={t.scales[question.scale][index]}
          >
            <span className="w-3 text-slate-600">{index + 1}</span>
            <span className="h-3 flex-1 rounded-sm bg-slate-100">
              <span
                className="block h-3 rounded-sm bg-teal-600"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </span>
            <span className="w-5 text-right tabular-nums text-slate-700">{count}</span>
          </li>
        ))}
      </ul>
      </details>
    </li>
  );
}
