# Backend test report – session 2026-11-12_001

Agent 1, Backend Testing Specialist (Level 1 – Backend). Policy: `TESTING_RULES.md`.
Role in this session: test and report only. No application source, test, config or doc file was modified.

## 1. Result in one paragraph

746 distinct tests were executed against the running production build: **714 passed, 32 failed, 0 blocked**.
The 32 failures collapse into **10 confirmed defects: 0 Critical, 0 High, 3 Medium, 7 Low**.
The policy's investigation target of 20 defects was **not** reached; no further genuine defects were found and none were invented.
The parts of the backend that protect confidentiality held up in every test: the permission matrix (154 role × endpoint checks, 0 failures), the threshold of 5 in results, suggestions, team page, trend and heatmap, and the storage rules of NFR-01.
The weak spots are session termination, one race condition when a round closes, and input validation of unusual text.

## 2. Scope and environment

| Item | Value |
| --- | --- |
| System under test | Next.js 16.4.6 App Router, Prisma 6 + SQLite, production build |
| Base URL | `http://localhost:3301` (only this server was used) |
| Database | `prisma/qa-backend.db` (only this file was used; reset to seed + demo data before every suite and at the end) |
| Branch / commit | `feat/it-11-usability`, `45528f9` |
| Expected behaviour taken from | `docs/requirements/mvp.md` (MVP-01..17, NFR-01..07, permission matrix, API table), `docs/requirements/iteracie.md` (IT-03..IT-13), `CLAUDE.md` |
| Test data | invented seed accounts only (`*@example.test`, password `Heslo123`), invented content |
| Date | 12 Nov 2026 |

### Routes found in `src/app/api/**/route.ts` (all were tested)

`POST /api/login`, `POST /api/logout`, `GET /api/me`, `GET|POST /api/questions`, `GET|POST /api/rounds`, `GET /api/rounds/:id`, `POST /api/rounds/:id/open`, `POST /api/rounds/:id/close`, `POST /api/rounds/:id/responses`, `GET /api/rounds/:id/results`, `GET /api/rounds/:id/suggestions`, `POST /api/rounds/:id/actions`, `PATCH /api/actions/:id`, `GET /api/teams/:id/summary`, `GET /api/teams/:id/trend`, `POST /api/kudos`, `GET /api/kudos/me`, `GET /api/hr/overview`, `GET /api/hr/heatmap`, `GET|POST /api/hr/issues`, `PATCH /api/hr/issues/:id`, `GET|POST /api/hr/notes` – 25 method + path combinations. No other API route exists.

## 3. Tools and how to rerun

- Node 26 built-in `fetch` for HTTP, `@prisma/client` and raw SQL for database inspection and for preparing states the API cannot reach (expired deadlines, old rounds).
- Scripts: `testing/scripts/backend/` – `lib.mjs` (harness), `s1-auth.mjs` … `s9-deep.mjs` (suites), `run-all.mjs` (runner), `gen-cases.mjs` (builds `TEST_CASES_BACKEND.md`), `migration-check.mjs`.
- Run everything from the project root in Git Bash (about 4 minutes; the QA server on port 3301 must be running):

  ```bash
  export PATH="/c/Program Files/nodejs:$PATH"
  node testing/scripts/backend/run-all.mjs > testing/reports/2026-11-12_001/evidence/backend/run-output.txt 2>&1
  node testing/scripts/backend/gen-cases.mjs
  ```

  A subset (`node testing/scripts/backend/run-all.mjs s4 s9`) writes `results-partial.json` and renumbers test ids from 1.
- The runner reseeds `qa-backend.db` (seed + demo) before each suite and once more at the end.

### Evidence files (`testing/reports/2026-11-12_001/evidence/backend/`)

| File | Content |
| --- | --- |
| `results.json` | one record per test: id, area, steps, expected, actual, status |
| `requests.jsonl` | every HTTP request and response of the run (bodies truncated), tagged with the test id |
| `run-output.txt` | console output of the final run |
| `summary.json` | counts per suite |
| `migration-check.txt` | all 5 migrations applied to an empty scratch database |
| `../server-backend.log` | stdout + stderr of the QA server (pre-existing; read only) |

All test ids below refer to the final run recorded in these files.

