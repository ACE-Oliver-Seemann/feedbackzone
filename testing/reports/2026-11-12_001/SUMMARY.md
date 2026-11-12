# System test 2026-11-12_001 – Summary

**Scope:** full system test per `TESTING_RULES.md` of branch `feat/ui-asseco-theme` (Asseco CE redesign, unified kudos, motion/celebrations) on test data only.
**Overall result: CONDITIONAL PASS** – no critical or high defects; 16 of 17 defects fixed and retested; 1 medium defect needs a product-owner decision. Details: RELEASE_READINESS.md.

## How it was tested
Three independent agents ran in parallel (TESTING_RULES §2):

| Phase | Agent | Environment |
|---|---|---|
| Level 1 – Backend | Backend Testing Specialist | Isolated copy of commit 8dfeeb1 on :3002 with its own database (aggressive/invalid requests could not disturb the others) |
| Level 2 – Frontend | Frontend Testing Specialist | Real Microsoft Edge via Playwright on :3000, own `FE-` data, 6 viewport widths, reduced motion on/off |
| Level 3 – End-to-end | Integration Testing Specialist | Real Edge via Playwright on :3000 + read-only DB checks, team Beta, own `INT-` data, multi-user and failure scenarios |

Afterwards: consolidation, fixes (lead: backend; frontend fixer agent: UI), retests, full regression and a production build.

## Numbers
| | Backend | Frontend | Integration | Total |
|---|---|---|---|---|
| Executed test attempts | 343 | 441 | 367 | **1,151** |
| Passed | 332 | 417 | 347 | 1,096 |
| Failed (→ defects) | 8 | 23 | 6 | 37 |
| Blocked | 1 | 1 | 0 | 2 |
| Observations / void (no pass-fail rule, or the agent's own script error re-run correctly) | 2 | 0 | 14 | 16 |
| Confirmed defects | 3 | 11 | 4 (1 duplicate) | **17 unique** |

Every row is listed in TEST_CASES.md. Pagination, filtering and sorting do not exist in this MVP (recorded as N/A, not as defects). The 20-defects-per-phase target was not reached; no defects were invented to reach it (TESTING_RULES §1).

## Defects by severity
Critical 0 · High 0 · Medium 5 · Low 12 → 16 fixed and retested, 1 open (BUG-002). See BUG_REGISTER.md.

## Verified as working
- Full MVP cycle end to end: create round → open → one-question-per-screen filling → confetti/thanks → close → results with threshold → actions with status → "Povedali ste, urobili sme" → next round shows latest actions; HR overview with "Čaká na krok".
- NFR-01: answers cannot be linked to people (schema, API, DB rows, transaction rollback); NFR-02 threshold 5 everywhere; NFR-03 full permission matrix incl. other teams' ids (403); NFR-04 wording; private kudos visible only to the recipient.
- Duplicate and concurrent submissions (one 201, one 409), invalid state transitions, validation boundaries, forged/expired cookies, XSS payloads escaped in rendered pages.
- Confetti only after a confirmed submission, never on failure or repeat; page transitions with direction; reduced-motion behaviour; no horizontal overflow from 360 to 1440 px; keyboard operation.

## Final verification (after fixes)
typecheck ✔ · lint ✔ · `npm test` 138/138 ✔ · acceptance on dev ✔ · `npm run build` ✔ · acceptance on the production build ✔ · production console clean ✔ · application running on http://localhost:3000.

## Remaining risks (not defects under mvp.md; unchanged)
- **Demo setup:** run the demo from a production build (`npm run build && npm start`), not `npm run dev` – avoids the dev indicator and dev-only console messages.
- **Security before any pilot:** no login rate limiting, no security headers / `Cache-Control: no-store`, login accepts any Content-Type, `Secure` cookie only in production mode (BACKEND_REPORT R-01…R-04). Acceptable for a demo on test data.
- **Shared browser:** on one laptop with several accounts, a stale tab acts as whoever logged in last (INTEGRATION_REPORT R1).
- **Expired draft** cannot be opened, edited or deleted and stays as "Koncept" (BACKEND_REPORT R-07).
- Answers are lost on reload mid-questionnaire (by design, NFR-01-friendly) and there is no warning (INTEGRATION R3).
- Kudos to HR / across teams: which team feed shows them should be confirmed by the product owner (BACKEND R-08).
- Not covered: real screen readers, Firefox/Safari, automatic close at the deadline in real time, server log contents (no access).

## Release recommendation
**Conditional pass for the management demonstration** – see RELEASE_READINESS.md.
