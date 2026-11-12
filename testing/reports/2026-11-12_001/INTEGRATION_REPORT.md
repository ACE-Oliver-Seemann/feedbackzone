# Integration report – Level 3 (end-to-end)

Session 2026-11-12_001, Agent 3 (full system integration). Testing only; no application code, test, config or doc was changed.

## Result in short

- **377 distinct test attempts executed: 351 passed, 23 failed, 3 blocked.**
- **14 confirmed defects: 0 critical, 0 high, 5 medium, 9 low.** The policy target of 20 was not reached; no further genuine defects were found in the covered area (coverage is described below).
- The six-step acceptance scenario from mvp.md passes end to end through the real UI and through `scripts/acceptance.mjs`.
- Confidentiality (NFR-01), the threshold of 5 (NFR-02) and server-side permissions (NFR-03) held in every attempt, including attempts to recover authorship with direct read access to the database.
- The 23 failed attempts map to the 14 defects (22 attempts) and to one potential risk (1 attempt).

## Scope and environment

| Item | Value |
| --- | --- |
| Application | Next.js 16 production build, running at `http://localhost:3303` |
| Database | `prisma/qa-e2e.db` (SQLite), used by this agent only; reset between journeys with `prisma/seed.ts` and, for journey 6, `scripts/demo-data.ts` |
| Branch | `feat/it-11-usability` |
| Accounts | the 13 invented seed accounts (`@example.test`), invented content only |
| Expected behaviour | `docs/requirements/mvp.md` (MVP-01..17, NFR-01..07, permission matrix, acceptance scenario), `docs/requirements/iteracie.md` (IT-03..IT-13), known contradictions from `CLAUDE.md` |
| Not in this build | IT-01 (brand colours) and IT-02 (animations, confetti) are "pozastavené"; their absence is not reported as a defect |

Time-dependent behaviour (deadline passing, 14 quiet days, 90-day window) was simulated by changing dates of rounds directly in the QA database; each such test says so in its preconditions. Final state of `prisma/qa-e2e.db`: seed + demo data.

## Tools

- Playwright (`playwright-core` 1.65) driving installed Microsoft Edge headless, one browser context per user, viewports 360, 390, 412, 768, 820, 1280, 1366, 1536 and 1920 px wide.
- `page.route` / `setOffline` for aborted, slow, failed and malformed responses; cookie removal and tampering for ended sessions.
- Node `fetch` with real session cookies for API-level checks and parallel requests.
- `@prisma/client` and raw SQL (`$queryRawUnsafe`, `PRAGMA`) against `prisma/qa-e2e.db` to verify persistence and to recompute every displayed number independently of the application code.
- Scripts: `testing/scripts/integration/` (`lib.mjs`, `j1-cycle.mjs` … `j11-followups.mjs`, `build-test-cases.cjs`). They resolve `playwright-core` from the scratchpad folder they were run in.
- Evidence: `testing/reports/2026-11-12_001/evidence/integration/` — 187 screenshots in `screens/`, one `results-<script>.json` per script with the recorded actual result of every attempt, `j9-db-dump.txt`, `j10-report.pdf`, regression logs.

## Coverage by journey

