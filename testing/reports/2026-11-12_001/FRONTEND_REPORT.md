# Frontend report – Agent 2 (Level 2 – Frontend)

Session `2026-11-12_001`, branch `feat/it-11-usability`. Policy: `TESTING_RULES.md`. This agent tested and reported only; no application code, test, configuration or documentation was changed.

## 1. Result in short

- **575 tests executed: 496 passed, 72 failed, 7 blocked.** No test is counted twice; a different viewport, role, route or input is a separate test. Every test has a recorded actual result (`TEST_CASES_FRONTEND.md`).
- **22 confirmed defects: 1 high, 3 medium, 18 low.** No critical defect. The 72 failed tests map to these 22 defects (65 tests) and to 4 informational notes (7 tests).
- Core flows work in the browser: login, role menus, 403 pages, the questionnaire from 320 px, results with the confidentiality threshold, actions, kudos, issues, notes, the printable report. No JavaScript error was logged in any run, and no horizontal page scroll appeared on any of the 24 screens at 1440, 1280, 768, 360 or 320 px with the demo data.
- NFR-04 holds: the word "anonym…" is not in the HTML of any screen for any role.
- Confetti, page transitions and other animations (IT-01, IT-02) are **not in this build** (status "pozastavené"); those 7 tests are recorded as BLOCKED / NOT IMPLEMENTED, not as defects.

The policy's target of 20 defects per phase was reached with genuine findings, but most of them are low severity: accessibility details, wording and small layout issues. The four that matter for a management demo are FE-001 to FE-004.

## 2. Scope and environment

| Item | Value |
| --- | --- |
| Application | Next.js 16 production build at `http://localhost:3302` (isolated QA instance) |
| Database | `prisma/qa-frontend.db`, reset to seed + demo data before each mutating run and at the end |
| Browser | Microsoft Edge (Chromium), headless, driven by `playwright-core` (`channel: "msedge"`), locale `sk-SK` |
| Viewports | 1440×900, 1280×800, 768×1024, 360×740, 320×640 |
| Accounts | Invented test accounts only (HR, both managers, employees of Tím Alfa and Tím Beta) |
| Screens | `/login`, `/`, `/rounds`, `/rounds/new`, `/rounds/:id/fill` (intro, question, comment, thank-you, already answered, closed), `/rounds/:id/results` (open, below threshold, above threshold, with actions, draft), `/rounds/:id/report`, `/team/:id`, `/team/:id/trend`, `/kudos/new`, `/kudos/me`, `/hr/rounds`, `/hr/overview`, `/hr/heatmap`, `/hr/issues`, `/hr/notes`, 403 page, 404 page |
| Expected behaviour | `docs/requirements/mvp.md` (MVP-01 to MVP-17, NFR-01 to NFR-07), `docs/requirements/iteracie.md` (IT-03 to IT-13), WCAG 2.1/2.2 AA for accessibility |

### Tools and scripts (`testing/scripts/frontend/`)

| Script | What it does | Changes data |
| --- | --- | --- |
| `lib.mjs` | Login helper, recorder (writes `results-*.json`), id discovery | – |
| `01-navigation.mjs` | Menus, tabs, direct URLs per role (access matrix), 403/404, back/forward, refresh, rapid and slow navigation, logout | no |
| `02-responsive.mjs` | 24 screens × 5 viewports (page overflow, elements outside the viewport, clipped text, inner scrollers), tap targets, menu wrapping, layout shift | no |
| `03-login-fill.mjs` | Login form, questionnaire (validation, limits, failures via `page.route`, double click, two tabs), keyboard-only runs, closing a round, comments | yes |
| `04-manage-forms.mjs` | New round, own question, open/close dialogs, results, actions, kudos, issues, notes; long and special input | yes |
| `05-a11y-text-print.mjs` | Titles, landmarks, headings, labels, computed colour contrast, focus, reduced motion, forbidden word, English leftovers, read-only components, print view and PDF | no |
| `06-plurals.ts` | Slovak plural forms of the generated sentences, evaluated from `src/lib/texts.sk.ts` with `tsx` (not a browser test) | no |
| `07-session-expiry.mjs` | Forms submitted after the session cookie is gone; failed logout | no |
| `08-build-test-cases.mjs` | Builds `TEST_CASES_FRONTEND.md` and `evidence/frontend/summary.txt` | – |

