// Shared handling of free text typed by users (QA 2026-11-12: BE-006, BE-007).

// Characters that take no space on screen and are not part of an emoji.
// ZWJ (U+200D) and ZWNJ (U+200C) are kept: emoji sequences and some scripts need them.
const INVISIBLE = /[​⁠﻿­]/g;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
// Whitespace and joiners only — nothing a reader could see.
const NOTHING_VISIBLE = /^[\s‌‍]*$/;

/**
 * Text as it should be validated and stored: invisible and control
 * characters removed, trimmed. Anything that is not a string, and text with
 * nothing visible in it, becomes "".
 */
export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.replace(INVISIBLE, "").replace(CONTROL, "").trim();
  return NOTHING_VISIBLE.test(text) ? "" : text;
}

/**
 * Length in characters as people count them (Unicode code points), not in
 * UTF-16 units — one emoji is one character, not two. SQLite's length(),
 * used by the CHECK on Response.comment, counts the same way.
 */
export function charLength(text: string): number {
  let count = 0;
  for (const _ of text) count++; // eslint-disable-line @typescript-eslint/no-unused-vars
  return count;
}
