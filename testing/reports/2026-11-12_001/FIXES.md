# Opravy a opätovné testovanie – relácia 2026-11-12_001

Identifikátory BUG-xxx sú z [BUG_REGISTER.md](BUG_REGISTER.md). Opravy robil koordinátor po skončení všetkých
troch fáz; agenti kód nemenili.

## Ako sa retestovalo

| Čo | Výsledok | Dôkaz |
|---|---|---|
| Automatické testy projektu (`npm test`), z toho 26 nových regresných v `tests/qa-fixes.test.ts` | 267 z 267 prešlo | výstup v tejto relácii |
| Celá backendová sada agenta 1 proti finálnemu zostaveniu | 735 zo 746 prešlo (pred opravami 714) | `evidence/retest/backend-run-output-final.txt` |
| Cielený retest v prehliadači Edge, 360 a 1280 px, finálne zostavenie | 85 z 85 prešlo | `evidence/retest/frontend-retest.txt`, `evidence/retest/shots/` |
| Scenáre agenta 3 (celý systém) | 361 z 374 prešlo (pred opravami 351) | `evidence/retest/integration-*.txt` |
| Akceptačný scenár z mvp.md cez HTTP, finálne zostavenie, čistý seed | 43 zo 43 prešlo | `evidence/retest/acceptance-final.log` |
| `npm run typecheck`, `npm run lint`, `npm run build` | bez chýb | výstup v tejto relácii |

**Poznámky k retestu, ktoré treba vedieť:**

- **Pôvodná frontendová sada agenta 2 sa po opravách nedala použiť.** Opravy zmenili stránky (dve tlačidlá
  „Vyplniť“ na úvode, úroveň nadpisov, názvy stránok), takže jej skripty nenachádzali prvky a zlyhávali
  reťazovo. Neúplný výstup je v `evidence/retest/frontend-0*.txt`. Opravené chyby frontendu preto overuje
  nový cielený skript `testing/scripts/retest/retest.mjs` (85 kontrol), nie pôvodných 575 testov.
- **Scenáre agenta 3 bežali na zostavení pred poslednou úpravou veľkosti ovládacích prvkov** (iba triedy CSS).
  Na finálnom zostavení som ich nezopakoval; finálne zostavenie pokrýva backendová sada, cielený retest
  a akceptačný scenár.
- **V backendovej sade som upravil jednu vec:** po úspešnom odhlásení sa testovací účet znova prihlási
  (`testing/scripts/backend/lib.mjs`). Bez toho by po oprave BUG-001 zlyhalo 18 ďalších testov, lebo
  odhlásenie teraz naozaj ukončí reláciu.

### Testy, ktoré po opravách stále zlyhávajú, a prečo

**Backend (11):**

| Testy | Dôvod |
|---|---|
| BE-T673, T713–T718 (7) | BUG-014, neopravené: chybné percentové kódovanie v adrese. |
| BE-T537 | Očakáva staré správanie. Verejné kudos pre príjemcu bez tímu sa po oprave BUG-024 odmietne. |
| BE-T608 | Očakáva staré správanie. Neznámy filter podnetov po oprave BUG-009 vráti 400. |
| BE-T709 | Očakáva staré správanie. Riadiace znaky (tu NUL) sa po oprave BUG-007 z textu odstraňujú. |
| BE-T727 | Slabý test (podľa samotného agenta): počíta odkazy, nie úlohy. Po oprave BUG-004 je na úvode o odkaz viac; úloh je stále najviac 3 (overuje `tests/usability.test.ts`). |

**Celý systém (13):**

| Kontroly | Dôvod |
|---|---|
| J4 ×2, J6 ×2 | Očakávajú staré nesprávne skloňovanie („3 dní“, „z 1 uzavretých kôl“), opravené v BUG-015. |
| J10 ×3 | Zastarané selektory po oprave (nadpis `h3` → `h2`, dve tlačidlá „Vyplniť“) a z toho plynúci reťazový výpadok. |
| J3 ×2 | Očakávajú, že verejné kudos pre HR prejde (BUG-024), a z toho odvodený počet riadkov. |
| J9 ×1 | Riziko R-3 (chýba `Cache-Control` na API), nie chyba; neriešené. |
| J5 ×1 | BUG-036, neopravené. |
| J7 ×1 | BUG-037, neopravené. |
| J7 ×1 | BUG-038: test meria, či je používateľ po neúspešnej požiadavke odhlásený. To nejde zaručiť (cookie je `HttpOnly` a server požiadavku nedostal); oprava preto ukazuje chybovú hlášku, čo overuje RT v cielenom reteste. |

## Opravené chyby

