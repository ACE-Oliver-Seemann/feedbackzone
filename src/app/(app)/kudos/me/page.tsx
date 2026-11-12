import { KudosList } from "@/components/kudos-list";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { t } from "@/lib/texts.sk";
import { listMyKudos } from "@/server/kudos";

// Screen "Moje kudos" for everyone: received kudos, including private (MVP-17).
export default async function MyKudosPage() {
  const user = await requirePageUser();
  const kudos = await pageData(() => listMyKudos(user));

  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-semibold">{t.kudos.myTitle}</h1>
      <KudosList kudos={kudos} mode="received" emptyText={t.kudos.myEmpty} />
    </section>
  );
}