## 4. Coverage

| Area | Executed | Passed | Failed | Blocked |
| --- | ---: | ---: | ---: | ---: |
| Login: valid, invalid, wrong types, malformed bodies, methods, timing, brute force | 45 | 45 | 0 | 0 |
| Session cookie: tampered, forged, expired, logout, replay | 37 | 34 | 3 | 0 |
| Authorization matrix: 6 actors × 25 endpoints, plus existence oracles | 154 | 154 | 0 | 0 |
| Authorization of server-rendered pages | 17 | 17 | 0 | 0 |
| Rounds: creation, validation, lifecycle, deadline, concurrency | 82 | 81 | 1 | 0 |
| Responses: validation, submission, duplicates, concurrency | 49 | 47 | 2 | 0 |
| NFR-01: storage, logs, API responses, pages | 20 | 20 | 0 | 0 |
| Database constraints, transactions, orphans | 18 | 18 | 0 | 0 |
| Results, threshold 4 vs 5, suggestions, team summary, trend, heatmap | 48 | 48 | 0 | 0 |
| Actions (kroky) | 39 | 39 | 0 | 0 |
| Kudos including emoji | 51 | 50 | 1 | 0 |
| Question library and own questions | 26 | 24 | 2 | 0 |
| HR issues, notes, overview | 61 | 57 | 4 | 0 |
| Home tasks (through the page) | 9 | 8 | 1 | 0 |
| HTTP methods, headers, CSRF posture, body edge cases, error format | 38 | 38 | 0 | 0 |
| Ids and URLs: traversal, injection, encodings | 31 | 24 | 7 | 0 |
| Invalid and unusual Unicode | 12 | 2 | 10 | 0 |
| Races and load | 4 | 3 | 1 | 0 |
| NFR-04, NFR-06, MVP-02 spot checks | 5 | 5 | 0 | 0 |
| **Total** | **746** | **714** | **32** | **0** |

Supplementary check outside the numbered tests: the five migrations apply cleanly to an empty database and the result keeps `WITHOUT ROWID` on `Response` and `Participation` and all six `CHECK` constraints on `Response` (`migration-check.txt`).

### What held up (selected verified facts)

- **NFR-03 / MVP-03:** every forbidden combination returned 403 with the body `{"error":"forbidden"}`, every anonymous call 401. A manager of Beta cannot tell an existing Alfa round from a non-existent id (BE-T233). Mass-assignment attempts (`teamId`, `status`, `fixed`, `starter`, `createdById`, `fromUserId`, `roundId`, `id`, `createdAt`, `role`) were ignored on every write endpoint.
- **NFR-02 / MVP-11:** with 4 responses, results, suggestions, team summary and trend return only the status and the count (BE-T412..T420); with 5 they return data (BE-T421). Heatmap cells equal the value recomputed from the database using only rounds with at least 5 responses (BE-T444, BE-T445).
- **NFR-01:** `Response` has no user or time column, both tables are `WITHOUT ROWID`, ids are UUID v4, the scan order of rows differs from the submission order, the submit reply is exactly `{"ok":true}`, and no endpoint or page other than the results screen returns comment text (BE-T371..T379, BE-T429..T432, BE-T730..T742).
- **MVP-09:** six simultaneous submissions by one user produce one 201 and five 409 with one stored row (BE-T405); five different users submitting at once all succeed (BE-T406).
- **Login:** unknown e-mail and wrong password give byte-identical answers; median times were 95.6 ms and 98.4 ms over 30 samples each (BE-T078).
- **Server log:** failures are logged as method, path and error class only; no body, password or token appeared (BE-T379, BE-T696).

## 5. Confirmed defects

Severity follows section 4 of `TESTING_RULES.md`. "Reproduced 3/3 runs" means the test failed identically in each execution of that suite during the session (suites S1–S8 were executed three times, suite S9 four times).

### BE-001 – Logout does not end the session; the old cookie keeps working for up to 8 hours

