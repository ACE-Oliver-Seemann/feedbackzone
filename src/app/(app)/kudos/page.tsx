import type { Metadata } from "next";
import { KudosHub, type KudosTab } from "@/components/kudos-hub";
import { Page, PageHeader } from "@/components/ui/page";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { t } from "@/lib/texts.sk";
import { listKudosRecipients, listMyKudos } from "@/server/kudos";

export const metadata: Metadata = { title: t.kudos.hubTitle };

// Screen "Kudos" for everyone: received kudos, including private (MVP-17),
// and the form to send one (MVP-16), as two tabs of one section.
export default async function KudosPage({ searchParams }: PageProps<"/kudos">) {
  const user = await requirePageUser();
  const { tab } = await searchParams;
  const initialTab: KudosTab = tab === "send" ? "send" : "received";
  const [received, recipients] = await pageData(() =>
    Promise.all([listMyKudos(user), listKudosRecipients(user)]),
  );

  return (
    <Page>
      <PageHeader title={t.kudos.hubTitle} description={t.kudos.hubIntro} />
      <KudosHub
        received={received}
        recipients={recipients}
        initialTab={initialTab}
        viewerId={user.id}
      />
    </Page>
  );
}
