"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { IconPlus, IconSparkle } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { InsetList, InsetRow, Panel } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { errorForStatus, t } from "@/lib/texts.sk";

const STATUSES = ["PLANNED", "IN_PROGRESS", "DONE"] as const;
type FieldName = keyof typeof t.actions.fieldErrors;

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
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, true>>>({});

  function applySuggestion(suggestion: ActionSuggestion) {
    setTopic(suggestion.topic);
    setDescription(suggestion.suggestion);
    setError(null);
    setFieldErrors({});
    formRef.current?.scrollIntoView({ block: "nearest" });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setError(null);
    setFieldErrors({});
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
        // The new step appears in the list above; the toast confirms it.
        toast.success(t.toasts.actionAdded);
      } else if (response.status === 400) {
        // The API names the invalid fields; without them, the summary message.
        const body = await response.json().catch(() => ({}));
        const invalid = Object.keys(body?.fields ?? {}).filter(
          (field): field is FieldName => field in t.actions.fieldErrors,
        );
        if (invalid.length > 0) {
          setFieldErrors(Object.fromEntries(invalid.map((field) => [field, true])));
        } else {
          setError(t.actions.invalid);
        }
      } else {
        setError(errorForStatus(response.status));
      }
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  const errorText = (field: FieldName) => fieldErrors[field] && t.actions.fieldErrors[field];

  return (
    <>
      {suggestions.length > 0 && (
        <InsetList className="mt-4">
          {suggestions.map((suggestion) => (
            <InsetRow
              key={suggestion.questionText}
              className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
            >
              <div className="min-w-0">
                <SuggestionText suggestion={suggestion} />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => applySuggestion(suggestion)}
                className="shrink-0 self-start"
              >
                {t.suggestions.use}
              </Button>
            </InsetRow>
          ))}
        </InsetList>
      )}

      <Panel className="mt-4 p-5 sm:p-6">
        <form
          ref={formRef}
          onSubmit={onSubmit}
          noValidate
          aria-labelledby="action-form-title"
          className="space-y-5"
        >
          <h3 id="action-form-title" className="text-base font-semibold tracking-[-0.01em] text-ink">
            {t.actions.addTitle}
          </h3>
          <Field label={t.actions.topic} error={errorText("topic")}>
            <Input
              name="topic"
              type="text"
              maxLength={120}
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder={t.actions.topicPlaceholder}
            />
          </Field>
          <Field label={t.actions.description} error={errorText("description")}>
            <Textarea
              name="description"
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t.actions.dueDate} error={errorText("dueDate")}>
              <Input name="dueDate" type="date" />
            </Field>
            <Field label={t.actions.status} error={errorText("status")}>
              <Select name="status" defaultValue="PLANNED">
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t.actions.statuses[status]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {error && (
            <Notice tone="error" role="alert">
              {error}
            </Notice>
          )}
          <div className="flex justify-end border-t border-line pt-5">
            <Button type="submit" disabled={pending} pending={pending} className="w-full sm:w-auto">
              {!pending && <IconPlus size={16} className="-ml-0.5" />}
              {pending ? t.actions.submitting : t.actions.submit}
            </Button>
          </div>
        </form>
      </Panel>
    </>
  );
}

/** One suggestion: the action and the result it reacts to. */
export function SuggestionText({ suggestion }: { suggestion: ActionSuggestion }) {
  return (
    <>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-800">
        <IconSparkle size={15} className="shrink-0 text-brand-600" />
        {suggestion.topic}
      </p>
      <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink">{suggestion.suggestion}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
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
