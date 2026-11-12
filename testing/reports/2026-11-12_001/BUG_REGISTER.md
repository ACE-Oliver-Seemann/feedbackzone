# Register chýb – testovacia relácia 2026-11-12_001

Zlúčený register zo všetkých troch fáz podľa `TESTING_RULES.md`. Tri fázy nahlásili spolu 46 chýb
(backend 10, frontend 22, celý systém 14); 8 z nich sú tie isté chyby nájdené dvoma agentmi, takže
jedinečných chýb je **38**. Podrobný opis, kroky na zopakovanie a dôkazy sú v správach fáz pod pôvodnými
identifikátormi (stĺpec „Pôvod“): [BACKEND_REPORT.md](BACKEND_REPORT.md), [FRONTEND_REPORT.md](FRONTEND_REPORT.md),
[INTEGRATION_REPORT.md](INTEGRATION_REPORT.md).

**Stav:** *Opravené* = opravené a znovu otestované (pozri [FIXES.md](FIXES.md)). *Čiastočne* = časť je opravená,
zvyšok je popísaný. *Otvorené* = neopravené, s dôvodom vo FIXES.md.

## Prehľad

| Závažnosť | Spolu | Opravené | Čiastočne | Otvorené |
|---|---|---|---|---|
| Kritická | 0 | – | – | – |
| Vysoká | 1 | 1 | 0 | 0 |
| Stredná | 8 | 8 | 0 | 0 |
| Nízka | 29 | 22 | 2 | 5 |
| **Spolu** | **38** | **31** | **2** | **5** |

## Chyby

