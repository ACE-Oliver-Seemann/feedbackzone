# Backend report – Agent 1 (Level 1, Backend)

Session: 2026-11-12_001 · Tester: Agent 1 (Senior Backend QA) · Policy: TESTING_RULES.md, section "AGENT 1"

## 1. Scope

- **Code under test:** worktree `feedback-zona-betest`, identical to commit `8dfeeb1` (branch `feat/ui-asseco-theme`).
- **Environment:** isolated `next dev` server on http://localhost:3002, own SQLite database `prisma/betest.db`, reseeded (`npx tsx prisma/seed.ts`) right before the run. Port 3000 and `prisma/dev.db` were not touched.
- **In scope:** all 15 route handlers (`src/app/api/**/route.ts`), service layer `src/server/*`, `src/lib/{session,authz,errors,page-auth,dates}.ts`, `src/config/*`, the Prisma schema and the hand-edited init migration, and the server-side guards of the pages (HTTP status only).
- **Out of scope:** visual and UX checks of the frontend (Agent 2) and end-to-end journeys in a browser (Agent 3).
- **Requirements baseline:** `docs/requirements/mvp.md` (MVP-01…17, NFR-01…07, permission matrix, API table). I did not count behaviour that matches mvp.md as a defect.

## 2. Method

1. **Code review** of every endpoint and service, the permission helpers, session signing, error wrapper, schema and migration.
2. **Black-box HTTP tests** with a Node 26 script (`qa/run.mjs`, `qa/run2.mjs`, `qa/run3.mjs`, global `fetch`). The scripts log in as the 13 seed accounts and cover:
   - every endpoint × role × own team / other team;
   - valid, invalid, missing, wrong-type, boundary, empty and malformed input;
   - wrong HTTP methods;
   - forged, tampered and expired session cookies (the HMAC was computed with the test `SESSION_SECRET` from `.env`);
   - controlled concurrency (2–20 parallel requests);
   - SQL-injection-like strings, XSS strings, Unicode and oversized bodies.
3. **Database checks** used the worktree's generated `@prisma/client` against `betest.db`:
   - read-only queries: `PRAGMA table_info`, `integrity_check`, `foreign_key_check`, orphan joins and consistency counts;
   - raw INSERTs that must violate CHECK, PK or FK constraints (any accepted row was deleted again);
   - a few changes to rows I had created myself: moving a deadline into the past to test auto-close and stuck drafts, and switching one role and then reverting it.
4. **Existing suite:** `npm test` (Vitest) passed in the worktree with **10 files and 132 tests** (55 s). I used it as supporting evidence and did not count it in the totals below.
5. Every test was executed and its actual result recorded automatically (`qa/results.json`). The full table is in `TEST_CASES_BACKEND.md`.

## 3. Counts

| Metric | Count |
|---|---|
| Distinct test attempts executed | **343** |
| Passed | 332 (of these, 21 are "Observation" tests: behaviour recorded where mvp.md sets no rule; analysed in §5) |
| Failed (confirmed defects) | 8 test cases → **3 distinct defects** |
| Blocked | 1 (BE-T343: the server log stream was not accessible at runtime; covered by code review) |
| Void (tester error) | 2 (BE-T043, BE-T296: the test expected 17 library questions, but the seed defines 16 by design; re-run as BE-T315 → PASS) |

| Area | Tests | Failed |
|---|---|---|
| A – API (status codes, shapes, malformed input, methods) | 69 | 0 |
| B – Database (persistence, constraints, NFR-01 schema, consistency, orphans, migration) | 29 | 0 |
| C – Authentication (login, logout, cookies, tokens) | 44 | 1 |
| C – Authorization (NFR-03 matrix, IDOR, pages) | 67 | 0 |
| D – Business logic (lifecycle, thresholds, answers, actions, kudos, concurrency) | 110 | 7 |
| E – Security (injection, XSS, leakage, headers, DoS-ish input) | 24 | 0 |

**Pagination, filtering and sorting:** N/A. The MVP API has no such parameters, and unknown query parameters are ignored (BE-T053). This is not counted as a defect.

## 4. Confirmed defects

### BE-001 – Logout does not invalidate the session server-side
- **Phase:** Backend · **Component:** `POST /api/logout`, `src/lib/session.ts` (stateless HMAC cookie)
- **Severity:** MEDIUM. Session handling is incomplete, but an attacker would first need the HttpOnly token, from disk, a proxy or a shared machine. It does not affect core workflows.
- **Description:** MVP-01 says "Odhlásenie zruší reláciu" (logout ends the session). Logout only tells the browser to delete the cookie (`Max-Age=0`). The token stays cryptographically valid until its `exp` (8 h), so a copied token keeps working after the user has logged out. Logging out in one browser also does not end other sessions of the same user (BE-T337).
- **Steps:**
  1. `POST /api/login` as cyril and keep the `fz_session` value.
  2. `POST /api/logout` with that cookie → 200 and `Set-Cookie: fz_session=; Max-Age=0`.
  3. `GET /api/me` with the saved value.
