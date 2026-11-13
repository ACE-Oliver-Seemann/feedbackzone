# Frontend report – Agent 2 (Level 2 – Frontend)

Session `2026-11-12_002`, branch `feat/frontend-integration`, commit `cc58885` (colleague's Asseco CE redesign merged with the iteration features). Policy: `TESTING_RULES.md`. This agent tested and reported only; no application code, configuration or documentation was changed.

## 1. Result in short

- **716 tests executed: 682 passed, 34 failed, 0 blocked, 0 script errors.** A different viewport, role, route or input is a separate test; no unchanged test is counted twice. Every test has a recorded actual result (`TEST_CASES_FRONTEND.md`).
- **14 confirmed defects: 0 critical, 0 high, 1 medium, 13 low.** 11 are new (introduced or exposed by the redesign), 3 are the still-open remainders of session-001 defects (BUG-028, BUG-029, BUG-030). The 34 failed tests map to these 14 defects; nothing is unmapped.
- **The merge did not lose a feature.** Every screen and every IT-01..IT-13 function that has a UI is reachable for the right role: menus (IT-12), tabs, home tasks (IT-11), summary-first results (IT-13), suggestions (IT-09), own question (IT-07), emoji kudos (IT-06), issues and notes (IT-10), trend, heatmap and printable report (IT-08), overview (IT-05). No button without a function was found.
- No JavaScript error or failed request was logged on any screen. No horizontal page scroll on any of the 37 screen states at 320, 360, 768, 1024, 1280 and 1440 px (222 layout measurements, all passed).
- **Contrast of the new palette was measured, not estimated:** every visible text element on 23 screens was computed against its composited background; all reach WCAG AA (4.5:1, 3:1 for large text). Only the form-field borders (1.46:1) fail, which is the known open part of BUG-030.
- NFR-04 holds: `anonym…` occurs in the HTML of no screen for any role.
- The animated parts work and respect reduced motion (system setting and the in-app menu). Two deviations from IT-02 were measured: the questionnaire confetti runs about 1.9 s (limit 1.5 s) and the transition between questions is the same in both directions.
- Of the 21 frontend defects of session 001 that were fixed, **all 21 fixes survived the redesign**; three have a small remaining part (BUG-006, BUG-016, BUG-026), reported below as FE2-011, FE2-007 and FE2-009. BUG-034 (no loading hint), open in session 001, is now fixed.

The policy's investigation target of 20 defects was not reached: 14 genuine defects were found and none was invented. The redesigned UI is in clearly better shape than the old one was in session 001 (22 defects, 1 high, 3 medium).

## 2. Scope and environment

| Item | Value |
| --- | --- |
| Application | Next.js 16 production build at `http://localhost:3302` (isolated QA instance, started by the coordinator) |
| Database | `prisma/qa-frontend.db`; seed + demo data (`scripts/demo-data.ts`), reset before the mutating run and again at the end |
| Browser | Microsoft Edge (Chromium), headless, driven by `playwright-core` (`channel: "msedge"`), locale `sk-SK` |
| Viewports | 320×640, 360×740, 768×1024 (these three as touch devices: `hasTouch`, `isMobile`), 1024×768, 1280×800, 1440×900; plus 740×360 landscape |
| Accounts | Invented test accounts only (`example.test`): HR, both managers, employees of Tím Alfa and Tím Beta |
| Screens | `/login`, `/`, `/rounds`, `/rounds/new`, `/rounds/:id/fill` (intro, question, comment, thank-you, already answered, closed), `/rounds/:id/results` (open, below threshold, above threshold, with actions, draft), `/rounds/:id/report` (screen and print), `/team/:id`, `/team/:id/trend`, `/kudos` (both tabs; `/kudos/new`, `/kudos/me` redirects), `/hr/rounds`, `/hr/overview`, `/hr/heatmap`, `/hr/issues`, `/hr/notes`, 403 page, 404 page |
| Expected behaviour | `docs/requirements/iteracie.md` (IT-01..IT-13) before `docs/requirements/mvp.md` (MVP-01..17, NFR-01..07); WCAG 2.1/2.2 AA for accessibility |

### Scripts (`testing/scripts/frontend/`, all new in this session, prefix `s2-`)

`QA_PW_DIR` must point to a folder that has `node_modules/playwright-core`; no user path is hard-coded.

| Script | What it does | Changes data |
| --- | --- | --- |
| `s2-lib.mjs` | Login, recorder (`results-*.json`), id discovery, touch-target and contrast helpers | – |
| `s2-01-navigation.mjs` | No-session redirects, menus per role and width, every menu item, tabs, 57 direct URLs (19 routes × 3 roles), 403/404, active item on nested pages, back/forward, refresh, rapid clicks, slow navigation, logout | no |
| `s2-02-responsive.mjs` | 36 screen states × 6 viewports + login (page overflow, elements outside the viewport, clipped labels, console errors, HTTP status), touch targets at 360 px | no |
| `s2-03-login-fill.mjs` | Login form, questionnaire incl. confetti, motion preference, failures through request interception, double submit, keyboard-only run | yes |
| `s2-04-rounds-results.mjs` | New round, own question, sticky save bar, start/close dialogs, toasts, results, suggestions, actions, report (screen, print media, PDF) | yes |
| `s2-05-kudos-hr.mjs` | Kudos (tabs, validation, preview, celebration, recipient side, team feed), issues, notes, overview, heatmap, trend | yes |
| `s2-06-a11y-visual.mjs` | Structure, names and labels, measured contrast on 23 screens, skip link, keyboard walks, motion menu, page transitions, reduced motion, layout shift, 200 % text, NFR-04, English leftovers, titles | no |
| `s2-07-extras.mjs` | Focus under the sticky header (screenshots), expired session, failed logout, home tasks per role, draft round, toasts, confetti on resize, landscape phone, 403/404 inside the shell | yes |
| `s2-10-regression-checks.mjs` | Explicit checks for remaining parts of BUG-006, 016, 028, 029, 031 | no |
| `06-plurals.ts` (session 001, reused unchanged) | 42 Slovak plural forms evaluated from `src/lib/texts.sk.ts` (not a browser test) | no |
| `s2-08-build-test-cases.mjs`, `s2-09-logs-from-results.mjs`, `s2-run-all.ps1`, `s2-00-discover.mjs` | Build `TEST_CASES_FRONTEND.md` and `summary.txt`; write UTF-8 logs; run order; id listing | – |

Run order of the recorded results: `01`, `02` on fresh demo data → reset → `06`, `03`, `04`, `05`, `07`, `06-plurals`, `10`. Scripts `02`, `03`, `04`, `05` and `06` were run at least twice; the product failures were identical in each run. The first runs also exposed selector mistakes of the tester (the redesign added a second `fieldset legend` in the motion menu, a hidden route announcer with `role="alert"`, a `<meta name="description">`); those were corrected in the scripts and are not counted as product failures.

Evidence in `evidence/frontend/`: `shots/*.png` (349 screenshots), `out-<script>.txt`, `results-<script>.json`, `summary.txt`, `defect-map.json`, `report-doneA.pdf`. About 30 screenshots were looked at by the tester (desktop and 360 px, all three roles, every screenshot referenced below).

## 3. Coverage

| Section (policy) | Executed | Passed | Failed | Blocked |
| --- | --- | --- | --- | --- |
| A – Navigation | 156 | 156 | 0 | 0 |
| B – UI components | 43 | 43 | 0 | 0 |
| C – Forms and questionnaire | 73 | 69 | 4 | 0 |
| D – Animations and interactions | 34 | 31 | 3 | 0 |
| E – Responsive design | 265 | 255 | 10 | 0 |
| F – Visual and text quality | 49 | 49 | 0 | 0 |
| G – Accessibility | 96 | 79 | 17 | 0 |
| **Total** | **716** | **682** | **34** | **0** |

- **A:** 16 protected routes without a session; menus for 3 roles at 1440/1280/360 px; all 24 menu-item clicks with the active mark and the pill position; 9 tab switches; 57 direct-URL checks against the permission matrix; 403 and 404 pages; active area on 14 nested pages; back/forward; refresh; rapid and double clicks; slow navigation with the pending hint; old kudos addresses; mobile menu scrolling; logout and Back after logout.
- **B:** dialogs (open, Esc, backdrop, focus return), disclosures, tabs, toasts, motion menu, tables, empty states, summary box, suggestions, report, print button.
- **C:** login (15 cases), questionnaire (validation, limits, markup, 500 / network / 401 / 409 responses, reload, slow and double submit), new round, own question, actions, kudos, issues, notes.
- **D:** confetti (appearance, removal, duration, click-through, resize, reduced motion, in-app override), question transition, page transitions forward/back, nav pill, dialog and toast timing, hover, layout shift (CLS 0 on 5 screens), progress bar.
- **E:** 222 layout measurements (all passed), 36 touch-target measurements at 360 px, header targets per role, dialog/toast/motion menu on a phone, landscape.
- **F:** 42 plural forms, NFR-04, English leftovers, fonts and palette, logo, favicon, long words and markup in every free-text field, print media.
- **G:** structure and names on 23 screens, contrast on 23 screens, skip link, 5 keyboard walks forward and back, keyboard-only questionnaire, dialog focus trap, ARIA tabs, 200 % text on 4 screens, table scroll regions.

Blocked: none. One test would have been blocked without data (empty issue filter) but a group without issues existed.

## 4. Confirmed defects

Severity follows section 4 of the policy. "Reproduced" = failed the same way in every run (number of runs given). Test IDs refer to `TEST_CASES_FRONTEND.md`; screenshots to `evidence/frontend/shots/`.

### FE2-001 – New round: validation and server errors appear outside the screen, the save button seems to do nothing — MEDIUM — new

- **Page / component:** `/rounds/new` (`new-round-form`, sticky bar with "Uložiť koncept")
- **Description:** The save button lives in a bar that is always on screen, while the form is about 1 900–2 600 px high. Field errors are rendered next to the fields at the top, the server/session error at the very end of the form. Neither is scrolled into view and focus is not moved (it falls to `<body>`). The user clicks "Uložiť koncept" and sees no change at all.
- **Steps (a):** Manager → Prieskumy → Vytvoriť kolo → clear the name (or set a past date) → scroll to the bottom → "Uložiť koncept".
- **Steps (b):** Same form, page at the top, server answers 500 or the session has expired (401) → "Uložiť koncept".
- **Expected:** The message is visible where the user is, or focus/scroll moves to the first invalid field (MVP-04; WCAG 3.3.1).
- **Actual (a):** alert "Zadaj názov kola (najviac 120 znakov)." at −1 495 px (viewport 0–800), focus on BODY, scroll position unchanged. **(b):** alert "Niečo sa nepodarilo. Skús to znova." at 2 584 px with scrollY 0.
- **Evidence:** FE2-T473, FE2-T481; `newround-name-error-offscreen.png`, `newround-500-error-offscreen.png`.
- **Reproduction:** Reproduced in 2 runs (a) / 1 run (b, added after the first pass). Case (a) needs the user to break a prefilled field; case (b) needs no mistake by the user, which is why it is rated medium.

### FE2-002 – Questionnaire confetti lasts about 1.9 s, IT-02 allows 1.5 s — LOW — new

- **Page / component:** thank-you step of `/rounds/:id/fill`; `fireConfetti` in `src/components/ui/celebrate.tsx` (`duration = full ? 1900 : 1400`)
- **Steps:** Employee submits the questionnaire with animations on; measure how long `canvas[data-confetti]` is in the page (requestAnimationFrame timestamps).
- **Expected:** IT-02: "Animácie trvajú najviac 1,5 s".
- **Actual:** 1 914 ms and 1 916 ms in two runs (1 929 ms measured from outside). The kudos confetti ("light") is within the limit: 1 413 ms. All CSS animations are shorter (longest 900 ms incl. delay).
- **Evidence:** FE2-T464 (FE2-T445 for removal, FE2-T526 for kudos); `fill-thanks-confetti-360.png`.
- **Reproduction:** Reproduced in 2 runs. The confetti does not block clicks (FE2-T456) and is off under reduced motion (FE2-T459, T462).

### FE2-003 – Transition between questions is not directional — LOW — new

- **Page / component:** `fill-wizard`, question step
- **Expected:** IT-02: "Prechod medzi otázkami pri vypĺňaní je animovaný v smere pohybu (Ďalej / Späť)."
- **Actual:** "Ďalej" and "Späť" both play the same animation `rise` (260 ms, `translateY(6px)` → none). The page transitions of the main menu do mirror the direction (FE2-T627, T628), the questions do not.
- **Evidence:** FE2-T439 (keyframes recorded for both directions).
- **Reproduction:** Reproduced in 3 runs.

### FE2-004 – Keyboard focus disappears under the sticky header when moving backwards — LOW — new

- **Page / component:** all pages inside the app shell (sticky header, 65 px on desktop, 113 px below 1280 px where the menu is a second row)
- **Description:** With Shift+Tab (or after a jump to the end of a list) the browser scrolls the focused control only to the top edge of the window, where the header covers it completely. There is no `scroll-padding-top`.
- **Steps:** HR → Prieskumy at 360 px → focus the last "Výsledky" → Shift+Tab repeatedly. Also `/rounds/:id/results` ("Prejsť na kroky") and `/kudos?tab=send` (all six emoji buttons) at 1280 px.
- **Expected:** The focused control stays visible (WCAG 2.2, 2.4.11 Focus Not Obscured, AA).
- **Actual:** 360 px: 3 of 12 stops 100 % hidden; 768 px: 1 of 12; 1280 px full walks: "Uzavrieť", "Výsledky", team link on `/hr/rounds`, "Prejsť na kroky" on results, six emoji buttons on kudos, each fully hidden.
- **Evidence:** FE2-T618, T619, T621, T692, T693; `focus-under-header-360.png`, `focus-under-header-768.png`, `focus-obscured-hr-rounds.png`, `focus-obscured-kudos-send.png`.
- **Reproduction:** Reproduced in 3 runs. Forward tabbing is fine, every stop has a visible focus ring, anchors (`#kroky`, `#new`) land below the header (FE2-T504, T516, T540).

### FE2-005 – Sticky save bar on the new-round form covers the question that has keyboard focus — LOW — new

- **Page / component:** `/rounds/new`, sticky bar (`sticky bottom-4`)
- **Steps:** Tab through the form at 1280×800.
- **Expected:** Focused control not covered (WCAG 2.4.11).
- **Actual:** 6 of 30 stops are covered by the bar, e.g. a question row 46 of 54 px, a topic header 46 of 48 px. The bar is 90 % opaque, so the row is practically unreadable.
- **Evidence:** FE2-T480; `newround-focus-under-sticky-bar.png`.
- **Reproduction:** Reproduced in 2 runs.

### FE2-006 – Animation menu is cut off at 320 px and its options are small for touch — LOW — new

- **Page / component:** `motion-menu` (header button "Nastavenie animácií")
- **Steps:** Open the menu at 320 px width on a touch device.
- **Expected:** NFR-07 (works on narrow screens); panel inside the viewport; rows of about 44 px.
- **Actual:** Panel spans −26…262 px: the legend reads "nimácie", the radio buttons are half outside the screen. Option rows are 32 px high. At 360 px and wider the panel fits.
- **Evidence:** FE2-T648; `motion-menu-320.png`.
- **Reproduction:** Reproduced in 3 runs.

### FE2-007 – Focus is dropped to `<body>` after submitting (thank-you screen, rejected kudos, rejected login) — LOW — remainder of BUG-016

- **Page / component:** `fill-wizard` (done step), `kudos-form`, `login-form`
- **Description:** The submit button is disabled while the request runs, so it loses focus; afterwards focus is nowhere. On the thank-you screen the keyboard and screen-reader user starts again from the top of the page; after a rejected kudos or login the next Tab starts at the skip link instead of the error. The steps between questions (the main part of BUG-016) are fixed.
- **Steps:** Keyboard: Enter on "Odoslať" in the questionnaire; Enter on "Poslať kudos" with an empty form; Enter on "Prihlásiť sa" with a wrong password.
- **Expected:** Focus stays on a meaningful element (WCAG 2.4.3).
- **Actual:** `document.activeElement` is BODY in all three cases. The messages themselves are announced (`role="status"` / `role="alert"`).
- **Evidence:** FE2-T460, T713, T714.
- **Reproduction:** Reproduced in 2 runs (thank-you), 1 run (kudos, login; also seen in the first pass).

### FE2-008 – 403 and 404 pages inside the app: nested `<main>`, wrong page title, needless scrolling — LOW — new

- **Page / component:** `src/app/forbidden.tsx`, `src/app/not-found.tsx` rendered inside `(app)/layout.tsx`
- **Steps:** Manager opens `/hr/issues`; HR opens `/team/neexistuje`.
- **Expected:** One `main` landmark; the title names the error (WCAG 1.3.1, 2.4.2).
- **Actual:** Two `<main>` elements, one inside the other. Title of the 403 page is the title of the forbidden page ("Podnety · Feedback portál", "Plnenie reakcie · Feedback portál"); title of the 404 for an unknown team is "Povedali ste, urobili sme · Feedback portál". The inner block has `min-h-screen`, so the page scrolls 177 px although it is nearly empty. The text, the Slovak wording and the button back are correct, and an unknown top-level address gets the right title.
- **Evidence:** FE2-T601, T707, T708; `403-in-shell.png`, `404-in-shell.png`.
- **Reproduction:** Reproduced in 3 runs.

### FE2-009 – Remaining small touch targets — LOW — remainder of BUG-026

- **Page / component:** header, lists, toasts on a touch device (360 px)
- **Actual:** "Odhlásiť sa" 40×44 px (all roles); toast close button 28×28 px; team and round text links 15–20 px high and not part of a sentence (`/hr/rounds` 9 links, `/hr/overview` 2, `/hr/heatmap` 2, `/hr/issues` 3), which is below the 24 px minimum of WCAG 2.2 AA (2.5.8); "Späť na výsledky" on the report 24 px. Everything else that failed in session 001 is now at least 44 px (menu, tabs, buttons, disclosures, selects, scale buttons 56 px).
- **Expected:** About 44 px on touch (the UI kit's own `pointer-coarse` rule), at least 24 px.
- **Evidence:** FE2-T193, T205, T211, T213, T215, T217, T226, T247, T264, T702; `toast-360.png`.
- **Reproduction:** Reproduced in 2 runs.

### FE2-010 – Skipped heading level on the kudos send tab — LOW — new

- **Page / component:** `/kudos?tab=send` (`kudos-form`, preview "Náhľad")
- **Actual:** h1 "Kudos" is followed directly by h3 "Náhľad". All other screens have a correct order (the skipped levels of BUG-028 on `/rounds` and `/hr/rounds` are fixed).
- **Evidence:** FE2-T586.
- **Reproduction:** Reproduced in 3 runs.

### FE2-011 – Text fields cut the text earlier than the counter says when emoji are used — LOW — remainder of BUG-006

- **Page / component:** comment in the questionnaire, kudos text (native `maxLength`)
- **Description:** The counter now counts characters (fix of BUG-006), but the field's `maxLength` still counts UTF-16 units. 990 letters + 10 emoji are cut to 995 characters although the counter shows "995 / 1000"; in kudos 495 of 500.
- **Expected:** Limit and counter use the same unit (MVP-08, MVP-16).
- **Evidence:** FE2-T711, T712 (also visible in FE2-T442, T523); `fill-comment-emoji-limit.png`.
- **Reproduction:** Reproduced in 2 runs.

### FE2-012 – Form-field borders have 1.46:1 contrast — LOW — known (BUG-030, borders)

- **Actual:** ring `rgb(211,214,218)` on white = 1.46:1 (WCAG 1.4.11 asks 3:1). Text contrast is fine everywhere.
- **Evidence:** FE2-T647. Reproduced in 3 runs. Left open in session 001 as a design decision.

### FE2-013 – Errors not linked to fields on the issue and note forms; required fields not marked — LOW — known (BUG-029), partly improved

- **Actual:** The new `Field` component links errors on the login, new-round, action and kudos forms (`aria-invalid`, `aria-describedby`: FE2-T474, T507, T520). The issue and note forms still show one summary message with no field marked (`aria-invalid` absent). No form marks its mandatory fields (`required` / `aria-required` false on all 6 checked fields; no visual mark).
- **Evidence:** FE2-T715, T716. Reproduced in 1 run (state unchanged from session 001).

### FE2-014 – Question step of the questionnaire has no heading — LOW — known (BUG-028, partial)

- **Actual:** On the question step `<main>` contains no heading; the question is a `<legend>`. The other two parts of BUG-028 are fixed (heading order on the round lists; the main menu is named "Hlavná navigácia").
- **Evidence:** FE2-T709. Reproduced in 1 run.

## 5. Regression of the frontend defects of session 001

| BUG | Session-001 finding | Result on the redesign | Evidence |
| --- | --- | --- | --- |
| BUG-004 | Manager has no link to the own team's questionnaire | Fixed, holds: 2 "Vyplniť" links on the manager's home page; manager submitted through the UI | FE2-T465, T466 |
| BUG-006 (FE part) | Counter counts emoji as two | Fixed for the counter; field limit still in UTF-16 units → FE2-011 | FE2-T442, T711 |
| BUG-009 (FE part) | Unknown filter shows a mismatching select | Fixed, holds | FE2-T537 |
| BUG-011 | Long word widens the page | Fixed, holds on comments, round names, actions, kudos, issues, notes, login (0 px overflow at 360 px) | FE2-T443, T484, T508, T510, T529, T534, T539, T423 |
| BUG-012 | Expired session gives "Skús to znova" | Fixed, holds: questionnaire (with a login link), new round, kudos | FE2-T452, T482, T525 |
| BUG-013 | English 404 without a way back | Fixed, holds (Slovak, button back); new detail FE2-008 | FE2-T017, T122, T123 |
| BUG-015 | Wrong plural forms | Fixed, holds: 42 forms correct; rendered sentences checked for 4 accounts | results-06-plurals, FE2-T696–T699 |
| BUG-016 | Focus lost at each questionnaire step | Fixed for the steps (1 Tab to the first option, focus in the panel); remainder → FE2-007 | FE2-T436, T458 |
| BUG-017 | HR team switch hides preselected questions | Fixed, holds | FE2-T497 |
| BUG-018 | Own question invisible / silent when full | Fixed, holds (toast, opened topic, notice when full) | FE2-T477, T479 |
| BUG-021 | Report of a draft shows a wrong message | Fixed, holds | FE2-T700 |
| BUG-022 | No active menu item while filling in | Fixed, holds ("Domov" for the employee, "Prieskumy" for the manager) | FE2-T135, T136 |
| BUG-023 | Trend and comparison tables cut off, not keyboard scrollable | Fixed, holds: hint text, focusable named region | FE2-T543, T544 |
| BUG-025 | Chart labels too small on a phone | Fixed, holds (label boxes ≥ 15 px high at 360 px) | FE2-T545 |
| BUG-026 | Touch targets below 44 px | Fixed for the controls named in session 001; remainder → FE2-009 | section E: 30 of 36 screen states pass |
| BUG-027 | Same title on every screen | Fixed, holds (23 screens, "X · Feedback portál") | FE2-T614 |
| BUG-028 | Heading level, question heading, menu name | Still partial: question step → FE2-014 (known); one new instance → FE2-010 | FE2-T709, T586 |
| BUG-029 | Errors not linked, required not marked | Open as before, partly improved by the new field component → FE2-013 (known) | FE2-T715, T716 |
| BUG-030 | Contrast | Text fixed, holds (0 low-contrast text elements on 23 screens); borders open → FE2-012 (known) | FE2-T647 and 23 contrast tests |
| BUG-031 | Progress bar ignores reduced motion | Fixed, holds | FE2-T710 |
| BUG-032 | Overlapping legend ranges | Fixed, holds ("pod 3,0", "od 3,0", "od 3,5", …) | FE2-T543, `resp-hr-heatmap-1280.png` |
| BUG-033 | "Prieskumy" opens pages with other names | Fixed, holds (h1 "Prieskumy všetkých tímov", "Prieskumy môjho tímu") | FE2-T022, T035 |
| BUG-034 | No loading hint on slow navigation | **Now fixed** (was open): pulsing bar under the clicked menu item within 700 ms | FE2-T147, `nav-slow-pending-hint.png` |
| BUG-038 (FE part) | Failed logout is silent | Fixed, holds | FE2-T695 |
| BUG-001 (FE part) | Logout / Back | Holds: Back after logout shows the login page | FE2-T153 |
| BUG-036, BUG-037 | Old tab after account switch; duplicate draft on retry | Not retested here (integration scope); double click creates exactly one round, action, kudos, issue and response | FE2-T483, T508, T526, T534, T455 |

## 6. Observations and risks that are not defects

- **"Zapnuté" in the animation menu overrides the system setting.** IT-02 says animations are off under the system setting "obmedziť pohyb". By default ("Podľa systému") that holds; a user who explicitly chooses "Zapnuté" gets animations in this app only, and the menu says so. Recorded as designed behaviour; the coordinator may want the product owner to confirm it.
- The "new kudos" counter stores a key containing the user's full name in `localStorage` (`feedback-portal:kudos-seen:<name>`); on a shared computer the names of people who used the browser remain there. Invented data only in this environment.
- Reloading in the middle of the questionnaire restarts it without a warning (drafts are out of scope: FILL-06 is only an idea).
- Date fields are native controls: their format follows the browser language (the test browser showed `11/19/2026`), not the Slovak UI.
- `/hr/heatmap` shows the hint "Tabuľka je širšia než obrazovka…" at 1280 px, where the table is only 2 px wider than its box; at 1440 px the trend table is still cut although the screen has room (design choice made for BUG-023).
- Adding an issue confirms twice (toast and inline message with the same text).
- Heatmap and trend show mixed decimals ("3,2" next to "2,66").
- Landscape phone (740×360): the sticky header takes 121 px (34 % of the height).
- At 360 px the last visible menu item sits in the fade-out zone of the scrolling menu, so an active "Kudos" looks slightly faded.
- Spinner (`animate-spin`) and the pending pulse are not stopped under reduced motion; both are short loading indicators without movement across the page.
- Prefilled round name can equal an existing one ("Pulse – 46. týždeň" twice for the same team).
- HR has no "Pridať vlastnú otázku" block on the new-round form; IT-07 names only the manager, so this matches the requirement.

## 7. Limitations

- Only Edge/Chromium, headless. No Firefox, Safari, real phones or a real screen reader; touch was emulated (`hasTouch`, `isMobile`).
- Timing values (confetti, transitions) come from `requestAnimationFrame` and the Web Animations API in a headless browser; they match the constants in the source.
- Contrast was computed for flat backgrounds; elements on gradients and disabled controls were skipped, collapsed content was not measured.
- Print layout was checked with print media emulation and one generated PDF (`report-doneA.pdf`), not on paper.
- Screenshots were reviewed by sampling (about 30 of 349); automated checks cover the rest.
- BUG-036 and BUG-037 were not retested in this phase.
