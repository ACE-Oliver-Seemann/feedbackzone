import Link from "next/link";
import { RoundTransitionButton } from "@/components/round-transition-button";
import { Badge as UiBadge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { IconCalendar, IconClipboard, IconInbox } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/page";
import { InsetList, InsetRow } from "@/components/ui/surface";
import { FORWARD } from "@/lib/page-motion";
import { formatDate, t } from "@/lib/texts.sk";
import type { RoundListItem, RoundStatus } from "@/server/rounds";

const STATUS_TONE: Record<RoundStatus, BadgeTone> = {
  DRAFT: "neutral",
  OPEN: "brand",
  CLOSED: "info",
};

export function StatusBadge({ status }: { status: RoundStatus }) {
  return <UiBadge tone={STATUS_TONE[status]}>{t.roundStatus[status]}</UiBadge>;
}

/**
 * Employee view: open rounds of own team with the "Odoslané" state (MVP-06).
 * Sits right under the page h1, so the round names are h2 (FE-010).
 */
export function MySurveyList({ rounds }: { rounds: RoundListItem[] }) {
  if (rounds.length === 0) {
    return <EmptyState icon={<IconInbox size={22} />} title={t.rounds.mySurveysEmpty} />;
  }
  return (
    <InsetList>
      {rounds.map((round) => (
        <InsetRow
          key={round.id}
          interactive={!round.submitted}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
        >
          {/* The whole row opens the round; the visible "Vyplniť" button is the
              accessible link, this overlay is for the pointer only. */}
          {!round.submitted && (
            <Link
              href={`/rounds/${round.id}/fill`}
              transitionTypes={FORWARD}
              aria-hidden="true"
              tabIndex={-1}
              className="absolute inset-0"
            />
          )}
          <div className="pointer-events-none relative min-w-0">
            <h2 className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">{round.name}</h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <IconCalendar size={15} className="shrink-0" />
                {t.rounds.deadline(formatDate(round.closesAt))}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IconClipboard size={15} className="shrink-0" />
                {t.rounds.questionCount(round.questionCount)}
              </span>
            </p>
          </div>
          <div className="relative flex shrink-0 items-center justify-between gap-3 sm:justify-end">
            {round.submitted ? (
              <UiBadge tone="success">{t.rounds.submitted}</UiBadge>
            ) : (
              <>
                <UiBadge tone="warning">{t.rounds.notSubmitted}</UiBadge>
                <ButtonLink href={`/rounds/${round.id}/fill`} transitionTypes={FORWARD}>
                  {t.rounds.fill}
                </ButtonLink>
              </>
            )}
          </div>
        </InsetRow>
      ))}
    </InsetList>
  );
}

// Column template shared by the header row and every round row on large
// screens, so the rows line up like a table. Below lg each row is stacked.
const COLUMNS =
  "lg:grid lg:grid-cols-[minmax(0,1fr)_9.5rem_7rem_7.5rem_11.5rem] lg:items-center lg:gap-x-5";

/**
 * Manager and HR view: status, participation, open/close (MVP-05, MVP-12, MVP-15).
 * One list, two layouts: table-like columns on lg+, stacked rows below. Cell
 * labels stay in the markup (visually hidden on lg+) so every row reads fully.
 */
export function ManagedRoundList({
  rounds,
  showTeam,
  headingLevel = 3,
}: {
  rounds: RoundListItem[];
  showTeam?: boolean;
  /** 2 when the list sits directly under the page h1 (FE-010); 3 inside a Section. */
  headingLevel?: 2 | 3;
}) {
  if (rounds.length === 0) {
    return <EmptyState icon={<IconInbox size={22} />} title={t.rounds.empty} />;
  }
  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-panel)] ring-1 ring-line">
      <div
        aria-hidden="true"
        className={cx(
          "hidden border-b border-line bg-canvas/60 px-5 py-2.5 text-xs font-medium text-muted",
          COLUMNS,
        )}
      >
        <span>{showTeam ? `${t.rounds.colName} · ${t.rounds.colTeam}` : t.rounds.colName}</span>
        <span>{t.rounds.colStatus}</span>
        <span>{t.rounds.colDeadline}</span>
        <span>{t.rounds.colParticipation}</span>
        <span className="text-right">{t.rounds.colActions}</span>
      </div>
      <ul className="divide-y divide-line">
        {rounds.map((round) => (
          <ManagedRoundRow
            key={round.id}
            round={round}
            showTeam={showTeam}
            headingLevel={headingLevel}
          />
        ))}
      </ul>
    </div>
  );
}

function ManagedRoundRow({
  round,
  showTeam,
  headingLevel,
}: {
  round: RoundListItem;
  showTeam?: boolean;
  headingLevel: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const participation = round.status !== "DRAFT" ? round.participation : undefined;
  const share =
    participation && participation.teamSize > 0
      ? Math.min(1, participation.responded / participation.teamSize)
      : 0;

  return (
    // data-round-* hooks: RoundTransitionButton moves focus within the row after a
    // status change replaces the button that had focus (FE-002).
    <li data-round-row={round.id} className={cx("grid gap-3 px-4 py-4 sm:px-5", COLUMNS)}>
      {/* Name and team */}
      <div className="min-w-0">
        <Heading
          data-round-heading=""
          tabIndex={-1}
          className="rounded font-semibold tracking-[-0.01em] text-ink"
        >
          {round.name}
        </Heading>
        {showTeam && (
          <Link
            href={`/team/${round.teamId}`}
            transitionTypes={FORWARD}
            className="mt-0.5 inline-block rounded text-sm text-brand-700 hover:text-brand-900 hover:underline"
          >
            {round.teamName}
          </Link>
        )}
      </div>

      {/* Status */}
      <div className="flex flex-wrap items-center gap-1.5 lg:flex-col lg:items-start">
        <span className="sr-only">{t.rounds.colStatus}: </span>
        <StatusBadge status={round.status} />
        {round.awaitingAction && <UiBadge tone="warning">{t.rounds.awaitingAction}</UiBadge>}
      </div>

      {/* Deadline and participation: side by side when stacked, two columns on lg+ */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2 lg:contents">
        <p className="text-sm text-ink-soft tabular-nums">
          <span className="block text-xs text-muted lg:sr-only">{t.rounds.colDeadline}</span>
          {formatDate(round.closesAt)}
        </p>
        {participation ? (
          <div className="min-w-28 text-sm">
            <span className="block text-xs text-muted lg:sr-only">{t.rounds.colParticipation}</span>
            <span className="font-medium text-ink tabular-nums">
              {t.rounds.participation(participation.responded, participation.teamSize)}
            </span>
            <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
              <span
                className="block h-full origin-left animate-grow-x rounded-full bg-brand-500"
                style={{ width: `${share * 100}%` }}
              />
            </span>
          </div>
        ) : (
          <span className="hidden text-sm text-muted lg:block" aria-hidden="true">
            –
          </span>
        )}
      </div>

      {/* Actions */}
      <div data-round-actions="" className="flex flex-wrap items-start gap-2 lg:justify-end">
        {round.status !== "DRAFT" && (
          <ButtonLink
            href={`/rounds/${round.id}/results`}
            transitionTypes={FORWARD}
            variant="secondary"
            size="sm"
          >
            {t.rounds.showResults}
          </ButtonLink>
        )}
        {round.status === "DRAFT" && <RoundTransitionButton roundId={round.id} action="open" />}
        {round.status === "OPEN" && <RoundTransitionButton roundId={round.id} action="close" />}
      </div>
    </li>
  );
}
