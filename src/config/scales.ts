// Answer scales of survey questions (IT-03). Every answer is still an integer
// 1–5 in the database; a scale only decides what the five points mean.
// Labels are in src/lib/texts.sk.ts under `scales`.

export const SCALES = {
  /** 1 = strongly disagree … 5 = strongly agree. The default. */
  AGREEMENT: { higherIsBetter: true, labelEveryPoint: false },
  /** 1 = very bad … 5 = very good. Used by the fixed trend question. */
  QUALITY: { higherIsBetter: true, labelEveryPoint: false },
  /** How often overtime was needed. A higher value is worse. */
  OVERTIME: { higherIsBetter: false, labelEveryPoint: true },
  /** How often something happened, never … almost always. A higher value is worse. */
  FREQUENCY: { higherIsBetter: false, labelEveryPoint: true },
} as const;

export type ScaleKey = keyof typeof SCALES;

export const isScaleKey = (value: unknown): value is ScaleKey =>
  typeof value === "string" && Object.hasOwn(SCALES, value);

/** Unknown values fall back to the agreement scale. */
export const toScaleKey = (value: string): ScaleKey => (isScaleKey(value) ? value : "AGREEMENT");
