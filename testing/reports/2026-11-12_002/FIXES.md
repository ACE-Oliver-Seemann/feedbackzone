# Opravy a retest – relácia 2026-11-12_002

Identifikátory sú z [BUG_REGISTER.md](BUG_REGISTER.md). Agenti kód nemenili; opravy vznikli po ich
skončení (backend a celý systém počas dobiehania frontendu, ale nasadené až po ňom, takže testovanie
prebehlo celé nad commitom `cc58885`).

## Opravené chyby

| ID | Oprava | Súbory | Retest |
|---|---|---|---|
| BUG-039 | Odpovede sa zapisujú jedna po druhej v rade v rámci procesu servera. Opakované odoslanie sa odmietne ešte pred radom, takže opakovaním požiadavky sa nedá zdržať ostatných. | `src/server/responses.ts`, `src/lib/text.ts` (`serialQueue`) | Sonda agenta: 12 až 30 súbežných odoslaní bez chyby do 120 ms; 24 ľudí naraz, 24 uložených odpovedí, 0 chýb. Sada N15: 9 z 9. Regresný test. |
| BUG-040 | Kontrola duplicity a vloženie vlastnej otázky bežia ako jeden krok v rade. | `src/server/catalog.ts` | Sada N4: 17 zo 17. Regresný test. |
| BUG-041 | `cleanText` odstraňuje všetky formátovacie znaky Unicode (okrem spojovačov potrebných pre emoji a vlajky) a text zložený iba z prázdnych alebo samostatne neviditeľných znakov považuje za prázdny. | `src/lib/text.ts` | Sada TEXT-INVISIBLE bez zlyhania (prvý retest 3 zlyhania, po doplnení 0). Regresný test. |
| BUG-042 | `cleanText` prevádza text do tvaru NFC. | `src/lib/text.ts` | Regresný test. |
| BUG-043 | Po neúspešnom uložení sa fokus presunie na prvé chybné pole (alebo na chybovú hlášku) a stránka sa naň posunie. | `src/components/ui/focus-error.ts` (nové), `src/components/new-round-form.tsx` | Frontend 04: 50 z 50. |
| BUG-044 | Trvanie konfiet po prieskume skrátené z 1,9 s na 1,45 s. | `src/components/ui/celebrate.tsx` | Frontend 03: 52 z 52. |
| BUG-045 | Otázka vchádza sprava pri „Ďalej“ a zľava pri „Späť“; pri obmedzenom pohybe iba krátke prelínanie. | `src/components/fill-wizard.tsx`, `src/app/globals.css` | Frontend 03: 52 z 52. |
| BUG-046, BUG-047 | Stránka má odsadenie posúvania pre prilepenú hlavičku aj prilepenú lištu, takže zaostrený prvok zostane viditeľný. | `src/app/globals.css` | Frontend 04 a 06: bez zlyhania (po prvom reteste zostal 1 riadok prekrytý o 7 px, po zväčšení odsadenia 0). |
| BUG-048 | Ponuka animácií sa na úzkej obrazovke neposunie za ľavý okraj; riadky volieb majú na dotyku 44 px. | `src/components/motion-menu.tsx` | Frontend 06: bez zlyhania. |
| BUG-049 | Poďakovanie po odoslaní dostane fokus; pri odmietnutom kudos a prihlásení fokus prejde na chybné pole alebo hlášku. | `src/components/fill-wizard.tsx`, `kudos-form.tsx`, `login-form.tsx` | Frontend 03 a 05: 82 z 82. |
| BUG-052 | Nadpis „Náhľad“ je h2. | `src/components/kudos-form.tsx` | Frontend 06. |
| BUG-053 | Dĺžku obmedzuje kód po znakoch (`limitChars`), nie atribút `maxLength`. | `src/lib/text.ts`, `fill-wizard.tsx`, `kudos-form.tsx` | Frontend 03 a 05. |
| BUG-057 | Počítadlo „videných“ kudos sa ukladá aj pri nule a pod ID používateľa (predtým pod celým menom). | `src/components/kudos-hub.tsx`, `src/app/(app)/kudos/page.tsx` | Celý systém m2: 34 z 34. |
| BUG-058, BUG-059 | Výber stavu po obnovení údajov prevezme hodnotu zo servera. | `src/components/action-status-select.tsx`, `issue-controls.tsx` | Celý systém m5: 23 z 23. |
| BUG-061 | Konfety za nové kudos vystrelia až vtedy, keď je vidno záložku s hláškou. | `src/components/kudos-hub.tsx` | Celý systém m2: 34 z 34. |

## Čiastočne opravené

