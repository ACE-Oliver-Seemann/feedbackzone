# Testovacie prípady – relácia 2026-11-12_001

Každá fáza má vlastný súbor s jedným riadkom na vykonaný test (ID, opis, predpoklady, kroky, očakávaný
a skutočný výsledok, stav, odkaz na dôkaz). Súbory sú po anglicky, tak ako ich napísali agenti.

| Fáza | Súbor | Riadkov s testom | Vykonané | Prešlo | Zlyhalo | Blokované |
|---|---|---|---|---|---|---|
| 1 – Backend | [TEST_CASES_BACKEND.md](TEST_CASES_BACKEND.md) | 746 | 746 | 714 | 32 | 0 |
| 2 – Frontend | [TEST_CASES_FRONTEND.md](TEST_CASES_FRONTEND.md) | 575 | 575 | 496 | 72 | 7 |
| 3 – Celý systém | [TEST_CASES_INTEGRATION.md](TEST_CASES_INTEGRATION.md) | 377 | 377 | 351 | 23 | 3 |
| **Spolu** | | | **1 698** | **1 561** | **127** | **10** |

Čísla v stĺpcoch „Vykonané“ až „Blokované“ sú zo záverečných správ agentov a platia pre stav **pred opravami**.
Blokované testy sú animácie a konfety (IT-01 a IT-02 sú pozastavené a v tejto verzii nie sú) a jeden
`npm run build`, ktorý agent 3 nespustil, aby nenarušil bežiace testovacie servery.

## Opätovné testovanie po opravách

Výsledky a vysvetlenie zvyšných zlyhaní sú vo [FIXES.md](FIXES.md).

| Sada | Vykonané | Prešlo | Zlyhalo | Dôkaz |
|---|---|---|---|---|
| Backendová sada agenta 1, finálne zostavenie | 746 | 735 | 11 | `evidence/retest/backend-run-output-final.txt` |
| Scenáre agenta 3 | 374 | 361 | 13 | `evidence/retest/integration-*.txt` |
| Cielený retest v prehliadači (nižšie) | 85 | 85 | 0 | `evidence/retest/frontend-retest.txt`, `evidence/retest/shots/` |
| Akceptačný scenár (`scripts/acceptance.mjs`) | 43 | 43 | 0 | `evidence/retest/acceptance-final.log` |
| Automatické testy projektu (`npm test`) | 267 | 267 | 0 | `tests/`, z toho `tests/qa-fixes.test.ts` je nových 26 |

### Cielený retest v prehliadači

Skript: `testing/scripts/retest/retest.mjs`. Prostredie: finálne zostavenie na `http://localhost:3302`,
databáza `prisma/qa-frontend.db` so seedom a ukážkovými dátami, Microsoft Edge bez okna, šírky 360 a 1280 px.
Predpoklad každého testu: prihlásený testovací účet uvedený v skripte. Kroky sú v skripte pri danom opise.

