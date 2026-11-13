"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useFocusFirstError } from "@/components/ui/focus-error";
import { Field, Textarea } from "@/components/ui/field";
import { IconLock, IconSend } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { t } from "@/lib/texts.sk";
import { failureMessage, SessionExpiredNotice } from "./responsibility-meta";

const r = t.responsibilities;
const MAX_LENGTH = 2000;

/** New progress comment; HR can mark it internal (IT-14). */
export function ResponsibilityCommentForm({ id, canCommentInternal }: { id: string; canCommentInternal: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  useFocusFirstError(formRef, fieldError, error, sessionExpired);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) {
      setFieldError(true);
      return;
    }
    setPending(true);
    setError(null);
    setFieldError(false);
    setSessionExpired(false);
    try {
      const response = await fetch(`/api/responsibilities/${id}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(canCommentInternal ? { text, internal } : { text }),
      });
      if (response.ok) {
        setText("");
        setInternal(false);
        toast.success(t.toasts.responsibilityCommentAdded);
        router.refresh();
      } else if (response.status === 400) {
        setFieldError(true);
      } else if (response.status === 401) {
        setSessionExpired(true);
      } else {
        setError(failureMessage(response.status));
      }
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      <Field
        label={r.commentLabel}
        error={fieldError ? r.fieldErrors.text : undefined}
        aside={`${[...text].length} / ${MAX_LENGTH}`}
      >
        <Textarea
          name="text"
          rows={3}
          maxLength={MAX_LENGTH}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={r.commentPlaceholder}
        />
      </Field>
      {canCommentInternal && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-950">
          <input
            type="checkbox"
            checked={internal}
            onChange={(event) => setInternal(event.target.checked)}
            className="mt-0.5 size-4.5 shrink-0 rounded accent-amber-700"
          />
          <span>
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <IconLock size={14} />
              {r.commentInternal}
            </span>
            <span className="block text-amber-900">{r.commentInternalHint}</span>
          </span>
        </label>
      )}
      {error && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
      {sessionExpired && <SessionExpiredNotice />}
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending} pending={pending} className="w-full sm:w-auto">
          {!pending && <IconSend size={16} className="-ml-0.5" />}
          {pending ? r.commentSubmitting : r.commentSubmit}
        </Button>
      </div>
    </form>
  );
}
