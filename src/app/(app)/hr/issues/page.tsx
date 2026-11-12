import type { Metadata } from "next";
import Link from "next/link";
import { IssueControls } from "@/components/issue-controls";
import { IssueForm } from "@/components/issue-form";
import { ISSUE_STATUSES, OWNER_GROUPS } from "@/config/owner-groups";
import { SubNav } from "@/components/sub-nav";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Field, Select } from "@/components/ui/field";
import { IconInbox } from "@/components/ui/icons";
import { EmptyState, Page, PageHeader } from "@/components/ui/page";
import { InsetList, InsetRow } from "@/components/ui/surface";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { FORWARD } from "@/lib/page-motion";
import { formatDate, t } from "@/lib/texts.sk";
import { listManageableTeams } from "@/server/catalog";
import { ACTIVE_FILTER, ALL_FILTER, getIssuePrefill, listIssues } from "@/server/hr-issues";

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const linkClass = "rounded font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900";

// Screen "Podnety" for HR (IT-10): list with filters and the form for a new issue.
export const metadata: Metadata = { title: t.issues.pageTitle };

export default async function HrIssuesPage({ searchParams }: PageProps<"/hr/issues">) {
  const user = await requirePageUser("HR");
  const query = await searchParams;
  // A hand-typed filter that does not exist falls back to the default view.
  const requestedGroup = first(query.group) ?? "";
  const group = (OWNER_GROUPS as readonly string[]).includes(requestedGroup) ? requestedGroup : "";
  // IT-13: show what is still to be done; finished issues are one click away.
  const requestedStatus = first(query.status) ?? ACTIVE_FILTER;
  const status =
    requestedStatus === ALL_FILTER || (ISSUE_STATUSES as readonly string[]).includes(requestedStatus)
      ? requestedStatus
      : ACTIVE_FILTER;

  const [issues, teams, prefill] = await pageData(() =>
    Promise.all([
      listIssues(user, { ownerGroup: group, status }),
      listManageableTeams(user),
      getIssuePrefill(user, { roundId: first(query.round), noteId: first(query.note) }),
    ]),
  );

  return (
    <Page>
      <SubNav
        label={t.nav.hrIssues}
        current="/hr/issues"
        items={[
          { href: "/hr/issues", label: t.nav.hrIssues },
          { href: "/hr/notes", label: t.nav.hrNotes },
        ]}
      />
      <PageHeader title={t.issues.pageTitle} description={t.issues.intro} />

      {/* Plain GET form: the filter works without JavaScript and is shareable as a link. */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <Field label={t.issues.ownerGroup} className="w-full sm:w-56">
          <Select name="group" defaultValue={group}>
            <option value="">{t.issues.filterAll}</option>
            {OWNER_GROUPS.map((item) => (
              <option key={item} value={item}>
                {t.ownerGroups[item]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.issues.status} className="w-full sm:w-56">
          <Select name="status" defaultValue={status}>
            <option value={ACTIVE_FILTER}>{t.issues.filterActive}</option>
            <option value={ALL_FILTER}>{t.issues.filterAll}</option>
            {ISSUE_STATUSES.map((item) => (
              <option key={item} value={item}>
                {t.issueStatuses[item]}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary" className="h-11 w-full sm:w-auto">
          {t.issues.filter}
        </Button>
      </form>

      <div className="mt-6">
        {issues.length === 0 ? (
          <EmptyState icon={<IconInbox size={20} />} title={t.issues.empty} />
        ) : (
          <InsetList>
            {issues.map((issue) => (
              <InsetRow key={issue.id} className="py-5">
                <h2 className="text-[0.9375rem] leading-snug font-semibold break-words text-ink">
                  {issue.title}
                </h2>
                {issue.description && (
                  <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-line text-ink-soft">
                    {issue.description}
                  </p>
                )}
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                  <span>
                    {t.issues.source}: {t.issueSources[issue.source]}
                  </span>
                  {issue.team && (
                    <span>
                      {t.issues.team}:{" "}
                      <Link
                        href={`/team/${issue.team.id}`}
                        transitionTypes={FORWARD}
                        className={linkClass}
                      >
                        {issue.team.name}
                      </Link>
                    </span>
                  )}
                  {issue.round && (
                    <span>
                      {t.issues.round}:{" "}
                      <Link
                        href={`/rounds/${issue.round.id}/results`}
                        transitionTypes={FORWARD}
                        className={linkClass}
                      >
                        {issue.round.name}
                      </Link>
                    </span>
                  )}
                  {issue.note && (
                    <span>
                      {t.issues.note}: {issue.note.title}
                    </span>
                  )}
                  {issue.dueDate && <span>{t.actions.due(formatDate(issue.dueDate))}</span>}
                  <span>{t.issues.created(formatDate(issue.createdAt))}</span>
                </p>
                <div className="mt-3">
                  <IssueControls
                    issueId={issue.id}
                    status={issue.status}
                    ownerGroup={issue.ownerGroup}
                  />
                </div>
              </InsetRow>
            ))}
          </InsetList>
        )}
      </div>

      {/* Open straight away when HR came here to raise an issue from a round or a note. */}
      <Disclosure
        className="mt-10"
        summary={t.issues.submit}
        open={Boolean(prefill.round || prefill.note) || undefined}
      >
        <div className="px-4 py-5 sm:px-5">
          <h2 className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">
            {t.issues.newTitle}
          </h2>
          <IssueForm teams={teams} prefill={prefill} />
        </div>
      </Disclosure>
    </Page>
  );
}
