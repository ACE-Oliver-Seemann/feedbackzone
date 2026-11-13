# Backend test report – session 2026-11-12_002

Agent 1, Backend Testing Specialist (Level 1 – Backend). Policy: `TESTING_RULES.md`.
Role in this session: test and report only. No application code, schema, migration, config or requirement file was modified. Only files under `testing/` were written.

## 1. Result in one paragraph

**1 107 distinct tests were executed against the running production build: 1 080 passed, 27 failed, 0 blocked.**
746 of them are last session's suite re-executed as a regression baseline (739 passed; the 7 failures are the known, open BUG-014). 361 are new tests written for this session (341 passed, 20 failed).
The 20 new failures collapse into **4 findings: 0 Critical, 0 High, 1 Medium, 2 Low, 1 Informational**. Together with the known BUG-014 that is 5 open backend items.
The frontend merge (`cc58885`) did **not** change the backend: `git diff` of the merge against its first parent touches nothing under `prisma/`, `src/app/api/`, `src/server/`, `src/config/`, and in `src/lib/` only the motion helpers and `texts.sk.ts`. Permissions, the confidentiality threshold and the storage rules of NFR-01 held in every test, including the new `/kudos` hub and the redirecting `/kudos/new` and `/kudos/me`.
The one finding that matters, **BE2-001**, is not caused by the merge. It is a side effect of last session's fix of BUG-002: when 14 or more answers to a survey arrive at the same moment, about half of them fail with a 500 and the whole API stalls for 5 to 6 seconds.
The policy's investigation target of 20 defects was not reached; nothing was invented to reach it.

## 2. Scope and environment

| Item | Value |
| --- | --- |
| System under test | Next.js 16.4.6 App Router, Prisma 6 + SQLite, production build (`next start`) |
| Base URL | `http://localhost:3301` (only this server was used; it was already running and was not restarted) |
| Database | `prisma/qa-backend.db` (only this file was used; reseeded by the scripts; left as a clean seed at the end: 13 users, 2 teams, 38 questions, 1 round) |
| Branch / commit | `feat/frontend-integration`, `cc58885` |
| Expected behaviour taken from | `docs/requirements/iteracie.md` (IT-03..IT-13), `docs/requirements/mvp.md` (MVP-01..17, NFR-01..07, permission matrix, API table), `CLAUDE.md`, and for regressions `testing/reports/2026-11-12_001/FIXES.md` |
| Test data | invented seed accounts only (`*@example.test`, password `Heslo123`), invented content |
| Date | 12 Nov 2026 |
| Machine | 12 logical CPUs (relevant for BE2-001) |

Not touched: `prisma/dev.db`, `prisma/qa-frontend.db`, `prisma/qa-e2e.db`, ports 3000, 3302, 3303. No `prisma generate`, no `migrate dev`, no build. No git command that changes anything.

## 3. Tools and how to rerun

Scripts are in `testing/scripts/backend/`. Run from the project root in Git Bash; the QA server on port 3301 must be running.

```bash
export PATH="/c/Program Files/nodejs:$PATH"
E=testing/reports/2026-11-12_002/evidence/backend
node testing/scripts/backend/run-all.mjs      > $E/run-output-baseline.txt 2>&1   # S1–S9, about 5 minutes
node testing/scripts/backend/run-session2.mjs > $E/run-output-new.txt 2>&1        # N1–N15, about 3 minutes
node testing/scripts/backend/gen-cases.mjs                                         # builds TEST_CASES_BACKEND.md
node testing/scripts/backend/probe-submit-concurrency.mjs                          # BE2-001, scenarios
node testing/scripts/backend/probe-submit-threshold.mjs                            # BE2-001, threshold, stall, retry, root cause
```

What changed in the scripts this session:

| File | Change |
| --- | --- |
| `lib.mjs` | evidence folder taken from `QA_SESSION` (default `2026-11-12_002`); test id prefix can be set (`BE2-T…` for the new suites) |
| `s10-session2.mjs`, `s11-session2-extra.mjs`, `run-session2.mjs` | new: suites N1–N15 and their runner |
| `probe-submit-concurrency.mjs`, `probe-submit-threshold.mjs` | new: probes for BE2-001 |
| `gen-cases.mjs` | reads both result files; pipe characters are now escaped correctly |
| `s6-actions-kudos.mjs` (BE-T537), `s7-questions-hr.mjs` (BE-T608), `s9-deep.mjs` (BE-T709, T727, T745) | five outdated or weak tests corrected, see section 5 |

