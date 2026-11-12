// Text length rules for user input (BUG BE-002, BE-003).
//
// String.length counts UTF-16 code units, so one emoji counted as 2 and the
// limits disagreed with what users see (and with SQLite's length(), which
// counts characters). Zero-width characters are invisible, so text made only
// of them must count as empty.

const INVISIBLE = /[­​-‏⁠-⁤﻿]/g;

/** Number of characters (Unicode code points). Use for maximum lengths. */
export function charCount(value: string): number {
  return [...value].length;
}

/** Number of visible characters: invisible formatting characters do not count. Use for "required" and minimum lengths. */
export function visibleLength(value: string): number {
  return charCount(value.replace(INVISIBLE, "").trim());
}
