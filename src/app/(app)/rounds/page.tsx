import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ManagedRoundList } from "@/components/round-list";
import { ButtonLink } from "@/components/ui/button";
import { IconPlus } from "@/components/ui/icons";
import { Page, PageHeader } from "@/components/ui/page";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { FORWARD } from "@/lib/page-motion";
import { t } from "@/lib/texts.sk";
import { listRounds } from "@/server/rounds";

export const metadata: Metadata = { title: t.nav.rounds };

// Screen "Prieskumy" for a manager: all rounds of their team (MVP-05, MVP-15).
// Moved here from the home page, which now shows what needs doing (IT-11, IT-12).
export default async function TeamRoundsPage() {
  const user = await requirePageUser("MANAGER", "HR");
  if (user.role === "HR") redirect("/hr/rounds");
  const rounds = await pageData(() => listRounds(user));

  return (
    <Page width="wide">
      <PageHeader
        title={t.rounds.teamRoundsTitle}
        actions={
          <ButtonLink href="/rounds/new" transitionTypes={FORWARD}>
            <IconPlus size={16} className="-ml-0.5" />
            {t.rounds.createFirst}
          </ButtonLink>
        }
      />
      <ManagedRoundList rounds={rounds} headingLevel={2} />
    </Page>
  );
}
