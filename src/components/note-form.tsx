"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { errorForStatus, t } from "@/lib/texts.sk";

// Form "Nová poznámka zo stretnutia" for HR (IT-10). Typed text only.
export function NoteForm() {
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
      const response = await fetch("/api/hr/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          meetingDate: form.get("meetingDate"),
          text: form.get("text"),
        }),
      });
      if (response.status === 201) {
        formElement.reset();
        router.refresh();
      } else {
        setError(response.status === 400 ? t.notes.invalid : errorForStatus(response.status));
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
      onSubmit={onSubmit}
      noValidate
      className="mt-3 space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">{t.notes.warning}</p>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <label className="block text-sm font-medium">
          {t.notes.title}
          <input
            name="title"
            type="text"
            maxLength={120}
            placeholder={t.notes.titlePlaceholder}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">
          {t.notes.meetingDate}
          <input name="meetingDate" type="date" className={inputClass} />
        </label>
      </div>
      <label className="block text-sm font-medium">
        {t.notes.text}
        <textarea name="text" rows={6} maxLength={10000} className={inputClass} />
      </label>
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
        {pending ? t.notes.submitting : t.notes.submit}
      </button>
    </form>
  );
}
