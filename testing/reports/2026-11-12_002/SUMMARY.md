# Súhrn testovania – relácia 2026-11-12_002

Testovanie podľa [TESTING_RULES.md](../../../TESTING_RULES.md), 12. 11. 2026. Testovaná verzia: vetva
`feat/frontend-integration`, commit `cc58885` – kolegov redizajn (farby a logo Asseco CE, nové komponenty,
animácie) zlúčený s iteráciami IT-03 až IT-13. Produkčné zostavenie, vymyslené testovacie dáta.

## Celkový výsledok

**Podmienečne vyhovuje (CONDITIONAL PASS).** Všetky kritické toky fungujú. Žiadna kritická ani vysoká chyba
nebola nájdená a obe stredné sú opravené a pretestované. Zostávajú 4 nízke chyby otvorené a 2 čiastočne
opravené z tejto relácie a 4 z relácie 001. Odôvodnenie a podmienky sú v
[RELEASE_READINESS.md](RELEASE_READINESS.md).

**Zlúčenie nič nerozbilo:** žiadna funkcia z iterácií sa nestratila, backend sa nezmenil a všetky opravy
z relácie 001 redizajn prežili.

## Rozsah

Tri nezávislé agenty pracovali súbežne, každý na vlastnom serveri s vlastnou databázou. Kód nemenili.

| Fáza | Vykonané testy | Prešlo | Zlyhalo | Blokované | Potvrdené chyby |
|---|---|---|---|---|---|
| 1 – Backend | 1 107 | 1 080 | 27 | 0 | 4 |
| 2 – Frontend | 716 | 682 | 34 | 0 | 14 |
| 3 – Celý systém | 281 | 275 | 5 | 1 | 5 |
| **Spolu** | **2 104** | **2 037** | **66** | **1** | **23** |

Každá fáza prekročila minimum 150 testov. Cieľ 20 chýb na fázu nesplnila žiadna (4, 14 a 5). Pravidlá
zakazujú chyby vymýšľať, takže sú nahlásené skutočné počty. Z 23 chýb je 16 nových a 7 je zvyšok chyby
známej z relácie 001.

## Chyby podľa závažnosti

| Závažnosť | Nájdené | Opravené | Čiastočne | Otvorené |
|---|---|---|---|---|
| Kritická | 0 | – | – | – |
| Vysoká | 0 | – | – | – |
| Stredná | 2 | 2 | 0 | 0 |
| Nízka | 20 | 14 | 2 | 4 |
| Informačná | 1 | 1 | 0 | 0 |
| **Spolu** | **23** | **17** | **2** | **4** |

Úplný zoznam je v [BUG_REGISTER.md](BUG_REGISTER.md), opravy a retest vo [FIXES.md](FIXES.md).

**Stredné chyby (obe opravené):**

- **Zamrznutie pri súčasnom odosielaní.** Keď odpoveď odoslalo 14 a viac ľudí v tej istej chvíli, asi
  polovica dostala chybu po 6 sekundách a aplikácia medzitým nereagovala. Dáta sa nestratili. Chybu
  nespôsobilo zlúčenie, ale oprava z relácie 001 (BUG-002). Pre demo s 12 účtami bola málo pravdepodobná,
  pre pilot s viacerými tímami nie.
- **Tlačidlo „Uložiť koncept“ vyzeralo, že nič nerobí.** Pri chybe sa hláška zobrazila mimo obrazovky
  a stránka sa neposunula. Vzniklo spojením kolegovej prilepenej lišty s naším dlhším formulárom.

## Čo obstálo vo všetkých troch fázach

- **Dôvernosť odpovedí (NFR-01):** v databáze, v odpovediach API, na stránkach ani v logu servera sa odpoveď
  nedá spojiť s človekom, ani pri súbehoch a zlyhaných požiadavkách.
- **Prah dôvernosti (NFR-02):** 4 oproti 5 odpovediam sa správa správne vo výsledkoch, reporte, návrhoch,
  na stránke tímu, vo vývoji aj v porovnaní tímov.
