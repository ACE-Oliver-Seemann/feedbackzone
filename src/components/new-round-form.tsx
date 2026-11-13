"use client";

import { useRouter } from "next/navigation";
import { addTransitionType, startTransition, useMemo, useRef, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Field, FieldError, Input, Select } from "@/components/ui/field";
import { useFocusFirstError } from "@/components/ui/focus-error";
import { IconCheck, IconChevronDown, IconPlus } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { Panel, Section } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { FORWARD } from "@/lib/page-motion";
import { errorForStatus, t } from "@/lib/texts.sk";

// Mirrors MIN_QUESTIONS / MAX_QUESTIONS in src/server/rounds.ts and the custom
// question limits in src/server/catalog.ts. The server validates again; this
// only keeps the form from sending an obvious mistake.
const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 5;
const CUSTOM_MAX_LENGTH = 200;
/** Topic of a team's own questions; mirrors CUSTOM_QUESTION_TOPIC in src/server/catalog.ts. */
const CUSTOM_TOPIC = "Vlastné otázky tímu";

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
  const toast = useToast();
  const [allQuestions, setAllQuestions] = useState(questions);
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>(() => defaults[teams[0]?.id ?? ""] ?? []);
  // Bumped when an own question is added, to re-open its topic (BUG-018).
  const [customAdded, setCustomAdded] = useState(0);
  const [customNotice, setCustomNotice] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, true>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [customText, setCustomText] = useState("");
  const [customError, setCustomError] = useState<CustomError | null>(null);
  const [customPending, setCustomPending] = useState(false);
  // The save button stays in view while the errors may be far above or below it.
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(formRef, fieldErrors, error);

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

  // Topics holding a preselected question of the CHOSEN team start expanded;
  // the rest are collapsed (BUG-017: they used to follow the first team only).
  const openTopics = useMemo(
    () =>
      new Set(
        allQuestions
          .filter((question) => (defaults[teamId] ?? []).includes(question.id))
          .map((question) => question.topic),
      ),
    [allQuestions, defaults, teamId],
  );

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
    setCustomNotice(false);
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
        setCustomAdded((count) => count + 1);
        // Saved for good, but not in this round: say so instead of staying silent.
        setCustomNotice(total >= MAX_QUESTIONS);
        toast.success(t.toasts.questionAdded);
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
        setError(errorForStatus(response.status));
      }
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  const errorText = (field: FieldName) => fieldErrors[field] && t.newRound.fieldErrors[field];

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate>
      <Section title={t.newRound.basicsTitle}>
        <Panel className="space-y-5 p-5 sm:p-6">
          <Field label={t.newRound.name} error={errorText("name")}>
            <Input
              name="name"
              type="text"
              maxLength={120}
              defaultValue={defaultName}
              placeholder={t.newRound.namePlaceholder}
              aria-invalid={fieldErrors.name}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t.newRound.team} error={errorText("teamId")}>
              <Select
                name="teamId"
                value={teamId}
                onChange={(event) => changeTeam(event.target.value)}
                aria-invalid={fieldErrors.teamId}
              >
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
                defaultValue={defaultClosesAt}
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

        {selected.length > 0 && (
          <Notice tone="info" className="mt-4">
            {t.newRound.preselected}
          </Notice>
        )}

        {fixedQuestions.length > 0 && (
          <Panel className="mt-4 px-4 py-4 sm:px-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span
                className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white"
                aria-hidden="true"
              >
                1
              </span>
              {t.newRound.fixedTitle}
            </p>
            {fixedQuestions.map((question) => (
              <p key={question.id} className="mt-2 text-[0.9375rem] leading-snug text-ink">
                {question.text}
              </p>
            ))}
            <p className="mt-1.5 text-xs text-muted">{t.newRound.fixedHint}</p>
          </Panel>
        )}

        <p className="mt-5 text-xs text-muted">{t.newRound.starterHint}</p>
        <div className="mt-2 space-y-2">
          {topics.map(([topic, items]) => (
            <details
              // Remounted on a team change or a new own question, so the
              // initial open state is computed again.
              key={`${teamId}-${topic}-${topic === CUSTOM_TOPIC ? customAdded : 0}`}
              open={
                openTopics.has(topic) || (topic === CUSTOM_TOPIC && customAdded > 0) || undefined
              }
              className="group overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-panel)] ring-1 ring-line"
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-canvas/70 sm:px-5 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  {topic}{" "}
                  <span className="font-normal text-muted">
                    {t.newRound.topicCount(
                      items.filter((question) => selected.includes(question.id)).length,
                      items.length,
                    )}
                  </span>
                </span>
                <IconChevronDown
                  size={16}
                  className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <ul className="divide-y divide-line border-t border-line">
                {items.map((question) => {
                  const position = selected.indexOf(question.id);
                  const checked = position !== -1;
                  const disabled = !checked && total >= MAX_QUESTIONS;
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
                            checked ? "bg-brand-600 text-white" : "ring-1 ring-inset ring-line-strong",
                          )}
                          aria-hidden="true"
                        >
                          {checked && (
                            <span key={position} className="animate-rise">
                              {fixedQuestions.length + position + 1}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1 pt-0.5">
                          {question.text}
                          {question.starter && (
                            <Badge tone="warning" dot={false} className="ml-2 align-middle">
                              {t.newRound.starter}
                            </Badge>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </div>

        {canAddQuestion && (
          <Panel className="mt-6 p-5 sm:p-6">
            <Field
              label={t.newRound.custom.title}
              error={customError && t.newRound.custom.errors[customError]}
            >
              <Input
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
              />
            </Field>
            <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs leading-relaxed text-muted">
              {t.newRound.custom.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-muted">{t.newRound.custom.permanent}</p>
            {customNotice && (
              <Notice tone="warning" role="status" className="mt-3">
                {t.newRound.custom.addedNotSelected}
              </Notice>
            )}
            <Button
              variant="secondary"
              onClick={addCustomQuestion}
              disabled={customPending || !customText.trim()}
              pending={customPending}
              className="mt-4"
            >
              {!customPending && <IconPlus size={16} className="-ml-0.5" />}
              {customPending ? t.newRound.custom.adding : t.newRound.custom.add}
            </Button>
          </Panel>
        )}
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
                  index < total ? (countValid ? "bg-brand-600" : "bg-brand-300") : "bg-line-strong",
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
            {t.newRound.selected(total)}
          </p>
        </div>
        <Button type="submit" disabled={pending} pending={pending} className="shrink-0">
          {pending ? t.newRound.submitting : t.newRound.submit}
        </Button>
      </div>
    </form>
  );
}
