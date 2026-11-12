"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { t } from "@/lib/texts.sk";

// Mirrors MIN_QUESTIONS / MAX_QUESTIONS in src/server/rounds.ts. The server
// validates again; this only keeps the form from sending an obvious mistake.
const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 5;

type Question = { id: string; text: string; topic: string };
type Team = { id: string; name: string };
type FieldName = keyof typeof t.newRound.fieldErrors;

function todayLocal(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function NewRoundForm({
  questions,
  teams,
  redirectTo,
}: {
  questions: Question[];
  teams: Team[];
  redirectTo: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, true>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const topics = useMemo(() => {
    const groups = new Map<string, Question[]>();
    for (const question of questions) {
      groups.set(question.topic, [...(groups.get(question.topic) ?? []), question]);
    }
    return [...groups.entries()];
  }, [questions]);

  const countValid = selected.length >= MIN_QUESTIONS && selected.length <= MAX_QUESTIONS;

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!countValid) {
      setFieldErrors({ questionIds: true });
      return;
    }
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const response = await fetch("/api/rounds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          teamId: form.get("teamId"),
          closesAt: form.get("closesAt"),
          questionIds: selected,
        }),
      });
      if (response.status === 201) {
        router.push(redirectTo);
        router.refresh();
        return;
      }
      if (response.status === 400) {
        const { fields } = await response.json();
        setFieldErrors(
          Object.fromEntries(Object.keys(fields ?? {}).map((field) => [field, true])),
        );
      } else {
        setError(t.errors.generic);
      }
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  const inputClass =
    "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";
  const fieldError = (field: FieldName) =>
    fieldErrors[field] && (
      <span role="alert" className="mt-1 block text-sm font-normal text-red-700">
        {t.newRound.fieldErrors[field]}
      </span>
    );

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
      <label className="block text-sm font-medium">
        {t.newRound.name}
        <input
          name="name"
          type="text"
          maxLength={120}
          placeholder={t.newRound.namePlaceholder}
          className={inputClass}
        />
        {fieldError("name")}
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t.newRound.team}
          <select name="teamId" className={inputClass} defaultValue={teams[0]?.id}>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          {fieldError("teamId")}
        </label>
        <label className="block text-sm font-medium">
          {t.newRound.closesAt}
          <input name="closesAt" type="date" min={todayLocal()} className={inputClass} />
          {fieldError("closesAt")}
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">{t.newRound.questions}</legend>
        <p className="mt-1 text-sm text-slate-600">{t.newRound.questionsHint}</p>
        <div className="mt-3 space-y-4">
          {topics.map(([topic, items]) => (
            <div key={topic}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {topic}
              </p>
              <ul className="mt-1 space-y-1">
                {items.map((question) => {
                  const position = selected.indexOf(question.id);
                  const checked = position !== -1;
                  const disabled = !checked && selected.length >= MAX_QUESTIONS;
                  return (
                    <li key={question.id}>
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm ${
                          checked ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white"
                        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 accent-teal-700"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggle(question.id)}
                        />
                        <span className="flex-1">{question.text}</span>
                        {checked && (
                          <span className="rounded-full bg-teal-700 px-2 text-xs font-medium leading-5 text-white">
                            {position + 1}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <p
          className={`mt-3 text-sm ${countValid ? "text-teal-800" : "text-slate-600"}`}
          aria-live="polite"
        >
          {t.newRound.selected(selected.length)}
        </p>
        {fieldError("questionIds")}
      </fieldset>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 sm:w-auto"
      >
        {pending ? t.newRound.submitting : t.newRound.submit}
      </button>
    </form>
  );
}
