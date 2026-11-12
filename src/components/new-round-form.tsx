"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { t } from "@/lib/texts.sk";

// Mirrors MIN_QUESTIONS / MAX_QUESTIONS in src/server/rounds.ts and the custom
// question limits in src/server/catalog.ts. The server validates again; this
// only keeps the form from sending an obvious mistake.
const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 5;
const CUSTOM_MAX_LENGTH = 200;

type Question = {
  id: string;
  text: string;
  topic: string;
  starter: boolean;
  fixed: boolean;
  /** Null for the shared library, otherwise the team that owns the question (IT-07). */
  teamId: string | null;
};
type Team = { id: string; name: string };
type FieldName = keyof typeof t.newRound.fieldErrors;
type CustomError = keyof typeof t.newRound.custom.errors;

function todayLocal(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function NewRoundForm({
  questions,
  teams,
  redirectTo,
  canAddQuestion,
  defaults,
  defaultName,
  defaultClosesAt,
}: {
  questions: Question[];
  teams: Team[];
  redirectTo: string;
  /** Only a manager writes own questions, and only for their own team (IT-07). */
  canAddQuestion: boolean;
  /** Preselected question ids per team (IT-13). */
  defaults: Record<string, string[]>;
  defaultName: string;
  defaultClosesAt: string;
}) {
  const router = useRouter();
  const [allQuestions, setAllQuestions] = useState(questions);
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>(() => defaults[teams[0]?.id ?? ""] ?? []);
  // Topics that hold a preselected question start expanded; the rest are collapsed.
  const [openTopics] = useState(
    () =>
      new Set(
        questions
          .filter((question) => (defaults[teams[0]?.id ?? ""] ?? []).includes(question.id))
          .map((question) => question.topic),
      ),
  );
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, true>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [customText, setCustomText] = useState("");
  const [customError, setCustomError] = useState<CustomError | null>(null);
  const [customPending, setCustomPending] = useState(false);

  // Shared questions plus the own questions of the chosen team.
  const visible = useMemo(
    () => allQuestions.filter((question) => question.teamId === null || question.teamId === teamId),
    [allQuestions, teamId],
  );
  // IT-04: fixed questions are part of every round and cannot be unticked.
  const fixedQuestions = useMemo(() => visible.filter((question) => question.fixed), [visible]);
  const topics = useMemo(() => {
    const groups = new Map<string, Question[]>();
    for (const question of visible.filter((item) => !item.fixed)) {
      groups.set(question.topic, [...(groups.get(question.topic) ?? []), question]);
    }
    return [...groups.entries()];
  }, [visible]);

  const total = fixedQuestions.length + selected.length;
  const countValid = total >= MIN_QUESTIONS && total <= MAX_QUESTIONS;

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function changeTeam(nextTeamId: string) {
    setTeamId(nextTeamId);
    // Each team gets its own preselection; own questions of another team never stay ticked.
    setSelected(defaults[nextTeamId] ?? []);
  }

  async function addCustomQuestion() {
    setCustomPending(true);
    setCustomError(null);
    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: customText }),
      });
      if (response.status === 201) {
        const { question } = (await response.json()) as { question: Question };
        setAllQuestions((current) => [...current, question]);
        // Tick it straight away if the round still has room.
        setSelected((current) =>
          fixedQuestions.length + current.length < MAX_QUESTIONS
            ? [...current, question.id]
            : current,
        );
        setCustomText("");
      } else if (response.status === 400) {
        const { fields } = await response.json();
        const code = fields?.text as string | undefined;
        setCustomError(code === "duplicate" ? "duplicate" : "length");
      } else {
        setCustomError("generic");
      }
    } catch {
      setCustomError("generic");
    }
    setCustomPending(false);
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
          teamId,
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
          defaultValue={defaultName}
          placeholder={t.newRound.namePlaceholder}
          className={inputClass}
        />
        {fieldError("name")}
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t.newRound.team}
          <select
            name="teamId"
            className={inputClass}
            value={teamId}
            onChange={(event) => changeTeam(event.target.value)}
          >
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
          <input
            name="closesAt"
            type="date"
            min={todayLocal()}
            defaultValue={defaultClosesAt}
            className={inputClass}
          />
          {fieldError("closesAt")}
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">{t.newRound.questions}</legend>
        <p className="mt-1 text-sm text-slate-600">{t.newRound.questionsHint}</p>
        {selected.length > 0 && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {t.newRound.preselected}
          </p>
        )}
        {fixedQuestions.length > 0 && (
          <div className="mt-3 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm">
            <p className="font-semibold text-teal-900">{t.newRound.fixedTitle}</p>
            {fixedQuestions.map((question) => (
              <p key={question.id} className="mt-1">
                {question.text}
              </p>
            ))}
            <p className="mt-1 text-xs text-slate-600">{t.newRound.fixedHint}</p>
          </div>
        )}
        <div className="mt-3 space-y-4">
          {topics.map(([topic, items]) => (
            <details
              key={topic}
              open={openTopics.has(topic) || undefined}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                {topic}{" "}
                <span className="font-normal text-slate-600">
                  {t.newRound.topicCount(
                    items.filter((question) => selected.includes(question.id)).length,
                    items.length,
                  )}
                </span>
              </summary>
              <ul className="mt-2 space-y-1">
                {items.map((question) => {
                  const position = selected.indexOf(question.id);
                  const checked = position !== -1;
                  const disabled = !checked && total >= MAX_QUESTIONS;
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
                        <span className="flex-1">
                          {question.text}
                          {question.starter && (
                            <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 text-xs font-medium leading-5 text-amber-900">
                              {t.newRound.starter}
                            </span>
                          )}
                        </span>
                        {checked && (
                          <span className="rounded-full bg-teal-700 px-2 text-xs font-medium leading-5 text-white">
                            {fixedQuestions.length + position + 1}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </div>

        {canAddQuestion && (
          <div className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-3">
            <label className="block text-sm font-medium">
              {t.newRound.custom.title}
              <input
                type="text"
                value={customText}
                maxLength={CUSTOM_MAX_LENGTH}
                placeholder={t.newRound.custom.placeholder}
                onChange={(event) => setCustomText(event.target.value)}
                onKeyDown={(event) => {
                  // Enter must not submit the whole round.
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (customText.trim() && !customPending) void addCustomQuestion();
                  }
                }}
                className={inputClass}
              />
            </label>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-slate-600">
              {t.newRound.custom.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-600">{t.newRound.custom.permanent}</p>
            {customError && (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {t.newRound.custom.errors[customError]}
              </p>
            )}
            <button
              type="button"
              onClick={addCustomQuestion}
              disabled={customPending || !customText.trim()}
              className="mt-3 rounded-md border border-teal-700 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50"
            >
              {customPending ? t.newRound.custom.adding : t.newRound.custom.add}
            </button>
          </div>
        )}

        <p
          className={`mt-3 text-sm ${countValid ? "text-teal-800" : "text-slate-600"}`}
          aria-live="polite"
        >
          {t.newRound.selected(total)}
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
