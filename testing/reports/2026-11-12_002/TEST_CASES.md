# Prehľad testov – relácia 2026-11-12_002

Každý vykonaný test (ID, opis, predpoklady, kroky, očakávaný a skutočný výsledok, stav, odkaz na dôkaz)
je v súbore svojej fázy. Súbory sú generované z výsledkov behov, nie písané ručne.

| Fáza | Súbor | Vykonané | Prešlo | Zlyhalo | Blokované |
|---|---|---|---|---|---|
| 1 – Backend | [TEST_CASES_BACKEND.md](TEST_CASES_BACKEND.md) | 1 107 | 1 080 | 27 | 0 |
| 2 – Frontend | [TEST_CASES_FRONTEND.md](TEST_CASES_FRONTEND.md) | 716 | 682 | 34 | 0 |
| 3 – Celý systém | [TEST_CASES_INTEGRATION.md](TEST_CASES_INTEGRATION.md) | 281 | 275 | 5 | 1 |
| **Spolu** | | **2 104** | **2 037** | **66** | **1** |

Čísla sú z testovania pred opravami (commit `cc58885`). Výsledky po opravách sú vo [FIXES.md](FIXES.md).

## Zloženie

- **Backend:** 746 testov sady z relácie 001 spustených znova ako regresia (ID `BE-T…`) a 361 nových
  testov (ID `BE2-T…`): oprávnenia stránok podľa rolí vrátane nových adries, relácie a podvrhnuté tokeny,
  kudos s emotikonom, vlastné otázky, návrhy krokov, podnety a poznámky HR, prah dôvernosti vo vývoji
  a porovnaní tímov, súbeh odoslaní, neviditeľné znaky, kontrola migrácií.
- **Frontend:** nová sada pre zmenený vzhľad (skripty `s2-*.mjs`): navigácia 156, komponenty 43,
  formuláre a prieskum 73, animácie 34, rozloženie na šírkach 320 až 1440 px 265, vzhľad a texty 49,
  prístupnosť 96.
- **Celý systém:** nové sady `m1` až `m7` cez prehliadač s overením v API a databáze: celý cyklus
  prieskumu 60, kudos 36, prihlásenie a oprávnenia 43, konzistencia údajov 27, chybové stavy 39,
  viac používateľov naraz 26, regresia iterácií 50.

## Testy doplnené pri oprave

Šesť regresných testov v `tests/qa-fixes.test.ts` (spúšťa ich `npm test`):

| Test | Chyba | Očakávanie | Stav |
|---|---|---|---|
| 30 súbežných odoslaní od šiestich ľudí | BUG-039 | 6 uložených, 24 odmietnutých s 409, žiadna 500 | prešiel |
| Zlyhané odoslanie nezablokuje ďalšie | BUG-039 | po chybe 500 ďalší človek odošle s 201 | prešiel |
| Päť súbežných otázok líšiacich sa veľkosťou písmen | BUG-040 | práve jedna otázka | prešiel |
| Zložené a rozložené diakritické znaky | BUG-042 | druhá požiadavka je duplicita (400) | prešiel |
| `cleanText` a ďalšie neviditeľné znaky | BUG-041 | prázdny text; emoji a vlajky zostávajú | prešiel |
| Kudos z prázdnych Braillových znakov | BUG-041 | 400, nič sa neuloží | prešiel |
