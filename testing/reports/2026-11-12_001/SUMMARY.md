# Súhrn testovania – relácia 2026-11-12_001

Testovanie podľa [TESTING_RULES.md](../../../TESTING_RULES.md), 12. a 13. 11. 2026. Testovaná verzia: vetva
`feat/it-11-usability` (MVP + iterácie IT-03 až IT-13), produkčné zostavenie, vymyslené testovacie dáta.

## Celkový výsledok

**Podmienečne vyhovuje (CONDITIONAL PASS).** Všetky kritické toky fungujú, žiadna kritická, vysoká ani stredná
chyba nezostala otvorená. Zostáva 5 nízkych chýb otvorených a 2 nízke čiastočne opravené; sú zdokumentované.
Odôvodnenie a podmienky sú v [RELEASE_READINESS.md](RELEASE_READINESS.md).

## Rozsah

Tri nezávislé agenty pracovali súbežne, každý na vlastnom serveri s vlastnou databázou. Kód nemenili.

| Fáza | Vykonané testy | Prešlo | Zlyhalo | Blokované | Potvrdené chyby |
|---|---|---|---|---|---|
| 1 – Backend | 746 | 714 | 32 | 0 | 10 |
| 2 – Frontend | 575 | 496 | 72 | 7 | 22 |
| 3 – Celý systém | 377 | 351 | 23 | 3 | 14 |
| **Spolu** | **1 698** | **1 561** | **127** | **10** | **46, po zlúčení 38** |

Každá fáza prekročila minimum 150 testov. Cieľ 20 chýb na fázu splnil iba frontend (22); backend našiel 10
a celý systém 14. Pravidlá zakazujú chyby vymýšľať, takže sú nahlásené skutočné počty.

## Chyby podľa závažnosti

| Závažnosť | Nájdené | Opravené | Čiastočne | Otvorené |
|---|---|---|---|---|
| Kritická | 0 | – | – | – |
| Vysoká | 1 | 1 | 0 | 0 |
| Stredná | 8 | 8 | 0 | 0 |
| Nízka | 29 | 22 | 2 | 5 |
| **Spolu** | **38** | **31** | **2** | **5** |

Úplný zoznam je v [BUG_REGISTER.md](BUG_REGISTER.md), opravy a retest vo [FIXES.md](FIXES.md).

**Vysoká chyba (opravená):** manažér sa cez rozhranie nedostal k prieskumu vlastného tímu, keď úvodnú
stránku zaplnili tri iné úlohy. Vznikla deň pred testovaním pri zmene úvodnej stránky a bola viditeľná
na ukážkových dátach, takže by sa prejavila pri deme.

**Stredné chyby (všetky opravené):** odhlásenie neukončilo reláciu na serveri; odpoveď sa pri súbehu mohla
uložiť do uzavretého kola; poškodený znak v texte zhodil požiadavku; dlhé slovo roztiahlo stránku; po
vypršaní relácie formulár neporadil prihlásiť sa; stránka 404 bola anglická; stránka tímu a poďakovanie
sa riadili uzávierkou namiesto skutočného uzavretia kola.

## Čo obstálo vo všetkých troch fázach

- **Dôvernosť odpovedí (NFR-01):** v databáze, v odpovediach API, na stránkach ani v logu servera sa odpoveď
  nedá spojiť s človekom, ani pri priamom čítaní databázy.
- **Prah dôvernosti (NFR-02):** 4 oproti 5 odpovediam sa správa správne vo výsledkoch, návrhoch, na stránke
  tímu, v grafe aj v porovnaní tímov.
- **Oprávnenia (NFR-03):** 154 kombinácií rola × endpoint a 57 kombinácií rola × stránka; pokusy podstrčiť
  cudzí tím alebo rolu boli ignorované.
- **Slovo zakázané v NFR-04** sa nenachádza na žiadnej obrazovke.
- **Akceptačný scenár z mvp.md** prešiel cez skutočné rozhranie aj cez HTTP.
- **Rozloženie:** žiadne vodorovné posúvanie na 24 obrazovkách pri šírkach 320 až 1440 px (pred opravou
  okrem prípadu dlhého slova, BUG-011).

## Po opravách

| Kontrola | Výsledok |
|---|---|
| Automatické testy projektu | 267 z 267 (26 nových regresných) |
| Backendová sada agenta 1, finálne zostavenie | 735 zo 746; zvyšných 11 je vysvetlených vo FIXES.md |
| Cielený retest opráv v prehliadači | 85 z 85 |
| Scenáre agenta 3 | 361 z 374; zvyšných 13 je vysvetlených vo FIXES.md |
| Akceptačný scenár | 43 zo 43 |
| Kontrola typov, lint, zostavenie, štart aplikácie | bez chýb |

## Zostávajúce riziká

1. **Päť nízkych chýb je otvorených** (BUG-014, 029, 034, 036, 037) a dve sú opravené čiastočne (BUG-010, 028).
2. **Bezpečnostné riziká mimo požiadaviek:** chýba obmedzenie pokusov o prihlásenie, ochrana proti CSRF stojí
   iba na nastavení cookie, chýbajú bezpečnostné hlavičky a limit veľkosti požiadavky. Pre demo na testovacích
   dátach sú prijateľné, pre prevádzku so skutočnými ľuďmi nie.
3. **Cookie `Secure`:** na internom serveri cez obyčajné HTTP by prihlásenie nefungovalo. Neoverené v prehliadači.
4. **Dve otázky návrhu dôvernosti** pre zadávateľa: manažér sa počíta do prahu 5, a priebežné počítadlo účasti
   ukazuje, kedy kto odpovedal.

## Obmedzenia testovania

- **Iba Edge (Chromium).** Bez Firefoxu, Safari, skutočných telefónov a skutočnej čítačky obrazovky.
- **Animácie a konfety sa netestovali,** lebo v tejto verzii nie sú (7 blokovaných testov).
- **Čas sa simuloval:** 8-hodinové vypršanie relácie, uzávierky a pravidlá 14 a 90 dní cez podpísané tokeny
  s minulým časom alebo zmenou dátumov v testovacej databáze.
- **Pôvodná frontendová sada sa po opravách nedala zopakovať;** opravy frontendu overuje cielený skript
  s 85 kontrolami, nie pôvodných 575 testov.
- **Scenáre celého systému sa nezopakovali na úplne finálnom zostavení** (po nich pribudla už len zmena výšky
  ovládacích prvkov).
- **Bez záťažových testov** nad rámec 5 až 100 súbežných požiadaviek.
- **Kontrola druhým človekom neprebehla.** Testovali a opravovali AI agenti; nezávislé ľudské posúdenie chýba.

## Súbory

| Súbor | Obsah |
|---|---|
| [BACKEND_REPORT.md](BACKEND_REPORT.md), [FRONTEND_REPORT.md](FRONTEND_REPORT.md), [INTEGRATION_REPORT.md](INTEGRATION_REPORT.md) | Správy fáz (anglicky) |
| [BUG_REGISTER.md](BUG_REGISTER.md) | Zlúčený register chýb a rizík |
| [TEST_CASES.md](TEST_CASES.md) | Prehľad testov a prípady retestu; odkazuje na tri súbory fáz |
| [FIXES.md](FIXES.md) | Opravy, retest, neopravené chyby, zmeny správania |
| [RELEASE_READINESS.md](RELEASE_READINESS.md) | Pripravenosť na demo |
| `evidence/` | Logy, výsledky v JSON, snímky obrazoviek; `before-fix/` je stav pred opravami, `retest/` po nich |
| `testing/scripts/` | Testovacie skripty troch fáz a retestu |
