# Frontend report – Agent 2 (Frontend Testing Specialist), session 2026-11-12_001

## 1. Scope
Areas A–G from TESTING_RULES.md (Agent 2) on branch `feat/ui-asseco-theme` (commit 8dfeeb1), against the running dev server http://localhost:3000. These were tested:

- **A Navigation:** the nav items for each role (employee, manager, HR), every route opened by direct URL and by refresh, the 403 and 404 routes, Back/Forward, rapid clicking, slow navigation, the active pill, the logo link, back links, logout and redirects for anonymous users.
- **B Components:** buttons, ConfirmDialog, toasts (stacking, auto-dismiss, close), round lists and cards, the HR summary cards, kudos tabs, empty states, the status select and the motion popover. **Search, filters and pagination: N/A.** They do not exist in this MVP.
- **C Forms:** login, new round, fill wizard, action ("krok") and kudos. Covered: missing, invalid and boundary values (3–5 questions, 19/20/500 chars, 1000-char comment, 120-char names), special characters, HTML/script injection text, emoji, long unbroken words, repeated and double submits, pending states, 500 and network errors, 409 (second tab) and stale state.
- **D Animations:** confetti (fill and kudos), page view transitions and their direction, the dialog, popover and toast animations, the nav pill, scale thumb, tab indicator and CountUp. Also OS `reducedMotion: reduce`, the in-app "Animácie" menu (incl. cross-tab sync and the "Zapnuté" override) and a CLS measurement with a PerformanceObserver.
- **E Responsive:** widths 1440, 1280, 1024, 768, 390 and 360 on 9 pages × 3 roles. Checked: horizontal overflow, off-screen elements, overlapping header items, clipped text, nav behaviour, modal and popover position, tap targets.
- **F Visual:** screenshots were reviewed (see section 7) for spacing, typography, logo rendering, icons and overlaps.
- **G Accessibility:** axe-core 4.10.2 on 10 pages, keyboard-only flows (skip link, tabs, scale, dialog, popover, chips), visible focus, labels, `aria-invalid`, live regions, contrast calculation, headings, `<title>`, the AX tree.