| ID | Oprava | Súbory | Retest |
|---|---|---|---|
| BUG-001 | Token relácie nesie čas vydania; odhlásenie zapíše používateľovi `sessionsValidAfter` a staršie tokeny server odmietne. **Dôsledok: odhlásenie na jednom zariadení odhlási používateľa všade.** Nový stĺpec `User.sessionsValidAfter`. | `src/lib/session.ts`, `src/server/auth.ts`, `src/app/api/logout/route.ts`, `prisma/schema.prisma`, migrácia `20261113090000_qa_logout_and_unique_question` | `tests/qa-fixes.test.ts`; BE sada S1 81/81; RT (druhé okno presmerované na prihlásenie, stará cookie 401) |
| BUG-002 | Kontrola „kolo je otvorené a pred uzávierkou“ a zápis účasti aj odpovede sú jedna transakcia, ktorá začína zápisom do kola, takže si najprv vezme zámok databázy. | `src/server/responses.ts` | regresný test s uzavretím kola v najhoršom momente; BE sada S9 (súbehy) bez zlyhania |
| BUG-003 | Telo požiadavky s neúplným Unicode znakom sa odmietne s 400 `invalid_text` ešte pred validáciou. | `src/lib/errors.ts` | regresné testy; BE sada (8 endpointov) |
| BUG-004 | Zoznam „Moje prieskumy“ na úvode má znova vlastné tlačidlo „Vyplniť“, nezávisle od troch úloh. | `src/app/(app)/page.tsx` | RT: manažér s 3 úlohami má odkaz a otvorí prieskum |
| BUG-005 | Jedinečný index `(teamId, text)` na tabuľke otázok; druhá súbežná požiadavka dostane 400 `duplicate`. | `prisma/schema.prisma`, migrácia, `src/server/catalog.ts` | regresný test s 5 súbežnými požiadavkami; BE sada |
| BUG-006 | Dĺžka sa počíta v znakoch (kódových bodoch) na serveri aj v počítadlách formulárov. | `src/lib/text.ts`, `src/server/*.ts`, `src/components/fill-wizard.tsx`, `kudos-form.tsx` | regresné testy (1000 a 1001 emotikonov); RT počítadlo |
| BUG-007 | Neviditeľné a riadiace znaky sa pred validáciou odstránia; text bez viditeľného obsahu je prázdny. Spojovač v zložených emotikonoch sa zachováva. | `src/lib/text.ts`, `src/server/*.ts` | regresné testy |
| BUG-008 | Nesprávne typované nepovinné polia podnetu vrátia 400 namiesto tichého zahodenia. | `src/server/hr-issues.ts` | regresné testy |
| BUG-009 | Neznámy filter vráti z API 400. Stránka podnetov ručne napísaný neplatný filter nahradí predvoleným „Nevybavené“. | `src/server/hr-issues.ts`, `src/app/(app)/hr/issues/page.tsx` | regresný test; RT |
| BUG-011 | Dlhý text sa zalamuje (`overflow-wrap: anywhere` na celej stránke). | `src/app/globals.css` | RT: 7 obrazoviek s 420-znakovým odkazom a 110-znakovým názvom kola, bez posúvania do strán |
| BUG-012 | Stav 401 vo formulároch ukáže „Prihlásenie vypršalo…“; vyplnené údaje zostanú. | `src/lib/texts.sk.ts`, 9 komponentov vo `src/components/` | RT: prieskum (komentár zostal) a kudos |
| BUG-013 | Vlastná slovenská stránka 404 s odkazom na úvod. | `src/app/not-found.tsx` | RT: prihlásený aj HR |
| BUG-015 | Pomocná funkcia na slovenské skloňovanie; opravené vety o dňoch a počtoch kôl. | `src/lib/texts.sk.ts` | regresné testy; RT na vyrenderovaných stránkach |
| BUG-016 | Po každom kroku prieskumu sa fokus presunie na nový obsah. | `src/components/fill-wizard.tsx` | RT: fokus po „Začať“ a „Ďalej“, dokončenie iba klávesnicou |
| BUG-017 | Rozbalené okruhy sa počítajú pre práve zvolený tím. | `src/components/new-round-form.tsx` | RT |
| BUG-018 | Okruh vlastných otázok sa po pridaní rozbalí; pri plnom kole sa zobrazí vysvetlenie. | `src/components/new-round-form.tsx` | RT |
| BUG-019 | Stránka tímu radí a datuje kolá podľa skutočného uzavretia (`closedAt`). | `src/server/teams.ts`, `src/app/(app)/team/[id]/page.tsx` | regresný test; scenár agenta 3 „real closing date“ prešiel |
| BUG-020 | Poďakovanie berie naposledy uzavreté kolo, nie kolo s najneskoršou uzávierkou. | `src/server/actions.ts` | regresný test |
| BUG-021 | Report konceptu ukáže text o koncepte a žiadnu účasť. | `src/app/(app)/rounds/[id]/report/page.tsx` | RT |
| BUG-022 | Položka „Domov“ zostáva zvýraznená aj počas vypĺňania. | `src/app/(app)/layout.tsx` | RT |
| BUG-023 | Posuvné tabuľky sú dostupné klávesnicou a majú vysvetľujúci text. | stránky vývoja tímu a porovnania tímov | RT |
| BUG-024 | Verejné kudos pre príjemcu bez tímu server odmietne s dôvodom; formulár to vysvetlí. Súkromné funguje. | `src/server/kudos.ts`, `src/lib/texts.sk.ts` | regresné testy; RT |
| BUG-025 | Väčšie písmo v grafe: najmenší popisok má na 360 px aspoň 11 px. | `src/components/trend-chart.tsx` | RT (meranie) |
| BUG-026 | Ovládacie prvky majú na telefóne aspoň 44 px; prepínač „Rozdelenie odpovedí“ aspoň 24 px. | 22 súborov vo `src/` (iba triedy výšky) | RT: 10 meraní na 360 px |
| BUG-027 | Každá obrazovka má vlastný titulok v tvare „Názov – Feedback portál“. | `src/app/layout.tsx` a 17 stránok | RT: 9 rôznych titulkov |
| BUG-030 | Zástupný text a „–“ v porovnaní tímov majú kontrast aspoň 4,5 : 1. | `src/app/globals.css`, stránka porovnania | RT (výpočet z farieb) |
| BUG-031 | Ukazovateľ priebehu rešpektuje „obmedziť pohyb“. | `src/components/fill-wizard.tsx` | RT |
| BUG-032 | Legenda má neprekrývajúce sa kroky („pod 3,0“, „od 3,0“ …). | stránka porovnania, `src/lib/texts.sk.ts` | RT |
| BUG-033 | Nadpisy stránok za položkou „Prieskumy“ začínajú slovom „Prieskumy“. | `src/lib/texts.sk.ts` | RT |
| BUG-035 | Skóre sa priemeruje z nezaokrúhlených hodnôt a zaokrúhli sa raz. | `src/server/trends.ts` | RT: Tím Beta 4,07 |
| BUG-038 | Neúspešné odhlásenie ukáže chybovú hlášku. | `src/components/logout-button.tsx` | RT |

