import { KudosList } from "@/components/kudos-list";
import { SubNav } from "@/components/sub-nav";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { t } from "@/lib/texts.sk";
import { listMyKudos } from "@/server/kudos";

// Screen "Moje kudos" for everyone: received kudos, including private (MVP-17).
export const metadata = { title: t.kudos.myTitle };

export default async function MyKudosPage() {
  const user = await requirePageUser();
  const kudos = await pageData(() => listMyKudos(user));

  return (
    <section className="max-w-2xl">
      <SubNav
        label={t.nav.kudos}
        current="/kudos/me"
        items={[
          { href: "/kudos/new", label: t.nav.sendKudos },
          { href: "/kudos/me", label: t.nav.myKudos },
        ]}
      />
      <h1 className="text-xl font-semibold">{t.kudos.myTitle}</h1>
      <KudosList kudos={kudos} mode="received" emptyText={t.kudos.myEmpty} />
    </section>
  );
}
