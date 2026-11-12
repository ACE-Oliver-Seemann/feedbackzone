import Link from "next/link";
import { IssueControls } from "@/components/issue-controls";
import { IssueForm } from "@/components/issue-form";
import { ISSUE_STATUSES, OWNER_GROUPS } from "@/config/owner-groups";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { formatDate, t } from "@/lib/texts.sk";
import { listManageableTeams } from "@/server/catalog";
import { getIssuePrefill, listIssues } from "@/server/hr-issues";

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

// Screen "Podnety" for HR (IT-10): list with filters and the form for a new issue.
export default async function HrIssuesPage({ searchParams }: PageProps<"/hr/issues">) {
  const user = await requirePageUser("HR");
  const query = await searchParams;
  const group = first(query.group) ?? "";
  const status = first(query.status) ?? "";

  const [issues, teams, prefill] = await pageData(() =>
    Promise.all([
      listIssues(user, { ownerGroup: group, status }),
      listManageableTeams(user),
      getIssuePrefill(user, { roundId: first(query.round), noteId: first(query.note) }),
    ]),
  );

  const selectClass = "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm";

  return (
    <section className="max-w-3xl">
      <h1 className="text-xl font-semibold">{t.issues.pageTitle}</h1>
      <p className="mt-1 text-sm text-slate-600">{t.issues.intro}</p>

      {/* Plain GET form: the filter works without JavaScript and is shareable as a link. */}
      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">
          {t.issues.ownerGroup}
          <select name="group" defaultValue={group} className={`${selectClass} mt-1 block`}>
            <option value="">{t.issues.filterAll}</option>
            {OWNER_GROUPS.map((item) => (
              <option key={item} value={item}>
                {t.ownerGroups[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          {t.issues.status}
          <select name="status" defaultValue={status} className={`${selectClass} mt-1 block`}>
            <option value="">{t.issues.filterAll}</option>
            {ISSUE_STATUSES.map((item) => (
              <option key={item} value={item}>
                {t.issueStatuses[item]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md border border-teal-700 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50"
        >
          {t.issues.filter}
        </button>
      </form>

      {issues.length === 0 ? (
        <p className="mt-4 text-slate-600">{t.issues.empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {issues.map((issue) => (
            <li key={issue.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="font-medium">{issue.title}</h2>
              {issue.description && (
                <p className="mt-1 whitespace-pre-line text-sm text-slate-800">
                  {issue.description}
                </p>
              )}
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600">
                <span>
                  {t.issues.source}: {t.issueSources[issue.source]}
                </span>
                {issue.team && (
                  <span>
                    {t.issues.team}:{" "}
                    <Link href={`/team/${issue.team.id}`} className="underline">
                      {issue.team.name}
                    </Link>
                  </span>
                )}
                {issue.round && (
                  <span>
                    {t.issues.round}:{" "}
                    <Link href={`/rounds/${issue.round.id}/results`} className="underline">
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
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-lg font-semibold">{t.issues.newTitle}</h2>
      <IssueForm teams={teams} prefill={prefill} />
    </section>
  );
}