- **Expected:** 401 `unauthorized`.
- **Actual:** `HTTP 200 {"user":{"id":"cmwdpq6cx…","name":"Cyril Ukážkový","role":"EMPLOYEE",…}}`
- **Evidence:** BE-T038 (logout 200), BE-T039 (replay → 200), BE-T337 (second token still valid after the first one logged out).
- **Reproduction:** 100 % (deterministic).
- **Fix changes functionality?** **No** for users and API clients: the endpoint contract stays the same, and only replayed tokens start getting 401. It does need a design change. Options are a server-side session or revocation store, or a per-user `sessionVersion` column. Both add state to the schema, which mvp.md limits to nine tables. The lead must decide that. A smaller alternative is to shorten the TTL.

### BE-002 – Text length limits count UTF-16 code units, not characters
- **Phase:** Backend · **Component:** `src/server/kudos.ts` (`text.length`), `src/server/responses.ts` (`comment.trim().length`); same pattern in `rounds.ts` (name) and `actions.ts` (topic, description)
- **Severity:** LOW. TESTING_RULES lists "incorrect validation" under Medium, but this only affects characters outside the BMP (emoji and similar). Ordinary Slovak text, including diacritics, is counted correctly (BE-T321).
- **Description:** mvp.md sets limits in characters (kudos 20–500 znakov, comment max. 1 000 znakov). JavaScript `.length` counts UTF-16 code units, so each emoji counts as 2. As a result:
  1. The kudos minimum can be bypassed: 10 emoji, which are 10 characters, are accepted.
  2. Valid inputs are rejected: 260 emoji in kudos, and a 501-emoji comment, both well under the character limits.
  3. The app limit and the database `CHECK (length(comment) <= 1000)` disagree, because SQLite `length()` counts characters.
- **Steps / Evidence:**
  - BE-T232: `POST /api/kudos` with text `"👍"×10` → `HTTP 201`. **Expected:** 400 `too_short`.
  - BE-T233: text `"👍"×260` → `HTTP 400 {"fields":{"text":"too_long"}}`. **Expected:** 201.
  - BE-T320: `POST /api/rounds/:id/responses` with comment `"😀"×501` → `HTTP 400 {"fields":{"comment":"too_long"}}`. **Expected:** 201.
  - Related observation BE-T323: decomposed diacritics (e + U+0301) count double for the same reason. Normalising to NFC would fix it.
