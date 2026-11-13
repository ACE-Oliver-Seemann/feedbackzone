# Integration report – Level 3 (end-to-end), session 2026-11-12_002

Agent 3 – full system integration testing, per `TESTING_RULES.md`. Subject: branch `feat/frontend-integration`,
commit `cc58885` (colleague's frontend redesign merged with the iteration features). Question to answer: do complete
workflows still work end to end after the merge, does the UI show what the API and the database hold, and do roles
stay isolated.

## Result in short

- **281 test attempts executed: 275 passed, 5 failed, 1 blocked.**
- **5 confirmed defects, all LOW.** None is a regression of a workflow, of permissions or of confidentiality.
  Two come from the redesign (the new "new kudos" notice), three existed before the merge and were not reported in
  session 001.
- **All 12 fixed end-to-end defects of session 001 stay fixed** after the redesign. The two open ones (BUG-036,
  BUG-037) behave as before.
- The acceptance scenario of `mvp.md` (steps 1–6) passes both through the UI (m1) and through `scripts/acceptance.mjs`.
- NFR-01, NFR-02, NFR-03 and NFR-04 held in every scenario, including races and failed requests.

## Scope and method

Every journey was driven through the real UI in a browser (Playwright + installed Edge), with separate browser
contexts per user. After each step the script checked the API (same session) and the SQLite database directly.
Expected values were recomputed independently from raw `Response` rows, not read back from the application.
Failed, slow, lost and invalid server answers were simulated in the browser with route interception; the server and
the database stayed real. Time was simulated only by shifting dates in `prisma/qa-e2e.db`.

Each failure was checked (screenshot, DOM, API, DB, source) before it was counted. Failures caused by a wrong
selector, timing or expectation in a script were corrected and the suite was run again; the recorded results are
from the final run of each suite.

## Environment

| Item | Value |
| --- | --- |
| Application | http://localhost:3303, production build (`next start`), commit `cc58885` |
| Database | `prisma/qa-e2e.db` (own copy; reset from `prisma/seed.ts` at the start of each suite, demo data for m6) |
| Browser | Edge (Chromium) via playwright-core, headless; desktop 1280×800 and phone 360×740 |
| Scripts | `testing/scripts/integration/m1-cycle.mjs` … `m7-followups.mjs`, shared `lib.mjs`, `build-test-cases-002.cjs` |
| Evidence | `evidence/integration/`: `results-m*.json`, `logs/m*.log`, `logs/acceptance.log`, `screens/*.png`, `dom/*.html`, `totals.json` |

How to run a suite (from the repo root, server on 3303 running): set `QA_PW` to a folder that has `playwright-core`
in `node_modules`, then `node testing/scripts/integration/m1-cycle.mjs`. Each suite resets `qa-e2e.db` itself.
The `j*.mjs` scripts of session 001 are kept for reference; their selectors are for the old markup and they are not
part of this session's results.

## Totals and coverage by section

| Section (TESTING_RULES.md, Agent 3) | Executed | Passed | Failed | Blocked |
| --- | --- | --- | --- | --- |
| A Complete user journeys | 60 | 59 | 1 | 0 |
| B Kudos workflow | 36 | 34 | 2 | 0 |
| C Authentication workflows | 43 | 43 | 0 | 0 |
| D Data consistency | 27 | 27 | 0 | 0 |
| E Error handling | 39 | 38 | 0 | 1 |
| F Multi-user scenarios | 26 | 24 | 2 | 0 |
| G Complete application regression | 50 | 50 | 0 | 0 |
| **Total** | **281** | **275** | **5** | **1** |

The exact per-section numbers are generated into `evidence/integration/totals.json` and the head of
`TEST_CASES_INTEGRATION.md`; if they differ from this table, the generated file is right.

What each section covered:

- **A – journeys (m1, m7).** HR creates a round with the defaults, starts it through the confirm dialog (cancel,
  Escape, confirm); manager adds an own question and creates a 5-question round; five members and the manager fill
  the wizard (one on a 360 px phone, one with the keyboard only); thank-you screen with the celebration, which does
  not block navigation; second attempt refused in the UI and in the API; closing; results, summary box, suggestions,
  "Použiť ako krok", step, status change; team page, report (screen and print), trend, comparison, HR view; next
  round with the steps of the last closed round on the thank-you screen; automatic closing at the deadline;
  deadline "today"; manager's whole journey on a phone.
- **Threshold 4 vs 5 (m1, m6).** With 4 responses: results API returns only `insufficient_responses` and the count;
  results page, report, team page, trend, comparison, suggestions and the team summary API show no value. With 5 and
  6 responses every value matched the recomputation.
- **B – kudos (m2, m7).** Text, emoji only, emoji with short text, boundaries 19/20/500/501, private vs team, HR as
  recipient without a team, HR as sender, cross-team, what each role sees on the team page and in "Moje kudos",
  the "new kudos" notice, old addresses `/kudos/new` and `/kudos/me`, tabs with reload and Back, HTML in the text.
- **C – authentication (m3).** Wrong password and unknown e-mail (same message), cookie attributes, direct URLs for
  an anonymous visitor (16 pages, 23 endpoints), page and API matrix for the three roles, 403 and 404 pages, logout
  (browser, copied token, every device, other users unaffected), failed and offline logout, session ended in the
  middle of the wizard, the kudos form, the step form and the start dialog, tampered and forged tokens.
- **D – consistency (m1, m6).** On the demo data (9 rounds): list of rounds, summary tiles, overview totals and
  per-team lines, 14 comparison cells, 5 trend rows, 5 team-page blocks and 5 results pages against raw rows; each
  page against its API; NFR-01 schema checks.
- **E – errors (m4, m7).** 500, cut connection, offline, slow answer with double click, lost reply, invalid answer,
  refresh and Back/Forward inside the wizard, round closed during the wizard, for: answers, kudos, step, step
  status, start/close, new round, own question, issue, issue status, note, login, logout. Toasts and the celebration
  were checked to appear only after the server confirmed. Server log checked for request bodies.
- **F – multi-user (m5).** Five simultaneous submissions in five browsers, same user in two tabs, six parallel API
  submissions, submissions against a simultaneous close (UI once, API 10 rounds), HR and manager starting and
  closing the same round together, two managers saving at once, parallel kudos and own questions, automatic close
  under parallel load, isolation between the two teams, stale second tab/session.
- **G – regression of the iterations (m1, m6, m7).** Menu per role, tabs, highlighting, home tasks per role incl.
  the cap of 3 and their links, new-round defaults, fixed question, own question, issues from a round and from a
  note, filters, notes, overview and comparison numbers, plural forms, the forbidden word of NFR-04 on 24 pages,
  toasts.

## Confirmed defects

All five are LOW. Severity follows section 4 of `TESTING_RULES.md`; each is a display problem limited to one
situation, with correct data in the database and no way to store a wrong record.

### E2E2-001 — The first kudos a person ever receives is not announced (LOW, new, from the redesign)

- **Workflow / page:** Kudos → `/kudos`, tab "Moje kudos", notice "Máš N nové kudos".
- **Description:** The notice compares the number of received kudos with the number remembered in the browser from
  the last visit. A visit with zero kudos remembers nothing, so when the first kudos arrives there is nothing to
  compare with and no notice is shown. From the second kudos on, the notice works.
- **Steps:** 1. Dana (no kudos) opens `/kudos`. 2. Cyril sends her a kudos. 3. Dana opens `/kudos` again.
- **Expected:** "Máš 1 nové kudos" (the notice exists to announce kudos that arrived since the last visit; the
  redesign's own text `kudos.newKudos`). Not covered by an IT-xx requirement.
- **Actual:** the kudos is listed, no notice, no celebration.
- **Evidence:** test E2E2-T091 (`results-m2-kudos.json`), `screens/m2-08-first-kudos-no-notice.png`;
  cause in `src/components/kudos-hub.tsx` (effect returns early when `received.length === 0`).
- **Reproduction:** always (2 of 2 runs).

### E2E2-002 — Step status in a second tab stays old after the page refreshes its data (LOW, new, existed before the merge)

- **Workflow / page:** Results of a closed round → "Kroky po kole", status select of a step (manager).
- **Description:** The status select keeps its own copy of the value from the first render. When the page later
  gets fresh data from the server (after adding another step), the select still shows the old value.
- **Steps:** 1. Manager opens the results of a closed round with one step "Plánované" in tabs T1 and T2.
  2. In T2 set the step to "Hotové" (toast, DB `DONE`). 3. In T1, without reloading, add a second step.
- **Expected:** after step 3 the list in T1 was reloaded from the server, so the first step shows "Hotové" (MVP-13).
- **Actual:** T1 shows "Plánované" for the first step while the database has `DONE`; choosing "Plánované" again in
  T1 does nothing visible, choosing anything else overwrites the newer value. A manual reload shows the right value.
- **Evidence:** test E2E2-T201 (`results-m5-multi.json`), `screens/m5-03-stale-status-select.png`;
  `src/components/action-status-select.tsx` (`useState(status)` never follows the prop). Same code before the merge.
- **Reproduction:** always (2 of 2 runs).

### E2E2-003 — Issue status and group in a second HR session stay old after the list refreshes (LOW, new, existed before the merge)

- **Workflow / page:** HR → Podnety `/hr/issues`, selects "Stav" and "Zodpovedná skupina" in a row.
- **Description:** Same cause as E2E2-002 in `src/components/issue-controls.tsx`.
- **Steps:** 1. Two HR sessions open `/hr/issues` with issues X and Y. 2. Session 2 sets X to "Rieši sa".
  3. Session 1, without reloading, changes the owner group of Y (the list is refreshed from the server).
- **Expected:** session 1 now shows X as "Rieši sa" (IT-10).
- **Actual:** session 1 still shows X as "Otvorené"; the database has `IN_PROGRESS`.
- **Evidence:** test E2E2-T202 (`results-m5-multi.json`), `screens/m5-04-stale-issue-select.png`.
- **Reproduction:** always (2 of 2 runs). Matters once more than one person works as HR.

### E2E2-004 — Browser Back after submitting a survey shows it as not filled in (LOW, new, existed before the merge)

- **Workflow / page:** Home `/` → "Vyplniť" → wizard → thank-you screen → browser Back.
- **Description:** Back restores the home page as it was before the survey was filled in: the task "Čaká na teba
  prieskum…" and the badge "Čaká na vyplnenie" with two "Vyplniť" buttons. The link "Späť na moje prieskumy" on the
  thank-you screen shows the right state ("Odoslané").
- **Steps:** 1. Barbora opens the home page, clicks "Vyplniť", answers and submits. 2. On the thank-you screen she
  presses the browser Back button.
- **Expected:** the round is shown as "Odoslané" (MVP-06).
- **Actual:** the round is offered again as unfilled. Clicking "Vyplniť" leads to "Toto kolo už máš vyplnené";
  no second response is stored (verified: 1 response, 1 participation).
- **Evidence:** test E2E2-T259 (`results-m7-followups.json`), `screens/m7-02-back-after-submit.png`.
- **Reproduction:** always (2 of 2 runs).

### E2E2-005 — Confetti for new kudos fires over the "Poslať kudos" form while its notice is hidden (LOW, new, from the redesign)

- **Workflow / page:** `/kudos?tab=send` (also reached through `/kudos/new` and the old links).
- **Description:** When new kudos arrived since the last visit and the person opens the page directly on the send
  tab, the celebration for "new kudos" plays over the form, although the notice that explains it is in the hidden
  "Moje kudos" tab. The notice itself is not lost: it is visible after switching the tab.
- **Steps:** 1. Cyril has seen `/kudos` with one kudos. 2. A second kudos arrives. 3. Cyril opens `/kudos?tab=send`.
- **Expected:** no celebration without its message; the notice (and celebration) when "Moje kudos" is shown.
- **Actual:** a confetti canvas appears over the send form; the notice is hidden until the tab is switched.
- **Evidence:** test E2E2-T274 (`results-m7-followups.json`), `screens/m7-07-confetti-on-send-tab.png`;
  `src/components/kudos-hub.tsx` (`<Confetti fire={newCount > 0}>` inside the hidden panel draws on `document.body`).
- **Reproduction:** always (2 of 2 runs). Minor animation issue.

Test IDs above are those in `TEST_CASES_INTEGRATION.md`; if an ID moved after regeneration, find the row by the
defect ID in its Evidence column.

## Regression of the end-to-end defects of session 001

| Session 001 | BUG | Defect | Status in 001 | Result after the merge | Verified by |
| --- | --- | --- | --- | --- | --- |
| E2E-001 | BUG-019 | Team page dated and ordered rounds by deadline | Fixed | **Stays fixed** | m1 "Team page orders closed rounds by the real closing time"; m6 team page vs DB; m7 order Y > X |
| E2E-002 | BUG-020 | Thank-you screen showed steps of the wrong round | Fixed | **Stays fixed** | m7 rounds X/Y/Z with deadline order opposite to closing order; m1 next round |
| E2E-003 | BUG-001 | Logout did not end the session on the server | Fixed | **Stays fixed** | m3 copied token → 401; second browser logged out |
| E2E-004 | BUG-012 | Ended session mid-form gave a misleading message | Fixed | **Stays fixed** | m3 wizard, kudos form, step form, start dialog: clear message, content kept, resubmit works |
| E2E-005 | BUG-011 | Long unbroken text widened the page on a phone | Fixed | **Stays fixed** | m6 300-character word and 200-character link at 360 px: width 360 |
| E2E-006 | BUG-036 | Stale tab after an account switch | Open | **Known, unchanged** | m3: old name shown until reload |
| E2E-007 | BUG-024 | Public kudos to HR shown nowhere | Fixed | **Stays fixed** | m2: refused with an explanation, private works, HR sees it |
| E2E-008 | BUG-015 | Wrong Slovak plurals in generated sentences | Fixed | **Stays fixed** | m6: 1 deň / 2 dni / 5 dní / pred 20 dňami; scan of 8 pages; overview lines |
| E2E-009 | BUG-035 | Comparison of teams off by 0.01 | Fixed | **Stays fixed** | m6: 14 cells recomputed from raw rows (Tím Beta 4,07) |
| E2E-010 | BUG-037 | Retry after a lost reply creates a duplicate draft | Open | **Known, unchanged** | m4: two drafts, no delete control |
| E2E-011 | BUG-038 | Failed logout gave no feedback | Fixed | **Stays fixed** | m3: message on 500 and offline; user stays logged in |
| E2E-012 | BUG-005 | Parallel requests created the same own question several times | Fixed | **Stays fixed** | m5: 5 parallel requests → 1 row |
| E2E-013 | BUG-013 | 404 page in English without a way back | Fixed | **Stays fixed** | m3: Slovak page, HTTP 404, link "Späť na úvod" (see note 1) |
| E2E-014 | BUG-009 | Unknown issue filter showed everything under "Nevybavené" | Fixed | **Stays fixed** | m6: `/hr/issues?status=XYZ&group=NOPE` lists exactly the unresolved issues |

Also confirmed after the merge: BUG-002 (submit vs close race: 10 rounds on the API and one in the UI, always
consistent), BUG-004 (manager's own survey reachable below three tasks), BUG-017, BUG-018, BUG-021, BUG-022, and
the known limitation of BUG-010 (a draft with a passed deadline cannot be started, edited or removed).

Note 1: the 404 page has no main menu (the 403 page has one). The fix of BUG-013 promised a Slovak page with a link
back, which is there, so this is not counted as a defect.

## Risks and observations that are not defects

Known from the session-001 register, confirmed briefly and not counted again:

- API responses of a logged-in user carry no `Cache-Control` header (pages do: `private, no-store`). Risk R-4.
- A double or repeated request creates duplicates where the server has no uniqueness rule (BUG-037). In the UI every
  submit button is disabled while the request runs; a double click sent one request in all 9 forms tested.
- The session cookie has the `Secure` flag; on a plain-HTTP host other than localhost login would not work. Risk R-2,
  still not verified in a browser on such a host.
- The manager counts toward the threshold of 5; the live participation count of an open round shows who answered
  when. Design questions for the owner (R-1, R-2 of the integration part).

New observations:

- **Unknown round id for a manager gives the 403 page, for HR the 404 page.** Intended (existence of other teams'
  rounds is not revealed), noted so that it is not reported later as a bug.
- **Draft rows show "–" instead of participation**, and the new-round form shows no team select when HR comes from
  a round ("Vytvoriť podnet z tohto kola"). Both are consistent with the requirements.
- **After login the user always lands on `/`,** also when a protected address was opened first. MVP-01 asks for
  exactly this; a return to the requested page could be an idea for `iteracie.md`.
- **The "new kudos" counter lives in the browser** (`localStorage`, key by the recipient's name). On another device
  or after clearing browser data the first visit never shows a notice. Related to E2E2-001.
- **The wizard keeps answers only in memory.** A reload or Back inside the wizard starts from the intro. This is by
  design (NFR-01; automatic saving is listed among the ideas in `iteracie.md`).

## Blocked tests

| Test | Why |
| --- | --- |
| Backend or database unavailable while a server-rendered page loads | The shared QA server and its database must not be stopped or locked. Failures of API calls were simulated in the browser instead (36 tests in m4). |

## Limitations

- **Browser:** only Edge (Chromium), headless. No Firefox, Safari, real phones or screen readers. Phone tests are a
  360×740 viewport, not a device.
- **Confetti** was checked by the presence, pointer-events and lifetime of its canvas, not by looking at the
  animation frame by frame. Visual quality belongs to the frontend phase.
- **Time** was simulated by shifting dates in the QA database, not by waiting or changing the system clock.
- **"Expired session"** was simulated by removing the cookie and by a logout from another device, not by waiting
  8 hours for a token to expire. Expiry by time is covered by the unit tests of `src/lib/session.ts`.
- **Load:** races used at most 6 parallel requests and 10 repetitions. No load test.
- The application code was not changed. Nothing was fixed in this phase.

## What I was not sure about

- **Severity of E2E2-002 and E2E2-003.** `TESTING_RULES.md` lists "inconsistent data display" under MEDIUM. I kept
  them LOW because they need a second tab or a second HR person and a page that was not reloaded, and the database
  is always right. If several people will work as HR in the pilot, E2E2-003 deserves MEDIUM.
- **Whether E2E2-001 and E2E2-005 are defects or wishes.** The notice is not in `iteracie.md`; it came with the
  redesign. I judged it against its own purpose and text.
- **E2E2-004** is common behaviour of single-page applications. I report it because the page then shows a status
  that is not true (MVP-06), but it is harmless.
