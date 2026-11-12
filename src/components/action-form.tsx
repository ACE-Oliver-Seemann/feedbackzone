"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { IconPlus } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { Panel } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { t } from "@/lib/texts.sk";

const STATUSES = ["PLANNED", "IN_PROGRESS", "DONE"] as const;
type FieldName = keyof typeof t.actions.fieldErrors;

// Form "Pridať krok" on the results screen (MVP-13).
export function ActionForm({ roundId }: { roundId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, true>>>({});

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
          topic: form.get("topic"),
          description: form.get("description"),
          dueDate: form.get("dueDate"),
          status: form.get("status"),
        }),
      });
      if (response.status === 201) {
        formElement.reset();
        router.refresh();
        // The new step appears in the list above; the toast confirms it.
        toast.success(t.toasts.actionAdded);
      } else if (response.status === 400) {
        // The API names the invalid fields (FE-005); without them, the summary message.
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
        setError(t.errors.generic);
      }
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  const errorText = (field: FieldName) => fieldErrors[field] && t.actions.fieldErrors[field];

  return (
    <Panel className="mt-4 p-5 sm:p-6">
      <form onSubmit={onSubmit} noValidate aria-labelledby="action-form-title" className="space-y-5">
        <h3 id="action-form-title" className="text-base font-semibold tracking-[-0.01em] text-ink">
          {t.actions.addTitle}
        </h3>
        <Field label={t.actions.topic} error={errorText("topic")}>
          <Input name="topic" type="text" maxLength={120} placeholder={t.actions.topicPlaceholder} />
        </Field>
        <Field label={t.actions.description} error={errorText("description")}>
          <Textarea name="description" rows={3} maxLength={1000} />
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
  );
}
