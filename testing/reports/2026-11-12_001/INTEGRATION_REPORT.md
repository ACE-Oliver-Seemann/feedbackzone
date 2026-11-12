# Integration Report – Agent 3 (Level 3, End-to-End)

Session: `2026-11-12_001` · Date: 2026-11-12 · Tester: Agent 3 (Full System Integration Testing Specialist)
Branch under test: `feat/ui-asseco-theme` (HEAD `8dfeeb1`) · No source code was modified.

## 1. Scope

I tested the complete application as real users in a real browser (frontend ⇄ API ⇄ SQLite), covering TESTING_RULES Agent-3 areas A–G:

| Area | What was covered |
|---|---|
| A – user journeys | The main flow from mvp.md, end to end: manager creates rounds (3, 4 and 5 questions) → opens them → 6 team members fill them (one question per screen, Back/Next, comment) → thank-you plus the latest actions → manager closes → results (averages, distribution, comments, random order) → threshold (4 → "Nedostatok odpovedí", 5 → shown) → actions added and status changed → team page "Povedali ste, urobili sme" → the next round's thank-you shows the actions. Also an HR-created round, the HR overview, "Čaká na krok", and a fill on a 360 px mobile viewport. |
| B – kudos | Navigation and the legacy redirects (`/kudos/me`, `/kudos/new`), validation, public, private and cross-team kudos, double-click, what each role sees (recipient, colleague, manager, HR, other team), team feed order, the "Máš 1 nové kudos" badge, kudos sent by HR, kudos to self. |
| C – auth | Login (wrong password or unknown e-mail give identical answers), cookie flags, refresh, logout, Back after logout, replaying the cookie after logout, 9 protected pages and 7 API endpoints without a session, 4 tampered cookies plus a forged expired token, navigation per role, 403 pages and 403 API calls per role and team, session lost mid-wizard, user switch in a shared browser. |
| D – consistency | DB rows after every write (Participation and Response counts, NFR-01 schema, UUIDs, `WITHOUT ROWID`, trimmed comments stored as NULL, `teamId` integrity, no orphans), averages computed independently and compared with UI and API, HR tiles and participation compared with the DB. |
| E – errors | Offline, connection refused or reset, mocked 500, a 409 or 400 with a non-JSON body, an unexpected 200, slow responses (1.2–3 s) with double-click, all APIs down, full backend down, reload mid-wizard, failed action add, failed status PATCH (rollback), kudos and login failures. |
| F – multi-user | Same user in two tabs submitting at once (×2), two users submitting at once, manager closing while an employee is on the last step, two tabs opening the same draft, manager and HR closing at once, a stale tab changing an action status, isolation between teams. |
| G – regression | Acceptance scenario steps 1–6 reproduced through the UI instead of `npm run acceptance`, which would reseed the shared DB. |

Out of my scope: pure API fuzzing (Agent 1) and visual and animation detail (Agent 2).

## 2. Method and environment