| # | Journey | Executed | Passed | Failed | Blocked |
| --- | --- | --- | --- | --- | --- |
| 1 | Full cycle: round creation (two-click default, manager's own question), start, filling on 5 viewports, second attempt, manual and automatic close, results, suggestions, actions, team page, report | 56 | 54 | 1 | 1 |
| 2 | Threshold: 4 vs 5 responses on every screen and API, for manager, HR, employee, other manager | 13 | 13 | 0 | 0 |
| 3 | Kudos: text, emoji only, private/public, sender, recipient, manager and HR views | 25 | 23 | 2 | 0 |
| 4 | HR: issues from a round and from a note, filters, status changes, home tasks following state | 37 | 35 | 2 | 0 |
| 5 | Authentication: login, logout, refresh, protected routes, back button, two tabs, ended or tampered session, role restrictions by direct URL | 39 | 35 | 4 | 0 |
| 6 | Data consistency: every number recomputed from the database, same data across roles, UI vs API | 93 | 89 | 4 | 0 |
| 7 | Error handling: aborted, slow, 500, malformed, lost reply, offline, in every form | 30 | 26 | 3 | 1 |
| 8 | Concurrency: simultaneous submissions, two tabs, close while filling, two actors on one round, double clicks | 24 | 23 | 1 | 0 |
| 9 | Confidentiality: recovering authorship from pages, APIs, ordering, ids, timing and the database | 24 | 22 | 1 | 1 |
| 10 | Regression variants: empty states, 3 and 5 questions, labelled scales, keyboard only, wording, long text on a phone, seed composition | 36 | 31 | 5 | 0 |
| | **Total** | **377** | **351** | **23** | **3** |

One row per attempt is in `TEST_CASES_INTEGRATION.md`.

## Confirmed defects

All were reproduced by script on the production build; "always" means every run.

### E2E-001 — Closed rounds are dated and ordered by their deadline, not by when they were closed (MEDIUM)

- **Workflow:** "Povedali ste, urobili sme" (team page) for employee, manager and HR.
- **Description:** A round closed by hand before its deadline is labelled "Uzavreté" with the deadline date, which lies in the future, and is sorted as if it had closed on that date. The trend page uses the real closing time, so the two pages disagree on which round is the newest.
- **Steps:** 1) HR creates a round with the default deadline (today + 7) and starts it. 2) Five members answer. 3) The manager clicks "Uzavrieť" today. 4) Any team member opens "Môj tím". For the ordering: also have a second round with an earlier deadline that closes by that deadline after step 3.
- **Expected:** "Uzavreté 12. 11. 2026" (the day it was closed); closed rounds newest first (MVP-14); same order as "Vývoj tímu".
- **Actual:** "Uzavreté 19. 11. 2026" on 12. 11. 2026 (T063); "Uzavreté 22. 11. 2026" for a round with a deadline in 10 days (T371). The round closed earlier is listed above the one closed later (T371). Trend lists round Y first, team page lists round X first (T372).
- **Evidence:** `screens/j1-32-team-page-closed-date.png`, `screens/j11-01-team-order.png`, `screens/j11-02-trend-vs-team.png`; `results-j1-cycle.json`, `results-j11-followups.json` (include `closedAt` and `closesAt` read from the database).
- **Reproduction:** always.

### E2E-002 — Thank-you screen shows the actions of the wrong round (MEDIUM)

- **Workflow:** Submitting a response (MVP-09, MVP-14).
- **Description:** After submitting, the member should see the actions of the team's last closed round. The round is chosen by the latest deadline, so a round closed by hand before its deadline wins over a round that closed later. Same cause as E2E-001.
- **Steps:** State from E2E-001 with rounds X (deadline in 10 days, closed by hand first) and Y (closed by its deadline afterwards), one action on each, and an open round Z. A member fills in Z and submits.
- **Expected:** "Čo sa urobilo po kole „Y“" with Y's action.
- **Actual:** "Čo sa urobilo po kole „QA kolo X (uzavreté ručne skôr)“" with X's action (T373).
- **Evidence:** `screens/j11-03-thanks-last-closed.png`, `results-j11-followups.json`.
- **Reproduction:** always.

### E2E-003 — Logout does not invalidate the session token on the server (MEDIUM)

- **Workflow:** Logout (MVP-01 "Odhlásenie zruší reláciu").
- **Description:** Logout removes the cookie from the browser, but the token itself stays valid until its 8-hour expiry. A copy of the cookie value taken before logout still authenticates.
- **Steps:** 1) Log in as an employee and note the value of `fz_session`. 2) Click "Odhlásiť sa". 3) Send `GET /api/me` and `GET /api/kudos/me` with the noted cookie value.
- **Expected:** 401.
- **Actual:** 200 with the user's data on both (T162).
- **Evidence:** `results-j5-auth.json` (T162).
- **Reproduction:** always.
- **Note:** The cookie is HttpOnly, Secure and SameSite=Lax (T149 passed), so obtaining a copy needs access to the machine or the traffic. Rated medium for that reason, not high.