## Čiastočne opravené

| ID | Čo je opravené | Čo zostáva |
|---|---|---|
| BUG-010 | Koncept s uplynutou uzávierkou už nepotláča úlohu „vytvor kolo“. | Taký koncept sa stále nedá spustiť, upraviť ani zmazať a zostáva v zozname. Mazanie konceptov nie je v požiadavkách; je to rozhodnutie zadávateľa. |
| BUG-028 | Zoznamy kôl majú správne úrovne nadpisov; hlavné menu má názov. | Krok s otázkou v prieskume nemá nadpis (otázka je `legend`) a niektoré `aria-label` sú na prvkoch bez roly. |

## Neopravené

| ID | Prečo |
|---|---|
| BUG-014 | Odpoveď 500 pri chybnom percentovom kódovaní vracia framework skôr, než sa dostane ku kódu aplikácie. Nič sa pri nej neuloží ani neprezradí. Oprava by znamenala vlastnú vrstvu pred smerovaním. |
| BUG-029 | Prepojenie chybových hlášok s poľami (`aria-invalid`, `aria-describedby`) a označenie povinných polí je úprava všetkých formulárov. Odporúčam ju spojiť s prácou kolegu na vzhľade. |
| BUG-030 (rámčeky) | Kontrast rámčekov polí 1,42 : 1 je voľba vzhľadu, ktorú rieši kolega zodpovedný za dizajn. |
| BUG-034 | Indikátor načítavania cez `loading.tsx` by pri týchto stránkach mohol zmeniť stavové kódy 403 a presmerovaní, na ktorých stoja kontroly oprávnení. Bez samostatného overenia som to nerobil. |
| BUG-036 | Stará karta po prepnutí účtu: odpoveď sa uloží pod účtom, ktorý je práve prihlásený, čo je správne. Chýba iba upozornenie v karte. Okrajový prípad na zdieľanom počítači. |
| BUG-037 | Ochrana pred duplicitou pri opakovaní požiadavky (idempotencia) a mazanie konceptov nie sú v požiadavkách. |

## Zmeny správania, ktoré opravy priniesli

Zadávateľ by o nich mal vedieť, lebo menia to, čo aplikácia robila predtým:

1. **Odhlásenie odhlási používateľa na všetkých zariadeniach.**
2. **Verejné kudos sa nedá poslať príjemcovi bez tímu** (dnes iba HR); treba zvoliť súkromné.
3. **Neznámy filter v API podnetov je chyba 400**, nie „ukáž všetko“.
4. **Z textov sa odstraňujú neviditeľné a riadiace znaky.**
5. **Databáza má novú migráciu.** Po stiahnutí zmien treba spustiť `npm run setup`.
6. **Ovládacie prvky sú vyššie** (aspoň 44 px), takže stránky sú o niečo dlhšie.
