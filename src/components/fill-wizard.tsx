"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Confetti, SuccessCheck } from "@/components/ui/celebrate";
import { cx } from "@/components/ui/cx";
import { Textarea } from "@/components/ui/field";
import { IconCheck, IconChevronLeft, IconClock, IconInfo, IconLock } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { Panel } from "@/components/ui/surface";
import { SCALES, type ScaleKey } from "@/config/scales";
import { BACK } from "@/lib/page-motion";
import { limitChars } from "@/lib/text";
import { t } from "@/lib/texts.sk";

const MAX_COMMENT_LENGTH = 1000; // mirrors src/server/responses.ts
const SCALE = [1, 2, 3, 4, 5] as const;

type Question = { position: number; text: string; scale: ScaleKey };
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
  // Which way the user is moving, so the next step slides in from that side (IT-02).
  const [direction, setDirection] = useState<"next" | "back">("next");
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // INT-004: the session ended while filling in; the answers are still here.
  const [sessionExpired, setSessionExpired] = useState(false);
  // Encouraging line on the thank-you screen, picked when the server accepts the answers.
  const [cheer, setCheer] = useState(0);

  const total = questions.length;

  // After each step the focus moves to the new content, so that keyboard and
  // screen-reader users continue from the new question, not from a button
  // that no longer exists (BUG-016). Not on the first render.
  const stepRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    stepRef.current?.focus();
  }, [step, index]);

  function back() {
    setDirection("back");
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
    setDirection("next");
    if (index === total - 1) setStep("comment");
    else setIndex(index + 1);
  }

  async function submit() {
    setPending(true);
    setError(null);
    setSessionExpired(false);
    try {
      const response = await fetch(`/api/rounds/${roundId}/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers, comment }),
      });
      if (response.status === 201) {
        // No router.refresh() here: the server page would re-render as
        // "already submitted" and replace the thank-you screen.
        setCheer(Math.floor(Math.random() * t.fill.cheers.length));
        setStep("done");
      } else if (response.status === 409) {
        const { error: code } = await response.json();
        setStep(code === "already_submitted" ? "already" : "closed");
      } else if (response.status === 401) {
        setSessionExpired(true);
      } else {
        setError(t.errors.generic);
      }
    } catch {
      setError(t.errors.generic);
    }
    setPending(false);
  }

  if (step === "done") {
    return (
      <div>
        {/* The done step exists only after the server answered 201 and is
            terminal (nothing leaves it), so this burst mounts – and fires – once. */}
        <Confetti intensity="full" origin={{ x: 0.5, y: 0.32 }} />
        <Panel
          ref={stepRef}
          tabIndex={-1}
          className="animate-rise overflow-hidden text-center outline-none"
          role="status"
        >
          {/* Static composition reads as a success even with motion off:
              the check sits on a soft brand halo. */}
          <div className="px-6 pt-10 pb-8 sm:px-10 sm:pt-12">
            <span className="mx-auto grid size-28 place-items-center rounded-full bg-brand-50/60 ring-8 ring-brand-50/40">
              <SuccessCheck size={76} />
            </span>
            <p className="mt-6 animate-rise text-sm font-medium text-brand-700 [animation-delay:350ms]">
              {t.fill.cheers[cheer]}
            </p>
            <h1 className="mt-1.5 text-[1.625rem] leading-tight font-semibold tracking-[-0.02em] text-ink sm:text-[1.75rem]">
              {t.fill.thanksTitle}
            </h1>
          </div>
          {/* What happens next. */}
          <div className="flex animate-rise items-start gap-3 border-t border-line bg-canvas/60 px-5 py-4 text-left [animation-delay:450ms] sm:px-8">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-brand-600 ring-1 ring-line"
              aria-hidden="true"
            >
              <IconLock size={16} />
            </span>
            <p className="min-w-0 pt-1 text-sm leading-relaxed text-ink-soft">{t.fill.thanksText}</p>
          </div>
        </Panel>
        {children}
        <FillBackLink />
      </div>
    );
  }

  if (step === "already" || step === "closed") {
    return (
      <div>
        <FillNotice
          kind={step}
          title={step === "already" ? t.fill.alreadySubmittedTitle : t.fill.closedTitle}
          text={step === "already" ? t.fill.alreadySubmittedText : t.fill.closedText}
        />
        <FillBackLink />
      </div>
    );
  }

  const answered = answers[index] ?? null;

  return (
    <Panel ref={stepRef} tabIndex={-1} className="px-5 py-6 outline-none sm:px-8 sm:py-8">
      <p className="truncate text-sm font-medium text-muted">{roundName}</p>

      {step === "intro" && (
        <div key="intro" className="animate-rise">
          <h1 className="mt-1 text-[1.75rem] leading-tight font-medium tracking-[-0.02em] text-ink">
            {t.fill.introTitle}
          </h1>
          <Notice tone="confidential" className="mt-6">
            {t.fill.confidentiality}
          </Notice>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <IconClock size={16} className="shrink-0" />
            {t.fill.introDuration(total)}
          </p>
          <Button size="lg" onClick={() => setStep("questions")} className="mt-8 w-full">
            {t.fill.start}
          </Button>
        </div>
      )}

      {step === "questions" && (
        <>
          <Progress current={index + 1} total={total} />

          <fieldset
            key={`question-${index}`}
            className={cx("mt-8", direction === "back" ? "animate-slide-back" : "animate-slide-next")}
          >
            <legend className="text-[1.375rem] leading-snug font-semibold tracking-[-0.015em] text-ink sm:text-[1.5rem]">
              {questions[index].text}
            </legend>
            <p className="sr-only">{t.fill.scaleLegend}</p>
            <ScaleControl
              scale={questions[index].scale}
              value={answered}
              onChange={(value) =>
                setAnswers((current) =>
                  current.map((item, position) => (position === index ? value : item)),
                )
              }
            />
          </fieldset>

          <StepButtons>
            <Button variant="secondary" size="lg" onClick={back} className="w-full sm:flex-1">
              <IconChevronLeft size={18} className="-ml-1" />
              {t.fill.back}
            </Button>
            <Button size="lg" onClick={next} disabled={answered === null} className="w-full sm:flex-1">
              {t.fill.next}
            </Button>
          </StepButtons>
        </>
      )}

      {step === "comment" && (
        <div key="comment" className="animate-rise">
          <h1 className="mt-1 text-[1.375rem] leading-snug font-semibold tracking-[-0.015em] text-ink sm:text-[1.5rem]">
            {t.fill.commentTitle}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t.fill.commentHint}</p>
          <label className="mt-5 block">
            <span className="sr-only">{t.fill.commentLabel}</span>
            <Textarea
              rows={5}
              value={comment}
              onChange={(event) => setComment(limitChars(event.target.value, MAX_COMMENT_LENGTH))}
              className="min-h-36 resize-y"
            />
          </label>
          <p
            className={cx(
              "mt-1.5 text-right text-xs tabular-nums",
              [...comment].length > MAX_COMMENT_LENGTH * 0.9 ? "text-amber-700" : "text-muted",
            )}
          >
            {t.fill.commentCounter([...comment].length)}
          </p>
          {error && (
            <Notice tone="error" role="alert" className="mt-4">
              {error}
            </Notice>
          )}
          {sessionExpired && (
            <Notice tone="error" role="alert" title={t.fill.sessionExpiredTitle} className="mt-4">
              <p>{t.fill.sessionExpiredText}</p>
              {/* A new tab keeps this one, and the answers in it, intact. */}
              <a
                href="/login"
                target="_blank"
                rel="noopener"
                className="mt-1 inline-block rounded font-semibold underline underline-offset-2 hover:text-red-950"
              >
                {t.fill.sessionExpiredLink}
              </a>
            </Notice>
          )}
          <StepButtons>
            <Button variant="secondary" size="lg" onClick={back} disabled={pending} className="w-full sm:flex-1">
              <IconChevronLeft size={18} className="-ml-1" />
              {t.fill.back}
            </Button>
            <Button size="lg" onClick={submit} disabled={pending} pending={pending} className="w-full sm:flex-1">
              {pending ? t.fill.submitting : t.fill.submit}
            </Button>
          </StepButtons>
        </div>
      )}
    </Panel>
  );
}

/** "2 z 4" plus one segment per question; segments up to the current one are filled. */
function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="mt-3">
      <p className="text-sm font-medium text-ink-soft tabular-nums" aria-live="polite">
        <span aria-hidden="true">{t.fill.progress(current, total)}</span>
        <span className="sr-only">{t.fill.progressLabel(current, total)}</span>
      </p>
      <div className="mt-2.5 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, position) => (
          <span key={position} className="h-1 flex-1 overflow-hidden rounded-full bg-line">
            <span
              className={cx(
                "block h-full origin-left rounded-full bg-brand-600",
                "transition-transform duration-300 ease-out-soft",
                position < current ? "scale-x-100" : "scale-x-0",
              )}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The five answer points (IT-03). Scales where every point has its own meaning
 * (how often…) show the five labels as a list, because the numbers alone would
 * say nothing.
 *
 * The others are five equal tiles joined into one segmented control. A single
 * brand-blue thumb slides to the chosen value, so changing the answer reads
 * as one continuous movement instead of two tiles blinking.
 */
function ScaleControl({
  scale,
  value,
  onChange,
}: {
  scale: ScaleKey;
  value: number | null;
  onChange: (value: number) => void;
}) {
  const labels = t.scales[scale];

  if (SCALES[scale].labelEveryPoint) {
    return (
      <div className="mt-7 space-y-2">
        {SCALE.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className={cx(
                "flex min-h-13 w-full items-center gap-3 rounded-[0.75rem] px-4 py-3 text-left text-base font-medium",
                "transition-[background-color,box-shadow,color] duration-150 ease-out",
                selected
                  ? "bg-brand-600 text-white shadow-[0_1px_2px_rgb(10_86_176/0.25),0_4px_12px_-4px_rgb(10_86_176/0.45)]"
                  : "bg-surface text-ink ring-1 ring-line-strong ring-inset hover:bg-brand-50 hover:ring-brand-300 active:bg-brand-100",
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "grid size-5 shrink-0 place-items-center rounded-full",
                  selected ? "bg-white text-brand-700" : "ring-1 ring-line-strong ring-inset",
                )}
              >
                {selected && <IconCheck size={13} strokeWidth={2.5} />}
              </span>
              {labels[option - 1]}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-7">
      <div className="relative grid grid-cols-5 rounded-[0.875rem] bg-surface p-1 ring-1 ring-line-strong ring-inset">
        {/* Sliding thumb: one tile wide, moved by whole tile widths. It mounts on
            the first pick (fading in at its place), then slides between values. */}
        {value !== null && (
          <span
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/5)] rounded-[0.625rem] bg-brand-600",
              "shadow-[0_1px_2px_rgb(10_86_176/0.25),0_4px_12px_-4px_rgb(10_86_176/0.45)]",
              "transition-[translate,scale,opacity] duration-200 ease-out-soft starting:scale-90 starting:opacity-0",
            )}
            style={{ translate: `${(value - 1) * 100}% 0` }}
          />
        )}
        {SCALE.map((option) => {
          const selected = value === option;
          // Hairline between tiles, hidden next to the selected one.
          const divider = option > 1 && value !== option && value !== option - 1;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              aria-label={`${option} – ${labels[option - 1]}`}
              onClick={() => onChange(option)}
              className={cx(
                "group relative z-10 h-14 rounded-[0.625rem] text-xl font-semibold tabular-nums",
                "transition-colors duration-150 focus-visible:z-20",
                selected ? "text-white" : "text-ink hover:bg-brand-50 active:bg-brand-100",
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "absolute inset-y-3 -left-px w-px bg-line transition-opacity duration-150",
                  divider ? "opacity-100" : "opacity-0",
                )}
              />
              <span
                className={cx(
                  "inline-block transition-transform duration-200 ease-out-soft",
                  selected ? "scale-110" : "group-active:scale-95",
                )}
              >
                {option}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex justify-between gap-4 text-xs text-muted" aria-hidden="true">
        <span className="max-w-[40%]">{labels[0]}</span>
        <span className="max-w-[40%] text-right">{labels[4]}</span>
      </div>
      {/* The meaning of the chosen number, so that 2 or 4 is not a guess. */}
      <p className="mt-2 min-h-5 text-center text-sm font-medium text-brand-700" aria-live="polite">
        {value !== null ? labels[value - 1] : ""}
      </p>
    </div>
  );
}

function StepButtons({ children }: { children: ReactNode }) {
  return <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row">{children}</div>;
}

export function FillBackLink() {
  return (
    <Link
      href="/"
      transitionTypes={BACK}
      className="-ml-1 mt-8 inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-sm font-medium text-brand-700 hover:text-brand-900"
    >
      <IconChevronLeft size={16} />
      {t.fill.backToSurveys}
    </Link>
  );
}

/** Round that cannot be filled in (already submitted or closed). */
export function FillNotice({
  kind = "closed",
  title,
  text,
}: {
  kind?: "already" | "closed";
  title: string;
  text: string;
}) {
  return (
    <Panel className="animate-rise px-6 py-10 text-center sm:px-10">
      <span
        className={cx(
          "mx-auto grid size-12 place-items-center rounded-full",
          kind === "already" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-muted",
        )}
      >
        {kind === "already" ? <IconCheck size={24} /> : <IconInfo size={24} />}
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-[-0.015em] text-ink">{title}</h1>
      <p className="mx-auto mt-1.5 max-w-sm text-[0.9375rem] leading-relaxed text-ink-soft">{text}</p>
    </Panel>
  );
}
