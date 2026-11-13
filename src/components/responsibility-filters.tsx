import Link from "next/link";
import type {
  ResponsibilityFilter,
  ResponsibilityKind,
  ResponsibilityOptions,
  ResponsibilityPriority,
  ResponsibilityStatus,
} from "@/server/responsibilities";
import { Button, ButtonLink } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Field, Select } from "@/components/ui/field";
import { Panel } from "@/components/ui/surface";
import { t } from "@/lib/texts.sk";
import { KINDS, PersonOptions, PRIORITIES, STATUSES } from "./responsibility-meta";

const r = t.responsibilities;
const SORTS = ["deadline", "priority", "created"] as const;
type Sort = (typeof SORTS)[number];

type Query = Record<string, string | string[] | undefined>;

/** Filter state as it lives in the address (IT-14). Unknown values fall back to the default. */
export type FilterState = {
  status: ResponsibilityStatus | "ACTIVE" | "ALL";
  priority: ResponsibilityPriority | "";
  kind: ResponsibilityKind | "";
  teamId: string;
  assigneeId: string;
  relatedUserId: string;
  overdue: boolean;
  sort: Sort;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const oneOf = <T extends string>(list: readonly T[], value: string): T | "" =>
  (list as readonly string[]).includes(value) ? (value as T) : "";

export function parseFilter(query: Query, allowPeople: boolean): FilterState {
  const status = first(query.status);
  return {
    status: status === "ALL" ? "ALL" : oneOf(STATUSES, status) || "ACTIVE",
    priority: oneOf(PRIORITIES, first(query.priority)),
    kind: oneOf(KINDS, first(query.kind)),
    // Team and people filters are offered to HR only; the server checks visibility anyway.
    teamId: allowPeople ? first(query.teamId) : "",
    assigneeId: allowPeople ? first(query.assigneeId) : "",
    relatedUserId: allowPeople ? first(query.relatedUserId) : "",
    overdue: first(query.overdue) === "1",
    sort: oneOf(SORTS, first(query.sort)) || "deadline",
  };
}

export function toServerFilter(state: FilterState): ResponsibilityFilter {
  return {
    status: state.status,
    priority: state.priority || null,
    kind: state.kind || null,
    teamId: state.teamId || null,
    assigneeId: state.assigneeId || null,
    relatedUserId: state.relatedUserId || null,
    overdue: state.overdue || null,
    sort: state.sort,
  };
}

/** Address of the list with the given state; default values are left out. */
function hrefFor(state: FilterState): string {
  const params = new URLSearchParams();
  if (state.status !== "ACTIVE") params.set("status", state.status);
  if (state.priority) params.set("priority", state.priority);
  if (state.kind) params.set("kind", state.kind);
  if (state.teamId) params.set("teamId", state.teamId);
  if (state.assigneeId) params.set("assigneeId", state.assigneeId);
  if (state.relatedUserId) params.set("relatedUserId", state.relatedUserId);
  if (state.overdue) params.set("overdue", "1");
  if (state.sort !== "deadline") params.set("sort", state.sort);
  const search = params.toString();
  return search ? `/responsibilities?${search}` : "/responsibilities";
}

export function isFiltered(state: FilterState): boolean {
  return hrefFor(state) !== "/responsibilities";
}

/** Segmented control HR / team / personal. Links, so it works without JavaScript. */
export function KindTabs({ state }: { state: FilterState }) {
  const items: { kind: ResponsibilityKind | ""; label: string }[] = [
    { kind: "", label: r.kindFilter.ALL },
    ...KINDS.map((kind) => ({ kind, label: r.kindFilter[kind] })),
  ];
  return (
    <nav aria-label={r.kindFilterLabel} className="mb-4">
      <ul className="inline-flex max-w-full flex-wrap gap-1 rounded-full bg-slate-200/60 p-1">
        {items.map((item) => {
          const active = item.kind === state.kind;
          return (
            <li key={item.kind || "all"}>
              <Link
                href={hrefFor({ ...state, kind: item.kind })}
                aria-current={active ? "true" : undefined}
                scroll={false}
                className={cx(
                  "inline-flex h-8 items-center rounded-full px-3.5 text-sm font-medium whitespace-nowrap pointer-coarse:h-11",
                  "transition-colors duration-150",
                  active ? "bg-surface text-ink shadow-[var(--shadow-panel)]" : "text-ink-soft hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Plain GET form: the filter works without JavaScript, survives refresh and
 * back, and can be shared as a link. `options` is passed for HR only.
 */
export function ResponsibilityFilters({
  state,
  options,
}: {
  state: FilterState;
  options: ResponsibilityOptions | null;
}) {
  return (
    <Panel className="p-4 sm:p-5">
      <form method="get" action="/responsibilities" aria-label={r.filtersTitle}>
        {state.kind && <input type="hidden" name="kind" value={state.kind} />}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={r.filterStatus}>
            <Select name="status" defaultValue={state.status}>
              <option value="ACTIVE">{r.filterActive}</option>
              <option value="ALL">{r.filterAll}</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {r.statuses[status]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={r.filterPriority}>
            <Select name="priority" defaultValue={state.priority}>
              <option value="">{r.filterAnyPriority}</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {r.priorities[priority]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={r.sort}>
            <Select name="sort" defaultValue={state.sort}>
              {SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {r.sorts[sort]}
                </option>
              ))}
            </Select>
          </Field>
          {options && (
            <>
              <Field label={r.filterTeam}>
                <Select name="teamId" defaultValue={state.teamId}>
                  <option value="">{r.filterAnyTeam}</option>
                  {options.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={r.filterAssignee}>
                <Select name="assigneeId" defaultValue={state.assigneeId}>
                  <option value="">{r.filterAnyone}</option>
                  <PersonOptions people={options.assignees} />
                </Select>
              </Field>
              <Field label={r.filterRelated}>
                <Select name="relatedUserId" defaultValue={state.relatedUserId}>
                  <option value="">{r.filterAnyone}</option>
                  <PersonOptions people={options.relatedEmployees} />
                </Select>
              </Field>
            </>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium text-ink">
            <input
              type="checkbox"
              name="overdue"
              value="1"
              defaultChecked={state.overdue}
              className="size-4.5 rounded accent-brand-600"
            />
            {r.filterOverdue}
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {isFiltered(state) && (
              <ButtonLink href="/responsibilities" variant="ghost" scroll={false} className="w-full sm:w-auto">
                {r.reset}
              </ButtonLink>
            )}
            <Button type="submit" variant="secondary" className="w-full sm:w-auto">
              {r.apply}
            </Button>
          </div>
        </div>
      </form>
    </Panel>
  );
}