### Evidence files (`testing/reports/2026-11-12_002/evidence/backend/`)

| File | Content |
| --- | --- |
| `results.json`, `requests.jsonl`, `summary.json`, `run-output-baseline.txt` | final run of the baseline S1–S9 (ids `BE-T001`–`BE-T746`) |
| `results-new.json`, `requests-new.jsonl`, `summary-new.json`, `run-output-new.txt` | final run of the new suites N1–N15 (ids `BE2-T001`–`BE2-T361`) |
| `probe-submit-concurrency.json`, `probe-submit-threshold.json` | measurements for BE2-001 |
| `migration-check.txt` | all 6 migrations applied to an empty throwaway database; `Response` and `Participation` are `WITHOUT ROWID`, `Response` has 6 `CHECK` constraints, 11 tables |
| `earlier-runs/` | superseded runs, kept for traceability: `baseline-1` (before the five test corrections, 734/746), `new-1` to `new-3` (before mistakes in my own new tests were corrected) |
| `../server-backend.log` | stdout + stderr of the QA server (read only) |

All test ids below refer to the final runs.

## 4. Totals and coverage

| | Executed | Passed | Failed | Blocked |
| --- | --- | --- | --- | --- |
| Regression baseline (S1–S9, session 001 suite) | 746 | 739 | 7 | 0 |
| New tests (N1–N15) | 361 | 341 | 20 | 0 |
| **Total** | **1 107** | **1 080** | **27** | **0** |

Additional check outside the totals: migrations on a throwaway database (passed, `migration-check.txt`).

| Suite | Executed | Passed | Failed | Failures belong to |
| --- | --- | --- | --- | --- |
| S1 Authentication & session | 81 | 81 | 0 | |
| S2 Authorization matrix (role × endpoint) | 170 | 170 | 0 | |
| S3 Rounds: creation, validation, lifecycle | 81 | 81 | 0 | |
| S4 Responses & confidentiality storage | 76 | 76 | 0 | |
| S5 Results, threshold 4 vs 5, suggestions, summary, trend, heatmap | 44 | 44 | 0 | |
| S6 Actions and kudos | 90 | 90 | 0 | |
| S7 Question library, own questions, HR issues/notes/overview, home tasks | 93 | 93 | 0 | |
| S8 HTTP methods, headers, injection, error handling | 65 | 64 | 1 | BUG-014 |
| S9 Deep probes: invalid unicode, races, pages, load | 46 | 40 | 6 | BUG-014 |
| N1 Page permission matrix: 24 pages × 5 roles, incl. `/kudos`, `/kudos/new`, `/kudos/me`, `/rounds`, `/hr/*` | 126 | 126 | 0 | |
| N2 Session, cookies, token tampering | 20 | 20 | 0 | |
| N3 Kudos with emoji (IT-06), extended matrix | 25 | 25 | 0 | |
| N4 Own questions (IT-07), extended | 17 | 16 | 1 | BE2-002 |
| N5 Suggestions (IT-09), threshold in trend and heatmap with time simulation (IT-08, NFR-02), automatic closing | 33 | 33 | 0 | |
| N6 HR issues and notes (IT-10), extended | 32 | 32 | 0 | |
| N7 HR overview maths with time simulation (IT-05) | 6 | 6 | 0 | |
| N8 Injection-style and malformed inputs | 20 | 20 | 0 | |
| N9 Concurrency | 11 | 10 | 1 | BE2-001 |
| N10 NFR-01 storage and log, database integrity after the run | 20 | 19 | 1 | BE2-002 |
| N11 Home tasks through the page (IT-11) | 5 | 5 | 0 | |
| N12 Session-001 fixes re-checked with new inputs | 17 | 3 | 14 | BE2-003 (13), BE2-004 (1) |
| N13 Known risks, one-line confirmation | 6 | 6 | 0 | |
| N14 Framework-level access (RSC requests, internal headers) | 14 | 14 | 0 | |
| N15 Submissions under concurrent load | 9 | 6 | 3 | BE2-001 |

What the new tests established, by area:

