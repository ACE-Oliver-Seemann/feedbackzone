import type { Metadata } from "next";
import { ActionList } from "@/components/action-list";
import { KudosList } from "@/components/kudos-list";
import { IconCalendar, IconChart, IconUsers } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { EmptyState, Page, PageHeader } from "@/components/ui/page";
import { InsetList, InsetRow, Section } from "@/components/ui/surface";
import { MIN_GROUP_SIZE } from "@/config/privacy";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { formatDate, t } from "@/lib/texts.sk";
import { getTeamSummary, type TeamRoundSummary } from "@/server/teams";

export const metadata: Metadata = { title: t.team.title };

// Screen "Stránka tímu" for team members and HR (MVP-14, MVP-17).
export default async function TeamPage({ params }: PageProps<"/team/[id]">) {
  const user = await requirePageUser();
  const { id } = await params;
  const summary = await pageData(() => getTeamSummary(user, id));

  return (
    <Page>
      <PageHeader
        title={t.team.title}
        context={
          <span className="inline-flex items-center gap-1.5">
            <IconUsers size={16} />
            {summary.team.name}
          </span>
        }
      />

      {summary.rounds.length === 0 ? (
        <EmptyState icon={<IconChart size={20} />} title={t.team.roundsEmpty} />
      ) : (
        // Timeline of closed rounds, newest first (order as delivered by the server).
        <ol className="relative">
          {summary.rounds.map((round, index) => (
            <TimelineRound
              key={round.id}
              round={round}
              latest={index === 0}
              last={index === summary.rounds.length - 1}
            />
          ))}
        </ol>
      )}

      <Section title={t.team.kudosTitle}>
        <KudosList kudos={summary.kudos} mode="feed" emptyText={t.team.kudosEmpty} />
      </Section>
    </Page>
  );
}

function formatAverage(value: number): string {
  return value.toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function TimelineRound({
  round,
  latest,
  last,
}: {
  round: TeamRoundSummary;
  latest: boolean;
  last: boolean;
}) {
  return (
    <li className="relative pb-12 pl-8 last:pb-0 sm:pl-10">
      {/* The line runs from this dot to the next one. */}
      {!last && (
        <span
          className="absolute top-3 bottom-0 left-[5px] w-px bg-line-strong sm:left-[7px]"
          aria-hidden="true"
        />
      )}
      <span
        className={
          latest
            ? "absolute top-1.5 left-0 size-[11px] rounded-full bg-brand-600 ring-4 ring-brand-100 sm:size-[15px]"
            : "absolute top-1.5 left-0 size-[11px] rounded-full border-2 border-brand-400 bg-canvas sm:size-[15px]"
        }
        aria-hidden="true"
      />

      <h2 className="text-lg leading-snug font-semibold tracking-[-0.01em] break-words text-ink">
        {round.name}
      </h2>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          <IconCalendar size={15} />
          {t.rounds.deadline(formatDate(round.closesAt))}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <IconUsers size={15} />
          {t.team.participation(round.participation.responded, round.participation.teamSize)}
        </span>
      </p>

      <div className="mt-4">
        {round.results.status === "ok" ? (
          <InsetList>
            {round.results.questions.map((question) => (
              <AverageRow key={question.position} text={question.text} average={question.average} />
            ))}
          </InsetList>
        ) : (
          <Notice tone="confidential">{t.team.insufficient(MIN_GROUP_SIZE)}</Notice>
        )}
      </div>

      <h3 className="mt-6 mb-3 text-[0.9375rem] font-semibold text-ink">{t.team.actionsTitle}</h3>
      <ActionList actions={round.actions} compact emptyText={t.team.actionsEmpty} />
    </li>
  );
}

function AverageRow({ text, average }: { text: string; average: number }) {
  // Share of the 1–5 scale reached by the average, 0–100 %.
  const fill = Math.min(Math.max((average - 1) / 4, 0), 1) * 100;
  return (
    <InsetRow className="flex items-center justify-between gap-4 py-3.5">
      <span className="min-w-0 text-sm leading-snug text-ink">{text}</span>
      <span className="flex shrink-0 items-center gap-3">
        <span
          className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-brand-50 min-[400px]:block"
          aria-hidden="true"
        >
          <span className="block h-full rounded-full bg-brand-500" style={{ width: `${fill}%` }} />
        </span>
        <span className="w-10 text-right text-base font-semibold text-brand-700 tabular-nums">
          <span className="sr-only">{t.team.average} </span>
          {formatAverage(average)}
        </span>
      </span>
    </InsetRow>
  );
}