- **Severity:** Medium
- **Affected:** `POST /api/logout`, `src/lib/session.ts` (stateless signed cookie, no server-side revocation), all endpoints and pages
- **Description:** Logout only tells the browser to delete the cookie. The token itself stays valid until its `exp` (8 h after login). Anyone holding a copy of the cookie value can keep reading and writing as that user after the user logged out.
- **Steps:**
  1. `POST /api/login` `{"email":"jakub.beta@example.test","password":"Heslo123"}`; keep the `fz_session` value.
  2. `POST /api/logout` with that cookie → 200, `Set-Cookie: fz_session=; Max-Age=0`.
  3. `GET /api/me` with the same cookie value.
  4. `POST /api/kudos` with the same cookie value and a valid body.
  5. `GET /` with the same cookie value.
- **Expected:** 401 in steps 3 and 4, redirect to `/login` in step 5. MVP-01: "Odhlásenie zruší reláciu."
- **Actual:** step 3 → `200 {"user":{…"name":"Jakub Pokus","role":"EMPLOYEE"…}}`; step 4 → `201 {"kudos":{…}}`; step 5 → HTTP 200 with the rendered home page.
- **Evidence:** `results.json` BE-T075, BE-T076, BE-T746; `requests.jsonl` (test = those ids)
- **Reproduction:** reproduced 3/3 runs, deterministic
- **Why Medium and not higher:** the cookie is `HttpOnly`, so an attacker first needs the token from another weakness or from a shared machine; no account can be taken over without it.

### BE-002 – A response can be stored after the round was closed (race between submit and close)

- **Severity:** Medium
- **Affected:** `POST /api/rounds/:id/responses` (`src/server/responses.ts`, `submitResponse`: the status check at line 87 and the insert at line 107 are not atomic), `POST /api/rounds/:id/close`; the same window exists for automatic closing at the deadline
- **Description:** A submission that passed the "round is open" check is still inserted if the round is closed in between. The response then lands in a round that is already closed and whose results may already have been read.
- **Steps:** (automated in BE-T720, 30 iterations)
  1. HR creates and opens a 3-question round for team Beta.
  2. Fire `POST /api/rounds/:id/close` (HR) and, 0–5 ms later, `POST /api/rounds/:id/responses` `{"answers":[3,3,3]}` (hugo.beta).
  3. As soon as close returns 200, `GET /api/rounds/:id/results` and note `responseCount`.
  4. Count `Response` rows of the round in the database.
- **Expected:** once close has returned and results were read, the number of responses never grows. MVP-09: "Do uzavretého kola sa odpovedať nedá"; MVP-05.
- **Actual:** in 6 of 30 iterations of the final run close returned 200, results reported `responseCount: 0`, the submission returned `201 {"ok":true}` and the database then held 1 response for the closed round.
- **Evidence:** `results.json` BE-T720; `requests.jsonl` (test = BE-T720)
- **Reproduction:** intermittent; 2/30, 3/30, 5/30 and 6/30 iterations in four runs
- **Impact:** besides breaking the rule, it weakens confidentiality: a manager who reads results at exactly 5 responses and again after a late 6th one can subtract the two and obtain one person's answers. The window is a few milliseconds, so it needs coincidence, not skill.

### BE-003 – Text with an unpaired UTF-16 surrogate causes HTTP 500 on every write endpoint, including login

- **Severity:** Medium
- **Affected:** `POST /api/login` (no session needed), `POST /api/rounds/:id/responses` (comment), `POST /api/kudos` (text), `POST /api/rounds` (name), `POST /api/questions` (text), `POST /api/rounds/:id/actions` (topic), `POST /api/hr/issues` (title), `POST /api/hr/notes` (text)
- **Description:** A JSON string containing the escape `\ud800` (a lone surrogate) passes validation and is rejected only by Prisma, which surfaces as an unhandled error.
- **Steps:** send the raw body `{"email":"hr\ud800@example.test","password":"Heslo123"}` to `POST /api/login`; or as filip.beta send `{"answers":[3,3,3],"comment":"zly \ud800 znak"}` to an open round.
- **Expected:** 400 `validation_error` (or 401 for login); never 500.
- **Actual:** `500 {"error":"internal_error"}` on all eight endpoints; server log: `[api] POST /api/login failed: PrismaClientKnownRequestError`.
- **Evidence:** `results.json` BE-T401, BE-T701..BE-T707; `server-backend.log`
- **Reproduction:** reproduced 3/3 runs (BE-T401), 4/4 runs (BE-T701..T707)
- **Verified limit of the damage:** nothing is stored. After the 500 on a response no `Participation` row is left and the same user can submit normally (BE-T708). The error body leaks no detail.