### E2E-004 — Ended session in the middle of a form gives a misleading message (MEDIUM)

- **Workflow:** Filling in a round, sending kudos, changing an action status — any form submitted after the session ended (expired, or logged out in another tab).
- **Description:** The server answers 401 and the form shows "Niečo sa nepodarilo. Skús to znova." Retrying can never work, and the user is neither told to log in again nor taken to the login page. Nothing is stored and the typed data stays on screen, but a reload loses the wizard answers.
- **Steps:** 1) A member answers all questions and reaches the comment step. 2) Remove the session cookie (or log out in a second tab). 3) Click "Odoslať", then again.
- **Expected:** A message that the session ended, or a redirect to `/login`.
- **Actual:** The generic message both times; the page stays on the form (T165). Same for kudos after logout in another tab (T164) and for the action status select (T281).
- **Evidence:** `screens/j5-08-expired-mid-fill.png`, `screens/j5-07-two-tabs-submit.png`, `screens/j7-12-status-401.png`.
- **Reproduction:** always.

### E2E-005 — Long unbroken text breaks the page layout on a phone (MEDIUM)

- **Workflow:** Results (comments), team page (action description, kudos feed), "Moje kudos", HR issues and notes, at 360 px.
- **Description:** User text without spaces, such as a URL, does not wrap. The whole page becomes wider than the screen and scrolls sideways.
- **Steps:** 1) Enter a 104-character URL as a survey comment, an action description, a kudos text, an issue description or a note. 2) Open the page that shows it at 360 px.
- **Expected:** No horizontal page scroll; text wraps inside its card (NFR-07).
- **Actual:** Page width 515–532 px on a 360 px screen on all six pages (T361–T364); 3513 px with a 500-character word in "Moje kudos" (T106). Pages with ordinary content have no overflow (T365 passed).
- **Evidence:** `screens/j10-13-long-comment-360.png`, `j10-14-long-action-360.png`, `j10-15-long-kudos-360.png`, `j10-16-long-issue-360.png`, `j3-07-long-word-360.png`.
- **Reproduction:** always.

### E2E-006 — After switching accounts in the same browser, an open tab submits under the new account (LOW)

- **Workflow:** Filling in a round with two tabs.
- **Description:** Tab A shows Emil on the last step of the wizard. In tab B Emil logs out and Dana logs in. Tab A still shows Emil; pressing "Odoslať" stores the response as Dana's participation and shows the thank-you screen.
- **Expected:** The stale tab notices that the identity changed, or the submit is refused.
- **Actual:** Thank-you shown; participation Emil = 0, Dana = 1 (T169). Dana can no longer answer, Emil can answer again.
- **Evidence:** `screens/j5-09-account-switch.png`, `results-j5-auth.json`.
- **Reproduction:** always. Needs two people sharing one browser profile, hence low.

### E2E-007 — Public kudos sent to HR is shown on no team page (LOW)

- **Workflow:** Send kudos (MVP-16, MVP-17).
- **Description:** The form says a public kudos "Zobrazí sa na stránke tímu príjemcu." The HR user has no team, so a public kudos to HR appears only in the recipient's "Moje kudos", labelled "Verejné v tíme".
- **Steps:** Employee sends a public kudos to "Hana Personálna"; check both team feeds.
- **Expected:** Visible on a team page, or "public" not offered for a recipient without a team.
- **Actual:** On no feed; in HR's "Moje kudos" only (T112).
- **Evidence:** `screens/j3-12-public-to-hr.png`.
- **Reproduction:** always.

### E2E-008 — Wrong Slovak plural for 2 to 4 days in task sentences (LOW)

- **Workflow:** Home tasks of manager and HR, headline of "Plnenie reakcie" (IT-11, IT-13).
- **Description:** For 2, 3 and 4 days the text says "dní" instead of "dni".
- **Actual:** "Kolo „Pulse – záťaž a sústredenie“ je uzavreté 3 dní a tím čaká…" (T138); "Najdlhšie Tím Beta, 3 dní." on HR home and overview (T002, T051, T059).
- **Expected:** "3 dni".
- **Evidence:** `screens/j4-12-mgr-home-days.png`, `screens/j1-24-hr-home-2-waiting.png`.
- **Reproduction:** always when the count is 2–4.

