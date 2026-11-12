# Fixes – system test 2026-11-12_001

Commit `ea1e7e1` on branch `feat/ui-asseco-theme` (local, not pushed). Frontend fixes in detail: see the second part of this file (from the frontend fixer's record).

## Backend fixes (lead)

### BUG-001 (BE-001 / INT-003) – logout invalidates the session on the server
- **Approved by the user** before fixing (it adds one column to the data model).
- **Files:** `prisma/schema.prisma` (`User.sessionVersion Int @default(0)`), new migration `prisma/migrations/20261112180000_session_version/migration.sql` (`ALTER TABLE "User" ADD COLUMN …` – the NFR-01 tables `Response`/`Participation` are untouched), `src/lib/session.ts` (token carries `sv`; `loadSessionUser` rejects a version mismatch; new `revokeSessions`), `src/app/api/logout/route.ts`, `src/app/api/login/route.ts`, `src/server/auth.ts`.
- **Behavior:** logout increments the user's session version → every token issued before stops working. Side effect: logout signs the user out on all devices. Old tokens without `sv` count as version 0 (no forced logout on deploy).
- **Retest:** new vitest `logout invalidates the token on the server … [BE-001]` (pass). Live with curl on :3000: `/api/me` before logout 200 → logout 200 → replay of the copied cookie 401, `/kudos` 307 → `/login` → fresh login 200. Permission matrix test adjusted so its logout row resets the version afterwards (the matrix checks access, not session lifetime).

### BUG-006 (BE-002) and BUG-007 (BE-003) – text length rules
- **Files:** new `src/lib/text-length.ts` (`charCount` = Unicode code points; `visibleLength` ignores zero-width/format characters), used in `src/server/kudos.ts`, `rounds.ts`, `actions.ts`, `responses.ts`.
- **Behavior:** maximum lengths count characters (consistent with SQLite `length()` used by the Response CHECK constraint); "required" and minimum lengths count only visible characters; a comment of only invisible characters is stored as no comment. Normal text behaves exactly as before.
- **Retest:** new vitest cases: 10 emoji rejected (too short), only zero-width rejected, 10 letters + zero-width rejected, 501 emoji rejected, 260 and 500 emoji accepted (all pass).

## Verification after all fixes
| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0, no warnings |
| `npm test` | 10 files, 138 tests passed (132 before + 6 new regression tests) |
| `npm run acceptance` (fresh seed, dev :3000) | ALL PASSED |
| `npm run build` (commit ea1e7e1, separate worktree) | success, 26 routes |
| `npm run acceptance` against the production build (:3002) | ALL PASSED |
| Production console check (Edge): `/`, `/kudos`, 403, 404 | no app errors; only the browser's network log of the intentional 403/404 responses |
| Frontend retest (Edge, Playwright) | 40/40 + 19/19 + 2/2 pass |

## Remaining issues
- BUG-002 (INT-002) open – needs a product-owner decision (see RELEASE_READINESS.md).
- Risks listed in SUMMARY.md were not changed (not defects under mvp.md, or would change functionality).

---

## Frontend fixes – session 2026-11-12_001 (Phase 4/5, frontend fixer)

Branch `feat/ui-asseco-theme`, uncommitted. These are UI-only fixes. No API URL, request body, form field name, permission, routing or schema changed. All new texts are in `src/lib/texts.sk.ts`. `grep -i anonym src` finds nothing.

**Checks:**
- `npx tsc --noEmit`: exit 0.
- `npx eslint src`: 0 errors. The only warning is `_version` in `src/lib/session.ts`, the lead's backend file, not part of this work.

**Retest:**
- Playwright 1.49 with Edge (`channel: "msedge"`) against the running dev server on :3000.
- Scripts are in `C:\Users\OLIVER~1.SEE\AppData\Local\Temp\claude\8592154cc8ab258b\cb264c66-a0dc-4ee1-877a-d3b62538e8e4\scratchpad\e2e\fix\`:
  - `retest.js`: 40 assertions, all pass. The `emp` section was re-run after the last change: 19/19.
  - `kudos-reg.js`: regression of the shared `Field`, 2/2 pass.
- Screenshots are in the same folder.
- **Test data created:** rounds `FX-focus-*`, `FX-closed-*` and `FX-open-*` in team Beta (2 runs). There is also one action `FX-Dlhátéma…` per run. No reseed was done.

| ID | Status | Retest |
|---|---|---|
| FE-001 | Fixed | PASS |
| FE-002 | Fixed | PASS |
| FE-003 | Fixed | PASS |
| FE-004 | Fixed | PASS |
| FE-005 | Fixed | PASS |
| FE-006 | Fixed | PASS |
| FE-007 | Fixed | PASS |
| FE-008 | Fixed | PASS |
| FE-009 | Fixed | PASS |
| FE-010 | Fixed | PASS |
| FE-011 | Fixed | PASS |
| INT-001 | Fixed (text only) | PASS |
| INT-004 | Fixed | PASS |

---

### FE-001 – Slovak 404 page
- **Files:** `src/app/not-found.tsx` (new), `src/lib/texts.sk.ts` (`errors.notFoundTitle/Text/Code`).
- **Fix:** the 404 page now matches `forbidden.tsx`: centred icon, h1 "Stránka neexistuje", an explanation, the "Späť na úvod" button (`/`) and "Chyba 404". Its title is "Stránka neexistuje · Feedback portál".
- **Retest:** `/neexistuje` returns HTTP 404, the Slovak h1, a link to `/` and the correct `<title>`. Screenshot: `fe001-404.png`.

### FE-002 – Focus lost after Spustiť / Uzavrieť
- **Files:** `src/components/round-transition-button.tsx`, `src/components/round-list.tsx`.
- **Fix:**
  - The row is marked `data-round-row`, the actions cell `data-round-actions` and the round name `data-round-heading` (with `tabIndex={-1}`). The button wrapper is marked `data-round-transition`.
  - After a successful POST, and before `router.refresh()`, a `MutationObserver` watches the row. Once the old trigger leaves the DOM, focus moves to the first match in this order:
    1. the new transition button ("Uzavrieť");
    2. the first action ("Výsledky");
    3. the round name.
  - Focus moves only if it fell to `<body>`, so it never takes focus from an element the user chose. The observer stops after 10 s.
  - Error paths (409, 500) are unchanged: focus stays on the trigger.
- **Retest:** as manazer.beta, keyboard only (Enter → Tab → Enter):
  - after "Spustiť", focus is on "Uzavrieť" in the same row;
  - after "Uzavrieť", focus is on "Výsledky" in the same row.

### FE-003 – "Encountered a script tag" console error on 403/404
- **Files:** `src/components/motion-init-script.tsx` (new), `src/app/layout.tsx`.
- **Docs read:** `next/dist/docs/.../components/script.md`. I also read the next/script source. `strategy="beforeInteractive"` with inline code is queued in `self.__next_s` and run by the Next runtime, so it runs after the first paint and would cause a motion flash. I therefore did not use it.
- **Fix:**
  - A client component renders the same inline `<script>`. In the server HTML it has no `type`, so the browser runs it during parsing, before the first paint. That is unchanged.
  - When React renders it on the client, it gets `type="text/plain"`. React never runs client-rendered scripts, and it does not warn for a data block. `suppressHydrationWarning` covers the deliberate difference in `type`.
- **Found while retesting:** for 403 the server returns Next's client-rendered error shell (`<html id="__next_error__">`). So the bootstrap never ran on 403 pages, and `data-motion` was missing there, also before this change. The in-app "Obmedzené" setting was therefore ignored on 403.
  - A mount effect now injects the same bootstrap with a DOM-created script, but only when `data-motion` is missing. On normal pages the attribute already exists, so nothing runs twice.
- **Retest:**
  - The SSR HTML still contains an executable `<script>(function(){var d=document.documentElement…`.
  - `data-motion="full"` is set on `/`.
  - `/neexistuje` (404) and `/hr/rounds` as employee (still HTTP 403) log no "Encountered a script tag" error.
  - `data-motion` is present on both pages.
  - With in-app "reduced", `data-motion="reduce"` is set on the 403 page and on `/`.
  - No hydration warning appears on normal pages.

### FE-004 – Long action topic clipped
- **Files:** `src/components/action-list.tsx` (h3 `break-words`), `src/app/(app)/team/[id]/page.tsx` (timeline round name h2 `break-words`).
- **Retest:** a 111-character topic with no spaces wraps:
  - results page at 360 px: scrollWidth 296 = clientWidth 296;
  - results page at 1280 px: 728 = 728;
  - team page at 360 px: 264 = 264.
  - There is no horizontal page scroll. Screenshots: `fe004-results-360.png`, `int001-team-360.png`.

### FE-005 – Action form: field-level errors
- **Files:** `src/components/action-form.tsx`, `src/lib/texts.sk.ts` (`actions.fieldErrors`).
- **Fix:**
  - The API already returns `{ error: "validation_error", fields: {topic, description, dueDate, status} }` (`src/server/actions.ts`, `src/lib/errors.ts`; read only).
  - On a 400 the form maps these fields to per-field messages. Through `Field` they also get `aria-invalid` and `aria-describedby`.
  - A 400 without `fields` (e.g. `invalid_json`) still shows the old summary `actions.invalid`.
  - The request is unchanged.
- **Retest:**
  - An empty submit marks topic, description and date, each with its own message.
  - A submit with only the topic marks just description and date.
  - A valid submit clears all field errors and adds the step.

### FE-006 – New round: all errors at once
- **File:** `src/components/new-round-form.tsx`.
- **Fix:**
  - The client no longer stops early when fewer than 3 questions are selected. The same `POST /api/rounds` request (same URL and body) is sent, and the server validates every field.
  - The `fields` from the 400 are shown together. `questionIds` is also marked whenever the client-side count is outside 3–5.
  - No round can be created with an invalid count, because the server rejects it.
- **Retest:** an empty submit shows the name, date and "Vyber 3 až 5 otázok." errors at the same time. Screenshot: `fe006-new-round-empty.png`.

### FE-007 – Errors linked to inputs
- **File:** `src/components/ui/field.tsx`.
- **Fix:**
  - `Field` creates ids with `useId` for the hint and the error, and clones its single control child. The clone gets `aria-describedby` (merged with any existing value) and `aria-invalid={true}` when there is an error, unless the control sets `aria-invalid` itself.
  - `FieldError` accepts `id`.
- **Retest:**
  - New round: `input[name=name]` has `aria-invalid="true"` and is described by "Zadaj názov kola…".
  - Kudos regression: the textarea is described by its hint "20 až 500 znakov.", and the recipient select has an invalid flag and a linked error after an empty submit.
  - Action form: see FE-005.

### FE-008 – Pending indicator on slow navigation
- **File:** `src/components/app-nav.tsx`.
- **Docs read:** `next/dist/docs/.../functions/use-link-status.md`.
- **Fix:**
  - A `NavPendingHint` child inside each nav `<Link>` uses `useLinkStatus()`. It is a fixed-size 2 px brand bar at the bottom of the link, always rendered, so there is no layout shift.
  - Only its opacity changes, with a 150 ms delay so fast navigations do not flash. It pulses (opacity only) while pending, so it also works under reduced motion. It is `aria-hidden`.
  - No `loading.tsx` was added.
- **Retest:** RSC responses were delayed by 1.5 s with `page.route`. 500 ms after clicking "Kudos" the hint opacity was about 0.7 while the URL was still `/`. After the navigation finished, it was 0.

### FE-009 – Per-page `<title>`
- **Files:**
  - `src/app/layout.tsx`: `title: { template: "%s · Feedback portál", default: "Feedback portál" }`.
  - `metadata` exports in `(app)/page.tsx`, `hr/rounds`, `kudos`, `rounds/new`, `rounds/[id]/results`, `rounds/[id]/fill`, `team/[id]`, `login`, and `not-found.tsx`.
  - `src/lib/texts.sk.ts`: new `meta.fill` "Vyplnenie prieskumu". All other titles reuse existing texts.
  - The results page uses the static "Výsledky kola", so no extra data fetch or permission check is needed for metadata.
- **Retest:** all of these titles were checked, e.g. "Moje prieskumy · Feedback portál", "Nové kolo · …", "Výsledky kola · …", "Povedali ste, urobili sme · …" (also after client-side navigation), "Vyplnenie prieskumu · …", "Kudos · …", "Prehľad kôl · …" and "Stránka neexistuje · …".

### FE-010 – Heading levels
- **Files:** `src/components/round-list.tsx`, `src/app/(app)/hr/rounds/page.tsx`.
- **Fix:**
  - `MySurveyList` round names are now `h2`, since they sit directly under the page h1.
  - `ManagedRoundList` has a new `headingLevel` prop (default 3, used inside a Section). `/hr/rounds` passes 2.
  - The look is unchanged.
- **Retest:** a heading-order check finds 0 skipped levels on `/` (employee), `/` (manager) and `/hr/rounds`.

### FE-011 – "Animácie" popover drifts on resize
- **File:** `src/components/motion-menu.tsx`.
- **Fix:** `place()` became a module function. A `resize` listener moves the panel back under the button while it is `:popover-open`.
- **Retest:** with the menu opened at 1280 px and the window resized to 900 px, the panel's right edge is at 755 and the button's at 754.7. Screenshot: `fe011-after-resize.png`.

### INT-001 – Team page says "Uzavreté <deadline>"
- **Files:** `src/app/(app)/team/[id]/page.tsx` (`t.rounds.deadline(...)`), `src/lib/texts.sk.ts` (removed the now unused `team.closed`).
- **Fix:** the timeline now shows "Uzávierka <date>", which is true for rounds closed early too. No schema change.
- **Retest:** as gabriela.beta, the team page shows "Uzávierka 20. 12. 2026…" and no "Uzavreté <date>" anywhere.
- **Note:** the ordering issue (INT-002, R-10) is not touched.

### INT-004 – Session lost mid-questionnaire
- **Files:** `src/components/fill-wizard.tsx`, `src/lib/texts.sk.ts` (`fill.sessionExpiredTitle/Text/Link`).
- **Fix:**
  - A 401 from `POST /responses` now shows an error notice: "Prihlásenie vypršalo – Odpovede sa neodoslali. Prihlás sa znova v novej karte, potom sa sem vráť a klikni na „Odoslať“."
  - The notice has a link "Prihlásiť sa v novej karte" (`/login`, `target="_blank"`). The answers stay in this tab, and resending after a re-login works, as the integration report showed with T261.
  - 201, 409 and all other statuses are handled exactly as before.
- **Retest:** as gabriela.beta, an FX-open round was walked to the comment step, the cookies were cleared and "Odoslať" was clicked. The notice and the `/login` new-tab link appear, and the wizard stays on the comment step. Screenshot: `int004-session-expired.png`.

## Not done / notes
- Unit tests (`npm test`) were not run by me, because the lead is changing `tests/**` and the DB in parallel. The only UI-related unit test (`tests/texts.test.ts`, the NFR-04 wording) depends only on texts. The exact `fill.confidentiality` text is unchanged, and "anonym" does not appear under `src/`.
- The checks were not repeated in a production build (`next build`).
