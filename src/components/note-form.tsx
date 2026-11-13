"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { IconPlus } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { Panel } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { errorForStatus, t } from "@/lib/texts.sk";

// Form "Nová poznámka zo stretnutia" for HR (IT-10). Typed text only.
export function NoteForm() {
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
        // The new note appears in the list below; the toast confirms it.
        toast.success(t.toasts.noteAdded);
      } else {
        setError(response.status === 400 ? t.notes.invalid : errorForStatus(response.status));
      }
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  return (
    <Panel className="p-5 sm:p-6">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Notice tone="warning">{t.notes.warning}</Notice>
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <Field label={t.notes.title}>
            <Input
              name="title"
              type="text"
              maxLength={120}
              placeholder={t.notes.titlePlaceholder}
            />
          </Field>
          <Field label={t.notes.meetingDate}>
            <Input name="meetingDate" type="date" />
          </Field>
        </div>
        <Field label={t.notes.text}>
          <Textarea name="text" rows={6} maxLength={10000} />
        </Field>
        {error && (
          <Notice tone="error" role="alert">
            {error}
          </Notice>
        )}
        <div className="flex justify-end border-t border-line pt-5">
          <Button type="submit" disabled={pending} pending={pending} className="w-full sm:w-auto">
            {!pending && <IconPlus size={16} className="-ml-0.5" />}
            {pending ? t.notes.submitting : t.notes.submit}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