- **Pages (MVP-03, NFR-03).** Every one of 24 pages answered each of the 5 roles (anonymous, employee, manager Alfa, manager Beta, HR) exactly as the matrix requires: 403 for a wrong role or team, 307 to `/login` without a session, 404 for a draft or an unknown id where the role may know about it. `/kudos/new` redirects to `/kudos?tab=send` and `/kudos/me` to `/kudos` for every logged-in role, and to `/login` for anonymous. `/rounds` is 403 for an employee and redirects HR to `/hr/rounds`. The same holds for client-side navigation requests (`rsc: 1`): the payload carries the 403 or the redirect and none of the protected content.
- **Session.** A token with a swapped user id, an extended expiry, an empty or altered signature or an extra segment is refused. Logout kills the token on API and pages (BUG-001 stays fixed).
- **Kudos (IT-06).** 25 new combinations: emoji with 0, 500 and invisible text; wrong types; look-alike emoji; mass assignment of sender, id and time; private emoji kudos visible only to the recipient; HR without a team; escaping on the new hub page. No failure.
- **Own questions (IT-07).** Ownership, visibility per role, use in foreign rounds (400), the 3–5 limit, immutability, mass assignment. One failure under concurrency (BE2-002).
- **Suggestions (IT-09).** Exactly two, weakest first, different topics when possible, reversed scale flipped, fixed question ignored, texts equal to the rule library, deterministic, nothing below the threshold, no comments.
- **Threshold (NFR-02, IT-08).** A round with 4 answers contributes nothing to results, suggestions, team page, trend or heatmap, not even to a mean over several rounds (heatmap 3.00 as required; 2.50 if it leaked). Time simulation in the database: rounds at 100 days, at 90 days ± 1 hour, and a legacy round without `closedAt`.
- **HR issues and notes (IT-10), overview (IT-05).** Filters, immutable fields, mass assignment, role checks, median and overdue counts with shifted dates. No failure.
- **NFR-01.** `Response` has exactly `id, roundId, teamId, v1..v5, comment`; `Participation` exactly `roundId, userId`; neither has a rowid; all ids are UUID v4. The server log has 209 error lines after the load tests, each of the form `[api] METHOD /path failed: ErrorClass`, and none of the comment markers sent in any run.
- **Database integrity at the end of suites N1–N9 (about 700 requests).** `integrity_check` ok, no foreign-key violation, responses = participations in every round, no orphan, all values in range. The only inconsistency is the duplicate questions of BE2-002.

## 5. Baseline failures analysed

First run of the unchanged session-001 suite: 734 of 746 (`earlier-runs/baseline-1`). The 12 failures:

| Tests | Verdict | What was done |
| --- | --- | --- |
| BE-T673, T713–T718 (7) | Known defect BUG-014, still open | nothing; still fail in the final run |
| BE-T537 | Outdated test. Expected a public kudos for HR to be accepted; since the BUG-024 fix it is refused (400 `no_team`). | test corrected to the fixed behaviour; passes |
| BE-T608 | Outdated test. Expected an unknown filter to be ignored; since the BUG-009 fix it is 400. | corrected; passes |
| BE-T709 | Outdated test. Expected a NUL character to be stored; since the BUG-007 fix control characters are removed. | corrected; passes |
| BE-T727 | Weak test (as noted in session 001). Counted links, and the menu links to the same pages. | now counts task rows; passes (manager 3, HR at most 3) |
| BE-T745 | Outdated by the merge. Fetched `/kudos/new`, which now redirects (307) to the kudos hub. | now fetches `/kudos?tab=send`; passes |

Final run: 739 of 746. No baseline failure points to a new defect, and none is caused by the merge except the moved kudos form (intended, IT-12).

## 6. Defects

### BE2-001 – Submitting answers fails with 500 when 14 or more arrive at the same moment; the whole API stalls for 5 to 6 seconds

| | |
| --- | --- |
| Severity | **MEDIUM** (partial failure of a core function under concurrent load; no data loss, no inconsistency) |
| New or known | **New.** Introduced by the fix of BUG-002 in commit `57bf612` (session 001), not by the frontend merge. |
| Endpoint / module | `POST /api/rounds/:id/responses` – `src/server/responses.ts`, the interactive transaction `db.$transaction(async (tx) => …)` |
| Requirement | MVP-09: a valid answer is stored; a second attempt gets 409 |
| Reproduction | 100 %: 4 runs of the suite and 2 probe runs; the limit was the same every time (13 pass, 14 fail) |

Steps to reproduce (script: `probe-submit-concurrency.mjs`, or tests BE2-T354, T358):

