"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import type { ResponsibilityDetail, ResponsibilityOptions } from "@/server/responsibilities";
import { Button, ButtonLink } from "@/components/ui/button";
import { useFocusFirstError } from "@/components/ui/focus-error";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { IconCheck, IconPlus } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { BACK, FORWARD } from "@/lib/page-motion";
import { t } from "@/lib/texts.sk";
import {
  failureMessage,
  OWNER_GROUPS,
  PersonOptions,
  PRIORITIES,
  SessionExpiredNotice,
  SOURCES,
  toDateInput,
} from "./responsibility-meta";

const r = t.responsibilities;
type FieldName = keyof typeof r.fieldErrors;

export type ResponsibilityPrefill = {
  round: { id: string; name: string; teamName: string } | null;
  note: { id: string; title: string } | null;
};

type Props = {
  options: ResponsibilityOptions;
  isHr: boolean;
  currentUserId: string;
} & (
  | { mode: "create"; prefill?: ResponsibilityPrefill }
  | { mode: "edit"; item: ResponsibilityDetail }
);

/**
 * Create or edit a responsibility (IT-14). In edit mode only the fields the
 * viewer may change are enabled and sent (permissions come from the server,
 * which checks them again).
 */
export function ResponsibilityForm(props: Props) {
  const { options, isHr, currentUserId } = props;
  const router = useRouter();
  const toast = useToast();
  const item = props.mode === "edit" ? props.item : null;
  const prefill = props.mode === "create" ? (props.prefill ?? null) : null;
  const canEdit = item ? item.permissions.canEdit : true;
  const canReassign = item ? item.permissions.canReassign : true;

  const prefillTeamId = prefill?.round
    ? (options.teams.find((team) => team.name === prefill.round!.teamName)?.id ?? "")
    : "";
  const defaultAssignee = item
    ? (item.assignee?.id ?? "")
    : isHr
      ? ""
      : (options.assignees.find((person) => person.id === currentUserId)?.id ?? "");
  const [assigneeId, setAssigneeId] = useState(defaultAssignee);
  const [teamId, setTeamId] = useState(item ? (item.team?.id ?? "") : prefillTeamId);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, true>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(formRef, fieldErrors, error, sessionExpired);

  // The current people stay selectable even if they are no longer among the options.
  const assignees = [...options.assignees];
  if (item?.assignee && !assignees.some((person) => person.id === item.assignee!.id)) {
    assignees.unshift({ ...item.assignee, teamId: null, teamName: null });
  }
  const relatedEmployees = [...options.relatedEmployees];
  if (item?.relatedEmployee && !relatedEmployees.some((person) => person.id === item.relatedEmployee!.id)) {
    relatedEmployees.unshift({ ...item.relatedEmployee, teamId: null, teamName: null });
  }
  const teams = [...options.teams];
  if (item?.team && !teams.some((team) => team.id === item.team!.id)) teams.unshift(item.team);

  function onAssigneeChange(id: string) {
    setAssigneeId(id);
    // HR: the team follows the responsible person unless HR already chose one.
    const person = assignees.find((candidate) => candidate.id === id);
    if (isHr && !teamId && person?.teamId) setTeamId(person.teamId);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const value = (name: string) => {
      const entry = form.get(name);
      return typeof entry === "string" ? entry : "";
    };

    const body: Record<string, unknown> = {};
    if (canEdit) {
      body.title = value("title");
      body.description = value("description");
      body.priority = value("priority");
      body.dueDate = value("dueDate") || null;
    }
    if (canReassign) {
      body.assigneeId = value("assigneeId") || null;
      body.relatedUserId = value("relatedUserId") || null;
      if (isHr) {
        body.teamId = prefill?.round && !item ? prefillTeamId || null : value("teamId") || null;
        body.ownerGroup = value("ownerGroup");
      }
    }
    if (!item && isHr) {
      body.source = value("source");
      body.roundId = prefill?.round?.id ?? null;
      body.noteId = prefill?.note?.id ?? null;
    }

    setPending(true);
    setError(null);
    setSessionExpired(false);
    setFieldErrors({});
    try {
      const response = await fetch(item ? `/api/responsibilities/${item.id}` : "/api/responsibilities", {
        method: item ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        if (item) {
          toast.success(t.toasts.responsibilitySaved);
          router.refresh();
        } else {
          // POST /api/responsibilities answers 201 { responsibility: ResponsibilityDetail }.
          const data = (await response.json().catch(() => null)) as {
            responsibility?: { id?: string };
          } | null;
          const createdId = data?.responsibility?.id;
          toast.success(t.toasts.responsibilityCreated);
          router.push(createdId ? `/responsibilities/${createdId}` : "/responsibilities", {
            transitionTypes: FORWARD,
          });
          return; // keep the button pending while the detail loads
        }
      } else if (response.status === 400) {
        const data = (await response.json().catch(() => ({}))) as { fields?: Record<string, unknown> };
        const invalid = Object.keys(data.fields ?? {}).filter(
          (field): field is FieldName => field in r.fieldErrors,
        );
        setFieldErrors(Object.fromEntries(invalid.map((field) => [field, true])));
        setError(r.invalid);
      } else if (response.status === 401) {
        setSessionExpired(true);
      } else {
        setError(failureMessage(response.status));
      }
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  const errorText = (field: FieldName) => (fieldErrors[field] ? r.fieldErrors[field] : undefined);
  const defaultSource = prefill?.round ? "SURVEY" : prefill?.note ? "MEETING" : "OTHER";

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-5">
      {prefill?.round && <Notice tone="info">{r.fromRound(prefill.round.name, prefill.round.teamName)}</Notice>}
      {prefill?.note && <Notice tone="info">{r.fromNote(prefill.note.title)}</Notice>}
      {/* NFR-01: a comment retyped here could give its author away. */}
      {isHr && <Notice tone="warning">{r.confidentialityWarning}</Notice>}

      <Field label={r.title} error={errorText("title")}>
        <Input
          name="title"
          type="text"
          required
          maxLength={120}
          defaultValue={item?.title}
          disabled={!canEdit}
          placeholder={r.titlePlaceholder}
        />
      </Field>
      <Field label={r.description} error={errorText("description")}>
        <Textarea
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={item?.description}
          disabled={!canEdit}
          placeholder={r.descriptionPlaceholder}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={r.assignee} error={errorText("assigneeId")}>
          <Select
            name="assigneeId"
            required
            value={assigneeId}
            onChange={(event) => onAssigneeChange(event.target.value)}
            disabled={!canReassign}
          >
            <option value="">{r.assigneeChoose}</option>
            <PersonOptions
              people={assignees.map((person) =>
                person.id === currentUserId ? { ...person, name: r.assigneeSelf(person.name) } : person,
              )}
            />
          </Select>
        </Field>
        <Field label={r.relatedEmployee} error={errorText("relatedUserId")}>
          <Select
            name="relatedUserId"
            defaultValue={item?.relatedEmployee?.id ?? ""}
            disabled={!canReassign}
          >
            <option value="">{r.relatedNone}</option>
            <PersonOptions people={relatedEmployees} />
          </Select>
        </Field>

        {isHr && !(prefill?.round && !item) && (
          <Field label={r.team} hint={canReassign ? r.teamHint : undefined} error={errorText("teamId")}>
            <Select
              name="teamId"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              disabled={!canReassign}
            >
              <option value="">{r.teamNone}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {isHr && (
          <Field label={r.ownerGroup} hint={r.ownerGroupHint} error={errorText("ownerGroup")}>
            <Select
              name="ownerGroup"
              defaultValue={item?.ownerGroup ?? "TEAM_MANAGER"}
              disabled={!canReassign}
            >
              {OWNER_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {t.ownerGroups[group]}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label={r.priority} error={errorText("priority")}>
          <Select name="priority" defaultValue={item?.priority ?? "MEDIUM"} disabled={!canEdit}>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {r.priorities[priority]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={r.dueDate} error={errorText("dueDate")}>
          <Input name="dueDate" type="date" defaultValue={toDateInput(item?.dueDate ?? null)} disabled={!canEdit} />
        </Field>

        {isHr && !item && (
          <Field label={r.sourceLabel} error={errorText("source")}>
            <Select name="source" defaultValue={defaultSource}>
              {SOURCES.map((source) => (
                <option key={source} value={source}>
                  {t.issueSources[source]}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {error && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
      {sessionExpired && <SessionExpiredNotice />}

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        {!item && (
          <ButtonLink href="/responsibilities" transitionTypes={BACK} variant="secondary">
            {r.cancel}
          </ButtonLink>
        )}
        <Button type="submit" disabled={pending} pending={pending}>
          {!pending && (item ? <IconCheck size={16} className="-ml-0.5" /> : <IconPlus size={16} className="-ml-0.5" />)}
          {pending ? r.submitting : item ? r.submitEdit : r.submitCreate}
        </Button>
      </div>
    </form>
  );
}