- **Oprávnenia (NFR-03):** 24 stránok × 5 rolí a všetky endpointy podľa matice; podvrhnuté tokeny odmietnuté.
- **Slovo zakázané v NFR-04** sa nenachádza na žiadnej obrazovke.
- **Akceptačný scenár z mvp.md** prešiel cez skutočné rozhranie aj cez HTTP.
- **Rozloženie:** žiadne vodorovné posúvanie na 37 stavoch obrazoviek pri šírkach 320 až 1440 px.
- **Kontrast textu novej palety** nameraný na 23 obrazovkách spĺňa úroveň AA.
- **Hlásenia a oslava** sa zobrazia až po potvrdení servera a neblokujú ovládanie.

## Po opravách

| Kontrola | Výsledok |
|---|---|
| Automatické testy projektu | 273 z 273 (6 nových regresných) |
| Backend, obe sady | 1 100 z 1 107; 7 je otvorená BUG-014 |
| Frontend | 663 zo 674; 11 je vysvetlených vo FIXES.md |
| Celý systém | 278 z 281; 3 sú vysvetlené vo FIXES.md |
| Akceptačný scenár | prešiel |
| Kontrola typov, lint, zostavenie, štart aplikácie | bez chýb |

## Zostávajúce riziká

1. **Otvorené nízke chyby:** 4 z tejto relácie (BUG-054, 055, 056, 060), 2 čiastočné (BUG-050, 051)
   a 4 z relácie 001 (BUG-010 čiastočne, 014, 036, 037).
2. **Bezpečnostné riziká mimo požiadaviek** z relácie 001 platia bez zmeny: obmedzenie pokusov o prihlásenie,
   CSRF iba cez nastavenie cookie, bezpečnostné hlavičky, limit veľkosti požiadavky. Pre demo na testovacích
   dátach prijateľné, pre prevádzku so skutočnými ľuďmi nie.
3. **Cookie `Secure`:** na internom serveri cez obyčajné HTTP by prihlásenie nefungovalo. Stále neoverené
   v prehliadači.
4. **Voľba „Zapnuté“ v ponuke animácií prebije systémové nastavenie „obmedziť pohyb“.** Rozhodnutie pre
   zadávateľa, či to zodpovedá IT-02.
5. **Sériový zápis odpovedí platí pre jeden proces servera.** Pri nasadení na viac procesov treba iné riešenie.

## Obmedzenia testovania

- **Iba Edge (Chromium), bez okna.** Bez Firefoxu, Safari, skutočných telefónov a skutočnej čítačky obrazovky.
  Dotyk a telefón sú emulované.
- **Animácie sa overovali meraním** (trvanie, prítomnosť, reakcia na nastavenie pohybu), nie okom; z 349
  snímok frontendu si agent pozrel asi 30.
- **Čas sa simuloval** posunom dátumov v testovacej databáze; vypršanie relácie odstránením cookie alebo
  odhlásením inde.
- **Nedostupný server pri načítaní stránky sa netestoval** (1 blokovaný test); zlyhania API sa simulovali
  v prehliadači.
- **Záťaž:** najviac 30 súbežných požiadaviek z jedného klienta; žiadny dlhší záťažový test.
- **Časť retestu bežala na predposlednom zostavení** (podrobnosti vo FIXES.md).
- **Kontrola druhým človekom neprebehla.** Testovali a opravovali AI agenti. Kolega, ktorý vzhľad navrhol,
  zlúčený výsledok ešte nevidel.

## Súbory

| Súbor | Obsah |
|---|---|
| [BACKEND_REPORT.md](BACKEND_REPORT.md), [FRONTEND_REPORT.md](FRONTEND_REPORT.md), [INTEGRATION_REPORT.md](INTEGRATION_REPORT.md) | Správy fáz (anglicky) |
| [BUG_REGISTER.md](BUG_REGISTER.md) | Zlúčený register chýb a rizík |
| [TEST_CASES.md](TEST_CASES.md) | Prehľad testov; odkazuje na tri súbory fáz |
| [FIXES.md](FIXES.md) | Opravy, retest, neopravené chyby, zmeny správania |
| [RELEASE_READINESS.md](RELEASE_READINESS.md) | Pripravenosť na demo |
| `evidence/` | Výsledky v JSON, logy, snímky; `retest/` sú výsledky po opravách |
| `testing/scripts/` | Testovacie skripty troch fáz (`s10`, `s11`, `s2-*`, `m1` až `m7` sú z tejto relácie) |
