"use client";

import { useRef, useState, type FormEvent } from "react";
import { KudosCard } from "@/components/kudos-list";
import { Button } from "@/components/ui/button";
import { SuccessCheck, useConfetti } from "@/components/ui/celebrate";
import { cx } from "@/components/ui/cx";
import { Field, FieldError, Select, Textarea } from "@/components/ui/field";
import { IconCheck, IconHeart, IconSend } from "@/components/ui/icons";
import { KudosValueIcon } from "@/components/ui/kudos-value";
import { Notice } from "@/components/ui/notice";
import { Panel } from "@/components/ui/surface";
import { t } from "@/lib/texts.sk";

// Mirror src/config/kudos.ts; the server validates again.
const VALUES = ["COLLABORATION", "QUALITY", "HELPING", "INNOVATION", "CUSTOMER"] as const;
const VISIBILITIES = ["TEAM", "PRIVATE"] as const;
const MIN_LENGTH = 20;
const MAX_LENGTH = 500;

type Recipient = { id: string; name: string; teamName: string | null };
type FieldName = keyof typeof t.kudos.fieldErrors;
type Choices = {
  toUserId: string;
  value: (typeof VALUES)[number];
  visibility: (typeof VISIBILITIES)[number];
};

const DEFAULT_CHOICES: Choices = { toUserId: "", value: VALUES[0], visibility: "TEAM" };

// Focus ring for radios that are visually hidden inside a styled <label>.
const focusWithin =
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-600";

/**
 * Form "Poslať kudos" (MVP-16) with a live preview of the kudos as the
 * recipient will see it. Rendered inside the kudos hub; `onShowReceived`
 * adds a "Pozrieť moje kudos" action after sending.
 */
