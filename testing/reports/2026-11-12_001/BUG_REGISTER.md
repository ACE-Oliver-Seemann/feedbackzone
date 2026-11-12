# Bug register – system test 2026-11-12_001

17 unique confirmed defects (18 records: INT-003 is a duplicate of BE-001 and is merged into it, with the evidence of both agents kept in their reports).
No CRITICAL and no HIGH defects were found.

| ID | Agent ID | Phase | Description | Severity | Status |
|---|---|---|---|---|---|
| BUG-001 | BE-001 / INT-003 | Backend + Integration | Logout only cleared the cookie; a copied session token kept working for up to 8 h | Medium | Fixed, retested |
| BUG-002 | INT-002 | Integration | "Latest closed round" (thank-you screen, team page order) is chosen by deadline, not by the actual closing time | Medium | **Open – needs product-owner decision** (fix requires a `closedAt` column = data-model change) |
| BUG-003 | INT-001 | Integration | Team page said "Uzavreté &lt;deadline&gt;" for rounds closed before their deadline | Medium | Fixed (wording "Uzávierka &lt;date&gt;"), retested |
| BUG-004 | FE-001 | Frontend | 404 was the default English Next.js page without a way back (NFR-07) | Medium | Fixed, retested |
| BUG-005 | FE-002 | Frontend | Keyboard focus lost to `<body>` after confirming Spustiť / Uzavrieť | Medium | Fixed, retested |
| BUG-006 | BE-002 | Backend | Length limits counted UTF-16 code units: an emoji counted as 2 characters | Low | Fixed, retested |
| BUG-007 | BE-003 | Backend | Text consisting only of zero-width characters passed "required"/minimum-length checks | Low | Fixed, retested |
| BUG-008 | FE-003 | Frontend | Console error "Encountered a script tag…" on 403/404 pages (motion init script) | Low | Fixed, retested (also on the production build) |
| BUG-009 | FE-004 | Frontend | Long action topic without spaces was clipped | Low | Fixed, retested |
| BUG-010 | FE-005 | Frontend | Action form showed only a generic error, no field-level messages | Low | Fixed, retested |
| BUG-011 | FE-006 | Frontend | New-round form showed name/date errors only after 3–5 questions were selected | Low | Fixed, retested |
| BUG-012 | FE-007 | Frontend | Field hints/errors not linked to inputs (`aria-describedby`, `aria-invalid`) | Low | Fixed, retested |
| BUG-013 | FE-008 | Frontend | No loading indicator during slow navigation | Low | Fixed, retested |
| BUG-014 | FE-009 | Frontend | Every page had the same `<title>` | Low | Fixed, retested (also on the production build) |
| BUG-015 | FE-010 | Frontend | Heading levels skipped h1 → h3 on `/` and `/hr/rounds` | Low | Fixed, retested |
| BUG-016 | FE-011 | Frontend | "Animácie" popover drifted away from its button on window resize | Low | Fixed, retested |
| BUG-017 | INT-004 | Integration | Session expired mid-questionnaire → only a generic error, no hint to log in again | Low | Fixed, retested |

Severity distribution: Critical 0 · High 0 · Medium 5 · Low 12 · (Informational: see risks in SUMMARY.md)
Status: 16 fixed and retested · 1 open (BUG-002, decision needed)
