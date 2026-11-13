import type { Metadata } from "next";
import { ActionForm, SuggestionText } from "@/components/action-form";
import { ActionList } from "@/components/action-list";
import { StatusBadge } from "@/components/round-list";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { IconCalendar, IconChart, IconMessage, IconPlus, IconUsers } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { Page, PageHeader } from "@/components/ui/page";
import { InsetList, InsetRow, Panel, Section } from "@/components/ui/surface";
import { MIN_GROUP_SIZE } from "@/config/privacy";
import { SCALES } from "@/config/scales";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { FORWARD } from "@/lib/page-motion";
import { formatDate, t } from "@/lib/texts.sk";
import { listRoundActions } from "@/server/actions";
import { getRoundResults, summarizeResults, type QuestionResult } from "@/server/results";
import { getRoundSuggestions } from "@/server/suggestions";

export const metadata: Metadata = { title: t.results.title };

// Screen "Výsledky kola a kroky" for manager and HR (MVP-10, MVP-11, MVP-13, MVP-15).
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
  const { round, participation } = results;
  const isClosed = round.status === "CLOSED";
  // Only the team's manager writes actions; HR reads them (permission matrix).
  const canWriteActions = user.role === "MANAGER";
  const back = { href: user.role === "HR" ? "/hr/rounds" : "/rounds", label: t.nav.rounds };

  return (
    <Page>
      <PageHeader
        back={back}
        title={round.name}
        context={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <IconUsers size={16} />
              {round.teamName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconCalendar size={16} />
              {t.rounds.deadline(formatDate(round.closesAt))}
            </span>
          </span>
        }
        actions={
          <>
            <StatusBadge status={round.status} />
            {isClosed && actions.length === 0 && (
              <Badge tone="warning">{t.rounds.awaitingAction}</Badge>
            )}
          </>
        }
      />

      {isClosed && (
        <div className="mb-6 flex flex-wrap gap-2">
          <ButtonLink
            href={`/rounds/${round.id}/report`}
            transitionTypes={FORWARD}
            variant="secondary"
            size="sm"
          >
            <IconChart size={16} className="-ml-0.5" />
            {t.report.open}
          </ButtonLink>
          {user.role === "HR" && (
            <ButtonLink
              href={`/hr/issues?round=${round.id}#new`}
              transitionTypes={FORWARD}
              variant="secondary"
              size="sm"
            >
              <IconPlus size={16} className="-ml-0.5" />
              {t.issues.createFromRound}
            </ButtonLink>
          )}
        </div>
      )}

      {round.status !== "DRAFT" && (
        <ParticipationStat
          responded={participation.responded}
          teamSize={participation.teamSize}
        />
      )}

      {results.status === "not_closed" && (
        <Notice className="mt-4">
          {round.status === "DRAFT" ? t.results.draft : t.results.notClosed}
        </Notice>
      )}

      {results.status === "insufficient_responses" && (
        <Notice tone="confidential" title={t.results.insufficientTitle} className="mt-4">
          {t.results.insufficientText(results.responseCount, MIN_GROUP_SIZE)}
        </Notice>
      )}

      {results.status === "ok" && (
        <>
          {summary && (
            <Notice tone="info" title={t.results.summaryTitle} className="mt-4">
              <p>
                {t.results.strongest(summary.strongest.text, formatAverage(summary.strongest.average))}
              </p>
              <p className="mt-1">
                {t.results.weakest(summary.weakest.text, formatAverage(summary.weakest.average))}
              </p>
              {suggestions[0] && (
                <p className="mt-2">
                  <span className="font-semibold">{t.results.suggestedStep}</span>{" "}
                  {suggestions[0].suggestion}{" "}
                  <a
                    href="#kroky"
                    className="rounded font-semibold underline underline-offset-2 hover:text-brand-700"
                  >
                    {t.results.toActions}
                  </a>
                </p>
              )}
            </Notice>
          )}

          <Section title={t.results.questionsTitle}>
            <InsetList>
              {results.questions.map((question, index) => (
                <QuestionRow key={question.position} question={question} index={index} />
              ))}
            </InsetList>
          </Section>

          {/* Collapsed, with the count in the heading so it is not overlooked. */}
          <Disclosure
            className="mt-10"
            summary={
              <h2 className="inline">
                {t.results.commentsTitle} ({results.comments.length})
              </h2>
            }
          >
            <p className="px-4 pt-3 text-sm text-muted sm:px-5">{t.results.commentsHint}</p>
            {results.comments.length === 0 ? (
              <p className="px-4 py-4 text-sm text-ink-soft sm:px-5">{t.results.commentsEmpty}</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {results.comments.map((comment, index) => (
                  <li key={index} className="flex gap-3 px-4 py-4 sm:px-5">
                    <IconMessage size={18} className="mt-0.5 shrink-0 text-brand-400" />
                    <blockquote className="min-w-0 whitespace-pre-line break-words text-[0.9375rem] leading-relaxed text-ink">
                      {comment}
                    </blockquote>
                  </li>
                ))}
              </ul>
            )}
          </Disclosure>
        </>
      )}

      <div id="kroky" className="mt-10 scroll-mt-36 xl:scroll-mt-24">
        <Section title={t.actions.title}>
          {isClosed ? (
            <>
              <ActionList actions={actions} editable={canWriteActions} />
              {suggestions.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-base font-semibold tracking-[-0.01em] text-ink">
                    {t.suggestions.title}
                  </h3>
                  <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-muted">
                    {t.suggestions.rulesNote}
                  </p>
                  {/* HR reads the suggestions; the manager gets them with a button in the form. */}
                  {!canWriteActions && (
                    <InsetList className="mt-4">
                      {suggestions.map((suggestion) => (
                        <InsetRow key={suggestion.questionText}>
                          <SuggestionText suggestion={suggestion} />
                        </InsetRow>
                      ))}
                    </InsetList>
                  )}
                </div>
              )}
              {canWriteActions && <ActionForm roundId={round.id} suggestions={suggestions} />}
            </>
          ) : (
            <Notice>{t.actions.onlyAfterClose}</Notice>
          )}
        </Section>
      </div>
    </Page>
  );
}