- **Reproduction:** 100 %.
- **Fix changes functionality?** **No.** This is a pure bug fix: count code points (`[...s].length`) or NFC-normalise and then count, which aligns the API with mvp.md and the DB CHECK. The frontend `maxLength` counters should use the same rule (Agent 2's area).

### BE-003 – Invisible-only text passes "required" and minimum-length checks
- **Phase:** Backend · **Component:** kudos text, round name, action topic and description, response comment (all use `String.prototype.trim()` only)
- **Severity:** LOW. These are validation gaps with little practical impact in an internal demo.
- **Description:** `trim()` removes normal whitespace and NBSP (BE-T325 → correctly rejected), but not zero-width characters (U+200B and similar). Text made only of such characters is stored as if it were real content:
  - kudos "text" of 20 × U+200B passes the 20-character minimum and shows an empty kudos;
  - a round named with 5 × U+200B is accepted;
  - an action with an invisible topic and description is accepted;
  - an invisible-only comment is stored as a comment, while whitespace-only comments are correctly normalised to NULL (BE-T138).
- **Steps / Evidence:**
  - BE-T231: `POST /api/kudos` text `"\u200B"×20` → `HTTP 201 {"kudos":{…,"text":"​​​…"}}`. **Expected:** 400.
  - BE-T324: `POST /api/rounds` name `"\u200B"×5` → `HTTP 201`. **Expected:** 400 `name: required`.
  - BE-T326: `POST /api/rounds/:id/actions` topic and description `"\u200B"×3` → `HTTP 201`. **Expected:** 400.
  - BE-T327: comment `"\u200B\u200B"` → 201, stored as a non-NULL comment. **Expected:** NULL, the same as a whitespace-only comment.
- **Reproduction:** 100 %.
- **Fix changes functionality?** **No.** This is a pure bug fix: strip `\p{Cf}` / zero-width characters before the emptiness and length checks.

> **No CRITICAL or HIGH backend defects were found.** I did not reach the 20-defect target of TESTING_RULES, and I did not add invented findings to reach it (Rule 2). §5 lists the remaining weaknesses as risks, and §6 the coverage gaps.

## 5. Potential risks and observations (not defects under mvp.md)

| # | Observation | Evidence | Assessment |
|---|---|---|---|
| R-01 | **No brute-force protection on login.** 30 wrong passwords in a row → 30 × 401, no 429 and no lockout. | BE-T317 | mvp.md has no requirement. Acceptable for a demo on test data. Must be addressed before any pilot; SSO is planned anyway. |
| R-02 | **Login CSRF / content-type laxness.** `request.json()` accepts any Content-Type, including `text/plain`, so a cross-site form could log a victim into an attacker's account. State-changing endpoints with a session are protected only by `SameSite=Lax`, which does not stop same-site (sibling subdomain) attackers. | BE-T042, BE-T311 | Low risk for an internal MVP. Fix: require `application/json` or check `Origin`. |
| R-03 | **Missing security headers on the dev server:** `X-Powered-By: Next.js` is present; CSP, `X-Frame-Options`, `X-Content-Type-Options` and `Referrer-Policy` are absent. API JSON (including confidential results) has no `Cache-Control: no-store`. | BE-T309, BE-T310 | Informational. Configure `headers()` in `next.config.ts` before hosting outside a laptop. |
| R-04 | **`Secure` cookie flag only when `NODE_ENV=production`.** The demo runs `next dev` over HTTP, so the flag is off. | BE-T024 | By design (NFR-05 asks only for HttpOnly and SameSite=Lax, which are verified in BE-T023). Use HTTPS and production mode if hosted. |
| R-05 | **Stored XSS payloads** are kept verbatim in round names, comments, action topics and kudos, and returned raw in JSON (correct for a JSON API). The server-rendered results page and team page **escape them** (no raw `<script>` in the HTML). | BE-T088, BE-T190, BE-T259, BE-T305, BE-T306 | No defect. Every future consumer (export, e-mail, Teams) must escape. |
| R-06 | **No rate limit on kudos.** 20 parallel sends are all accepted. | BE-T261 | GAM is out of scope. Spam is possible but signed, so the sender is known. |
| R-07 | **An expired draft gets stuck.** A draft left past its deadline cannot be opened (409 `deadline_passed`), closed (409), edited or deleted (405), so it stays in the lists as "Koncept" forever. | BE-T342 | mvp.md defines no draft editing or deletion. Usability risk for HR's overview. Possible fixes: let open/close handle it, or allow changing the deadline. |
| R-08 | **Public kudos sent to HR** (who has no team) are visible only in HR's "Moje kudos". **Cross-team public kudos** go to the *recipient's* team feed. | BE-T256, BE-T258 | mvp.md says "verejné v tíme" without saying which team. Product owner should confirm. |
| R-09 | **Live participation count.** During an OPEN round the manager sees `participation.responded` change in real time. | BE-T140 | Allowed by MVP-10 ("Otvorené kolo ukazuje iba účasť"). Timing gives no link to answer content, because results appear only after closing and Response has no time column. |
| R-10 | **The manager is also a respondent.** If the manager answers, a "5-response" round can contain only 4 other people. | design | Matches the matrix ("Manažér má aj všetky práva zamestnanca"). Worth a sentence in the demo. |
| R-11 | **Server time zone.** `YYYY-MM-DD` deadlines are interpreted as end of day in the *server's* local time and returned as UTC ISO timestamps (e.g. `2026-10-13T21:59:59.999Z`). On a UTC host, rounds would close at 00:59 CET. | BE-T189 | Fine on a CET laptop. Pin the server time zone if hosted elsewhere. |
| R-12 | **No CHECK constraints** on `Round.status`, `Action.status`, `Kudos.value`/`visibility` or `User.role`. These are enforced only in application code. | BE-T290 | Response values and the comment *are* CHECK-protected (BE-T282…289). Low risk, because there is no admin UI or raw SQL path. |
| R-13 | **No upper bound** on `closesAt` (`9999-12-31` is accepted). Action `dueDate` can be in the past. | BE-T082, BE-T189 | mvp.md sets no rule. Informational. |
| R-14 | **The NFR-04 intro text hard-codes "aspoň 5 ľudí"** (`src/lib/texts.sk.ts:107`) instead of interpolating `MIN_GROUP_SIZE`. | code review | The wording is mandated verbatim by NFR-04. If the threshold ever changes, this text must change too. |
| R-15 | **NFR-01 at the storage level.** `WITHOUT ROWID` and the UUID primary key remove the logical insertion order (BE-T276…279), but SQLite page/WAL forensics on the raw file are not excluded. | design | Acceptable for the MVP (test data only). Relevant before real data. |
| R-16 | **Malformed percent-encoding** in an API path returns Next's HTML 400 page instead of the JSON error shape. | BE-T222 | Cosmetic. No internal details leaked. |

## 6. What was verified as working (highlights)

- **NFR-01:**
  - `Response` has only `id, roundId, teamId, v1..v5, comment`, and `Participation` only `roundId, userId` (BE-T274/275).
  - Both tables are `WITHOUT ROWID` (BE-T276/277); ids are random UUID v4 (BE-T278); physical row order ≠ submission order (BE-T279); no other table references `Response` (BE-T280).
  - The submit reply is exactly `{"ok":true}` (BE-T131).
  - Results contain no user ids, names, e-mails or response ids (BE-T153/154).
  - The rejected second submission leaves no orphan Response, so the transaction rolls back (BE-T134), and participation count = response count for every round (BE-T291).
- **NFR-02:**
  - The threshold value comes only from `src/config/privacy.ts` (grep).
  - Boundary: 4 responses → only `insufficient_responses` and the count, with no averages, distribution or comment text, both on a fresh round and on the seed round, for manager and HR (BE-T162/163/169).
  - 5 responses → full results (BE-T148), with averages, distribution and random comment order checked (BE-T149–152).
  - The team page hides averages below the threshold and never returns comments or distributions (BE-T170/208/219).
- **NFR-03:** every endpoint × role × own/foreign team behaves as in the matrix:
  - 403 for a foreign team, an employee on management endpoints, HR on fill/actions, and IDOR on round, action and team ids;
  - 401 without a session;
  - 404 only for HR on unknown ids, while managers and employees get 403 so they cannot probe whether a foreign round exists;
  - the pages enforce the same rules (BE-T298…304).
- **Authentication:**
  - generic 401 that does not reveal whether the e-mail exists, with equal timing (BE-T316: 195.8 ms vs 200.2 ms);
  - bcrypt cost 10;
  - HttpOnly + SameSite=Lax + 8 h `Max-Age`;
  - tampered, forged, wrong-secret, expired, malformed and ghost-user tokens → 401;
  - the role is re-read from the DB on every request (BE-T334).
- **Lifecycle:**
  - DRAFT→OPEN→CLOSED only; invalid transitions → 409;
  - a concurrent double open → exactly one 200 (BE-T098);
  - auto-close on the first read after the deadline, and also when the first request is a submit (BE-T270/272);
  - no editing endpoint exists (405).
- **Answers:**
  - 3–5 questions enforced at creation; answer count must equal the question count;
  - values must be integers 1–5, which is also enforced by DB CHECK constraints;
  - comment ≤ 1000 characters (BMP text);
  - 409 on a second submit, including 2× and 6× **parallel** submits (exactly one 201, with 1 participation and 1 response stored; BE-T266/267);
  - a close+submit race stays consistent (BE-T269).
- **Kudos:**
  - 20–500 characters (ASCII boundaries), self-kudos → 400, all 5 values and both visibilities;
  - private kudos visible only in the recipient's `/kudos/me`, not to the sender, the manager or HR, and never in the team feed (BE-T249–254);
  - mass-assigning `fromUserId` is ignored (BE-T247).
- **Robustness:**
  - malformed, empty, `null`, array and primitive JSON → 400 `invalid_json`;
  - a 1 MB password, a 5 MB kudos body, 100 k answers and 100 k-deep nesting → 4xx, and the server stays up;
  - SQL-like strings are stored literally (Prisma parameterises queries);
  - no stack traces or Prisma messages in error bodies (BE-T307).
- **Database:** `integrity_check` ok, no FK violations, no orphans, FKs enforced, one applied migration.

## 7. Coverage gaps

- **NFR-01 runtime logs (BE-T343, BLOCKED):** I could not read the stdout of the server on :3002. Code review shows that `route()` logs only the method, path and error class, Prisma `log: []` is set, and there is no other `console.*` in `src/`.
- **Production build (`next start`)** was not tested: Secure flag, headers, error pages. Only the dev server.
- **Load and soak testing** was excluded on purpose (Rule 4). Concurrency was limited to ≤ 20 parallel requests.
- **Session expiry in real time** (8 h) was not waited out. It was simulated with signed expired tokens.
- **The browser side of XSS** (client-rendered components, `dangerouslySetInnerHTML`) belongs to Agent 2. I checked only the SSR HTML of two pages.
- **`npm run acceptance`** was not run against :3002 (Agent 3's journey scope).
- **Pagination, filtering and sorting:** N/A in this MVP.

## 8. Artefacts

- `TEST_CASES_BACKEND.md`: all 343 executed tests.
- Raw results and harness (throwaway): `c:\Users\oliver.seemann\Desktop\feedback-zona-betest\qa\results.json`, `qa\run.mjs`, `qa\run2.mjs`, `qa\run3.mjs`.
- Test data created during the run lives only in `betest.db`. Reseeding with `npx tsx prisma/seed.ts` restores the baseline.
