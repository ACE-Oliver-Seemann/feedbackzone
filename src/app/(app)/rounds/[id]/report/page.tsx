import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { MIN_GROUP_SIZE } from "@/config/privacy";
import { SCALES } from "@/config/scales";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { formatDate, t } from "@/lib/texts.sk";
import { listRoundActions } from "@/server/actions";
import { getRoundResults } from "@/server/results";
import { getRoundSuggestions } from "@/server/suggestions";

const number = (value: number) =>
  value.toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/**
 * Printable report of one round for the team's manager and HR (IT-08).
 * Same permissions and the same threshold as the results screen, because it
 * is built from the same service calls.
 *
 * Comments are left out on purpose: a printed page or a PDF leaves the
 * application and its access rules, and free text is the part most likely to
 * give its author away.
 */
export default async function RoundReportPage({ params }: PageProps<"/rounds/[id]/report">) {
  const user = await requirePageUser("MANAGER", "HR");
  const { id } = await params;
  const [results, actions, suggested] = await pageData(() =>
    Promise.all([
      getRoundResults(user, id),
      listRoundActions(user, id),
      getRoundSuggestions(user, id),
    ]),
  );
  const { round, participation } = results;

  return (
    <article className="max-w-2xl print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/rounds/${round.id}/results`} className="text-sm font-medium text-teal-800 underline">
          {t.report.back}
        </Link>
        <PrintButton />
      </div>

      <header className="mt-4 border-b border-slate-300 pb-3 print:mt-0">
        <p className="text-sm text-slate-600">{t.report.title}</p>
        <h1 className="text-2xl font-semibold">{round.name}</h1>
        <p className="mt-1 text-sm text-slate-700">
          {round.teamName}, {t.rounds.deadline(formatDate(round.closesAt)).toLowerCase()}
        </p>
        <p className="mt-1 text-sm font-medium">
          {t.results.participation(participation.responded, participation.teamSize)}
        </p>
      </header>

      {results.status === "not_closed" && <p className="mt-4">{t.results.notClosed}</p>}

      {results.status === "insufficient_responses" && (
        <section className="mt-4">
          <h2 className="text-lg font-semibold">{t.results.insufficientTitle}</h2>
          <p className="mt-1 text-sm">
            {t.results.insufficientText(results.responseCount, MIN_GROUP_SIZE)}
          </p>
        </section>
      )}

      {results.status === "ok" && (
        <section className="mt-5 break-inside-avoid">
          <h2 className="text-lg font-semibold">{t.results.questionsTitle}</h2>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left">
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  {t.report.colQuestion}
                </th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                  {t.results.average}
                </th>
                {[1, 2, 3, 4, 5].map((value) => (
                  <th key={value} scope="col" className="w-8 py-1.5 text-right font-medium">
                    {value}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.questions.map((question) => (
                <tr key={question.position} className="border-b border-slate-200 align-top">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                    {question.text}
                    {!SCALES[question.scale].higherIsBetter && (
                      <span className="block text-xs text-slate-600">{t.scales.lowerIsBetter}</span>
                    )}
                  </th>
                  <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">
                    {number(question.average)}
                  </td>
                  {question.distribution.map((count, index) => (
                    <td key={index} className="py-1.5 text-right tabular-nums">
                      {count}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-600">{t.report.distributionHint}</p>
        </section>
      )}

      {round.status === "CLOSED" && (
        <section className="mt-6 break-inside-avoid">
          <h2 className="text-lg font-semibold">{t.actions.title}</h2>
          {actions.length === 0 ? (
            <p className="mt-1 text-sm">{t.actions.empty}</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {actions.map((action) => (
                <li key={action.id} className="border-b border-slate-200 pb-2">
                  <p className="font-medium">
                    {action.topic} ({t.actions.statuses[action.status]})
                  </p>
                  <p className="whitespace-pre-line">{action.description}</p>
                  <p className="text-xs text-slate-600">{t.actions.due(formatDate(action.dueDate))}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {suggested.status === "ok" && (
        <section className="mt-6 break-inside-avoid">
          <h2 className="text-lg font-semibold">{t.suggestions.title}</h2>
          <p className="mt-1 text-xs text-slate-600">{t.suggestions.rulesNote}</p>
          <ul className="mt-2 space-y-2 text-sm">
            {suggested.suggestions.map((suggestion) => (
              <li key={suggestion.questionText} className="border-b border-slate-200 pb-2">
                <p className="font-medium">{suggestion.topic}</p>
                <p>{suggestion.suggestion}</p>
                <p className="text-xs text-slate-600">
                  {t.suggestions.because(suggestion.questionText, number(suggestion.average))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-6 border-t border-slate-300 pt-2 text-xs text-slate-600">
        <p>{t.report.noComments}</p>
        <p>{t.report.generated(formatDate(new Date()))}</p>
      </footer>
    </article>
  );
}
