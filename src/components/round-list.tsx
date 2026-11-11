import Link from "next/link";
import { RoundTransitionButton } from "@/components/round-transition-button";
import { formatDate, t } from "@/lib/texts.sk";
import type { RoundListItem, RoundStatus } from "@/server/rounds";

const STATUS_STYLE: Record<RoundStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  OPEN: "bg-teal-100 text-teal-800",
  CLOSED: "bg-slate-200 text-slate-800",
};

export function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: RoundStatus }) {
  return <Badge className={STATUS_STYLE[status]}>{t.roundStatus[status]}</Badge>;
}

function RoundMeta({ round, showTeam }: { round: RoundListItem; showTeam?: boolean }) {
  return (
    <p className="mt-1 text-sm text-slate-600">
      {showTeam && (
        <>
          <Link href={`/team/${round.teamId}`} className="font-medium text-teal-800 underline">
            {round.teamName}
          </Link>{" "}
          ·{" "}
        </>
      )}
      {t.rounds.deadline(formatDate(round.closesAt))} · {t.rounds.questionCount(round.questionCount)}
    </p>
  );
}

/** Employee view: open rounds of own team with the "Odoslané" state (MVP-06). */
export function MySurveyList({ rounds }: { rounds: RoundListItem[] }) {
  if (rounds.length === 0) {
    return <p className="mt-3 text-slate-600">{t.rounds.mySurveysEmpty}</p>;
  }
  return (
    <ul className="mt-3 space-y-3">
      {rounds.map((round) => (
        <li key={round.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-medium">{round.name}</h3>
            {round.submitted ? (
              <Badge className="bg-emerald-100 text-emerald-800">{t.rounds.submitted}</Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-900">{t.rounds.notSubmitted}</Badge>
            )}
          </div>
          <RoundMeta round={round} />
          {!round.submitted && (
            <Link
              href={`/rounds/${round.id}/fill`}
              className="mt-3 inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              {t.rounds.fill}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Manager and HR view: status, participation, open/close (MVP-05, MVP-12, MVP-15). */
export function ManagedRoundList({
  rounds,
  showTeam,
}: {
  rounds: RoundListItem[];
  showTeam?: boolean;
}) {
  if (rounds.length === 0) {
    return <p className="mt-3 text-slate-600">{t.rounds.empty}</p>;
  }
  return (
    <ul className="mt-3 space-y-3">
      {rounds.map((round) => (
        <li key={round.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-medium">{round.name}</h3>
            <span className="flex flex-wrap gap-1.5">
              <StatusBadge status={round.status} />
              {round.awaitingAction && (
                <Badge className="bg-amber-100 text-amber-900">{t.rounds.awaitingAction}</Badge>
              )}
            </span>
          </div>
          <RoundMeta round={round} showTeam={showTeam} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-700">
              {round.participation && round.status !== "DRAFT" && (
                <>
                  {t.rounds.colParticipation}:{" "}
                  <strong>
                    {t.rounds.participation(
                      round.participation.responded,
                      round.participation.teamSize,
                    )}
                  </strong>
                </>
              )}
            </span>
            <span className="flex flex-wrap items-start gap-2">
              {round.status !== "DRAFT" && (
                <Link
                  href={`/rounds/${round.id}/results`}
                  className="rounded-md border border-teal-700 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50"
                >
                  {t.rounds.showResults}
                </Link>
              )}
              {round.status === "DRAFT" && (
                <RoundTransitionButton roundId={round.id} action="open" />
              )}
              {round.status === "OPEN" && (
                <RoundTransitionButton roundId={round.id} action="close" />
              )}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
