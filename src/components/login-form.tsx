"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { t } from "@/lib/texts.sk";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      if (response.ok) {
        const { home } = await response.json();
        // Full navigation so that the layout is rendered for the new session.
        window.location.assign(home);
        return;
      }
      setError(response.status === 401 ? t.login.invalid : t.errors.generic);
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <Field label={t.login.email}>
        <Input name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label={t.login.password}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      {error && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
      <Button type="submit" size="lg" disabled={pending} pending={pending} className="w-full">
        {pending ? t.login.submitting : t.login.submit}
      </Button>
    </form>
  );
}