| ID | Fáza | Pôvod | Opis | Závažnosť | Stav |
|---|---|---|---|---|---|
| BUG-001 | Backend, Celý systém | BE-001, E2E-003 | Odhlásenie neukončí reláciu na serveri; skopírovaná cookie funguje ďalej až 8 hodín (MVP-01). | Stredná | Opravené |
| BUG-002 | Backend | BE-002 | Súbeh odoslania a uzavretia kola: odpoveď sa občas uloží do už uzavretého kola (MVP-09). | Stredná | Opravené |
| BUG-003 | Backend | BE-003 | Neúplný Unicode znak (osamotený surrogát) v texte vráti 500 na 8 zápisových endpointoch vrátane prihlásenia. | Stredná | Opravené |
| BUG-004 | Frontend | FE-001 | Manažér nemá odkaz na prieskum vlastného tímu, keď úvod zaplnia tri iné úlohy. | Vysoká | Opravené |
| BUG-005 | Backend, Celý systém | BE-005, E2E-012 | Päť súbežných požiadaviek vytvorí päť rovnakých vlastných otázok, ktoré sa nedajú zmazať (IT-07). | Nízka | Opravené |
| BUG-006 | Backend, Frontend | BE-006, FE-014 | Dĺžka textu sa počíta v jednotkách UTF-16, nie v znakoch: emotikon sa počíta za dva (MVP-08, MVP-16, IT-07). | Nízka | Opravené |
| BUG-007 | Backend | BE-007 | Text zložený iba z neviditeľných znakov prejde validáciou ako názov kola, kudos alebo vlastná otázka. | Nízka | Opravené |
| BUG-008 | Backend | BE-008 | `POST /api/hr/issues` potichu zahodí nesprávne typované `roundId`, `teamId` a `description` a vráti 201. | Nízka | Opravené |
| BUG-009 | Backend, Celý systém | BE-009, E2E-014 | Neznámy filter podnetov sa ignoruje a vrátia sa všetky; stránka pritom ukazuje filter „Nevybavené“. | Nízka | Opravené |
| BUG-010 | Backend | BE-010 | Koncept s uplynutou uzávierkou potlačí manažérovi úlohu „vytvor kolo“ (IT-11). | Nízka | Čiastočne |
| BUG-011 | Frontend, Celý systém | FE-002, E2E-005 | Dlhé slovo alebo odkaz bez medzier roztiahne celú stránku (až 13 106 px na 360 px displeji; NFR-07). | Stredná | Opravené |
| BUG-012 | Frontend, Celý systém | FE-003, E2E-004 | Po skončení relácie formulár ukáže „Niečo sa nepodarilo. Skús to znova.“ bez výzvy na prihlásenie. | Stredná | Opravené |
| BUG-013 | Frontend, Celý systém | FE-004, E2E-013 | Stránka 404 je anglická predvolená stránka frameworku, bez menu a bez odkazu späť. | Stredná | Opravené |
| BUG-014 | Backend | BE-004 | Chybné percentové kódovanie v adrese (napr. `/api/rounds/%E0%A4%A`) vráti holú odpoveď 500. | Nízka | Otvorené |
| BUG-015 | Frontend, Celý systém | FE-005, E2E-008 | Nesprávne skloňovanie vo vygenerovaných vetách („uzavreté 3 dní“, „1 z 1 uzavretých kôl“, „pred 0 dňami“). | Nízka | Opravené |
| BUG-016 | Frontend | FE-006 | Pri každom kroku prieskumu sa stratí fokus klávesnice a nová otázka sa neoznámi čítačke obrazovky. | Nízka | Opravené |
| BUG-017 | Frontend | FE-007 | Nové kolo ako HR: po zmene tímu sú predvybrané otázky v zbalených okruhoch a otvorené zostávajú okruhy predošlého tímu. | Nízka | Opravené |
| BUG-018 | Frontend | FE-008 | Vlastná otázka skončí po pridaní v zbalenom okruhu; pri plnom kole sa uloží bez akejkoľvek správy. | Nízka | Opravené |
| BUG-019 | Celý systém | E2E-001 | Stránka tímu datuje a radí uzavreté kolá podľa uzávierky, nie podľa skutočného uzavretia. | Stredná | Opravené |
| BUG-020 | Celý systém | E2E-002 | Poďakovanie po odoslaní ukáže kroky kola s najneskoršou uzávierkou, nie naposledy uzavretého (MVP-09). | Stredná | Opravené |
| BUG-021 | Frontend | FE-009 | Report konceptu ukáže „Odpovedalo 0 z 6“ a text o uzavretí namiesto textu o koncepte. | Nízka | Opravené |
| BUG-022 | Frontend | FE-010 | Počas vypĺňania prieskumu nie je zamestnancovi v menu zvýraznená žiadna položka. | Nízka | Opravené |
| BUG-023 | Frontend | FE-011 | Tabuľka vývoja a porovnanie tímov sú na počítači orezané a posúvajú sa do strán bez náznaku; nedajú sa posúvať klávesnicou. | Nízka | Opravené |
| BUG-024 | Celý systém | E2E-007 | Verejné kudos pre HR (bez tímu) sa nezobrazí na žiadnej stránke tímu, hoci formulár to sľubuje. | Nízka | Opravené |
| BUG-025 | Frontend | FE-012 | Popisky grafu vývoja majú na 360 px veľkosť 9,8 px a na 320 px 8,5 px. | Nízka | Opravené |
| BUG-026 | Frontend | FE-013 | Dotykové ciele pod 44 px na 360 px (menu 32, odhlásenie 34, tlačidlá zoznamu 32–34, záložky 38, „Rozdelenie odpovedí“ 20). | Nízka | Opravené |
| BUG-027 | Frontend | FE-015 | Všetkých 24 obrazoviek má rovnaký titulok „Feedback portál“. | Nízka | Opravené |
| BUG-028 | Frontend | FE-016 | Preskočená úroveň nadpisu na `/rounds` a `/hr/rounds`; krok otázky nemá nadpis; hlavné menu nemá názov. | Nízka | Čiastočne |
| BUG-029 | Frontend | FE-017 | Chybové hlášky nie sú prepojené s poľami (`aria-invalid`, `aria-describedby`), povinné polia nie sú označené. | Nízka | Otvorené |
| BUG-030 | Frontend | FE-018 | Kontrast pod úrovňou AA: zástupný text 3,45 : 1, „–“ v porovnaní tímov 2,63 : 1, rámčeky polí 1,42 : 1. | Nízka | Opravené (text), rámčeky otvorené |
| BUG-031 | Frontend | FE-019 | Prechod ukazovateľa priebehu ignoruje nastavenie „obmedziť pohyb“. | Nízka | Opravené |
| BUG-032 | Frontend | FE-020 | Rozsahy v legende porovnania tímov sa prekrývajú („1,0 až 3,0“, „3,0 až 3,5“). | Nízka | Opravené |
| BUG-033 | Frontend | FE-021 | Položka menu „Prieskumy“ otvára stránky s nadpisom „Kolá môjho tímu“ a „Prehľad kôl“. | Nízka | Opravené |
| BUG-034 | Frontend | FE-022 | Pri pomalej zmene stránky nie je žiadny náznak načítavania (2 s bez viditeľnej zmeny). | Nízka | Otvorené |
| BUG-035 | Celý systém | E2E-009 | Porovnanie tímov spriemeruje už zaokrúhlené skóre: zobrazí 4,06 namiesto správnych 4,07. | Nízka | Opravené |
| BUG-036 | Celý systém | E2E-006 | Po prepnutí účtu v tom istom prehliadači stará karta odošle odpoveď pod novým účtom, hoci ukazuje staré meno. | Nízka | Otvorené |
| BUG-037 | Celý systém | E2E-010 | Opakovanie požiadavky po stratenej odpovedi vytvorí duplicitný koncept kola; koncepty sa nedajú zmazať. | Nízka | Otvorené |
| BUG-038 | Celý systém | E2E-011 | Neúspešné odhlásenie nedá žiadnu správu; používateľ potichu zostane prihlásený. | Nízka | Opravené |

