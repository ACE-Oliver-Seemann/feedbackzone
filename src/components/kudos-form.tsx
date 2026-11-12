"use client";

import { useState, type FormEvent } from "react";
import { t } from "@/lib/texts.sk";

// Mirror src/config/kudos.ts; the server validates again.
const VALUES = ["COLLABORATION", "QUALITY", "HELPING", "INNOVATION", "CUSTOMER"] as const;
const VISIBILITIES = ["TEAM", "PRIVATE"] as const;
const MIN_LENGTH = 20;
const MAX_LENGTH = 500;

type Recipient = { id: string; name: string; teamName: string | null };
type FieldName = keyof typeof t.kudos.fieldErrors;

// Form "Poslať kudos" (MVP-16).
export function KudosForm({ recipients }: { recipients: Recipient[] }) {
  const [text, setText] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, true>>>({});
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setError(null);
    setSent(false);
    setFieldErrors({});
    try {
      const response = await fetch("/api/kudos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          toUserId: form.get("toUserId"),
          text,
          value: form.get("value"),
          visibility: form.get("visibility"),
        }),
      });
      if (response.status === 201) {
        formElement.reset();
        setText("");
        setSent(true);
      } else if (response.status === 400) {
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
        {t.kudos.fieldErrors[field]}
      </span>
    );
  const length = text.trim().length;

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
      <label className="block text-sm font-medium">
        {t.kudos.recipient}
        <select name="toUserId" defaultValue="" className={inputClass}>
          <option value="" disabled>
            {t.kudos.recipientPlaceholder}
          </option>
          {recipients.map((recipient) => (
            <option key={recipient.id} value={recipient.id}>
              {recipient.name}
              {recipient.teamName ? ` (${recipient.teamName})` : ""}
            </option>
          ))}
        </select>
        {fieldError("toUserId")}
      </label>

      <label className="block text-sm font-medium">
        {t.kudos.text}
        <textarea
          rows={4}
          maxLength={MAX_LENGTH}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className={inputClass}
        />
        <span className="mt-1 flex justify-between text-xs font-normal text-slate-500">
          <span>{t.kudos.textHint}</span>
          <span className={length >= MIN_LENGTH ? "text-teal-800" : ""}>
            {t.kudos.textCounter(length)}
          </span>
        </span>
        {fieldError("text")}
      </label>

      <label className="block text-sm font-medium">
        {t.kudos.value}
        <select name="value" defaultValue={VALUES[0]} className={inputClass}>
          {VALUES.map((value) => (
            <option key={value} value={value}>
              {t.kudos.values[value]}
            </option>
          ))}
        </select>
        {fieldError("value")}
      </label>

      <fieldset>
        <legend className="text-sm font-medium">{t.kudos.visibility}</legend>
        <div className="mt-2 space-y-2">
          {VISIBILITIES.map((visibility) => (
            <label
              key={visibility}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="visibility"
                value={visibility}
                defaultChecked={visibility === "TEAM"}
                className="mt-0.5 h-4 w-4 accent-teal-700"
              />
              <span>
                <span className="block font-medium">{t.kudos.visibilities[visibility]}</span>
                <span className="block text-slate-600">{t.kudos.visibilityHints[visibility]}</span>
              </span>
            </label>
          ))}
        </div>
        {fieldError("visibility")}
      </fieldset>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {sent && (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {t.kudos.sent}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 sm:w-auto"
      >
        {pending ? t.kudos.submitting : t.kudos.submit}
      </button>
    </form>
  );
}