- App: `http://localhost:3000` (Next.js dev server, shared with the frontend agent; never restarted or reseeded). DB: `prisma/dev.db`, read with a read-only Prisma script (`db.js`). Every write went through the UI or the API as a logged-in user.
- Driver: Playwright 1.49.1 + installed Edge (`channel: "msedge"`), `reducedMotion: "reduce"` for speed. Mobile run: 360×740 with `isMobile` and `hasTouch`.
- Scripts and raw results (one JSON line per attempt) are in
  `C:\Users\OLIVER~1.SEE\AppData\Local\Temp\claude\8592154cc8ab258b\cb264c66-a0dc-4ee1-877a-d3b62538e8e4\scratchpad\e2e\int\`:
  `journey.js`, `kudos.js`, `auth.js`, `errors.js`, `verify.js`, `verify2.js` → `results-*.jsonl`; screenshots in `shots\`.
- Data: team **Beta** (filip, gabriela, hugo, ivana, jakub, manazer.beta) for every questionnaire journey; Alfa and HR accounts for cross-team and role checks. Everything I created is prefixed `INT-`.

## 3. Results

| Metric | Count |
|---|---|
| **Executed test attempts** | **367** |
| Passed | 347 |
| Failed (defects) | 6 attempts → **4 confirmed defects** |
| Observations (behavior recorded, no pass/fail requirement) | 7 |
| Invalid (my own locator or expectation error, re-run correctly, kept for transparency) | 7 |
| Blocked | 0 |

By area (attempts / pass / fail / obs / invalid): A 155/147/2/1/5 · B 53/53/0/0/0 · C 74/68/3/3/0 · D 10/10/0/0/0 · E 54/51/0/3/0 · F 21/18/1/0/2.
The full list is in `TEST_CASES_INTEGRATION.md` (INT-T001 … INT-T367).

**What works end to end (verified against the DB):**
- **Core cycle:** works without a defect.
- **Persistence:** every submission writes exactly one Participation and one Response row.
- **Duplicate protection:** holds under real concurrency. Two tabs submitting at the same moment gave one 201 and one 409, in both runs (T060, T328), and the comment stored was the winning tab's (T331).
- **NFR-01:**
  - The Response table has no user or time column.
  - Response and Participation are `WITHOUT ROWID`, and Response ids are UUIDv4.
  - No API answer carries an author.
- **NFR-02:** the threshold boundary holds: 4 responses → hidden, 5 → shown.
- **NFR-03:** every cross-role or cross-team attempt returned 403 on both the page and the API.
- **Averages and distributions:** match values I computed by hand (3,33 / 3,67 / 3,0 / 2,83).
- **XSS:** a `<script>` comment is rendered as text.
- **Kudos:** visibility rules hold for every role.
- **Network failures:** every failure path shows an understandable error, keeps the user's input and allows a retry.

## 4. Confirmed defects

### INT-001 – Team page shows the deadline as the "closed" date
- **Phase:** Integration · **Component:** `/team/:id` ("Povedali ste, urobili sme"), `src/app/(app)/team/[id]/page.tsx` (`t.team.closed(formatDate(round.closesAt))`)
- **Description:** A round closed early with the "Uzavrieť" button is labelled "Uzavreté <deadline>". The page shows a date in the future, or simply not the date the round was closed. The `Round` table has no column for the actual closing time (`id, teamId, name, startsAt, closesAt, status`), so the page shows `closesAt`.
- **Steps:**
  1. As manazer.beta, create a round with deadline 27. 11. 2026 and open it.
  2. Let members fill it, then close it on 12. 11. 2026.
  3. As filip.beta, open "Môj tím".
- **Expected:** "Uzavreté 12. 11. 2026", or a neutral label such as "Uzávierka 27. 11. 2026".
- **Actual:** "Uzavreté 27. 11. 2026" on 12. 11. 2026. Reproduced for a second round: D shows "Uzavreté 25. 11. 2026" though it was closed on 12. 11. 2026.
- **Severity:** Medium (inconsistent data display on the key team-facing screen; it will be visible in a demo).
- **Evidence:** T118, T335; `shots\J05-team-beta-filip.png`, `shots\V02-team-page-dates.png`; DB query in section 7 (status CLOSED, `closesAt` 2026-11-27T22:59:59Z, closed on 2026-11-12).
- **Reproduction:** 2/2.
- **Fix changes functionality?** A pure text fix is possible: label it "Uzávierka …". Showing the real closing date would need a new `closedAt` column (schema change), which **changes the data model**.

### INT-002 – "Latest closed round" is picked by deadline, not by when it was closed
- **Phase:** Integration · **Component:** thank-you screen after submit (MVP-09 and MVP-14), `listLatestClosedRoundActions` in `src/server/actions.ts`. The same ordering is used for the team page.
- **Description:** After a submission the employee should see the actions of the latest closed round. The query orders by `closesAt desc`. When rounds are closed manually before their deadline (the normal demo flow), the app shows an older round's actions instead of the round closed last. The team page is also ordered by deadline (T334, observation).
- **Steps:**
  1. Close round A (deadline 27. 11.) and add 2 actions.
  2. Later, close round D (deadline 25. 11.) and add an action.
  3. Open round C and fill it as a member.
- **Expected:** The thank-you screen shows "Čo sa urobilo po kole „INT-Beta chyby …“" (D, closed last) with its action.
- **Actual:** It shows „INT-Beta cyklus 76813“ (A). D's action is never shown there.
- **Severity:** Medium. Core loop step 5 can show stale actions; data is not lost.
- **Evidence:** T329; `shots\V01-thanks-latest-round.png`; DB order in section 7.
- **Reproduction:** 1/1, deterministic (it follows directly from the ORDER BY).
- **Fix changes functionality?** **Yes.** It needs a closing timestamp (schema change), or a product decision that "latest" means "latest deadline". The requirement wording is ambiguous, so the product owner should confirm before anything is fixed.

### INT-003 – Logout does not invalidate the session token
- **Phase:** Integration (auth) · **Component:** `POST /api/logout`, `src/lib/session.ts` (stateless HMAC cookie, 8 h TTL)
- **Description:** Logout only clears the cookie in the browser. A token captured before logout stays valid on the server until it expires (up to 8 h). MVP-01 requires "Odhlásenie zruší reláciu" (logout ends the session).
- **Steps:**
  1. Log in as filip.beta and copy the `fz_session` value.
  2. Click "Odhlásiť sa".
  3. In a new browser context, set the copied cookie and call `GET /api/me` or open `/kudos`.
- **Expected:** 401, and a redirect to `/login`.
- **Actual:** `/api/me` → 200 with filip's identity, and `/kudos` opens normally.
- **Severity:** Medium (security: a session survives logout, which matters on shared or kiosk machines; it is not an authentication bypass, because the token must already be known).
- **Evidence:** T209, T210; `shots\C01-replayed-cookie-after-logout.png`.
- **Reproduction:** 1/1, deterministic by design.
- **Fix changes functionality?** **Yes.** It needs server-side state: a session table, or a token version on `User`. mvp.md fixes the data model at nine tables, so this is a design decision. An alternative is to accept the risk for the demo and document it (SSO before pilot is already planned).

### INT-004 – Session expiry mid-questionnaire shows only "Niečo sa nepodarilo. Skús to znova."
- **Phase:** Integration (error handling) · **Component:** `src/components/fill-wizard.tsx` `submit()` (a 401 falls into the generic branch). Other forms behave the same way.
- **Description:** If the session expires or the cookie is lost while the user is filling a round, "Odoslať" gets a 401. The user only sees the generic retry message. Retrying can never succeed, and there is no hint or link to log in again. If the user navigates to `/login`, the answers are lost (they are client state only, by design).
- **Steps:**
  1. As gabriela.beta, walk round C to the comment step.
  2. Clear cookies.
  3. Click "Odoslať".
- **Expected:** Understandable feedback (TESTING_RULES E): for example "Relácia vypršala, prihlás sa znova" with a way to log in that keeps the answers.
- **Actual:** "Niečo sa nepodarilo. Skús to znova." and nothing else. A workaround exists: logging in again in a **second tab** and retrying in the first tab gave 201 (T261).
- **Severity:** Low (TTL is 8 h, so this is rare in a demo; but the user cannot tell what to do).
- **Evidence:** T258–T261; `shots\C03-session-lost-submit.png`.
- **Reproduction:** 1/1.
- **Fix changes functionality?** No. It is a pure error-handling and text fix: handle 401 and add a new text to `texts.sk.ts`.

## 5. Potential risks (not confirmed defects)

| # | Risk | Evidence |
|---|---|---|
| R1 | **Shared browser, user switch:** a stale tab still showing "Hugo Ukážka" submitted after another tab logged in as Ivana. The submission was recorded as Ivana's participation (hugoP=0, ivanaP=1). This is inherent to cookie sessions, but a demo on one laptop with several accounts can produce confusing "already submitted" states. | T263 |
| R2 | **Action status, last write wins:** a stale second tab silently overwrote DONE with IN_PROGRESS, with no warning. Each team has one manager, so the impact is low. | T309–T311 |
| R3 | **Reload mid-wizard** loses all answers and returns to the intro. This is by design (answers live only in client state, which fits NFR-01), but users get no warning before leaving. | T294 |
| R4 | **Offline client-side navigation** falls back to a full browser navigation and shows the browser's own offline page (`chrome-error://`). There is no in-app offline message. | T299, `shots\E03-offline-nav.png` |
| R5 | **Dev console error on every 403/404 page:** "Encountered a script tag while rendering React component", caused by the inline `MOTION_INIT_SCRIPT` in `src/app/layout.tsx` re-rendering on the client when `forbidden()` or `notFound()` boundaries render. It is dev-only and I saw no visible effect, but the frontend lead should check it in a production build. | issues-*.txt (auth, journey, kudos) |
| R6 | The **"new kudos" counter** is stored in localStorage under the recipient's *name*. Two accounts with the same display name on one browser would share it. Minor. | code review while testing kudos-hub |
| R7 | **Auto-close at the deadline** (MVP-05, "first load after the deadline") could not be exercised end to end without waiting for real time or changing data. Not verified by me. | gap |
| R8 | **Login e-mail is case-insensitive:** `FILIP.BETA@EXAMPLE.TEST` logs in. This is fine, just recorded. | T194 |