### E2E-009 — Comparison of teams can be off by 0.01 (LOW)

- **Workflow:** HR "Porovnanie tímov" (IT-08).
- **Description:** A cell is the mean of round scores that were already rounded to two decimals, then rounded again.
- **Steps:** Demo data; open `/hr/heatmap`; recompute Tím Beta, "Stála otázka" from the raw answers of its two rounds above the threshold.
- **Expected:** 4,07 (round averages 3.8 and 4.3333, mean 4.0667).
- **Actual:** 4,06 (T244). All other cells, and all trend cells, matched.
- **Evidence:** `screens/j6-heatmap.png`, `results-j6-consistency.json`.
- **Reproduction:** always on the demo data.

### E2E-010 — Retry after a lost reply creates a duplicate draft round that cannot be removed (LOW)

- **Workflow:** New round.
- **Description:** If the server saves the round but the reply does not arrive, the form shows the generic error. Saving again creates a second identical draft. The UI has no way to delete a draft.
- **Steps:** Let `POST /api/rounds` reach the server and drop the response; click "Uložiť koncept" again.
- **Expected:** One round.
- **Actual:** Two drafts with the same name (T271).
- **Evidence:** `screens/j7-06-round-duplicate-after-lost-reply.png`.
- **Reproduction:** always under that network condition. The same pattern probably applies to kudos, actions, issues and notes; that was not tested. Filling in a round is safe: the retry reports "Toto kolo už máš vyplnené" (T266 passed).

### E2E-011 — A failed logout gives no feedback (LOW)

- **Workflow:** Logout while the network request fails.
- **Description:** The button ignores the failure and navigates to `/login`, which sends the still-logged-in user back to the home page. The user sees no message.
- **Expected:** A message that logout failed.
- **Actual:** Lands on `/`, session cookie present, no message (T286).
- **Evidence:** `screens/j7-15-logout-failed.png`.
- **Reproduction:** always under that network condition.

### E2E-012 — Parallel requests create the same own question several times (LOW)

- **Workflow:** Manager's own question (IT-07).
- **Description:** The duplicate check and the insert are not atomic and the table has no unique constraint.
- **Steps:** Send five `POST /api/questions` with the same text at once as a manager.
- **Expected:** One 201, four 400 "duplicate".
- **Actual:** Five 201, five identical questions; they cannot be edited or deleted (T307). A real double click in the UI creates only one (T306 passed).
- **Evidence:** `results-j8-concurrency.json`.
- **Reproduction:** 1 of 1 run.

### E2E-013 — Page for an unknown address is in English and has no way back (LOW)

- **Workflow:** Any mistyped address (NFR-07).
- **Actual:** "404 This page could not be found." with no menu and no link (T360). An unknown id inside the application, such as the fill page of a draft, also shows the English text but keeps the menu (T009).
- **Expected:** Slovak text and a link home, like the 403 page.
- **Evidence:** `screens/j10-12-404-english-360.png`.
- **Reproduction:** always.

### E2E-014 — Issues list with an unknown status in the address shows all issues while the filter says "Nevybavené" (LOW)

- **Workflow:** HR issues filter (IT-10).
- **Steps:** Open `/hr/issues?status=NEZNAMY`.
- **Expected:** Filter and list agree.
- **Actual:** Filter shows "Nevybavené"; the list includes the finished issue (T374).
- **Evidence:** `screens/j11-04-filter-unknown-status.png`.
- **Reproduction:** always. Reachable only by editing the address.

## Potential risks (not counted as defects)