### BE-004 – Malformed percent-encoding in a path segment returns a bare HTTP 500

- **Severity:** Low
- **Affected:** every route with a dynamic segment (`/api/rounds/:id…`, `/api/teams/:id…`, `/api/actions/:id`, `/api/hr/issues/:id`), with or without a session
- **Steps:** `GET /api/rounds/%E0%A4%A/results` (also `/api/rounds/%/results`, `/api/teams/%ZZ/summary`, `PATCH /api/actions/%E0%A4%A`, `PATCH /api/hr/issues/%C0%AF`).
- **Expected:** 400 or 404 in the API's JSON error format.
- **Actual:** `500 Internal Server Error`, `content-type: text/plain`, even for an anonymous caller (who should get 401). The failure happens in the framework before the route handler, so it is not in the `[api]` log lines.
- **Evidence:** `results.json` BE-T673, BE-T713..BE-T718
- **Reproduction:** reproduced 3/3 runs (BE-T673), 4/4 runs (others)

### BE-005 – The same own question can be created several times by parallel requests

- **Severity:** Low
- **Affected:** `POST /api/questions` (`src/server/catalog.ts`, duplicate check followed by insert; no unique constraint in the database)
- **Steps:** as manazer.alfa send five simultaneous `POST /api/questions` `{"text":"Paralelne vytvorená vlastná otázka tímu?"}`.
- **Expected:** one 201 and four `400 {"fields":{"text":"duplicate"}}` – IT-07 and the code's own rule "the same wording must not exist twice for the team". Sequential duplicates are rejected correctly (BE-T559).
- **Actual:** five times 201; five identical rows for team Alfa.
- **Evidence:** `results.json` BE-T568
- **Reproduction:** reproduced 3/3 runs
- **Note:** a double click on the form's button is enough to trigger it if the button is not disabled; the question cannot be deleted afterwards (IT-07).

### BE-006 – Length limits count UTF-16 code units, not characters

- **Severity:** Low
- **Affected:** comment in `POST /api/rounds/:id/responses`, text in `POST /api/kudos`, text in `POST /api/questions`
- **Steps and results:**
  - comment of 1 000 emoji (1 000 characters) → `400 {"fields":{"comment":"too_long"}}`; MVP-08 allows 1 000 characters (BE-T402). The database `CHECK` counts characters, so server and database disagree.
  - kudos text of 300 emoji → `400 too_long`; MVP-16 allows 500 characters (BE-T710).
  - kudos text of 10 emoji without the emoji field → 201; MVP-16 requires at least 20 characters (BE-T711).
  - own question of 5 emoji → 201; IT-07 requires at least 10 characters (BE-T712).
- **Expected:** limits apply to characters as the user sees them.
- **Evidence:** `results.json` BE-T402, BE-T710, BE-T711, BE-T712
- **Reproduction:** reproduced 3/3 runs (BE-T402), 4/4 runs (others)

### BE-007 – Text made only of zero-width spaces passes "required" and minimum-length validation

- **Severity:** Low
- **Affected:** `POST /api/rounds` (name), `POST /api/kudos` (text), `POST /api/questions` (text)
- **Steps:** send `"​"` repeated 5 times as a round name, 20 times as a kudos text without emoji, 10 times as an own question.
- **Expected:** 400 (`name: required`, `text: too_short`), as for ordinary whitespace, which is trimmed correctly.
- **Actual:** 201 in all three cases. The result is a round with an invisible name, an empty-looking kudos, and an invisible question that stays in the team's library permanently.
- **Evidence:** `results.json` BE-T268, BE-T512, BE-T561
- **Reproduction:** reproduced 3/3 runs

### BE-008 – Creating an HR issue silently drops optional fields of the wrong type