BUG-030 je v prehľade počítaná ako opravená, lebo oba textové kontrasty sú opravené; kontrast rámčekov
je vec vzhľadu, ktorú rieši kolega zodpovedný za dizajn (pozri FIXES.md).

## Riziká, ktoré nie sú chyby

Agenti ich uviedli oddelene, lebo požiadavky ich nevyžadujú. Pred ostrou prevádzkou ich treba posúdiť.

| Riziko | Pôvod | Poznámka |
|---|---|---|
| Chýba obmedzenie počtu pokusov o prihlásenie; overovanie hesla blokuje server (pri 100 súbežných pokusoch čakala iná požiadavka 5,8 až 10,3 s). | Backend R-1 | Pre demo bez dopadu. |
| Cookie má v produkčnom zostavení príznak `Secure`: na internom serveri cez obyčajné HTTP (nie localhost) by prihlásenie nefungovalo. | Backend R-2 | **Overiť pred demom**, ak nepobeží na notebooku. V prehliadači neoverené. |
| Ochrana proti CSRF stojí iba na `SameSite=Lax`. | Backend R-3 | |
| Chýbajú bezpečnostné hlavičky a `Cache-Control` na prihlásených odpovediach API. | Backend R-4, Celý systém R-3 | |
| Chýba limit veľkosti tela požiadavky. | Backend R-5 | |
| Dvojité odoslanie vytvorí duplicitné kolá, kroky a kudos. | Backend R-6 | Súvisí s BUG-037. |
| Člen tímu rozlíši koncept vlastného tímu (404) od neznámeho ID (403). | Backend R-7 | |
| Manažér sa počíta do prahu 5: pri 4 zamestnancoch a manažérovi vie manažér dopočítať súčet odpovedí štyroch zamestnancov. | Celý systém R-1 | Zodpovedá MVP-11; otázka návrhu pre zadávateľa. |
| Priebežné počítadlo účasti na otvorenom kole prezradí pozorovateľovi, kto kedy odpovedal (nie obsah). | Celý systém R-2 | Otázka návrhu. |
| Autora komentára možno v malom tíme spoznať podľa štýlu. | Backend R-8 | Známe, uvedené v mvp.md. |
| Prah „5“ je v niektorých textoch napísaný natvrdo, nie z `MIN_GROUP_SIZE`. | Frontend | Pri zmene prahu treba upraviť aj texty. |
| Testované iba v Edge (Chromium); bez Firefoxu, Safari, skutočných telefónov a čítačky obrazovky. | Frontend, Celý systém | |
