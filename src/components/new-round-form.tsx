"use client";

import { useRouter } from "next/navigation";
import { addTransitionType, startTransition, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Field, FieldError, Input, Select } from "@/components/ui/field";
import { IconCheck } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { InsetList, Panel, Section } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { FORWARD } from "@/lib/page-motion";
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
  const toast = useToast();
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
        // The toast lives in the app shell, so it stays visible after the redirect.
        toast.success(t.toasts.roundCreated);
        startTransition(() => {
          for (const type of FORWARD) addTransitionType(type);
          router.push(redirectTo);
        });
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

  const errorText = (field: FieldName) => fieldErrors[field] && t.newRound.fieldErrors[field];

  return (
    <form onSubmit={onSubmit} noValidate>
      <Section title={t.newRound.basicsTitle}>
        <Panel className="space-y-5 p-5 sm:p-6">
          <Field label={t.newRound.name} error={errorText("name")}>
            <Input
              name="name"
              type="text"
              maxLength={120}
              placeholder={t.newRound.namePlaceholder}
              aria-invalid={fieldErrors.name}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t.newRound.team} error={errorText("teamId")}>
              <Select name="teamId" defaultValue={teams[0]?.id} aria-invalid={fieldErrors.teamId}>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.newRound.closesAt} error={errorText("closesAt")}>
              <Input
                name="closesAt"
                type="date"
                min={todayLocal()}
                aria-invalid={fieldErrors.closesAt}
              />
            </Field>
          </div>
        </Panel>
      </Section>

      <fieldset className="mt-10">
        <legend className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">
          {t.newRound.questions}
        </legend>
        <p className="mt-0.5 text-sm text-muted">{t.newRound.questionsHint}</p>
        {fieldErrors.questionIds && <FieldError>{t.newRound.fieldErrors.questionIds}</FieldError>}

        <div className="mt-5 space-y-6">
          {topics.map(([topic, items]) => (
            <div key={topic}>
              <p className="mb-2 px-1 text-sm font-semibold text-ink-soft">{topic}</p>
              <InsetList>
                {items.map((question) => {
                  const position = selected.indexOf(question.id);
                  const checked = position !== -1;
                  const disabled = !checked && selected.length >= MAX_QUESTIONS;
                  return (
                    <li key={question.id}>
                      <label
                        className={cx(
                          "flex items-start gap-3.5 px-4 py-3.5 text-[0.9375rem] leading-snug sm:px-5",
                          "transition-colors duration-150",
                          "has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-brand-600",
                          checked ? "bg-brand-50/60 text-ink" : "text-ink-soft",
                          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                          !checked && !disabled && "hover:bg-canvas",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggle(question.id)}
                        />
                        <span
                          className={cx(
                            "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums",
                            "transition-[background-color,box-shadow] duration-150",
                            checked
                              ? "bg-brand-600 text-white"
                              : "ring-1 ring-inset ring-line-strong",
                          )}
                          aria-hidden="true"
                        >
                          {checked && (
                            <span key={position} className="animate-rise">
                              {position + 1}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1 pt-0.5">{question.text}</span>
                      </label>
                    </li>
                  );
                })}
              </InsetList>
            </div>
          ))}
        </div>
      </fieldset>

      {error && (
        <Notice tone="error" role="alert" className="mt-6">
          {error}
        </Notice>
      )}

      {/* Stays in view while scrolling the question list: count + submit. */}
      <div className="sticky bottom-4 z-20 mt-8 flex items-center justify-between gap-3 rounded-2xl bg-surface/90 px-4 py-3 shadow-[var(--shadow-raised)] ring-1 ring-line backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden gap-1 sm:flex" aria-hidden="true">
            {Array.from({ length: MAX_QUESTIONS }, (_, index) => (
              <span
                key={index}
                className={cx(
                  "h-1.5 w-4 rounded-full transition-colors duration-200",
                  index < selected.length
                    ? countValid
                      ? "bg-brand-600"
                      : "bg-brand-300"
                    : "bg-line-strong",
                )}
              />
            ))}
          </span>
          <p
            className={cx(
              "flex min-w-0 items-center gap-1.5 text-sm transition-colors duration-200",
              countValid
                ? "font-medium text-brand-700"
                : fieldErrors.questionIds
                  ? "text-red-700"
                  : "text-muted",
            )}
            aria-live="polite"
          >
            {countValid && <IconCheck size={16} className="shrink-0 animate-rise" />}
            {t.newRound.selected(selected.length)}
          </p>
        </div>
        <Button type="submit" disabled={pending} pending={pending} className="shrink-0">
          {pending ? t.newRound.submitting : t.newRound.submit}
        </Button>
      </div>
    </form>
  );
}