function formatAverage(value: number): string {
  return value.toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function ParticipationStat({ responded, teamSize }: { responded: number; teamSize: number }) {
  const share = teamSize > 0 ? Math.min(responded / teamSize, 1) : 0;
  return (
    <Panel className="px-5 py-5 sm:px-6">
      {/* One sentence for screen readers; the visual stat below repeats it. */}
      <p className="sr-only">{t.results.participation(responded, teamSize)}</p>
      <div aria-hidden="true">
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-[2rem] leading-none font-semibold tracking-[-0.02em] text-ink tabular-nums">
            {t.results.participationValue(responded, teamSize)}
          </span>
          <span className="text-sm text-muted">{t.results.participationLabel}</span>
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-brand-50">
          <div
            className="h-full origin-left animate-grow-x rounded-full bg-brand-500"
            style={{ width: `${share * 100}%` }}
          />
        </div>
      </div>
    </Panel>
  );
}

function QuestionRow({ question, index }: { question: QuestionResult; index: number }) {
  const max = Math.max(...question.distribution, 1);
  // Position of the average on the 1–5 scale, 0–100 %.
  const position = Math.min(Math.max((question.average - 1) / 4, 0), 1) * 100;
  return (
    <InsetRow className="py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 pt-1">
          <h3 className="text-[0.9375rem] leading-snug font-medium text-ink">{question.text}</h3>
          {!SCALES[question.scale].higherIsBetter && (
            <p className="mt-1 text-xs text-amber-800">{t.scales.lowerIsBetter}</p>
          )}
        </div>
        <div className="w-20 shrink-0 text-right">
          <p>
            <span className="block text-xs text-muted">{t.results.average}</span>
            <span className="block text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-brand-700 tabular-nums">
              {formatAverage(question.average)}
            </span>
          </p>
          {/* Where the average sits on the 1–5 scale; decorative, the number carries the value. */}
          <div className="relative mt-1.5 h-1 rounded-full bg-brand-50" aria-hidden="true">
            <span
              className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600 ring-2 ring-surface"
              style={{ left: `${position}%` }}
            />
          </div>
        </div>
      </div>
      <Disclosure variant="inline" summary={t.results.showDistribution} className="mt-1">
        <ul className="mt-2 space-y-1.5">
          {question.distribution.map((count, valueIndex) => (
            <li
              key={valueIndex}
              className="flex items-center gap-3 text-sm"
              aria-label={t.results.distributionLabel(valueIndex + 1, count)}
              title={t.scales[question.scale][valueIndex]}
            >
              <span className="w-3 text-center text-muted tabular-nums">{valueIndex + 1}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
                <span
                  className="block h-full origin-left animate-grow-x rounded-full bg-brand-500"
                  style={{
                    width: `${(count / max) * 100}%`,
                    animationDelay: `${index * 90 + valueIndex * 45}ms`,
                  }}
                />
              </span>
              <span className="w-6 text-right text-ink-soft tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      </Disclosure>
    </InsetRow>
  );
}
