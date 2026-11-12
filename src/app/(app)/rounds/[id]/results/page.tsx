import { ActionForm } from "@/components/action-form";
import { ActionList } from "@/components/action-list";
import { Badge, StatusBadge } from "@/components/round-list";
import { MIN_GROUP_SIZE } from "@/config/privacy";
import { SCALES } from "@/config/scales";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { formatDate, t } from "@/lib/texts.sk";
import { listRoundActions } from "@/server/actions";
import { getRoundResults, type QuestionResult } from "@/server/results";

// Screen "Výsledky kola a kroky" for manager and HR (MVP-10, MVP-11, MVP-13, MVP-15).
export default async function ResultsPage({ params }: PageProps<"/rounds/[id]/results">) {
  const user = await requirePageUser("MANAGER", "HR");
  const { id } = await params;
  const [results, actions] = await pageData(() =>
    Promise.all([getRoundResults(user, id), listRoundActions(user, id)]),
  );
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
          <section className="mt-8">
            <h2 className="text-lg font-semibold">{t.results.questionsTitle}</h2>
            <ul className="mt-3 space-y-3">
              {results.questions.map((question) => (
                <QuestionCard key={question.position} question={question} />
              ))}
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">{t.results.commentsTitle}</h2>
            <p className="text-sm text-slate-600">{t.results.commentsHint}</p>
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
          </section>
        </>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t.actions.title}</h2>
        {isClosed ? (
          <>
            <ActionList actions={actions} editable={canWriteActions} />
            {canWriteActions && <ActionForm roundId={round.id} />}
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
    </li>
  );
}