export function KudosForm({
  recipients,
  onSent,
  onShowReceived,
}: {
  recipients: Recipient[];
  /** Called after the server accepted the kudos (201). */
  onSent?: () => void;
  onShowReceived?: () => void;
}) {
  const [text, setText] = useState("");
  const [choices, setChoices] = useState<Choices>(DEFAULT_CHOICES);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, true>>>({});
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const recipientRef = useRef<HTMLSelectElement>(null);
  const fireConfetti = useConfetti();

  // The select and the radios stay uncontrolled (form.reset() clears them);
  // the preview reads the current choices on every change.
  function readChoices(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    setChoices({
      toUserId: String(form.get("toUserId") ?? ""),
      value: (form.get("value") as Choices["value"] | null) ?? DEFAULT_CHOICES.value,
      visibility: (form.get("visibility") as Choices["visibility"] | null) ?? "TEAM",
    });
  }

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
        setChoices(DEFAULT_CHOICES);
        setSent(true);
        fireConfetti({ intensity: "light", origin: { x: 0.5, y: 0.6 } });
        onSent?.();
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

  function sendAnother() {
    setSent(false);
    recipientRef.current?.focus();
  }

  const errorText = (field: FieldName) => fieldErrors[field] && t.kudos.fieldErrors[field];
  const length = text.trim().length;
  const recipientName =
    recipients.find((recipient) => recipient.id === choices.toUserId)?.name ?? "";

  return (
    <Panel className="p-5 sm:p-6">
      <form
        onSubmit={onSubmit}
        onChange={(event) => readChoices(event.currentTarget)}
        noValidate
        className="space-y-6"
      >
        <Field label={t.kudos.recipient} error={errorText("toUserId")}>
          <Select
            ref={recipientRef}
            name="toUserId"
            defaultValue=""
            aria-invalid={fieldErrors.toUserId}
          >
            <option value="" disabled>
              {t.kudos.recipientPlaceholder}
            </option>
            {recipients.map((recipient) => (
              <option key={recipient.id} value={recipient.id}>
                {recipient.name}
                {recipient.teamName ? ` (${recipient.teamName})` : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={t.kudos.text}
          hint={t.kudos.textHint}
          aside={
            <span
              className={cx(
                "inline-flex items-center gap-1 transition-colors duration-200",
                length >= MIN_LENGTH && "font-medium text-brand-700",
              )}
            >
              {length >= MIN_LENGTH && <IconCheck size={14} className="animate-rise" />}
              {t.kudos.textCounter(length)}
            </span>
          }
          error={errorText("text")}
        >
          <Textarea
            rows={4}
            maxLength={MAX_LENGTH}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={fieldErrors.text}
          />
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">{t.kudos.value}</legend>
          <div className="flex flex-wrap gap-2">
            {VALUES.map((value) => (
              <label
                key={value}
                className={cx(
                  "group relative inline-flex h-9 cursor-pointer select-none items-center gap-1.5 rounded-full px-3.5 text-sm font-medium",
                  "bg-surface text-ink-soft ring-1 ring-inset ring-line-strong",
                  "transition-[background-color,color,box-shadow,scale] duration-150 ease-out active:scale-[0.97]",
                  "[&:not(:has(:checked))]:hover:bg-brand-50/60 [&:not(:has(:checked))]:hover:ring-brand-300",
                  "has-checked:bg-brand-600 has-checked:text-white has-checked:ring-brand-600",
                  focusWithin,
                )}
              >
                <input
                  type="radio"
                  name="value"
                  value={value}
                  defaultChecked={value === VALUES[0]}
                  className="sr-only"
                />
                <KudosValueIcon
                  value={value}
                  size={15}
                  className="-ml-0.5 text-brand-600 transition-colors group-has-checked:text-white"
                />
                {t.kudos.values[value]}
              </label>
            ))}
          </div>
          {fieldErrors.value && <FieldError>{t.kudos.fieldErrors.value}</FieldError>}
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">{t.kudos.visibility}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {VISIBILITIES.map((visibility) => (
              <label
                key={visibility}
                className={cx(
                  "group relative flex cursor-pointer items-start gap-3 rounded-xl bg-surface p-4",
                  "ring-1 ring-inset ring-line-strong transition-[background-color,box-shadow] duration-150 ease-out",
                  "[&:not(:has(:checked))]:hover:ring-brand-300 has-checked:bg-brand-50/50 has-checked:ring-2 has-checked:ring-brand-600",
                  focusWithin,
                )}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={visibility}
                  defaultChecked={visibility === "TEAM"}
                  className="sr-only"
                />
                <span
                  className="mt-0.5 grid size-[1.125rem] shrink-0 place-items-center rounded-full ring-1 ring-inset ring-line-strong transition-colors group-has-checked:bg-brand-600 group-has-checked:ring-brand-600"
                  aria-hidden="true"
                >
                  <span className="size-1.5 scale-0 rounded-full bg-white opacity-0 transition-[opacity,scale] duration-200 ease-out-soft group-has-checked:scale-100 group-has-checked:opacity-100" />
                </span>
                <span className="min-w-0 text-sm">
                  <span className="block font-medium text-ink">
                    {t.kudos.visibilities[visibility]}
                  </span>
                  <span className="mt-0.5 block leading-snug text-muted">
                    {t.kudos.visibilityHints[visibility]}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {fieldErrors.visibility && <FieldError>{t.kudos.fieldErrors.visibility}</FieldError>}
        </fieldset>

        {/* Live preview: how the recipient will see the kudos, so the sender can review it. */}
        <section aria-labelledby="kudos-preview-title">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 id="kudos-preview-title" className="text-sm font-medium text-ink">
              {t.kudos.previewTitle}
            </h3>
            <p className="text-xs text-muted">{t.kudos.previewHint}</p>
          </div>
          <KudosCard
            as="div"
            mode="preview"
            className="overflow-hidden rounded-xl bg-canvas/70 ring-1 ring-line"
            item={{
              fromName: "",
              toName: recipientName,
              text: text.trim(),
              value: choices.value,
              visibility: choices.visibility,
              createdAt: "",
            }}
          />
        </section>

        {error && (
          <Notice tone="error" role="alert">
            {error}
          </Notice>
        )}
        {/* Live region stays mounted so the confirmation is announced. */}
        <div role="status">
          {sent && (
            <div className="flex animate-rise flex-col gap-4 rounded-xl bg-brand-50 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <SuccessCheck size={44} className="[&>span]:bg-surface" />
                <div className="min-w-0 text-sm leading-relaxed text-brand-900">
                  <p className="font-semibold">{t.kudos.sent}</p>
                  <p>{t.kudos.sentText}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={sendAnother}>
                  {t.kudos.sendAnother}
                </Button>
                {onShowReceived && (
                  <Button size="sm" variant="ghost" onClick={onShowReceived}>
                    <IconHeart size={15} />
                    {t.kudos.showReceived}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-line pt-5">
          <Button type="submit" disabled={pending} pending={pending} className="w-full sm:w-auto">
            {!pending && <IconSend size={16} className="-ml-0.5" />}
            {pending ? t.kudos.submitting : t.kudos.submit}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