| ID | Chyba | Čo sa overuje (očakávaný výsledok) | Skutočný výsledok | Stav |
|---|---|---|---|---|
| RT-001 | BUG-004 | manager with 3 tasks on the home page still has a 'Vyplniť' link to the open round | tasks=3; fill links=1 | PASS |
| RT-002 | BUG-004 | the link opens the questionnaire of the own team | /rounds/:id/fill | PASS |
| RT-003 | BUG-022 | menu item 'Domov' is marked while an employee fills in the questionnaire | Domov | PASS |
| RT-004 | BUG-016 | after 'Začať' the keyboard focus is inside the questionnaire, not lost on <body> | activeElement=DIV:-1 | PASS |
| RT-005 | BUG-016 | after 'Ďalej' the focus moves to the new question again | activeElement=DIV:-1 | PASS |
| RT-006 | BUG-016 | the questionnaire can be completed to the comment step with the keyboard only | reached the comment step | PASS |
| RT-007 | BUG-031 | with 'reduce motion' the progress bar has no transition | transition-property=none | PASS |
| RT-008 | BUG-006 | the comment counter counts one emoji as one character | 3 / 1000 | PASS |
| RT-009 | BUG-012 | questionnaire: after the session ends, submitting says to log in again and keeps the answers | Prihlásenie vypršalo. Prihlás sa znova v novej karte a potom to tu skús ešte raz. Čo máš vyplnené, zostane. | comment kept=true | PASS |
| RT-010 | BUG-012 | kudos form: after the session ends, the message asks to log in again | Prihlásenie vypršalo. Prihlás sa znova v novej karte a potom to tu skús ešte raz. Čo máš vyplnené, zostane. | PASS |
| RT-011 | BUG-001 | after logout in one window, a second window of the same user is sent to the login page | second window path=/login; old cookie on /api/me=401 | PASS |
| RT-012 | BUG-038 | a failed logout request shows a message instead of silently staying logged in | Odhlásenie sa nepodarilo. Skús to znova. | PASS |
| RT-013 | BUG-013 | unknown address as logged-in employee: Slovak 404 page with a link back | HTTP 404; h1="Túto stránku sme nenašli"; back link=1; lang=sk | PASS |
| RT-014 | BUG-013 | unknown address as HR: Slovak 404 page with a link back | HTTP 404; h1="Túto stránku sme nenašli"; back link=1; lang=sk | PASS |
| RT-015 | BUG-011 | setup: long unbroken text stored as action, kudos, issue, note and round name | action/kudos/issue/note/round = 201/201/201/201/201 | PASS |
| RT-016 | BUG-011 | 360 px: list of rounds with a 110-character unbroken round name does not scroll sideways | page wider than the screen by 0 px | PASS |
| RT-017 | BUG-011 | 360 px: results page (action) with a 420-character unbroken link does not scroll sideways | page wider than the screen by 0 px | PASS |
| RT-018 | BUG-011 | 360 px: team page (action, kudos) with a 420-character unbroken link does not scroll sideways | page wider than the screen by 0 px | PASS |
| RT-019 | BUG-011 | 360 px: my kudos with a 420-character unbroken link does not scroll sideways | page wider than the screen by 0 px | PASS |
| RT-020 | BUG-011 | 360 px: HR issues with a 420-character unbroken link does not scroll sideways | page wider than the screen by 0 px | PASS |
| RT-021 | BUG-011 | 360 px: HR notes with a 420-character unbroken link does not scroll sideways | page wider than the screen by 0 px | PASS |
| RT-022 | BUG-011 | 360 px: report with a 420-character unbroken link does not scroll sideways | page wider than the screen by 0 px | PASS |
| RT-023 | REGRESSION | HTML in an action is shown as text and runs no script | shown literally=true; injected elements=0; dialog=false | PASS |
| RT-024 | BUG-015 | manager Beta home: 'uzavreté 3 dni' (was '3 dní') | Kolo „Pulse – 44. týždeň“ je uzavreté 14 dní a tím čaká, čo sa s výsledkami stane. | Kolo „Pulse – záťaž a sústredenie“ je uzavreté 3 dni a tím čaká, čo sa s výsledkami stane. | PASS |
| RT-025 | BUG-015 | HR home and overview: number of days and verb agree | 3 z 8 uzavretých kôl čakajú na krok. Najdlhšie Tím Alfa, 28 dní. | PASS |
| RT-026 | BUG-009 | issues page with an unknown filter in the address falls back to 'Nevybavené' and lists only unfinished | page HTTP 200; filter=ACTIVE; finished issue shown=0; API with unknown filter=400 | PASS |
| RT-027 | BUG-033 | the page behind menu 'Prieskumy' is headed 'Prieskumy…' for manager and HR | manager="Prieskumy môjho tímu"; HR="Prieskumy všetkých tímov" | PASS |
| RT-028 | BUG-028 | lists of rounds use h1 then h2 (no skipped level) and the main menu has a name | levels=H1,H2; nav label=Hlavné menu | PASS |
| RT-029 | BUG-017 | new round as HR: after switching the team every preselected question is in an expanded topic | {"checked":3,"hidden":0,"open":3} | PASS |
| RT-030 | BUG-018 | new round as manager: an own question added to a full round is saved with an explanation and its topic is expanded | notice shown; question visible=true; counter still 5=true | PASS |
| RT-031 | BUG-021 | report of a draft says it is a draft and shows no participation | AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA Tím Alfa, uzávierka 31. 12. 2026 Kolo je koncept a ešte nebolo spustené. Komentá | PASS |
| RT-032 | BUG-024 | public kudos to HR is refused with an explanation; private kudos to HR is sent | error shown, then private kudos sent | PASS |
| RT-033 | BUG-023 | trend table: keyboard-focusable scroll region with a hint | regions=1; hint=1 | PASS |
| RT-034 | BUG-025 | trend chart labels are at least 11 px at 360 px | smallest label height=15 px of 8 labels | PASS |
| RT-035 | BUG-032 | comparison legend: steps do not overlap ('pod 3,0', 'od 3,0', …) | Skóre: pod 3,0 od 3,0 od 3,5 od 4,0 od 4,5 – bez dát | PASS |
| RT-036 | BUG-035 | comparison: Tím Beta 'Stála otázka' shows 4,07 (was 4,06) | API=4.07; shown on the page=true | PASS |
| RT-037 | BUG-023 | comparison table: keyboard-focusable scroll region | regions=1 | PASS |
| RT-038 | BUG-030 | comparison: the dash for 'no data' has a contrast of at least 4.5 : 1 | lab(35.5623 -1.74978 -15.4316) on white = 19.3 : 1 | PASS |
| RT-039 | BUG-030 | placeholder text has a contrast of at least 4.5 : 1 | rgb(100, 116, 139) on white = 4.76 : 1 | PASS |
| RT-040 | BUG-027 | every screen has its own browser title | 9 distinct of 9: Domov – Feedback portál | Prieskumy – Feedback portál | Plnenie reakcie – Feedback portál | Porovnanie tímov – Feedback portál | PASS |
| RT-041 | BUG-026 | 360 px: main menu links are at least 44 px tall | smallest=44 px | PASS |
| RT-042 | BUG-026 | 360 px: logout button are at least 44 px tall | smallest=46 px | PASS |
| RT-043 | BUG-026 | 360 px: home task and list buttons are at least 44 px tall | smallest=44 px | PASS |
| RT-044 | BUG-026 | 360 px: tabs inside a page are at least 44 px tall | smallest=46 px | PASS |
| RT-045 | BUG-026 | 360 px: kudos form: selects, text, submit are at least 44 px tall | smallest=44 px | PASS |
| RT-046 | BUG-026 | 360 px: round list buttons (manager) are at least 44 px tall | smallest=44 px | PASS |
| RT-047 | BUG-026 | 360 px: new round: inputs, question rows, submit are at least 44 px tall | smallest=44 px | PASS |
| RT-048 | BUG-026 | 360 px: issues: filters and controls (HR) are at least 44 px tall | smallest=45 px | PASS |
| RT-049 | BUG-026 | 360 px: login inputs and button are at least 44 px tall | smallest=44 px | PASS |
| RT-050 | BUG-026 | 360 px: 'Rozdelenie odpovedí' toggle is at least 24 px tall (WCAG minimum) | smallest=36 px | PASS |
| RT-051 | REGRESSION | 360 px: HR home loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-052 | REGRESSION | 360 px: HR rounds loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-053 | REGRESSION | 360 px: HR overview loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-054 | REGRESSION | 360 px: HR comparison loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-055 | REGRESSION | 360 px: HR issues loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-056 | REGRESSION | 360 px: HR notes loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-057 | REGRESSION | 360 px: manager home loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-058 | REGRESSION | 360 px: manager rounds loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-059 | REGRESSION | 360 px: new round loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-060 | REGRESSION | 360 px: results loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-061 | REGRESSION | 360 px: report loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-062 | REGRESSION | 360 px: trend loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-063 | REGRESSION | 360 px: team page loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-064 | REGRESSION | 360 px: employee home loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-065 | REGRESSION | 360 px: kudos form loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-066 | REGRESSION | 360 px: my kudos loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-067 | REGRESSION | 1280 px: HR home loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-068 | REGRESSION | 1280 px: HR rounds loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-069 | REGRESSION | 1280 px: HR overview loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-070 | REGRESSION | 1280 px: HR comparison loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-071 | REGRESSION | 1280 px: HR issues loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-072 | REGRESSION | 1280 px: HR notes loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-073 | REGRESSION | 1280 px: manager home loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-074 | REGRESSION | 1280 px: manager rounds loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-075 | REGRESSION | 1280 px: new round loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-076 | REGRESSION | 1280 px: results loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-077 | REGRESSION | 1280 px: report loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-078 | REGRESSION | 1280 px: trend loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-079 | REGRESSION | 1280 px: team page loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-080 | REGRESSION | 1280 px: employee home loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-081 | REGRESSION | 1280 px: kudos form loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-082 | REGRESSION | 1280 px: my kudos loads with HTTP 200 and no sideways scrolling | HTTP 200; overflow=0 px | PASS |
| RT-083 | REGRESSION | employee completes the questionnaire at 360 px and sees the thank-you screen | thank-you shown; second submission=409 | PASS |
| RT-084 | REGRESSION | permissions still hold in the browser: employee gets 403 on results, trend and HR pages | 403,403,403,403,403 | PASS |
| RT-085 | REGRESSION | no uncaught JavaScript error in any window during the retest | none | PASS |