1. As HR create and open two rounds for team Alfa and two for team Beta (`POST /api/rounds`, `POST /api/rounds/:id/open`).
2. Send 24 requests at the same moment: every one of the 12 team members posts `{"answers":[3,3,3,3]}` to both rounds of their team.

Expected: 24 × `201 {"ok":true}`.

Actual: 11 × 201 and **13 × `500 {"error":"internal_error"}`**. Every request, including the successful ones, takes 5.7 to 6.1 s. The same happens with pure duplicates: 13 simultaneous repeats of an already submitted answer give 13 × 409 in 0.2 s; 14 give 9 × 409 and 5 × 500 after 5.9 s.

Measured (`probe-submit-threshold.json`):

| Simultaneous submissions | Result | Duration |
| --- | --- | --- |
| 12 | 12 × expected status | 0.2 s |
| 13 | 13 × expected status | 0.2 s |
| 14 | 8 expected, 6 × 500 | 5.7 s |
| 18 | 8 expected, 10 × 500 | 5.8 s |
| 30 | 11 expected, 19 × 500 | 11.5 s |

Further facts:

- **Everything else waits too.** `GET /api/me` of an uninvolved user, sent 0.3 s into such a burst, answered after 5.5 s (BE2-T359).
- **No data is damaged.** After the burst every round has as many participations as responses and exactly the accepted answers are stored (BE2-T355). The 13 refused users were all accepted on a second try, 24 responses in the end (BE2-T356).
- **It needs no special rights.** Duplicates trigger it as well, so one logged-in employee who repeats their own, already submitted answer 14 times in parallel freezes the application for every user for about 6 seconds per burst.
- **Control.** 24 simultaneous kudos (a plain insert) all succeed in 0.4 s (BE2-T360). 12 simultaneous first answers succeed in 0.2 s (BE2-T353).
- **Cause.** Reproduced outside the server on a throwaway copy of the database with the same transaction shape, 20 at once: 12 fail with Prisma `P1008 Socket timeout (the database failed to respond to a query within the configured timeout)`. The server log shows the matching `[api] POST /api/rounds/…/responses failed: PrismaClientKnownRequestError` lines. Before commit `57bf612` the two inserts were a batch transaction; the fix turned it into an interactive transaction that first writes to the round to take the write lock. With many of those open at once, SQLite's single writer lock is not handed over in time.
- **Nothing confidential leaks.** The 500 body is `{"error":"internal_error"}`, and the log line holds only method, path and error class (BE2-T361).

How likely it is in practice: with the 12 demo accounts, 14 people cannot press "Odoslať" within the same fifth of a second, so the demo scenario is not affected. In a pilot with more teams it can happen right after a reminder, and it can be provoked on purpose.

Evidence: `results-new.json#BE2-T282, T354, T358, T359` (failing), `#BE2-T353, T355, T356, T357, T360` (controls), `probe-submit-concurrency.json`, `probe-submit-threshold.json`, `../server-backend.log`.

Not fixed (testing only). Possible directions for the developer: retry the transaction on a lock timeout, or let only one submission at a time into the transaction inside the process. Either must keep the property that BUG-002 fixed.

### BE2-002 – Simultaneous requests create the same own question several times when the wording differs only in letter case

| | |
| --- | --- |
| Severity | **LOW** |
| New or known | **New**, a remainder of BUG-005 (fixed for identical wording only) |
| Endpoint / module | `POST /api/questions` – `src/server/catalog.ts`; unique index `(teamId, text)` from migration `20261113090000_qa_logout_and_unique_question` |
| Requirement | IT-07; rule of the BUG-005 fix "the same wording must not exist twice for the team", which the server applies without regard to case |
| Reproduction | 3 of 3 runs (3, 5 and 5 rows created) |

Steps: as manager Beta send these five requests at the same moment: `POST /api/questions` with `text` = `Súbeh qa2 otázka číslo jedna?`, `SÚBEH QA2 OTÁZKA ČÍSLO JEDNA?`, `súbeh qa2 otázka číslo jedna?`, `Súbeh QA2 Otázka Číslo Jedna?`, `sÚBEH qA2 oTÁZKA čÍSLO jEDNA?`.

Expected: one `201`, four `400 {"fields":{"text":"duplicate"}}`. Sent one after another, the server does answer exactly that (BE2-T173, BE-T568).

Actual: `201,201,201,201,201`; five rows with the same wording in the team's library. Own questions cannot be edited or deleted (IT-07), so they stay.

