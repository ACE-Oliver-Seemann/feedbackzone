# Pripravenosť na demo – relácia 2026-11-12_001

## Záver

**Podmienečne vyhovuje (CONDITIONAL PASS)** pre predvedenie vedeniu na testovacích dátach.

**Nevyhovuje** pre pilot so skutočnými zamestnancami. To nie je výsledok tohto testovania, ale stav známy
od začiatku: `mvp.md` pred pilotom vyžaduje firemné SSO, vyriešené komentáre a posúdenie DPO.

## Kritériá z TESTING_RULES.md

| Kritérium | Stav | Na čom to stojí |
|---|---|---|
| Všetky kritické toky fungujú | Áno | Akceptačný scenár 43/43 na finálnom zostavení; scenáre agenta 3 cez skutočné rozhranie |
| Žiadna otvorená kritická chyba | Áno | Žiadna nebola nájdená |
| Žiadna otvorená vysoká chyba v hlavných tokoch | Áno | Jediná vysoká (BUG-004) je opravená a overená v prehliadači |
| Prihlásenie a oprávnenia fungujú | Áno | 154 + 57 kontrol oprávnení; odhlásenie po oprave ukončí reláciu na serveri |
| Integrita databázy overená | Áno | Obmedzenia, transakcie, migrácie na prázdnej databáze; súbeh odoslania a uzavretia opravený |
| Frontend je funkčný | Áno | 85/85 cielených kontrol, bez chýb JavaScriptu |
| Integračné testy prechádzajú | Áno, s výhradou | 361/374; zvyšných 13 sú zmenené očakávania a 3 známe nízke chyby (FIXES.md) |
| Zostavenie prejde | Áno | `npm run build` bez chýb |
| Aplikácia sa spustí | Áno | Spustená na štyroch portoch počas testovania |

Prečo nie plné „vyhovuje“: zostáva 5 otvorených a 2 čiastočne opravené nízke chyby a testovanie má
obmedzenia uvedené nižšie. Pravidlá pre taký stav určujú podmienečné vyhovenie.

## Podmienky pred demom

1. **Rozhodnúť, kde demo pobeží.** Na notebooku cez `localhost` funguje. Na internom serveri cez obyčajné
   HTTP by sa pre príznak `Secure` na cookie nedalo prihlásiť; vtedy treba HTTPS. Toto som neoveril v prehliadači.
2. **Pripraviť dáta príkazom `npm run db:demo`** tesne pred demom. Úvodné stránky počítajú dni od uzavretia
   kôl, takže staršie dáta ukážu iné čísla.
3. **Prejsť demo scenár raz ručne v prehliadači, v ktorom sa bude predvádzať.** Testovalo sa iba v Edge.
4. **Zlúčiť vetvu do `main`** a nechať zmeny prejsť človeku. Testovali a opravovali AI agenti; kontrola
   druhým vývojárom, ktorú vyžaduje definícia hotového v mvp.md, stále neprebehla.

## Čo pri deme povedať nahlas

Aby sa demo nebralo ako hotový produkt (riziko uvedené v mvp.md):

- **Prihlásenie heslom je len na demo.** Ostrá verzia potrebuje firemné SSO.
- **Návrhy krokov nie sú AI.** Sú to pripravené texty vyberané podľa priemerov.
- **Podnet sa skupine nedoručí;** skupina je zatiaľ iba označenie.
- **Vzhľad nie je finálny.** Farby, animácie a konfety sú odložené na samostatnej vetve.
- **Komentáre sa nedajú nahlásiť** a v malom tíme môže byť autor rozpoznateľný podľa štýlu.

## Známe nedostatky, ktoré sa pri deme môžu prejaviť

| Čo | Kedy sa prejaví | Ako sa tomu vyhnúť |
|---|---|---|
| Koncept s uplynutou uzávierkou sa nedá spustiť ani zmazať (BUG-010) | Ak niekto vytvorí koncept a nechá ho prejsť cez uzávierku | Pred demom použiť čerstvé dáta |
| Dvojitý koncept po opakovanom odoslaní pri výpadku siete (BUG-037) | Pri nestabilnom pripojení | Stabilné pripojenie; klikať raz |
| Bez indikátora načítavania (BUG-034) | Na pomalom počítači trvá prechod stránky bez viditeľnej zmeny | Nechať stránku dobehnúť |
| Menu HR má na telefóne dva riadky | Pri predvádzaní HR na šírke 360 px | HR predvádzať na počítači |
| Stará karta po prepnutí účtu (BUG-036) | Pri striedaní účtov v jednom prehliadači | Na každý účet použiť vlastné okno v režime súkromného prehliadania |

## Čo treba pred pilotom so skutočnými ľuďmi

Nad rámec tohto testovania, ale vyplýva z neho:

- Firemné SSO namiesto hesiel a obmedzenie počtu pokusov o prihlásenie.
- Ochrana proti CSRF, bezpečnostné hlavičky, limit veľkosti požiadavky, `Cache-Control` na odpovediach API.
- Rozhodnutie zadávateľa o dvoch otázkach dôvernosti: manažér počítaný do prahu 5 a priebežné počítadlo účasti.
- Nahlasovanie komentárov alebo ich vypnutie; zváženie vyššieho prahu pre komentáre.
- Testy vo Firefoxe, Safari, na skutočných telefónoch a so skutočnou čítačkou obrazovky.
- Posúdenie DPO vrátane poznámok HR zo stretnutí, ktoré môžu obsahovať mená.
- Nezávislá bezpečnostná kontrola človekom.
