// Shared handling of free text typed by users (QA 2026-11-12: BUG-006, BUG-007;
// session 002: BE2-003, BE2-004).

// Format characters (Unicode category Cf) take no space on screen: zero-width
// space, soft hyphen, byte-order mark, direction marks and overrides, …
// Kept on purpose: ZWJ (U+200D) and ZWNJ (U+200C), which emoji sequences and
// some scripts need, and the tag characters used by flag emoji.
const FORMAT = /\p{Cf}/gu;
const KEPT_FORMAT = /[‌‍\u{E0020}-\u{E007F}]/u;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
// Whitespace, joiners, letters or symbols that are drawn as a blank (Hangul
// fillers, the empty braille pattern) and marks that only modify a neighbour
// (grapheme joiner, variation selectors, tag characters) — on their own there
// is nothing a reader could see.
const NOTHING_VISIBLE =
  /^[\s‌‍ᅟᅠㅤﾠ⠀͏︀-️\u{E0020}-\u{E007F}]*$/u;

/**
 * Text as it should be validated and stored: invisible and control
 * characters removed, trimmed, in one Unicode form (NFC) so that the same
 * wording typed on two keyboards compares as equal. Anything that is not a
 * string, and text with nothing visible in it, becomes "".
 */
export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value
    .replace(FORMAT, (character) => (KEPT_FORMAT.test(character) ? character : ""))
    .replace(CONTROL, "")
    .normalize("NFC")
    .trim();
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

/** The first `max` characters of a text, never cutting an emoji in half (FE2-011). */
export function limitChars(text: string, max: number): string {
  const characters = [...text];
  return characters.length > max ? characters.slice(0, max).join("") : text;
}

/**
 * Runs tasks one after another within this server process. SQLite has a
 * single writer; many write transactions started at once only wait on each
 * other until some time out (BE2-001), and a "check, then insert" sequence
 * can interleave (BE2-002). A queue per kind of write avoids both.
 */
export function serialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}
