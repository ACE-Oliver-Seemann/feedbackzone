// Kudos rules (MVP-16). Labels of the values are in src/lib/texts.sk.ts.

export const KUDOS_VALUES = [
  "COLLABORATION",
  "QUALITY",
  "HELPING",
  "INNOVATION",
  "CUSTOMER",
] as const;
export type KudosValue = (typeof KUDOS_VALUES)[number];

export const KUDOS_VISIBILITIES = ["TEAM", "PRIVATE"] as const;
export type KudosVisibility = (typeof KUDOS_VISIBILITIES)[number];

export const KUDOS_MIN_LENGTH = 20;
export const KUDOS_MAX_LENGTH = 500;
