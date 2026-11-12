"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { errorForStatus, t } from "@/lib/texts.sk";

// Mirror src/config/owner-groups.ts; the server validates again.
const OWNER_GROUPS = ["FACILITY", "IT_SUPPORT", "HR", "MANAGEMENT", "TEAM_MANAGER", "OTHER"] as const;
const SOURCES = ["SURVEY", "MEETING", "OTHER"] as const;

type Team = { id: string; name: string };
type Prefill = {
  round: { id: string; name: string; teamName: string } | null;
  note: { id: string; title: string } | null;
};

// Form "Nový podnet" for HR (IT-10).
export function IssueForm({ teams, prefill }: { teams: Team[]; prefill: Prefill }) {
  const router = useRouter();
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
      } else {
        setError(response.status === 400 ? t.issues.invalid : errorForStatus(response.status));
      }
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  const inputClass =
    "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";

  return (
    <form
      id="new"
      onSubmit={onSubmit}
      noValidate
      className="mt-3 space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      {prefill.round && (
        <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-950">
          {t.issues.fromRound(prefill.round.name, prefill.round.teamName)}
        </p>
      )}
      {prefill.note && (
        <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-950">
          {t.issues.fromNote(prefill.note.title)}
        </p>
      )}
      {/* NFR-01: a comment retyped here could give its author away. */}
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
        {t.issues.confidentialityWarning}
      </p>

      <label className="block text-sm font-medium">
        {t.issues.title}
        <input
          name="title"
          type="text"
          maxLength={120}
          placeholder={t.issues.titlePlaceholder}
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-medium">
        {t.issues.description}
        <textarea name="description" rows={3} maxLength={2000} className={inputClass} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t.issues.ownerGroup}
          <select name="ownerGroup" defaultValue="FACILITY" className={inputClass}>
            {OWNER_GROUPS.map((group) => (
              <option key={group} value={group}>
                {t.ownerGroups[group]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          {t.issues.source}
          <select name="source" defaultValue={defaultSource} className={inputClass}>
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {t.issueSources[source]}
              </option>
            ))}
          </select>
        </label>
        {!prefill.round && (
          <label className="block text-sm font-medium">
            {t.issues.team}
            <select name="teamId" defaultValue="" className={inputClass}>
              <option value="">{t.issues.teamNone}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm font-medium">
          {t.issues.dueDate}
          <input name="dueDate" type="date" className={inputClass} />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {t.issues.saved}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-teal-700 px-4 py-3 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 sm:w-auto"
      >
        {pending ? t.issues.submitting : t.issues.submit}
      </button>
    </form>
  );
}
