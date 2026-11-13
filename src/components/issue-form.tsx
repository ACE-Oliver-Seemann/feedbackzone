"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { IconPlus } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { errorForStatus, t } from "@/lib/texts.sk";

// Mirror src/config/owner-groups.ts; the server validates again.
const OWNER_GROUPS = ["FACILITY", "IT_SUPPORT", "HR", "MANAGEMENT", "TEAM_MANAGER", "OTHER"] as const;
const SOURCES = ["SURVEY", "MEETING", "OTHER"] as const;

type Team = { id: string; name: string };
type Prefill = {
  round: { id: string; name: string; teamName: string } | null;
  note: { id: string; title: string } | null;
};

// Form "Nový podnet" for HR (IT-10). The surface around it is the caller's.
export function IssueForm({ teams, prefill }: { teams: Team[]; prefill: Prefill }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const defaultSource = prefill.round ? "SURVEY" : prefill.note ? "MEETING" : "OTHER";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/hr/issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description"),
          source: form.get("source"),
          ownerGroup: form.get("ownerGroup"),
          dueDate: form.get("dueDate"),
          teamId: form.get("teamId"),
          roundId: prefill.round?.id ?? null,
          noteId: prefill.note?.id ?? null,
        }),
      });
      if (response.status === 201) {
        formElement.reset();
        setSaved(true);
        router.refresh();
        toast.success(t.toasts.issueAdded);
      } else {
        setError(response.status === 400 ? t.issues.invalid : errorForStatus(response.status));
      }
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  return (
    <form
      id="new"
      onSubmit={onSubmit}
      noValidate
      className="mt-4 scroll-mt-36 space-y-5 lg:scroll-mt-24"
    >
      {prefill.round && (
        <Notice tone="info">{t.issues.fromRound(prefill.round.name, prefill.round.teamName)}</Notice>
      )}
      {prefill.note && <Notice tone="info">{t.issues.fromNote(prefill.note.title)}</Notice>}
      {/* NFR-01: a comment retyped here could give its author away. */}
      <Notice tone="warning">{t.issues.confidentialityWarning}</Notice>

      <Field label={t.issues.title}>
        <Input name="title" type="text" maxLength={120} placeholder={t.issues.titlePlaceholder} />
      </Field>
      <Field label={t.issues.description}>
        <Textarea name="description" rows={3} maxLength={2000} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t.issues.ownerGroup}>
          <Select name="ownerGroup" defaultValue="FACILITY">
            {OWNER_GROUPS.map((group) => (
              <option key={group} value={group}>
                {t.ownerGroups[group]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.issues.source}>
          <Select name="source" defaultValue={defaultSource}>
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {t.issueSources[source]}
              </option>
            ))}
          </Select>
        </Field>
        {!prefill.round && (
          <Field label={t.issues.team}>
            <Select name="teamId" defaultValue="">
              <option value="">{t.issues.teamNone}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t.issues.dueDate}>
          <Input name="dueDate" type="date" />
        </Field>
      </div>

      {error && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
      {saved && (
        <Notice tone="success" role="status">
          {t.issues.saved}
        </Notice>
      )}
      <div className="flex justify-end border-t border-line pt-5">
        <Button type="submit" disabled={pending} pending={pending} className="w-full sm:w-auto">
          {!pending && <IconPlus size={16} className="-ml-0.5" />}
          {pending ? t.issues.submitting : t.issues.submit}
        </Button>
      </div>
    </form>
  );
}