- **R-1 Manager counts towards the threshold.** With 4 employees and the manager answering, results are shown (5 responses, as MVP-11 requires). The manager knows the own answers and can compute the exact sums of the 4 employees (T328). This is a design question for the owner, not a deviation from the requirements.
- **R-2 Live participation counter.** While a round is open, manager and HR see the count rise after each submission (T326). Someone who knows who is answering at that moment learns who answered when. No answer content is available before closing.
- **R-3 No caching headers on API responses.** `GET /api/rounds/:id/results` and `/api/teams/:id/summary` send no `Cache-Control` (T377); pages send `no-store` (T161). Relevant only if a caching proxy sits in front of the application.
- **R-4 Stale tabs.** An action status changed in a second tab is not reflected in the first until reload and there is no conflict warning; the last write wins (T299).
- **R-5 Comments at exactly 5 responses.** A single comment in a group of 5 is shown, as MVP-10 requires. The idea of a higher threshold for comments is already listed in `iteracie.md`.

## Informational notes

- The sender has no list of sent kudos; a kudos sent to another team is visible to the sender nowhere after the confirmation. The specification does not ask for one.
- Issues and actions accept a due date in the past, which makes them overdue at once. Used in the tests; may be intended.
- The default round name repeats within a week, so HR's list can hold several rounds named "Pulse – 46. týždeň".
- The session cookie is `Secure`. Edge accepts it on `http://localhost`; on a plain-http intranet host login would not work.
- Unanimous answers reveal every respondent's answer through the distribution (T329); inherent to aggregates.
- Nothing in the application can be deleted, so "deleted information disappears" from the policy has no test.

## What held up

- Second submission refused in UI and API; ten parallel submissions of one user gave one 201 and nine 409; six simultaneous browser submissions and three close-versus-submit races left participations equal to responses.
- Below the threshold, no average, distribution, comment or suggestion appeared on any page, in any API body or in the embedded page data, for any role.
- Private kudos never appeared for manager, HR or sender, in pages or APIs.
- 24 of 24 anonymous API calls returned 401; every cross-team and cross-role attempt returned 403.
- `Response` and `Participation` have exactly the specified columns, no rowid, UUID v4 ids; storage order matched submission order in 0 of 6 rounds (pooled rank correlation −0.21); no API or page carried a user id, e-mail, name or response id of a respondent.
- Every average, distribution, trend cell, overview figure and home task on the demo data matched the independent recomputation, apart from E2E-009.

## Regression commands

| Command | Result | Log |
| --- | --- | --- |
| `node scripts/acceptance.mjs http://localhost:3303` on a seed-only database | ALL PASSED (43 checks), exit 0 | `regression-acceptance.log` |
| `npm test` from PowerShell | 15 files, 241 tests passed | `regression-npm-test-powershell.log` |
| `npm test` from Git Bash | 15 files failed with "Vitest failed to find the runner", 0 tests run | `regression-npm-test.log` |
| `npm run lint` | exit 0, no findings | `regression-lint.log` |
| `npm run typecheck` | exit 0 | `regression-typecheck.log` |
| `npm run build` | BLOCKED: not run, a rebuild could disturb the production servers on 3301–3303; the coordinator verified the build before the session | — |
| Application starts | server on :3303 answered throughout the session | — |

The Git Bash failure of `npm test` is an environment effect, not a product failure: the same command passed twice from PowerShell minutes later with no code change. I did not investigate the cause further; the likely one is the lower-case drive letter of the working directory in that shell.

## Not tested, and why

- **Server log content (NFR-01 "logy neobsahujú telo odpovede")** — blocked (T332). The console output of the server on :3303 was not available to me.
- **Backend or database down during a server-rendered page load** — blocked (T287). The shared QA server could not be stopped. Client-side failures were simulated in the browser instead.
- **Confetti and animated thank-you** — blocked (T029). IT-02 is paused and not in this build.
- **Real session expiry after 8 hours** — simulated by removing the cookie; token expiry itself is covered only by the unit tests.
- **Real passage of time** — deadlines, the 14-day and 90-day rules were simulated by re-dating rounds in the QA database.
- **`npm run build`** — see above.
- **Browsers other than Edge (Chromium), real phones, screen readers, printing on paper** — not available. PDF output was produced from the browser (`j10-report.pdf`).
- **Load** — only small bursts of 5 to 12 parallel requests.
