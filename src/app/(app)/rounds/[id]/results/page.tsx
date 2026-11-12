import { ActionForm } from "@/components/action-form";
import { ActionList } from "@/components/action-list";
import { StatusBadge } from "@/components/round-list";
import { Badge } from "@/components/ui/badge";
import { IconCalendar, IconMessage, IconUsers } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { EmptyState, Page, PageHeader } from "@/components/ui/page";
import { InsetList, InsetRow, Panel, Section } from "@/components/ui/surface";
import { MIN_GROUP_SIZE } from "@/config/privacy";
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
  const back =
    user.role === "HR"
      ? { href: "/hr/rounds", label: t.nav.hrRounds }
      : { href: "/", label: t.nav.mySurveys };

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
          <Section title={t.results.questionsTitle}>
            <InsetList>
              {results.questions.map((question, index) => (
                <QuestionRow key={question.position} question={question} index={index} />
              ))}
            </InsetList>
          </Section>

          <Section title={t.results.commentsTitle} description={t.results.commentsHint}>
            {results.comments.length === 0 ? (
              <EmptyState icon={<IconMessage size={20} />} title={t.results.commentsEmpty} />
            ) : (
              <InsetList>
                {results.comments.map((comment, index) => (
                  <InsetRow key={index} className="flex gap-3">
                    <IconMessage size={18} className="mt-0.5 shrink-0 text-brand-400" />
                    <blockquote className="min-w-0 whitespace-pre-line break-words text-[0.9375rem] leading-relaxed text-ink">
                      {comment}
                    </blockquote>
                  </InsetRow>
                ))}
              </InsetList>
            )}
          </Section>
        </>
      )}

      <Section title={t.actions.title}>
        {isClosed ? (
          <>
            <ActionList actions={actions} editable={canWriteActions} />
            {canWriteActions && <ActionForm roundId={round.id} />}
          </>
        ) : (
          <Notice>{t.actions.onlyAfterClose}</Notice>
        )}
      </Section>
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
          <div className="h-full origin-left animate-grow-x rounded-full bg-brand-500" style={{ width: `${share * 100}%` }} />
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
        <h3 className="min-w-0 pt-1 text-[0.9375rem] leading-snug font-medium text-ink">
          {question.text}
        </h3>
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
      <ul className="mt-4 space-y-1.5">
        {question.distribution.map((count, valueIndex) => (
          <li
            key={valueIndex}
            className="flex items-center gap-3 text-sm"
            aria-label={t.results.distributionLabel(valueIndex + 1, count)}
          >
            <span className="w-3 text-center text-muted tabular-nums">
              {valueIndex + 1}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
              <span
                className="block h-full origin-left animate-grow-x rounded-full bg-brand-500"
                style={{
                  width: `${(count / max) * 100}%`,
                  animationDelay: `${index * 90 + valueIndex * 45}ms`,
                }}
              />
            </span>
            <span className="w-6 text-right text-ink-soft tabular-nums">
              {count}
            </span>
          </li>
        ))}
      </ul>
    </InsetRow>
  );
}
