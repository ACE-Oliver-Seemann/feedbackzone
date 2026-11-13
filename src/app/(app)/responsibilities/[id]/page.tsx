import type { Metadata } from "next";
import Link from "next/link";
import { ResponsibilityCommentForm } from "@/components/responsibility-comment-form";
import { ResponsibilityForm } from "@/components/responsibility-form";
import {
  KindMarker,
  OverdueBadge,
  PriorityLabel,
  StatusBadge,
} from "@/components/responsibility-meta";
import { ResponsibilityStatusControl } from "@/components/responsibility-status";
import { Badge } from "@/components/ui/badge";
import { cx } from "@/components/ui/cx";
import { Disclosure } from "@/components/ui/disclosure";
import { IconLock, IconMessage } from "@/components/ui/icons";
import { EmptyState, Page, PageHeader } from "@/components/ui/page";
import { Panel, Section } from "@/components/ui/surface";
import { pageData, requirePageUser } from "@/lib/page-auth";
import { FORWARD } from "@/lib/page-motion";
import { formatDate, t } from "@/lib/texts.sk";
import { getResponsibility, getResponsibilityOptions } from "@/server/responsibilities";

const r = t.responsibilities;
const linkClass = "rounded font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900";

// Detail of one responsibility (IT-14). Visibility and every permission are
// decided on the server; this page only hides controls the viewer may not use.
export const metadata: Metadata = { title: r.pageTitle };

export default async function ResponsibilityDetailPage({ params }: PageProps<"/responsibilities/[id]">) {
  const user = await requirePageUser();
  const { id } = await params;
  const item = await pageData(() => getResponsibility(user, id));
  const { permissions } = item;
  const canChangeFields = permissions.canEdit || permissions.canReassign;
  const options = canChangeFields ? await pageData(() => getResponsibilityOptions(user)) : null;
  const isHr = user.role === "HR";

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: r.assignee, value: item.assignee?.name ?? r.assigneeNone },
    { label: r.relatedEmployee, value: item.relatedEmployee?.name ?? r.relatedNone },
    {
      label: r.team,
      value: item.team ? (
        // Link only where the team page is open to the viewer (HR, or their own team).
        isHr || (user.role === "MANAGER" && user.teamId === item.team.id) ? (
          <Link href={`/team/${item.team.id}`} transitionTypes={FORWARD} className={linkClass}>
            {item.team.name}
          </Link>
        ) : (
          item.team.name
        )
      ) : (
        r.teamNone
      ),
    },
    { label: r.ownerGroup, value: t.ownerGroups[item.ownerGroup] },
    {
      label: r.dueDate,
      value: item.dueDate ? (
        <span className={cx(item.overdue && "font-semibold text-red-700")}>{formatDate(item.dueDate)}</span>
      ) : (
        r.dueNone
      ),
    },
    {
      label: r.createdBy,
      value: r.createdByLine(item.createdBy.name, t.roles[item.createdBy.role], formatDate(item.createdAt)),
    },
    ...(item.completedAt ? [{ label: r.completedAt, value: formatDate(item.completedAt) }] : []),
    ...(isHr ? [{ label: r.source, value: t.issueSources[item.source] }] : []),
    ...(item.round
      ? [
          {
            label: r.round,
            value: (
              <Link href={`/rounds/${item.round.id}/results`} transitionTypes={FORWARD} className={linkClass}>
                {item.round.name}
              </Link>
            ),
          },
        ]
      : []),
    ...(item.note ? [{ label: r.note, value: item.note.title }] : []),
  ];

  return (
    <Page>
      <PageHeader
        back={{ href: "/responsibilities", label: r.back }}
        title={<span className="break-words">{item.title}</span>}
        context={<KindMarker kind={item.kind} />}
      />

      <div className="-mt-4 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <StatusBadge status={item.status} />
        <PriorityLabel priority={item.priority} />
        {item.overdue && <OverdueBadge />}
      </div>

      <Panel
        className={cx(
          "relative overflow-hidden p-5 sm:p-6",
          // Overdue: red accent bar + the "Po termíne" label above (not color alone).
          item.overdue && "before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-red-500",
        )}
      >
        <h2 className="sr-only">{r.details}</h2>
        <p
          className={cx(
            "text-[0.9375rem] leading-relaxed break-words whitespace-pre-line",
            item.description ? "text-ink" : "text-muted",
          )}
        >
          {item.description || r.descriptionNone}
        </p>
        <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-line pt-5 text-sm sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-xs font-medium text-muted">{fact.label}</dt>
              <dd className="mt-0.5 break-words text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Section title={r.statusTitle}>
        {permissions.canChangeStatus ? (
          <ResponsibilityStatusControl id={item.id} status={item.status} />
        ) : (
          <p className="text-sm text-muted">{r.statusReadOnly}</p>
        )}
      </Section>

      {options && (
        <Disclosure summary={r.editTitle} className="mt-10">
          <div className="px-4 py-5 sm:px-5">
            <ResponsibilityForm
              mode="edit"
              item={item}
              options={options}
              isHr={isHr}
              currentUserId={user.id}
            />
          </div>
        </Disclosure>
      )}

      <Section title={`${r.commentsTitle} (${item.comments.length})`}>
        {item.comments.length === 0 ? (
          <EmptyState icon={<IconMessage size={20} />} title={r.commentsEmpty} />
        ) : (
          <ol className="space-y-3">
            {item.comments.map((comment) => (
              <li
                key={comment.id}
                className={cx(
                  "rounded-[var(--radius-panel)] px-4 py-3.5 ring-1 sm:px-5",
                  comment.internal ? "bg-amber-50/70 ring-amber-200" : "bg-surface ring-line",
                )}
              >
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span className="font-semibold text-ink">{comment.author.name}</span>
                  <span>{t.roles[comment.author.role]}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
                  {comment.internal && (
                    <Badge tone="warning" dot={false} className="sm:ml-auto">
                      <IconLock size={13} className="-ml-0.5" />
                      {r.internalBadge}
                    </Badge>
                  )}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed break-words whitespace-pre-line text-ink">
                  {comment.text}
                </p>
              </li>
            ))}
          </ol>
        )}
        {permissions.canComment && (
          <Panel className="mt-4 p-4 sm:p-5">
            <ResponsibilityCommentForm id={item.id} canCommentInternal={permissions.canCommentInternal} />
          </Panel>
        )}
      </Section>
    </Page>
  );
}
