import { KudosForm } from "@/components/kudos-form";
import { SubNav } from "@/components/sub-nav";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { t } from "@/lib/texts.sk";
import { listKudosRecipients } from "@/server/kudos";

// Screen "Poslať kudos" for everyone (MVP-16).
export default async function NewKudosPage() {
  const user = await requirePageUser();
  const recipients = await pageData(() => listKudosRecipients(user));

  return (
    <section className="max-w-xl">
      <SubNav
        label={t.nav.kudos}
        current="/kudos/new"
        items={[
          { href: "/kudos/new", label: t.nav.sendKudos },
          { href: "/kudos/me", label: t.nav.myKudos },
        ]}
      />
      <h1 className="text-xl font-semibold">{t.kudos.newTitle}</h1>
      <p className="mt-1 text-sm text-slate-600">{t.kudos.newIntro}</p>
      <KudosForm recipients={recipients} />
    </section>
  );
}