## 6. Gaps and notes

- `npm run acceptance` was deliberately **not** run, because it needs a fresh seed that would wipe the shared DB. All six acceptance steps were reproduced through the UI on team Beta (HR-created round, 5+ fills incl. 360 px mobile, second attempt rejected, Alfa manager gets 403, 4 responses → "Nedostatok odpovedí", action shown to employee, public kudos in team feed).
- NFR-01 "logs contain no answer body": I had no access to the dev server's stdout, so this is not verified by me.
- Confetti was not asserted: I ran with `reducedMotion: reduce`, which is Agent 2's area. The thank-you screen and the absence of confetti on 409 and 500 were asserted.
- There is no delete feature in the MVP, so "deleted information disappears" (area D) is not applicable.
- **Test data left in the shared DB** (all prefixed `INT-`): 10 rounds (7 closed; the drafts `INT-neulozit`, `INT-Beta cyklus 53546` and `INT-Beta prah 53546` were left by my first two runs, which stopped early on script errors), 7 kudos and 3 actions. They are harmless and are removed by the next `npm run db:seed`.
- The 7 INVALID rows are my own locator or regex mistakes. Each was re-run with a correct locator and passed; see the notes in TEST_CASES_INTEGRATION.md.

## 7. DB evidence for INT-001 and INT-002 (read-only query, team Beta closed rounds ordered as the app orders them)

```
name                    status  startsAt (opened)          closesAt (deadline)        actions
INT-Beta dalsie 76813   CLOSED  2026-11-12T15:40:06Z       2026-11-30T22:59:59Z       0
INT-Beta cyklus 76813   CLOSED  2026-11-12T15:38:14Z       2026-11-27T22:59:59Z       2   <- shown as "latest" on thank-you
INT-Beta chyby 76813    CLOSED  2026-11-12T15:48:04Z       2026-11-25T22:59:59Z       1   <- actually closed after "cyklus"
Round columns: id, teamId, name, startsAt, closesAt, status   (no closedAt)
```
