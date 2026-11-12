"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { t } from "@/lib/texts.sk";

const STATUSES = ["PLANNED", "IN_PROGRESS", "DONE"] as const;

// Form "Pridať krok" on the results screen (MVP-13).
export function ActionForm({ roundId }: { roundId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          topic: form.get("topic"),
          description: form.get("description"),
          dueDate: form.get("dueDate"),
          status: form.get("status"),
        }),
      });
      if (response.status === 201) {
        formElement.reset();
        router.refresh();
      } else {
        setError(response.status === 400 ? t.actions.invalid : t.errors.generic);
      }
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  const inputClass =
    "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";

  return (
    <form
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
          placeholder={t.actions.topicPlaceholder}
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-medium">
        {t.actions.description}
        <textarea name="description" rows={3} maxLength={1000} className={inputClass} />
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
        className="w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 sm:w-auto"
      >
        {pending ? t.actions.submitting : t.actions.submit}
      </button>
    </form>
  );
}