- **Severity:** Low
- **Affected:** `POST /api/hr/issues` (`src/server/hr-issues.ts`, `optionalId` and the description parsing)
- **Steps:** as HR send a valid issue plus `"roundId": 12345`, or `"teamId": ["<id of Alfa>"]`, or `"description": {"text":"opis"}`.
- **Expected:** 400 with the field named, as the same endpoint does for an unknown string id (`roundId: unknown`, BE-T573).
- **Actual:** 201; the issue is stored with `round: null`, `team: null`, `description: ""`. The caller is told the issue was created and does not learn that the link to the round or team was lost.
- **Evidence:** `results.json` BE-T588, BE-T589, BE-T590
- **Reproduction:** reproduced 3/3 runs

### BE-009 – Unknown filter values on the issue list are ignored and everything is returned

- **Severity:** Low
- **Affected:** `GET /api/hr/issues?group=&status=`
- **Steps:** as HR `GET /api/hr/issues?group=NOPE&status=NOPE`.
- **Expected:** 400 or an empty list (IT-10: "Zoznam sa dá filtrovať podľa skupiny a stavu").
- **Actual:** 200 with all 12 of 12 issues. Valid values filter correctly (BE-T603..T606).
- **Evidence:** `results.json` BE-T607
- **Reproduction:** reproduced 3/3 runs

### BE-010 – A draft whose deadline passed blocks the manager's "start a round" task and can never be used or removed

- **Severity:** Low
- **Affected:** home tasks (`src/server/home.ts`, `managerTasks` counts every DRAFT as an active round), `POST /api/rounds/:id/open`
- **Steps:**
  1. Team Beta has no open round and its newest closed round is 14 days old → the manager's home page shows the task linking to `/rounds/new` (BE-T724 passes).
  2. Manager Beta creates a draft; its deadline passes without the round being opened (simulated by moving `closesAt` one day back in the database).
  3. Load `/` as manager Beta; then `POST /api/rounds/:id/open`.
- **Expected:** the task is still shown: no round is running or can run (IT-11: "žiadne kolo 14 dní").
- **Actual:** the task disappears. Opening the draft returns `409 {"error":"deadline_passed"}`; there is no endpoint to edit or delete it, so the task stays suppressed permanently and the dead draft stays in the round lists of the manager and HR (BE-T726).
- **Evidence:** `results.json` BE-T724, BE-T725, BE-T726
- **Reproduction:** reproduced 2/2 runs with the corrected precondition (an earlier run had a wrong precondition in the test itself and is not counted)

### Severity distribution

| Critical | High | Medium | Low |
| ---: | ---: | ---: | ---: |
| 0 | 0 | 3 (BE-001, BE-002, BE-003) | 7 (BE-004..BE-010) |

## 6. Potential risks (not confirmed defects)