Order of the final run: reset → 01 → 02 → 05 → 03 → 04 → 06 → 07. The scripts ran at least twice (03 three times) with the same failures each time. Besides the assertions, 194 screenshots were taken and the important ones were looked at by the tester (all screens at 360 px and 1280 px, every screenshot referenced below).

Evidence is in `testing/reports/2026-11-12_001/evidence/frontend/`: `shots/*.png`, `out-<script>.txt` (console log of each run), `results-<script>.json`, `summary.txt`, `report-okA.pdf`, `defect-map.json`.

## 3. Coverage

| Area (policy section) | Executed | Passed | Failed | Blocked |
| --- | --- | --- | --- | --- |
| A – Navigation | 131 | 125 | 6 | 0 |
| B – UI components | 42 | 41 | 1 | 0 |
| C – Forms and questionnaire | 91 | 79 | 12 | 0 |
| D – Animations and interactions | 15 | 7 | 1 | 7 |
| E – Responsive design | 140 | 127 | 13 | 0 |
| F – Visual quality | 14 | 2 | 12 | 0 |
| G – Accessibility | 81 | 67 | 14 | 0 |
| P – Print view of the report | 7 | 7 | 0 | 0 |
| T – Text quality | 54 | 41 | 13 | 0 |
| **Total** | **575** | **496** | **72** | **7** |

What the numbers contain:

- **A:** 15 protected routes without a session, menus and every menu item for 3 roles, 11 tab switches, 57 direct-URL checks (19 routes × 3 roles, including the other team's pages), 403 and 404 pages, active menu item on 13 nested pages, back/forward, refresh, rapid clicking, clicking during a delayed load, logout and Back after logout.
- **E:** 24 screens × 5 viewports = 120 layout measurements (all passed), 15 tap-target measurements at 360 px, 5 menu-wrapping checks.
- **F:** mostly targeted stress tests with long unbroken text, which is why few pass; the general visual checks are the 120 layout measurements in E and the reviewed screenshots.
- **T:** 42 of the 54 are plural-form checks run against the text generators, not through the browser. One of the wrong forms was also seen rendered (FE-T510).
- **D blocked (7):** questionnaire confetti, animated thank-you, animated transition between questions, kudos animation, page transitions, modal/dropdown transitions, loading animations. Each test verified in the page that nothing of the kind exists (0 canvas elements, 0 running animations).

## 4. Confirmed defects

Severity follows section 4 of the policy. "Reproduced" means the automated test failed the same way in every run (at least two).

### FE-001 – Manager cannot reach the questionnaire of the own team when three other tasks are shown — HIGH

- **Page / component:** `/` (home tasks, list "Moje prieskumy"), `/rounds`
- **Description:** The home page shows at most 3 tasks. The questionnaire task is the manager's third priority, so with two closed rounds without an action and one overdue action (exactly the demo data) it is cut off. The list "Moje prieskumy" below shows the round as "Čaká na vyplnenie" but deliberately has no button, and `/rounds` offers only "Výsledky" and "Uzavrieť". There is no link to `/rounds/:id/fill` anywhere in the manager's UI.
- **Steps:** Log in as `manazer.alfa@example.test` on fresh demo data (1280 px) → home page → look for a way to fill in "Pulse – 48. týždeň" → open "Prieskumy".
- **Expected:** A "Vyplniť" link. The manager fills in the round of the own team (permission matrix in mvp.md, MVP-06); IT-11 lists "vlastný nevyplnený prieskum" among the manager's tasks.
- **Actual:** 3 tasks, none is the questionnaire; 0 links to the questionnaire on `/` and on `/rounds`. The questionnaire works when the URL is typed by hand (FE-T314).
- **Evidence:** FE-T313; `shots/home-manager-no-fill-link-1280.png`; `out-03-login-fill.txt`.
- **Reproduction:** Reproduced in 3 runs. Visible on the unmodified demo data, so it will show in the demo.
- **Note on severity:** rated high because a function of the permission matrix is unreachable in the UI and the manager's answer can decide whether a team of six reaches the threshold of 5. If the coordinator considers the direct URL an acceptable workaround, medium.

### FE-002 – A long word or link in any free text breaks the page layout — MEDIUM

- **Page / component:** comments on `/rounds/:id/results`; actions on results and on `/team/:id`; kudos on `/team/:id` and `/kudos/me`; round names on `/rounds`, `/hr/rounds`; issues on `/hr/issues`; notes on `/hr/notes`
- **Description:** User text is rendered without word breaking. One string without spaces (a pasted link is the realistic case) makes the card and the whole page as wide as the string; the page scrolls horizontally and the rest of the content sits in a narrow strip on the left.
- **Steps (one example):** As an employee send a kudos whose text is 300 characters without a space, visibility "Súkromné" → recipient opens Kudos → Moje kudos at 360 px. Same with a 1 000-character comment, a 120-character round name, action topic or issue title, a 200-character word in a note.
- **Expected:** Text wraps inside its card; no horizontal page scroll (NFR-07 for 360 px).
- **Actual:** Page width 3 199 px on a 360 px screen (`/kudos/me`); 13 106 px for the comment on results (13 298 px at 1280 px); 3 651–3 843 px for the action on results and on the team page; 1 887 px for the round name and the issue title; 2 128 px for the note.
- **Evidence:** FE-T323, T324, T349, T369, T370, T371, T390, T392, T408, T414; `shots/kudos-me-long-360.png`, `results-long-comment-360.png`, `team-long-action-360.png`, `rounds-long-name-360.png`, `issues-long-title-360.png`, `notes-long-word-360.png`.
- **Reproduction:** Reproduced in 2–3 runs. One person's input changes the page for everybody who sees it (the whole team on the team page).

### FE-003 – After the session ends, forms say "Skús to znova" instead of asking the user to log in — MEDIUM

- **Page / component:** `/rounds/:id/fill` (submit), `/kudos/new`; by code inspection the same handling is in every client form (any non-OK status other than the handled ones becomes the generic message)
- **Description:** If the session expires or the user logs out in another tab while a form is open, the API answers 401 and the form shows "Niečo sa nepodarilo. Skús to znova." Trying again can never work, and nothing tells the user to log in. In the questionnaire the answers stay on the screen but cannot be sent; a reload leads to the login page and the answers are lost.
- **Steps:** Log in as `adam.alfa@example.test` (360 px) → open the questionnaire, answer all questions, type a comment → delete the session cookie (or log out in another tab) → "Odoslať". Same on `/kudos/new` with a valid kudos.
- **Expected:** A message that the session ended with a way to log in again, or a redirect to `/login` (MVP-01).
- **Actual:** API 401; the page stays; message "Niečo sa nepodarilo. Skús to znova."
- **Evidence:** FE-T572, T573; `shots/fill-session-expired-360.png`, `kudos-session-expired-360.png`; `out-07-session-expiry.txt`.
- **Reproduction:** Reproduced in 2 runs. Clicking a menu link in the same situation correctly redirects to `/login` (FE-T574).

### FE-004 – The 404 page is the framework default in English and can be a dead end — MEDIUM

- **Page / component:** every unknown address; there is no `not-found` page in `src/app`
- **Description:** Unknown addresses show "404 – This page could not be found." in English. For an unknown top-level address (`/does-not-exist`, `/hr/unknown`) the page has no header, no menu and no link at all, for logged-in users and for visitors without a session. For an unknown id inside the application (`/team/unknown-team`) the header stays but the text is still English.
- **Steps:** Log in as any role → open `/does-not-exist`.
- **Expected:** A Slovak message with a way back, like the 403 page has (NFR-07: the UI is Slovak, texts in `texts.sk.ts`).
- **Actual:** HTTP 404, English text, 0 links on the page.
- **Evidence:** FE-T016, T102, T105, T106, T507; `shots/nav-404-employee-unknown-route.png`, `nav-404-hr-unknown-team-id.png`.
- **Reproduction:** Reproduced in 2 runs. (An unknown round id returns the Slovak 403 page for manager and employee, which is acceptable: FE-T103, T104.)

### FE-005 – Wrong Slovak plural forms in generated sentences — LOW

- **Page / component:** home tasks (`/`), headline and team lines on `/hr/overview`; all from `src/lib/texts.sk.ts`
- **Description / actual:**
  - "Kolo „…“ je uzavreté **3 dní**" for 2, 3 and 4 days (correct: 2 dni, 3 dni, 4 dni). Seen rendered on the demo data on the home page of the Tím Beta manager.
  - "Najdlhšie Tím Alfa, **2 dní**" in the HR home task and in the overview headline (2–4 days).
  - "**5 z 8** uzavretých kôl **čakajú** na krok" (5 and more takes "čaká", as the home page already does).
  - "1 z 1 uzavretých kôl", "Krok má 1 z 1 uzavretých kôl." (correct: uzavretého kola).
  - "Všetkých **1** uzavretých kôl má zapísaný krok.", "Všetkých **2** uzavretých kôl má…" (correct for 2–4: Všetky 2 uzavreté kolá majú).
  - "uzavreté pred **0 dňami**" for a round closed today.
- **Steps:** Log in as `manazer.beta@example.test` on demo data → home page. The other forms: call the generators with the counts (script 06).
- **Expected:** Grammatical Slovak for 0, 1, 2–4 and 5+ (NFR-07).
- **Evidence:** FE-T510 with `shots/text-home-managerB-3-dni-1280.png`; FE-T534, T535, T543, T560–T564, T566, T569; `out-06-plurals.txt`.
- **Reproduction:** Reproduced. 32 other plural forms are correct (questions, actions, issues, answers, rounds, days in the overview figures).

### FE-006 – Keyboard focus is lost at every step of the questionnaire and after a validation error — LOW

- **Page / component:** `fill-wizard` (`/rounds/:id/fill`), forms with a pending state
- **Description:** After "Začať" the focus falls to `<body>`. After each "Ďalej" the focus stays on the same button, which is now disabled, and the next Tab starts again from the top of the page: 8 Tab presses to reach the scale of questions 2 to 4 instead of 3. The new question is not in a live region (only "2 z 4" is announced), so a screen-reader user is not told what the next question is. In the kudos form the focus also falls to `<body>` after a failed validation.
- **Steps:** Log in as an employee, use only the keyboard: Tab to "Vyplniť", Enter, Tab to "Začať", Enter, then answer with Space and continue with Tab/Enter.
- **Expected:** Focus moves to the new question (or its first option) after each step; the question is announced (WCAG 2.4.3, 4.1.3).
- **Actual:** Completable, 52 Tab presses for 4 questions; focus after each step: BODY or a disabled button. Every stop does have a visible focus ring.
- **Evidence:** FE-T312, T489, T452; `out-03-login-fill.txt`.
- **Reproduction:** Reproduced in 2 runs.

### FE-007 – New round as HR: after switching the team, the preselected questions are hidden — LOW

- **Page / component:** `/rounds/new` (`new-round-form`)
- **Description:** The topics that are expanded are computed once for the first team. After HR selects "Tím Beta", the three ticked questions sit in collapsed topics, while the expanded topics show the previous team's choice with nothing ticked.
- **Steps:** Log in as HR → Prieskumy → Vytvoriť kolo → Tím: Tím Beta.
- **Expected:** IT-13: the form shows the preselected questions so they can be checked ("Skontroluj ich").
- **Actual:** Ticked questions in "Jasnosť a priority", "Manažér a spätná väzba", "Rast, uznanie a silné stránky" – all collapsed; three other topics stay open and empty.
- **Evidence:** FE-T351; `shots/newround-hr-beta-1280.png`.
- **Reproduction:** Reproduced in 2 runs.

### FE-008 – Own question: no visible result after adding it — LOW

- **Page / component:** `/rounds/new`, block "Pridať vlastnú otázku" (manager)
- **Description:** The added question lands in the collapsed topic "Vlastné otázky tímu"; the field is cleared and only the counter changes. When the round already has 5 questions, the question is saved to the team library (permanently, it cannot be edited or deleted) and nothing on the screen says so: no message, no visible item.
- **Steps:** Manager → Vytvoriť kolo → type a valid question → Enter. Then with 5 questions in the round add another one.
- **Expected:** The user sees the new question or a confirmation; with a full round, a note that it was saved but is not in this round (IT-07).
- **Actual:** Question not visible without expanding a topic; with a full round no feedback at all.
- **Evidence:** FE-T338, T340; `shots/newround-own-question-1280.png`.
- **Reproduction:** Reproduced in 2 runs. Validation (too short, duplicate, server error) works: FE-T336, T339, T341.

### FE-009 – Printable report of a draft round shows the wrong message — LOW

- **Page / component:** `/rounds/:id/report`
- **Description:** For a round that was never started the report says "Odpovedalo 0 z 6 členov tímu" and "Výsledky sa zobrazia až po uzavretí kola. Dovtedy je viditeľná iba účasť." The results screen of the same round correctly says "Kolo je koncept a ešte nebolo spustené." and shows no participation.
- **Steps:** Manager → create a round (draft) → open `/rounds/<id>/report`.
- **Expected:** Same message as on the results screen (IT-08: report follows the results).
- **Evidence:** FE-T345 (FE-T344 for the results screen); `shots/report-draft-1280.png`.
- **Reproduction:** Reproduced in 2 runs. Reachable only by a typed URL, the UI does not link a draft to its report.

### FE-010 – No menu item is highlighted while an employee fills in the questionnaire — LOW

- **Page / component:** main menu on `/rounds/:id/fill`, role employee
- **Expected:** IT-12: the current area is highlighted (here "Domov", where the user came from).
- **Actual:** No item has `aria-current`. For a manager "Prieskumy" is highlighted on the same page.
- **Evidence:** FE-T119 (FE-T112 for the manager).
- **Reproduction:** Reproduced in 2 runs.

### FE-011 – Trend table and team comparison are cut off on desktop and scroll sideways — LOW

- **Page / component:** `/team/:id/trend` (table "Skóre podľa okruhov"), `/hr/heatmap`
- **Description:** The tables sit in a column limited to 768 px / 896 px. At 1440 px the trend table is 1 221 px wide inside a 766 px box; at 1280 px the comparison is 960 px inside 862 px, and its last column shows only "Zá". There is no hint that more columns exist, while the screen has free space on both sides. The scroll box has no `tabindex` or name, so it is not a reliable keyboard stop.
- **Steps:** Manager → Môj tím → Vývoj tímu at 1440 px; HR → Prehľady → Porovnanie tímov at 1280 px.
- **Expected:** The table fits on a desktop screen, or the cut is obvious and scrollable from the keyboard.
- **Evidence:** `shots/resp-trend-manager-1440.png`, `resp-hr-heatmap-1280.png`; inner scroller values in FE-T212 to T216 and T232 to T236; FE-T493.
- **Reproduction:** Reproduced in 2 runs. On mobile the same sideways scroll is expected behaviour and works.

### FE-012 – Chart labels are too small on a phone — LOW

- **Page / component:** `trend-chart` on `/team/:id/trend`
- **Actual:** The SVG scales with its container, so the 12-unit axis and date labels render at 9.8 px at 360 px and 8.5 px at 320 px; the value label at 11.4 / 9.9 px.
- **Expected:** Readable text of about 11–12 px (NFR-07).
- **Evidence:** FE-T519, T520; `shots/trend-chart-360.png`, `trend-chart-320.png`.
- **Reproduction:** Reproduced in 2 runs.

### FE-013 – Many controls are smaller than a comfortable touch target at 360 px — LOW

- **Page / component:** header, lists, results, issues
- **Actual (height):** menu links 32 px; "Odhlásiť sa" 34 px; "Vyplniť" on the home page 36 px; "Vytvoriť kolo" 32 px; "Výsledky", "Uzavrieť", "Report na tlač", "Použiť ako krok", "Filtrovať" 34 px; tabs 38 px; status selects on issues 31 px; "Komentáre (n)" 28 px; "Rozdelenie odpovedí" **20 px**, which is also below the 24 px minimum of WCAG 2.2 AA (2.5.8).
- **Expected:** About 44 px for the main controls on a phone; at least 24 px everywhere.
- **Evidence:** FE-T252 to T255, T259, T261 to T266.
- **Reproduction:** Reproduced in 2 runs. The questionnaire itself is fine: scale buttons 56 px, "Späť" / "Ďalej" / "Odoslať" 48 px, "Začať" 48 px (FE-T256 to T258).

### FE-014 – Comment counter counts an emoji as two characters — LOW

- **Page / component:** comment step of the questionnaire (the kudos counter uses the same `length`)
- **Steps:** Type a single 😀 into the comment.
- **Expected:** "1 / 1000". **Actual:** "2 / 1000"; the limit is reached earlier than the user expects.
- **Evidence:** FE-T298.
- **Reproduction:** Reproduced in 3 runs.

### FE-015 – Every screen has the same page title — LOW

- **Actual:** `document.title` is "Feedback portál" on all 24 screens, including login, 403 and 404.
- **Expected:** A title naming the screen (WCAG 2.4.2, level A); it is what browser tabs, history and screen readers announce.
- **Evidence:** FE-T418.
- **Reproduction:** Reproduced in 2 runs.

### FE-016 – Heading levels, landmarks and labels on non-interactive elements — LOW

- **Actual:**
  - `/rounds` and `/hr/rounds`: `h1` is followed directly by `h3` (round cards), no `h2`.
  - The question step of the questionnaire has no heading at all (the intro and the comment step have an `h1`).
  - Pages with tabs have two `<nav>` elements; the main menu has no accessible name. There is no skip link to the content.
  - The emoji on a kudos card is `<p aria-label="💪">` without a role, and the average on the team page is `<span aria-label="Priemer">`: `aria-label` on elements without a role is not reliably announced.
- **Expected:** One `h1`, no skipped level, named navigation landmarks, `role="img"` where a label replaces the content (WCAG 1.3.1, 2.4.1, 1.1.1).
- **Evidence:** FE-T419, T423, T431, T439, T491.
- **Reproduction:** Reproduced in 2 runs. The other 21 screens have a correct heading structure.

### FE-017 – Validation messages are not tied to their fields; required fields are not marked — LOW

- **Page / component:** kudos, new round, action, issue and note forms
- **Actual:** Messages use `role="alert"` (good), but no field gets `aria-invalid` or `aria-describedby`, and no mandatory field has `required` / `aria-required` or a visible mark. The action, issue and note forms show one sentence for all fields ("Vyplň tému, čo sa urobí a platný termín.") even when only the date is missing, so the user has to find the wrong field.
- **Expected:** WCAG 3.3.1, 3.3.2: the field in error is identified.
- **Evidence:** FE-T361, T452, T453.
- **Reproduction:** Reproduced in 2 runs.

### FE-018 – Contrast below WCAG AA in three places — LOW

- **Actual (computed from the rendered colours):** placeholder text 3.45:1 on white (needs 4.5:1); the "–" of an empty cell in the team comparison 2.63:1; the border of the scale buttons and inputs against the page background 1.42:1 (needs 3:1 for the boundary of a control, WCAG 1.4.11) – the white button on the light page is otherwise at 1.05:1.
- **Evidence:** FE-T475, T478, T479.
- **Reproduction:** Reproduced in 2 runs. All other text passed: 23 of 24 screens have no text below 4.5:1 (FE-T454 to T477).

### FE-019 – Reduced motion is not respected by the only animation in the build — LOW

- **Page / component:** progress bar of the questionnaire (`transition-all`)
- **Actual:** With `prefers-reduced-motion: reduce` the bar still has `transition: all 0.15s`.
- **Expected:** No transition under reduced motion (IT-02 names this rule; IT-02 itself is paused, the bar is the only moving element today).
- **Evidence:** FE-T495.
- **Reproduction:** Reproduced in 2 runs. The transition is short (0.15 s) and causes no layout shift (FE-T496).

### FE-020 – Legend of the team comparison has overlapping ranges — LOW

- **Actual:** "1,0 až 3,0 | 3,0 až 3,5 | 3,5 až 4,0 | 4,0 až 4,5 | 4,5 a viac": a score of 3,0 or 3,5 belongs to two ranges by the legend.
- **Expected:** Ranges that do not share a boundary value.
- **Evidence:** FE-T517; `shots/resp-hr-heatmap-1280.png`.
- **Reproduction:** Reproduced in 2 runs.

### FE-021 – Menu item "Prieskumy" opens pages that speak only about "kolá" — LOW

- **Actual:** Manager: menu "Prieskumy" → heading "Kolá môjho tímu", button "Vytvoriť kolo". HR: menu "Prieskumy" → heading "Prehľad kôl". The home page uses "prieskum" for the same thing ("Čaká na teba prieskum…", "Moje prieskumy").
- **Expected:** The page heading repeats the word of the menu item, one term per thing (NFR-07, IT-12).
- **Evidence:** FE-T513.
- **Reproduction:** Reproduced in 2 runs.

### FE-022 – No sign of loading during a slow page change — LOW

- **Steps:** HR, delay the response of `/hr/overview` by 2 s, click "Prehľady".
- **Actual:** For the whole wait the page does not change at all: no spinner, no pending state of the link, the old page stays as it was.
- **Expected:** Some indication that the click was registered.
- **Evidence:** FE-T126; `shots/nav-slow-no-indicator.png`.
- **Reproduction:** Reproduced in 2 runs. Form buttons do show a pending text ("Odosielam…", "Ukladám…", "Posielam…", "Prihlasujem…").

## 5. Potential risks (not confirmed as defects)

| ID | Risk | Why it is not a confirmed defect |
| --- | --- | --- |
| R-01 | Only Edge (Chromium) was used. Firefox, Safari and real phones (touch, on-screen keyboard, iOS date picker) were not tested. | No other browser available in the environment. |
| R-02 | No real screen reader was used; accessibility results come from the DOM, computed styles and keyboard runs. | Tooling. FE-006, FE-016 and FE-017 describe what a screen reader would most likely stumble on. |
| R-03 | The confidentiality threshold "5" is written into several sentences (`trend.intro`, `heatmap.intro`, `report.generated`, the mandatory NFR-04 text) instead of using `MIN_GROUP_SIZE`. | Correct today; the texts would become wrong if the threshold changed (NFR-02). |
| R-04 | Lists have no paging, search or filter (`/hr/rounds`, `/rounds`, team page, kudos feed). With 9 rounds it is fine. | Not required by the MVP; tested only with demo volumes. |
| R-05 | The trend table grows by one column per topic; with more topics the sideways scroll of FE-011 gets worse. | Depends on future data. |
| R-06 | Automatic closing of a round after its deadline could not be exercised from the UI (the form accepts only today or later). | Needs a clock change or database edit, outside this agent's scope. |
| R-07 | Double submission is prevented by disabling the button; all double-click tests produced exactly one request. Whether the server would reject a real duplicate (kudos, action, issue) was not tested here. | Backend / integration scope. |

## 6. Informational notes and suggestions

- **N-01** HR main menu (5 items) wraps to two rows at 360 and 320 px; the header is 163 px high, about a fifth of the screen (FE-T267, T268).
- **N-02** The notice "Predvybrali sme odporúčané otázky…" stays even after the user replaced the whole selection (FE-T330).
- **N-03** Adding an action or a note gives no confirmation message; kudos and issues do ("Kudos je odoslané.", "Podnet je pridaný.") (FE-T364, T413).
- **N-04** At the 1 000-character limit typing just stops; the counter does not change colour and nothing is announced (FE-T297).
- **N-05** Reloading in the middle of the questionnaire restarts it without a warning. Autosave is out of scope (FILL-06), a browser warning would be cheap (FE-T300).
- **N-06** Printing the results screen with Ctrl+P instead of the report prints the action form and its buttons; comments stay collapsed and are not printed (FE-T529).
- **N-07** A failed logout request leaves the user on the home page with no message (FE-T575).
- **N-08** The selected emoji in the kudos form differs only by a thin border and a faint tint (`shots/kudos-emoji-selected-360.png`).
- **N-09** Language: Slovak writes "5 zo 6", "4 zo 6" (the preposition is vocalised before "šesť" and "sedem"); the UI shows "5 z 6". Worth a check by a native proofreader together with FE-005.
- **N-10** The date fields showed `mm/dd/yyyy` in the screenshots. That is the locale of the headless browser, not the application.

## 7. What could not be tested and why

- **Confetti, page transitions, question transitions, animated thank-you, kudos animation, modal and dropdown animations, loading animations:** not implemented (IT-01 and IT-02 are paused). Recorded as BLOCKED (FE-T304 to T306, T379, T499 to T501).
- **Modals, tooltips, search, pagination, notifications as components:** the application has none. Confirm dialogs are the native `confirm()` (tested: cancel and accept for "Spustiť" and "Uzavrieť"); tooltips are native `title` attributes (their presence was checked, not their display).
- **Real print output:** the print stylesheet was tested with `emulateMedia({ media: "print" })` and a generated PDF (1 page, `report-okA.pdf`); the system print dialog and a physical printer were not.
- **Other browsers, real devices, screen readers:** see R-01 and R-02.
- **Automatic closing after the deadline, expiry of the session by time:** the session end was simulated by removing the cookie.
- **Brand colours and visual design:** intentionally not assessed (owned by a colleague, IT-01 paused). Only measurable visual defects are reported.

## 8. State after testing

`prisma/qa-frontend.db` was reset to seed + demo data after the last run. Nothing outside `testing/scripts/frontend/` and `testing/reports/2026-11-12_001/` (this report, `TEST_CASES_FRONTEND.md`, `evidence/frontend/`) was written.
