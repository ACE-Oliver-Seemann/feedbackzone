"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { t } from "@/lib/texts.sk";

const MAX_COMMENT_LENGTH = 1000; // mirrors src/server/responses.ts
const SCALE = [1, 2, 3, 4, 5] as const;

type Question = { position: number; text: string };
type Step = "intro" | "questions" | "comment" | "done" | "already" | "closed";

/**
 * Filling in a round (MVP-07 to MVP-09): confidentiality intro, one question
 * per screen with a 1–5 scale, optional comment, one submission at the end.
 * Answers live only in component state until they are sent.
 */
export function FillWizard({
  roundId,
  roundName,
  questions,
  children,
}: {
  roundId: string;
  roundName: string;
  questions: Question[];
  /** Shown under the thank-you message: latest actions of the team (MVP-14). */
  children?: ReactNode;
}) {
  const [step, setStep] = useState<Step>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = questions.length;
  const primary =
    "rounded-md bg-teal-700 px-5 py-3 text-base font-medium text-white hover:bg-teal-800 disabled:opacity-50";
  const secondary =
    "rounded-md border border-slate-300 bg-white px-5 py-3 text-base font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50";

  function back() {
    setError(null);
    if (step === "comment") {
      setStep("questions");
      setIndex(total - 1);
    } else if (index === 0) {
      setStep("intro");
    } else {
      setIndex(index - 1);
    }
  }

  function next() {
    if (index === total - 1) setStep("comment");
    else setIndex(index + 1);
  }

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/rounds/${roundId}/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers, comment }),
      });
      if (response.status === 201) {
        // No router.refresh() here: the server page would re-render as
        // "already submitted" and replace the thank-you screen.
        setStep("done");
      } else if (response.status === 409) {
        const { error: code } = await response.json();
        setStep(code === "already_submitted" ? "already" : "closed");
      } else {
        setError(t.errors.generic);
      }
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  const backLink = (
    <Link href="/" className="mt-6 inline-block text-sm font-medium text-teal-800 underline">
      {t.fill.backToSurveys}
    </Link>
  );

  if (step === "done") {
    return (
      <div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <h1 className="text-xl font-semibold text-emerald-900">{t.fill.thanksTitle}</h1>
          <p className="mt-1 text-emerald-900">{t.fill.thanksText}</p>
        </div>
        {children}
        {backLink}
      </div>
    );
  }

  if (step === "already" || step === "closed") {
    return (
      <div>
        <FillNotice
          title={step === "already" ? t.fill.alreadySubmittedTitle : t.fill.closedTitle}
          text={step === "already" ? t.fill.alreadySubmittedText : t.fill.closedText}
        />
        {backLink}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-teal-800">{roundName}</p>

      {step === "intro" && (
        <>
          <h1 className="mt-1 text-xl font-semibold">{t.fill.introTitle}</h1>
          <p className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4 text-base text-teal-950">
            {t.fill.confidentiality}
          </p>
          <p className="mt-3 text-sm text-slate-600">{t.fill.introDuration(total)}</p>
          <button type="button" onClick={() => setStep("questions")} className={`${primary} mt-6 w-full`}>
            {t.fill.start}
          </button>
        </>
      )}

      {step === "questions" && (
        <>
          <p className="mt-1 text-sm text-slate-600" aria-live="polite">
            {t.fill.progress(index + 1, total)}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-slate-200" aria-hidden="true">
            <div
              className="h-1.5 rounded-full bg-teal-600 transition-all"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
          <fieldset className="mt-6">
            <legend className="text-lg font-medium leading-snug">{questions[index].text}</legend>
            <p className="sr-only">{t.fill.scaleLegend}</p>
            <div className="mt-5 grid grid-cols-5 gap-2">
              {SCALE.map((value) => {
                const selected = answers[index] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setAnswers((current) =>
                        current.map((item, position) => (position === index ? value : item)),
                      )
                    }
                    className={`h-14 rounded-md border text-lg font-semibold ${
                      selected
                        ? "border-teal-700 bg-teal-700 text-white"
                        : "border-slate-300 bg-white text-slate-800 hover:border-teal-600"
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between gap-4 text-xs text-slate-500">
              <span>{t.fill.scaleLow}</span>
              <span className="text-right">{t.fill.scaleHigh}</span>
            </div>
          </fieldset>
          <div className="mt-8 flex gap-3">
            <button type="button" onClick={back} className={`${secondary} flex-1`}>
              {t.fill.back}
            </button>
            <button
              type="button"
              onClick={next}
              disabled={answers[index] === null}
              className={`${primary} flex-1`}
            >
              {t.fill.next}
            </button>
          </div>
        </>
      )}

      {step === "comment" && (
        <>
          <h1 className="mt-1 text-lg font-medium">{t.fill.commentTitle}</h1>
          <p className="mt-2 text-sm text-slate-600">{t.fill.commentHint}</p>
          <label className="mt-4 block">
            <span className="sr-only">{t.fill.commentLabel}</span>
            <textarea
              rows={5}
              maxLength={MAX_COMMENT_LENGTH}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </label>
          <p className="mt-1 text-right text-xs text-slate-500">
            {t.fill.commentCounter(comment.length)}
          </p>
          {error && (
            <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={back} disabled={pending} className={`${secondary} flex-1`}>
              {t.fill.back}
            </button>
            <button type="button" onClick={submit} disabled={pending} className={`${primary} flex-1`}>
              {pending ? t.fill.submitting : t.fill.submit}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function FillNotice({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-1 text-slate-700">{text}</p>
    </div>
  );
}