Cause: the duplicate check in the code compares lower-cased text, but the database index that stops the race compares exact text.

Evidence: `results-new.json#BE2-T188`, `#BE2-T310` (duplicate found by the integrity check at the end of the run).

### BE2-003 – Text made only of invisible characters is still accepted for characters outside the four that the BUG-007 fix removes

| | |
| --- | --- |
| Severity | **LOW** |
| New or known | **Known (BUG-007), fix incomplete.** New inputs, same defect class. |
| Endpoint / module | every endpoint that takes free text – `cleanText` in `src/lib/text.ts`. Confirmed on `POST /api/kudos` (text), `POST /api/rounds` (name), `POST /api/questions` (text), `POST /api/hr/issues` (title), `POST /api/rounds/:id/actions` (topic, description) |
| Requirement | MVP-16 (kudos text 20–500 characters), MVP-04, IT-07, IT-10, MVP-13; FIXES.md of session 001: "text without visible content is empty" |
| Reproduction | 2 of 2 runs, 13 of 13 inputs |

Steps (one example): as an employee `POST /api/kudos` with `{"toUserId":"<colleague>","value":"HELPING","visibility":"PRIVATE","text":"<25 × U+3164>"}`.

Expected: `400 {"fields":{"text":"too_short"}}`, as for 20 × U+200B (BE-T512, passes).

Actual: `201`; a kudos with a text that shows nothing is stored and displayed. The same for 25 × each of U+200E, U+202E, U+2800, U+115F, U+034F, U+2063, U+180E, U+FE0F, U+E0061 (BE2-T316–T325); a draft round whose name is 5 × U+3164 (T326); an own question of 12 × U+2800 that can never be removed (T327); an issue title and an action topic (T328).

Cause: `cleanText` removes U+200B, U+2060, U+FEFF, U+00AD and control characters; other code points that render as nothing pass and count towards the minimum length.

Impact: cosmetic and limited to what a logged-in user can already write; no security effect. U+202E (right-to-left override) additionally reverses the display of the text after it.

Evidence: `results-new.json#BE2-T316` to `#BE2-T328`.

### BE2-004 – Own questions that read the same but differ in Unicode form are not recognised as duplicates

| | |
| --- | --- |
| Severity | **INFORMATIONAL** |
| New or known | New |
| Endpoint / module | `POST /api/questions` – `src/server/catalog.ts` |
| Reproduction | 2 of 2 runs |

Steps: as manager Beta post `Máme v tíme dosť času na učenie QA2?` once with composed accents (NFC) and once with decomposed accents (NFD).

Expected: the second is refused as a duplicate. Actual: both `201`; two questions that look identical in the library.

This needs text that arrives in decomposed form (for example pasted from a PDF or typed on some systems), so it is unlikely in normal use. No requirement names Unicode normalisation; reported as an improvement, not as a defect of a requirement.

Evidence: `results-new.json#BE2-T329`.

### Still open from session 001

**BUG-014 (LOW, known, open).** Malformed percent-encoding in a path (`/api/rounds/%E0%A4%A`, `/api/rounds/%/results`, `/api/teams/%ZZ/summary`, `/team/%E0%A4%A` …) returns a bare `500 Internal Server Error` as `text/plain` from the framework, with or without a session. Nothing is stored or disclosed. Unchanged. Evidence: `results.json#BE-T673, T713–T718`, `results-new.json#BE2-T279`.

## 7. Regression status of the session-001 backend defects

