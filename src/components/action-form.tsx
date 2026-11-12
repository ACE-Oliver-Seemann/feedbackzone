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

// Form "Pridať krok" on the results screen (MVP-13).
export function ActionForm({ roundId }: { roundId: string }) {
  const router = useRouter();
  const toast = useToast();
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
        // The new step appears in the list above; the toast confirms it.
        toast.success(t.toasts.actionAdded);
      } else {
        setError(response.status === 400 ? t.actions.invalid : t.errors.generic);
      }
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  return (
    <Panel className="mt-4 p-5 sm:p-6">
      <form onSubmit={onSubmit} noValidate aria-labelledby="action-form-title" className="space-y-5">
        <h3 id="action-form-title" className="text-base font-semibold tracking-[-0.01em] text-ink">
          {t.actions.addTitle}
        </h3>
        <Field label={t.actions.topic}>
          <Input name="topic" type="text" maxLength={120} placeholder={t.actions.topicPlaceholder} />
        </Field>
        <Field label={t.actions.description}>
          <Textarea name="description" rows={3} maxLength={1000} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t.actions.dueDate}>
            <Input name="dueDate" type="date" />
          </Field>
          <Field label={t.actions.status}>
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