| ID | Čo je opravené | Čo zostáva |
|---|---|---|
| BUG-050 | Stránky 403 a 404 vnútri aplikácie už nemajú vnorený `<main>` ani zbytočné posúvanie; majú vlastné súbory `src/app/(app)/forbidden.tsx` a `not-found.tsx`. Stránka 404 mimo aplikácie má `<main>`. | Titulok karty pri 403 a 404 vnútri aplikácie zostáva titulkom pôvodnej stránky (napr. „Podnety“). Nadpis na stránke je správny. |
| BUG-051 | Odhlásenie, zatvorenie hlásenia, odkazy späť a tlačidlo ponuky animácií majú na dotyku aspoň 44 px. | Textové odkazy na tím a kolo vnútri viet a tabuliek (15 až 20 px). Odkazy v texte sú z pravidla 44 px vyňaté; zväčšenie by rozbilo riadkovanie. |

## Neopravené

| ID | Dôvod |
|---|---|
| BUG-054 | Kontrast rámčekov polí je rozhodnutie o vzhľade, ktorý vlastní kolega. Odporúčanie: tmavší odtieň rámčeka (aspoň 3 : 1). |
| BUG-055 | Server pri podnete a poznámke vracia jednu súhrnnú chybu, nie chyby po poliach; prepojenie vyžaduje zmenu odpovede API. Označenie povinných polí je rozhodnutie o vzhľade pre všetky formuláre naraz. |
| BUG-056 | Otázka je popisom skupiny odpovedí (`<legend>`), čo je pre čítačku obrazovky správne; pridanie nadpisu by ju čítalo dvakrát. Postup sa oznamuje cez živú oblasť. |
| BUG-060 | Návrat tlačidlom Späť obnoví stránku z pamäte prehliadača. Obnovenie údajov po odoslaní by nahradilo obrazovku poďakovania hláškou „už vyplnené“. Neškodné: kliknutie na „Vyplniť“ povie, že kolo je vyplnené, a druhá odpoveď sa neuloží. |
| BUG-010, 014, 036, 037 | Bez zmeny oproti relácii 001, dôvody sú v jej FIXES.md. |

## Retest

| Kontrola | Výsledok | Poznámka |
|---|---|---|
| Automatické testy projektu | 273 z 273 | 6 nových regresných testov v `tests/qa-fixes.test.ts` |
| Backend, obe sady, finálne zostavenie | 1 100 z 1 107 | 7 zlyhaní je BUG-014 (otvorená) |
| Frontend, všetky sady okrem 02, 03, 05 na finálnom zostavení | 663 zo 674 | 11 zlyhaní: 5 textové odkazy (BUG-051), 2 titulok 403/404 (BUG-050), 2 BUG-055, 1 BUG-054, 1 BUG-056 |
| Celý systém, sady m1 až m7 | 278 z 281 | 1 BUG-060 (otvorená), 1 test očakával atribút `maxLength` odstránený opravou BUG-053, 1 blokovaný |
| Akceptačný scenár (`scripts/acceptance.mjs`) | prešiel | finálne zostavenie, čistý seed |
| Kontrola typov, lint, zostavenie | bez chýb | |

Obmedzenia retestu:

- **Frontendové sady 02, 03 a 05 a celý systém bežali na predposlednom zostavení.** Po nich pribudli už len
  tri zmeny: doplnenie neviditeľných znakov, rozdelenie stránok 403 a 404 a väčšie odsadenie posúvania.
  Dotknuté sady (frontend 01, 04, 06, 07, backend nové testy, akceptačný scenár) bežali na finálnom.
- **Počty testov frontendu sa medzi behmi líšia** (716 pri testovaní, 674 pri reteste), lebo sada 07 má
  niektoré kontroly závislé od stavu dát a regresná sada 10 bežala pri testovaní zvlášť.
- **Výsledky retestu sú v `evidence/retest/`**, pôvodné výsledky agentov zostali v `evidence/backend`,
  `evidence/frontend` a `evidence/integration`.

## Zmeny správania po opravách

- **Odpovede sa zapisujú po jednej.** Pri bežnom počte ľudí to nie je cítiť (24 naraz za 0,3 s).
- **Text sa ukladá v tvare NFC a bez formátovacích znakov** (napr. značiek smeru písma).
- **Pri chybe formulár skočí na chybné pole** (nové kolo, kudos, prihlásenie).
- **Otázky v prieskume sa posúvajú v smere pohybu.**
- **Stránky 403 a 404 vnútri aplikácie majú menu;** neznáma adresa mimo aplikácie je bez menu ako doteraz.