| ID | Session-001 status | Status now | Evidence |
| --- | --- | --- | --- |
| BUG-001 logout did not end the session | Fixed | **Still fixed.** Old token is 401 on the API and redirected on pages; logging out one session ends all sessions of that user (documented). | BE-T074–T076, T226–T231, T746; BE2-T143, T144, T289 |
| BUG-002 answer stored into a closed round | Fixed | **Still fixed** (39 submit-versus-close races, none stored after closing). **The fix introduced BE2-001.** | BE-T407, T720; BE2-T284 |
| BUG-003 lone surrogate → 500 | Fixed | **Still fixed**, also for the emoji field, nested values and key names. | BE-T401, T701–T707; BE2-T330 |
| BUG-005 parallel identical own questions | Fixed | **Fixed for identical wording; incomplete** for wording that differs in case → BE2-002. | BE-T568 (pass); BE2-T188 (fail) |
| BUG-006 length counted in UTF-16 units | Fixed | **Still fixed.** | BE-T402, T710–T712; BE2-T331, BE2-T227 |
| BUG-007 invisible-only text accepted | Fixed | **Fixed for the four characters covered; incomplete** for other blank characters → BE2-003. | BE-T512, T709 (pass); BE2-T316–T328 (fail) |
| BUG-008 wrongly typed issue fields dropped | Fixed | **Still fixed**, also for `noteId`. | BE-T588–T590; BE2-T332 |
| BUG-009 unknown issue filter ignored | Fixed | **Still fixed** (400), including lower-case and SQL-style values; the page falls back to the default filter. | BE-T607, T608; BE2-T123, T244, T245 |
| BUG-010 stale draft suppressed "start a round" | Partial | **Unchanged, as described.** The task is shown again; the expired draft still cannot be opened (409 `deadline_passed`), edited or deleted and stays listed. | BE-T725, T726; BE2-T221 |
| BUG-014 malformed percent-encoding → bare 500 | Open | **Unchanged, still open.** | BE-T673, T713–T718; BE2-T279 |

## 8. Risks (not defects)

Known risks from the session-001 register, each confirmed in one line (suite N13):

| Risk | Status |
| --- | --- |
| R-1 no limit on login attempts | still present: 15 wrong passwords, then the right one logs in (BE2-T333) |
| R-2 cookie has `Secure` in the production build | still present (BE2-T334); matters only if the demo runs over plain HTTP on a host other than localhost |
| R-3 CSRF protection rests on `SameSite=Lax` only | still present |
| R-4 no security headers and no `Cache-Control` on API answers | still present; pages do send `no-store`; `X-Powered-By: Next.js` is sent (BE2-T335, T126) |
| R-5 no request body size limit | still present: a 2 MB body is read and answered with 400 (BE2-T336) |
| R-6 a repeated request creates duplicates (BUG-037) | still present (BE2-T337) |
| R-7 a member can tell an own-team draft (404) from an unknown id (403) | still present (BE2-T338) |
| R-8 author of a comment recognisable by style in a small team | by design; not testable |

New observations, not defects:

- **Client-side navigation to a forbidden page answers HTTP 200.** A request with the header `rsc: 1` gets the framework's payload with the digest `NEXT_HTTP_ERROR_FALLBACK;403` (or `NEXT_REDIRECT;replace;/login` without a session) and none of the page's data; the user sees the 403 page. A normal page request gets a real 403. Monitoring that counts only HTTP status codes will not see these refusals (BE2-T339–T348).
- **Unknown paths under `/api/` answer with the HTML 404 page**, not JSON (BE2-T352).
- **The server log file contains lines added by PowerShell** (`npx.cmd : …`, `+ CategoryInfo …`) around the first error line. They come from how the server's output was redirected, not from the application.

## 9. Blocked

Nothing was blocked. One test (BE2-T190, suggestion texts against the rule library) depends on Node being able to import `src/config/suggestions.ts` directly; it could, and the test passed.

## 10. Limitations and things I am not sure about

- **BE2-001 limit is machine-dependent.** 13 pass / 14 fail was stable on this machine (12 logical CPUs, local disk). On other hardware the number may differ. I identified the Prisma error (`P1008`) on a copy of the database, not inside the server process, because the server log by design shows only the error class.
- **BE2-001 severity is a judgement.** I chose Medium because no data is lost and a retry works. If the application is to be used by more than a few teams at once, or if deliberate stalling by an employee is a concern, it deserves High.
- **BE2-003 and BE2-004 have no explicit requirement** beyond the wording of the BUG-007 and BUG-005 fixes. I report BE2-003 as an incomplete fix and BE2-004 only as informational.
- **Concurrency was tested with at most 30 simultaneous requests** from one client on the same machine. No sustained load test was run (Rule 4 of the policy).
- **Home tasks (IT-11) have no API**; they were checked through the rendered page (links and absence of response content), not through structured data.
- **Natural session expiry after 8 hours** was not waited for. The baseline covers it with forged expired tokens (S1), which pass.
- **Pages were checked for status, redirect target, escaping and absence of protected text**, not for layout or behaviour in a browser; that is the frontend agent's area.
- Browser enforcement of `SameSite`, `Secure` and `HttpOnly` cannot be observed with an HTTP client; only the attributes in `Set-Cookie` were verified.