## 2. Method
- Playwright 1.49.1 drove Microsoft Edge (`channel: "msedge"`). Locale was sk-SK, viewport 1280×860 unless stated otherwise.
- Scripts are in `C:\Users\OLIVER~1.SEE\AppData\Local\Temp\claude\8592154cc8ab258b\cb264c66-a0dc-4ee1-877a-d3b62538e8e4\scratchpad\e2e\fe\`: nav.js, round.js, round2.js, fill.js, results.js, kudos.js, visual.js, misc.js, skip.js, plus probes. Raw results are in `results-*.json`, axe output in `axe-*.json`, screenshots in `shots\`.
- I created all my own data with the prefix FE- and did no reseed:
  - Rounds: FE-Beta-1 (4 questions; filled by 5 Beta employees; then closed), FE-Alfa-1 (filled by adam and manazer.alfa, 2 responses, closed → below the threshold), FE-Beta-draft-409, FE-Beta-focus, FE-Beta-focus2 (all closed).
  - Actions: FE-Retro and FE-Dlhátéma….
  - Kudos: cyril→dana (private), cyril→emil (public), hr→dana.
- Server errors (500), network aborts and slow responses were simulated with `page.route` in the browser only. No server data was changed this way.
- Console errors and page errors were captured for every page.

## 3. Counts
| | Count |
|---|---|
| Executed test attempts (assertions with a recorded result) | **441** |
| Passed | **417** |
| Failed | **23** (→ 11 distinct confirmed defects) |
| Blocked | **1** (empty kudos state for ivana; covered instead by a passing test for barbora) |

The full list is in `TEST_CASES_FRONTEND.md`.

**About the count:** the 54 responsive checks are distinct (page × width × role) conditions, not one check repeated.

**Re-classified tests:** 14 raw script failures were re-classified after analysis, and each reason is stated in the test case table:
- some were script artefacts and were re-tested;
- some were dev-only effects (React StrictMode double confetti mount);
- some match expected behaviour in mvp.md (redirect to the role's home after login; 403 for unknown IDs for non-HR roles).

## 4. Confirmed defects

### FE-001 – 404 page is the unstyled Next.js default in English, with no way back
- **Phase:** Frontend · **Page/component:** every unknown route (`/neexistuje`, `/rounds`, `/team`, `/hr`, `/kudos/xyz`), and unknown IDs for HR (`/rounds/<bad>/results` → `notFound()`); `src/app` has no `not-found.tsx`.
- **Description:** a missing route shows "404 | This page could not be found." It is in English, without the app shell, logo, Outfit font or any link. This violates NFR-07 (UI in Slovak, texts in one file) and leaves the user stuck.
- **Steps:** log in as any user → open http://localhost:3000/neexistuje.
- **Expected:** a Slovak 404 page in the app style with a link home (like the 403 page "Sem nemáš prístup").
- **Actual:** the default English page; there are 0 links on the page.
- **Severity:** MEDIUM (requirement NFR-07 violated; usability dead end).
- **Evidence:** `…\fe\shots\404-neexistuje.png`; FE-T054–T057, T061, T062 (body text "404 This page could not be found.", links=0).
- **Reproduction:** 100% (5/5 routes).
- **Functionality change if fixed:** No. It is a pure UI fix: add `src/app/not-found.tsx` with texts in `texts.sk.ts`.

### FE-002 – Keyboard focus is lost to `<body>` after confirming "Spustiť" / "Uzavrieť"
- **Phase:** Frontend (accessibility) · **Page/component:** `RoundTransitionButton` + `ConfirmDialog` in `ManagedRoundList` (manager `/`, HR `/hr/rounds`).
- **Description:** after confirmation, `router.refresh()` replaces the DRAFT row's "Spustiť" button with a new "Uzavrieť" component, and then the CLOSED row has none. The trigger that focus should return to is unmounted, so `document.activeElement` becomes BODY. A keyboard or screen-reader user loses their place in a long list.
- **Steps:** as manazer.beta, focus "Spustiť" on a draft → Enter → Tab → Enter (confirm) → wait 2 s → check the active element.
- **Expected:** focus moves to the new action ("Uzavrieť"/"Výsledky") or to the row.
- **Actual:** `{"tag":"BODY"}`, both for "Spustiť" and for "Uzavrieť".
- **Severity:** MEDIUM (broken keyboard interaction in the core flow).
- **Evidence:** FE-T130, T135, T136 (round.js, round2.js).
- **Reproduction:** 3/3.
- **Functionality change if fixed:** No. It is a pure fix: manage focus after refresh.

### FE-003 – Console error on every 403 page ("Encountered a script tag while rendering React component"), shown as a red "1 Issue" badge in the demo
- **Phase:** Frontend · **Page/component:** `forbidden()` pages; the cause is the inline `<script dangerouslySetInnerHTML={MOTION_INIT_SCRIPT}>` in `src/app/layout.tsx`, which React re-renders on the client when the forbidden boundary renders.
- **Steps:** log in as barbora.alfa → open `/hr/rounds`.
- **Expected:** a clean console.
- **Actual:** `console.error: Encountered a script tag while rendering React component…`, logged once per 403 render for every role. `npm run demo` runs `next dev`, so the Next dev indicator shows a red "1 Issue" badge on screen during a demo of the permission check (acceptance step 3).
- **Severity:** LOW. The page works, and the motion script already ran at first load.
- **Evidence:** `…\fe\shots\forbidden-emp.png` (red "1 Issue" badge); `results-nav.json` issues for nav-emp, nav-mgr and nav-hr; probe2.js output.
- **Reproduction:** 100%.
- **Functionality change if fixed:** No. It is a pure fix, e.g. `next/script` `beforeInteractive`, or render the script only on the server.

### FE-004 – Long unbroken action topic is clipped (cut off) at every width
- **Phase:** Frontend · **Page/component:** `ActionList` h3 `action.topic` (`src/components/action-list.tsx`). It has no `break-words`/`min-w-0` wrap, and the parent `InsetList` clips the overflow. Seen on results and on the team page.
- **Steps:** as manager, add a krok with the topic "FE-" + "Dlhátémabezmedzier"×6 (≤120 chars, allowed) → view the results at 360 px and at 1280 px, and the team page.
- **Expected:** the topic wraps (as the description does with `break-words`).
- **Actual:** the text is cut off at the right edge; scrollWidth 932 > clientWidth 264 (360 px) and 688–728 (1280 px).
- **Severity:** LOW.
- **Evidence:** `…\fe\shots\results-actions-360.png`; FE-T298, T308, T343, T353.
- **Reproduction:** 100%.
- **Functionality change if fixed:** No. It is a pure CSS fix.

### FE-005 – Action form validation does not show which field is wrong
- **Phase:** Frontend · **Page/component:** `ActionForm` (results page, "Pridať krok").
- **Description:** each 400 response shows the same sentence, "Vyplň tému, čo sa urobí a platný termín." No field gets `aria-invalid` or the red ring. The other forms do mark fields: new round marks them, and kudos marks them and adds per-field messages.
- **Steps:** submit an empty form, then a form with only the topic filled.
- **Expected:** the missing fields are highlighted, consistent with the other forms.
- **Actual:** topic `aria-invalid=null`; the same generic message both times.
- **Severity:** LOW (incorrect/unclear validation feedback).
- **Evidence:** `…\fe\shots\action-empty-submit.png`; FE-T218 and the following row.
- **Reproduction:** 100%.
- **Functionality change if fixed:** No. The UI should read `fields` from the 400 response that the API already returns.

### FE-006 – New round form validates in two steps
- **Phase:** Frontend · **Page/component:** `NewRoundForm`.
- **Description:** if fewer than 3 questions are selected, only the question error is shown and nothing is sent. Name and date errors appear only after a second submit. The user fixes one error and immediately gets new ones.
- **Steps:** on `/rounds/new`, click "Uložiť koncept" with everything empty.
- **Expected:** all errors (name, date, questions) at once.
- **Actual:** only "Vyber 3 až 5 otázok."; after selecting questions and submitting again: "Zadaj názov kola…" and "Zadaj dátum uzávierky…".
- **Severity:** LOW (usability).
- **Evidence:** `…\fe\shots\round-new-empty-submit.png`; FE-T095.
- **Reproduction:** 100%.
- **Functionality change if fixed:** No. Only the client-side check changes; server rules stay the same.

### FE-007 – Field error messages are not programmatically linked to their inputs
- **Phase:** Frontend (accessibility) · **Page/component:** `Field`/`FieldError` (`src/components/ui/field.tsx`), used by new round and kudos.
- **Description:** errors use `role="alert"`, so they are announced once. The inputs have no `aria-describedby`/`aria-errormessage`, so a screen-reader user who tabs back to the field does not hear the error (WCAG 3.3.1/1.3.1).
- **Steps:** submit new round with an empty name → inspect `input[name=name]`.
- **Expected:** `aria-describedby` points to the error.
- **Actual:** `null` (while `aria-invalid=true` is set).
- **Severity:** LOW.
- **Evidence:** FE-T108.
- **Reproduction:** 100%.
- **Functionality change if fixed:** No.

### FE-008 – No loading feedback during slow page navigation
- **Phase:** Frontend · **Page/component:** app shell. There is no `loading.tsx`, and nav links show no pending state.
- **Steps:** delay RSC responses by 1.5 s (`page.route`) → click "Kudos" in the nav.
- **Expected:** a visible indicator (spinner, skeleton or pending link).
- **Actual:** after 300 ms the URL is still `/`, there is no `aria-busy` and no spinner. The page looks frozen until the response arrives. A second click does win correctly (FE-T081 passed).
- **Severity:** LOW. In the local demo responses are fast; on a slower server users may click repeatedly.
- **Evidence:** FE-T080 (`{"ariaBusy":false,"spinner":false,"path":"/"}`).
- **Reproduction:** 100% with throttling.
- **Functionality change if fixed:** No.

### FE-009 – Every page has the same `<title>` "Feedback portál"
- **Phase:** Frontend (accessibility) · **Page/component:** root `metadata` only; pages export no title.
- **Description:** browser tabs, history and screen readers cannot tell the pages apart (WCAG 2.4.2).
- **Steps:** open `/`, `/rounds/new`, `/rounds/:id/results`, `/kudos`.
- **Expected:** titles like "Nové kolo – Feedback portál".
- **Actual:** "Feedback portál" everywhere.
- **Severity:** LOW.
- **Evidence:** FE-T389, T391, T393, T395.
- **Reproduction:** 100%.
- **Functionality change if fixed:** No.

### FE-010 – Heading level skips from h1 to h3
- **Phase:** Frontend (accessibility) · **Page/component:** `MySurveyList` round names (h3 directly under the page h1) on employee and manager `/`; `ManagedRoundList` on `/hr/rounds` (h3 rows with no h2).
- **Steps:** run axe on `/` (employee and manager) and on `/hr/rounds`.
- **Expected:** no skipped heading levels.
- **Actual:** axe `heading-order` (moderate) on 3 pages; custom check `skipped:1`.
- **Severity:** LOW.
- **Evidence:** `…\fe\axe-emp-home.json`, `axe-mgr-home.json`, `axe-hr-rounds.json`; FE-T388.
- **Reproduction:** 100%.
- **Functionality change if fixed:** No.

### FE-011 – Animation menu popover detaches from its button after a window resize
- **Phase:** Frontend · **Page/component:** `MotionMenu`. `place()` runs only on `beforetoggle`, and the popover is `position: fixed`.
- **Steps:** at 1280 px open "Nastavenie animácií" → resize the window to 900 px while the menu is open.
- **Expected:** the menu stays under its button, or closes.
- **Actual:** the menu's right edge is at 627 px and the button's right edge at 755 px; the panel floats over the header.
- **Severity:** LOW (minor visual).
- **Evidence:** `…\fe\shots\motion-menu-after-resize.png`; FE-T385.
- **Reproduction:** 100%.
- **Functionality change if fixed:** No.

**Severity distribution:** CRITICAL 0 · HIGH 0 · MEDIUM 2 (FE-001, FE-002) · LOW 9.

## 5. Potential risks (not confirmed defects)
- **R-01:** after login the user always lands on the role's home; a deep link such as `/kudos?tab=send` is lost. This is expected per MVP-01, but it is inconvenient for shared links.
- **R-02:** `npm run demo` runs the dev server, so the Next "N" dev indicator and any dev error badge (FE-003) are visible to management. Consider `npm run build && npm start` for the demo.
- **R-03:** login and new-round inputs use native browser validation. Messages appear in the browser UI language (English on this machine: "Please include an '@'…"), not in Slovak texts.sk.ts.
- **R-04:** the date input shows the browser format (mm/dd/yyyy on an English Edge) despite `lang="sk"`.
- **R-05:** tap targets in the mobile header are 32–36 px high (logout 40×32, motion 36×36). That meets WCAG 2.5.8 AA (≥24 px) but is below the 44 px guideline.
- **R-06:** for non-HR users an unknown round or team ID returns 403 instead of 404. This is intentional anti-enumeration, but the 403 text "nie je dostupná pre tvoju rolu" is misleading for a mistyped link.
- **R-07:** an action ("krok") accepts a due date in the past (FE-Retro was saved with 1. 1. 2020). mvp.md has no rule for this, so it is informational.
- **R-08:** text length counts UTF-16 units, the same on client and server. An emoji counts as 2 (260 emoji → 250 kept, counter 500/500). This is consistent, but users may find it surprising.
- **R-09:** toasts do not pause on hover (3.5 s). A reader with motor or reading difficulties may miss "Kolo je spustené".
- **R-10:** the team timeline is ordered by deadline (`closesAt`), not by when the round was actually closed. A round closed early can appear below one that closed later.
- **R-11:** the placeholder colour (slate-400) is low-contrast. The automated read of `::placeholder` returned an inherited value, so this is not verified.
- **R-12:** the employee "Moje prieskumy" list and the manager list share the same round names. Rounds whose names differ only in suffix ("FE-Beta-focus" and "FE-Beta-focus2") are hard to tell apart; this depends on the data.
- **Dev-only, not defects:** confetti mounts twice under React StrictMode (the first canvas is removed at once); the Next "N" indicator; StrictMode double effects.

## 6. What worked well (high-value passes)
- Every role's nav matches the permission matrix. The active pill is correct after clicks, refresh, Back/Forward, rapid clicking (5 clicks in a row) and resizes. On 360/390 px the active item scrolls into view.
- All forbidden direct URLs return the Slovak 403 page with HTTP 403. Anonymous users are redirected to /login. After logout, Back does not show protected content.
- **Fill wizard:**
  - Shows the exact NFR-04 text; the word "anonym" appears nowhere.
  - Shows progress as "n z 4". Back and forward keep the answers and the comment.
  - Caps the comment at 1000 characters, with an amber counter above 900.
  - On 500 it shows an inline error. A double click sends only one POST. A second tab gets the "už máš vyplnené" view.
  - Confetti fires only after the 201 and does not block clicks. Layout shift (CLS) was 0.
  - At 360 px: no overflow, and scale tap targets are 56×56 px.
- **Reduced motion** works:
  - OS reduce, the in-app "Obmedzené" option, the "Zapnuté" override, persistence and cross-tab sync all behave correctly.
  - Under reduce there is no confetti, CountUp shows the final value, and the pill does not slide.
- **Page transitions** use `nav-forward`/`nav-back` correctly. The header is a still group, and a navigation finishes in about 0.7 s.
- **ConfirmDialog:** focuses "Zrušiť" on open, closes with Esc, a backdrop click or "Zrušiť", traps focus inside, sits correctly at 360 px, blocks double triggering while pending, and handles the stale-state 409.
- **Kudos:**
  - Tabs follow the ARIA pattern (roving tabindex, Arrow/Home/End keys, URL sync).
  - Validation boundaries at 19 and 20 characters, with trimmed counting.
  - The live preview renders HTML-like text literally.
  - Success, pending, 500 and the "Máš 1 nové kudos" moment all work, and the empty state works.
  - Private kudos never appear in the team feed.
- **Injection:** every user string with HTML/script (round name, comment, action, kudos) was rendered as literal text.
- **axe-core:** 0 serious or critical violations on 10 pages. Measured contrast: muted text 5.28:1, primary button 4.81:1.
- **Responsive:** no horizontal scroll, off-screen content or header overlap on 9 pages × 6 widths, apart from FE-004.

## 7. Screenshots reviewed (evidence)
All are in `C:\Users\OLIVER~1.SEE\AppData\Local\Temp\claude\8592154cc8ab258b\cb264c66-a0dc-4ee1-877a-d3b62538e8e4\scratchpad\e2e\fe\shots\`:
- 404-neexistuje.png (FE-001)
- forbidden-emp.png (FE-003 badge)
- results-actions-360.png (FE-004)
- motion-menu-after-resize.png (FE-011)
- resp-360-mgr-home.png
- fill-360-q1.png
- kudos-sent-1280.png

There are also about 60 more (resp-{1440,768,360}-*, fill-*, dialog-open-*, kudos-*, login-*). The sticky header that appears mid-page in full-page screenshots is a Playwright stitching artefact, not a bug.

## 8. Gaps
- Not covered: real touch gestures beyond Playwright `tap`, real screen readers (NVDA/JAWS), Firefox/Safari (only Edge/Chromium), CPU-throttled animation performance (only CLS and duration were measured), the production build (`next start`), and the automatic close of a round after its deadline as seen in the UI. Keyboard-only coverage was spot-checked on the main flows, not on every screen.
- FE- data remains in the shared database. There is no delete UI, and I did not reseed per the rules: rounds FE-Beta-1, FE-Alfa-1, FE-Beta-draft-409, FE-Beta-focus and FE-Beta-focus2 (all closed), actions FE-Retro and FE-Dlhátéma…, and 3 FE kudos.