| ID | Risk | What was observed | Why it is not a defect today |
| --- | --- | --- | --- |
| R-1 | No rate limit or lockout on login, and password hashing blocks the whole server | 40 wrong passwords in a row were all answered 401 and the account still logged in (BE-T080). During 100 parallel failed logins an authenticated `GET /api/me` waited 5.8 s, 8.5 s and 10.3 s in the three runs whose output was kept, against a 4–10 ms baseline (BE-T723). | Requirements do not ask for it and mvp.md says password login is for the demo only. It lets one unauthenticated client stall the app for everyone, so it should be closed before any pilot. |
| R-2 | Login may be impossible when the production build is served over plain HTTP on a host other than localhost | The cookie carries `Secure` in this production build (BE-T660; `src/lib/session.ts` sets it when `NODE_ENV=production`). Browsers do not store `Secure` cookies from `http://` origins other than localhost. | Not verified in a browser (outside this agent's scope). mvp.md leaves open whether the demo runs on a notebook or an internal server; on a server without HTTPS this would stop the demo at login. |
| R-3 | CSRF protection rests on `SameSite=Lax` alone | A state-changing request with `Content-Type: text/plain` and `Origin: https://evil.example` was accepted (BE-T663, BE-T037). No state-changing GET exists (BE-T664) and no CORS header is sent (BE-T652). | NFR-05 asks only for `SameSite=Lax`, and current browsers then withhold the cookie on cross-site POST. An `Origin` check would add a second layer. |
| R-4 | No security headers and no `Cache-Control` on authenticated JSON | `X-Content-Type-Options`, `X-Frame-Options`, CSP, `Referrer-Policy` absent; `/login` sends `X-Powered-By: Next.js`; results JSON has no `Cache-Control` (BE-T661, BE-T662). | Not required for the MVP. Without framing protection the app can be embedded in another page. |
| R-5 | No request size limit | A 20 MB JSON body was read and parsed before being rejected with 400 (BE-T690); a 5 MB comment likewise (BE-T354). The server stayed responsive. | Not required; combined with R-1 it is a cheap way to load the server. |
| R-6 | Double submission creates duplicates | Two identical parallel `POST /api/rounds` create two drafts (BE-T722); the same applies to actions, kudos and issues by design. | Requirements define no idempotency. Depends on whether the UI disables buttons (frontend agents). |
| R-7 | A team member can tell an existing draft of the own team from an unknown id | `GET /api/rounds/:id` → 404 for a draft, 403 for an unknown id (BE-T235). | Limited to the member's own team and needs a guessed 25-character id. |
| R-8 | Authors of comments can be recognised by style in a small team | Comments are shown from 5 responses on, as specified. | Known and documented in mvp.md ("Riziká") and iteracie.md ("Vyšší prah pre komentáre"). |

## 7. Informational notes

- **Pagination:** no endpoint supports it; every list returns all rows. Filtering exists only on `GET /api/hr/issues` (tested). Sort orders were verified for rounds summary, kudos feed, issues, notes, trend and awaiting rounds.
- **Past and future dates:** an action with due date `2020-01-01` is accepted (BE-T472) and a meeting note dated `2099-01-01` is accepted (BE-T624). Requirements are silent.
- **Unknown ids:** managers and employees get 403 for a non-existent round, team or action, HR gets 404. This is deliberate (existence is not revealed) and consistent.
- **Public kudos to HR:** HR has no team, so such a kudos appears only in HR's "my kudos" (BE-T537). Consistent with MVP-17.
- **Session is not refreshed:** the cookie lasts exactly 8 hours from login regardless of activity, and extra claims in a token are ignored – role and team are read from the database on every request (BE-T071).
- **Hard-coded "5" in two UI sentences** (`src/lib/texts.sk.ts`, lines 121 and 220). Line 121 is the wording mandated by NFR-04; if `MIN_GROUP_SIZE` ever changes, these two sentences will not follow it.
- **NUL characters** inside comments are stored and returned intact (BE-T709); no truncation.
- **bcrypt:** a password that starts with the correct one and continues with 64 more characters is rejected (BE-T042).

## 8. What could not be tested, and why

| Not tested | Reason |
| --- | --- |
| Existing Vitest suite (`npm test`) | It uses `prisma/test.db`, which this agent must not touch. Its test files were read to avoid duplicating them. |
| Real expiry of a session after 8 hours | Not practical in the session. Replaced by tokens with a past `exp` signed in the test with the server's `SESSION_SECRET` (white-box, value never printed): all rejected (BE-T063..T070). |
| Browser behaviour: `Secure` cookie over HTTP, cross-site cookie handling, clickjacking | No browser in this agent's scope; see R-2, R-3, R-4. |
| Recovering submission order from the SQLite file itself (free pages, journal) | Requires forensic analysis of the database file; only the logical schema and scan order were checked. |
| Logs other than the server's stdout/stderr | Only `evidence/server-backend.log` exists for the QA server. |
| Sustained load and large data volumes | The policy forbids uncontrolled load tests; only short bursts of up to 100 requests were sent. |
| HTTPS, SSO, e-mail, comment reporting | Not part of the MVP (mvp.md, "Mimo rozsahu"). |
| UI behaviour, visual checks, full user journeys | Covered by agents 2 and 3. Pages were fetched here only to check status codes, the threshold and comment rules in the HTML, and home tasks. |

One weakness of my own tests to be aware of: BE-T727 ("home shows at most 3 tasks") counts links in the HTML and also counts navigation links for HR, so it can only show that the limit is not exceeded, not the exact number of tasks.

## 9. State left behind

`prisma/qa-backend.db` was reset to seed + demo data after the final run (13 users, 9 rounds, 41 responses, 5 actions, 3 kudos). The server on port 3301 was not restarted. Files written: `testing/scripts/backend/*`, `testing/reports/2026-11-12_001/evidence/backend/*`, this report and `TEST_CASES_BACKEND.md`.
