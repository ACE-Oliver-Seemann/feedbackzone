import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { ResponsibilityForm } from "@/components/responsibility-form";
import { Page, PageHeader } from "@/components/ui/page";
import { Panel } from "@/components/ui/surface";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { t } from "@/lib/texts.sk";
import { getIssuePrefill } from "@/server/hr-issues";
import { getResponsibilityOptions } from "@/server/responsibilities";

const r = t.responsibilities;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Form "Nová zodpovednosť" (IT-14): HR for anyone, a manager for themselves or
// their team. HR arrives here prefilled from round results (?round=) or a note (?note=).
export const metadata: Metadata = { title: r.newPageTitle };

export default async function NewResponsibilityPage({ searchParams }: PageProps<"/responsibilities/new">) {
  const user = await requirePageUser("HR", "MANAGER");
  const query = await searchParams;
  const isHr = user.role === "HR";

  const [options, prefill] = await pageData(() =>
    Promise.all([
      getResponsibilityOptions(user),
      isHr
        ? getIssuePrefill(user, { roundId: first(query.round), noteId: first(query.note) })
        : Promise.resolve({ round: null, note: null }),
    ]),
  );
  if (!options.canCreate) forbidden();

  return (
    <Page width="narrow">
      <PageHeader back={{ href: "/responsibilities", label: r.back }} title={r.newPageTitle} />
      <Panel className="p-5 sm:p-6">
        <ResponsibilityForm
          mode="create"
          options={options}
          isHr={isHr}
          currentUserId={user.id}
          prefill={prefill}
        />
      </Panel>
    </Page>
  );
}
