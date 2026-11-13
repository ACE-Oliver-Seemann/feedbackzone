import type { Metadata } from "next";
import {
  isFiltered,
  KindTabs,
  parseFilter,
  ResponsibilityFilters,
  toServerFilter,
} from "@/components/responsibility-filters";
import { ResponsibilityList } from "@/components/responsibility-list";
import { ResponsibilitySubNav } from "@/components/responsibility-sub-nav";
import { ButtonLink } from "@/components/ui/button";
import { IconInbox, IconPlus } from "@/components/ui/icons";
import { EmptyState, Page, PageHeader } from "@/components/ui/page";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { FORWARD } from "@/lib/page-motion";
import { t } from "@/lib/texts.sk";
import { getResponsibilityOptions, listResponsibilities } from "@/server/responsibilities";

const r = t.responsibilities;

// Screen "Zodpovednosti" (IT-14): HR sees all, a manager their own and their
// team's, an employee only what is assigned to them (checked on the server).
export const metadata: Metadata = { title: r.pageTitle };

export default async function ResponsibilitiesPage({ searchParams }: PageProps<"/responsibilities">) {
  const user = await requirePageUser();
  const isHr = user.role === "HR";
  const state = parseFilter(await searchParams, isHr);

  const [items, options] = await pageData(() =>
    Promise.all([listResponsibilities(user, toServerFilter(state)), getResponsibilityOptions(user)]),
  );

  const intro = isHr ? r.introHr : user.role === "MANAGER" ? r.introManager : r.introEmployee;
  const filtered = isFiltered(state);

  return (
    <Page>
      {isHr && <ResponsibilitySubNav current="/responsibilities" />}
      <PageHeader
        title={r.pageTitle}
        description={intro}
        actions={
          options.canCreate && (
            <ButtonLink href="/responsibilities/new" transitionTypes={FORWARD}>
              <IconPlus size={16} className="-ml-0.5" />
              {r.create}
            </ButtonLink>
          )
        }
      />

      <KindTabs state={state} />
      <ResponsibilityFilters state={state} options={isHr ? options : null} />

      <div className="mt-6">
        <p className="mb-3 text-sm text-muted" role="status">
          {r.count(items.length)}
        </p>
        {items.length === 0 ? (
          <EmptyState
            icon={<IconInbox size={20} />}
            title={filtered ? r.empty : user.role === "EMPLOYEE" ? r.emptyNoneEmployee : r.emptyNone}
            description={filtered ? r.emptyHint : undefined}
          />
        ) : (
          <ResponsibilityList items={items} />
        )}
      </div>
    </Page>
  );
}
