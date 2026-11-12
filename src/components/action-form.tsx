"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { errorForStatus, t } from "@/lib/texts.sk";

const STATUSES = ["PLANNED", "IN_PROGRESS", "DONE"] as const;

export type ActionSuggestion = {
  topic: string;
  questionText: string;
  average: number;
  suggestion: string;
};

/**
 * Form "Pridať krok" on the results screen (MVP-13). With `suggestions`
 * (IT-09) each suggestion gets a button that copies it into the form; the
 * manager can still rewrite it before saving.
 */
export function ActionForm({
  roundId,
  suggestions = [],
}: {
  roundId: string;
  suggestions?: ActionSuggestion[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applySuggestion(suggestion: ActionSuggestion) {
    setTopic(suggestion.topic);
    setDescription(suggestion.suggestion);
    setError(null);
    formRef.current?.scrollIntoView({ block: "nearest" });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/rounds/${roundId}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topic,
          description,
          dueDate: form.get("dueDate"),
          status: form.get("status"),
        }),
      });
      if (response.status === 201) {
        formElement.reset();
        setTopic("");
        setDescription("");
        router.refresh();
      } else {
        setError(response.status === 400 ? t.actions.invalid : errorForStatus(response.status));
      }
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  const inputClass =
    "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";

  return (
    <>
      {suggestions.length > 0 && (
        <ul className="mt-3 space-y-3">
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.questionText}
              className="rounded-lg border border-teal-200 bg-teal-50 p-4"
            >
              <SuggestionText suggestion={suggestion} />
              <button
                type="button"
                onClick={() => applySuggestion(suggestion)}
                className="mt-3 rounded-md border border-teal-700 bg-white px-3 py-3 text-sm font-medium text-teal-800 hover:bg-teal-50"
              >
                {t.suggestions.use}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        ref={formRef}
        onSubmit={onSubmit}
        noValidate
        className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-white p-4"
      >
        <h3 className="font-medium">{t.actions.addTitle}</h3>
        <label className="block text-sm font-medium">
          {t.actions.topic}
          <input
            name="topic"
            type="text"
            maxLength={120}
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder={t.actions.topicPlaceholder}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">
          {t.actions.description}
          <textarea
            name="description"
            rows={3}
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={inputClass}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {t.actions.dueDate}
            <input name="dueDate" type="date" className={inputClass} />
          </label>
          <label className="block text-sm font-medium">
            {t.actions.status}
            <select name="status" defaultValue="PLANNED" className={inputClass}>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t.actions.statuses[status]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-teal-700 px-4 py-3 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 sm:w-auto"
        >
          {pending ? t.actions.submitting : t.actions.submit}
        </button>
      </form>
    </>
  );
}

/** One suggestion: the action and the result it reacts to. */
export function SuggestionText({ suggestion }: { suggestion: ActionSuggestion }) {
  return (
    <>
      <p className="text-sm font-semibold text-teal-900">{suggestion.topic}</p>
      <p className="mt-1 text-sm text-slate-900">{suggestion.suggestion}</p>
      <p className="mt-2 text-xs text-slate-600">
        {t.suggestions.because(
          suggestion.questionText,
          suggestion.average.toLocaleString("sk-SK", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 2,
          }),
        )}
      </p>
    </>
  );
}
