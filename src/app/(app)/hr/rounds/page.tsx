import { ManagedRoundList } from "@/components/round-list";
import { ButtonLink } from "@/components/ui/button";
import { IconPlus } from "@/components/ui/icons";
import { Page, PageHeader } from "@/components/ui/page";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { FORWARD } from "@/lib/page-motion";
import { t } from "@/lib/texts.sk";
import { listRounds } from "@/server/rounds";

// Screen "Prehľad kôl" for HR (MVP-12, MVP-15).
export default async function HrRoundsPage() {
  const user = await requirePageUser("HR");
  const rounds = await pageData(() => listRounds(user));

  // Counts from the already loaded list; no extra data.
  const summary = [
    { label: t.rounds.summaryOpen, value: rounds.filter((round) => round.status === "OPEN").length },
    { label: t.rounds.summaryAwaiting, value: rounds.filter((round) => round.awaitingAction).length },
    { label: t.rounds.summaryTotal, value: rounds.length },
  ];

  return (
    <Page width="wide">
      <PageHeader
        title={t.rounds.allRoundsTitle}
        actions={
          <ButtonLink href="/rounds/new" transitionTypes={FORWARD}>
            <IconPlus size={16} className="-ml-0.5" />
            {t.rounds.createFirst}
          </ButtonLink>
        }
      />

      {rounds.length > 0 && (
        <dl
          aria-label={t.rounds.summaryLabel}
          className="mb-6 grid grid-cols-3 divide-x divide-line rounded-[var(--radius-panel)] bg-surface py-4 shadow-[var(--shadow-panel)] ring-1 ring-line sm:max-w-lg"
        >
          {summary.map((item) => (
            <div key={item.label} className="flex flex-col-reverse px-4 sm:px-5">
              <dt className="mt-0.5 text-xs leading-snug text-muted sm:text-sm">{item.label}</dt>
              <dd className="text-2xl font-semibold tracking-[-0.02em] text-ink tabular-nums">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <ManagedRoundList rounds={rounds} showTeam />
    </Page>
  );
}
