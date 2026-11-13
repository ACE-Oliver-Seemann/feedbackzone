# Pripravenosť na demo – relácia 2026-11-12_002

## Záver

**Podmienečne vyhovuje (CONDITIONAL PASS)** pre predvedenie vedeniu na testovacích dátach, vo verzii
s novým vzhľadom (vetva `feat/frontend-integration` po opravách z tejto relácie).

**Nevyhovuje** pre pilot so skutočnými zamestnancami. To nie je výsledok tohto testovania, ale stav známy
od začiatku: `mvp.md` pred pilotom vyžaduje firemné SSO, vyriešené komentáre a posúdenie DPO.

## Kritériá z TESTING_RULES.md

| Kritérium | Stav | Na čom to stojí |
|---|---|---|
| Všetky kritické toky fungujú | Áno | Akceptačný scenár na finálnom zostavení; 60 scenárov cez skutočné rozhranie |
| Žiadna otvorená kritická chyba | Áno | Žiadna nebola nájdená |
| Žiadna otvorená vysoká chyba v hlavných tokoch | Áno | Žiadna nebola nájdená |
| Prihlásenie a oprávnenia fungujú | Áno | 24 stránok × 5 rolí, všetky endpointy, podvrhnuté tokeny, odhlásenie |
| Integrita databázy overená | Áno | Migrácie na prázdnej databáze, obmedzenia, súbehy; počet účastí sa vždy rovná počtu odpovedí |
| Frontend je funkčný | Áno | 663 zo 674 po opravách; žiadne chyby JavaScriptu, žiadne mŕtve tlačidlo |
| Integračné testy prechádzajú | Áno, s výhradou | 278 z 281; zvyšok je 1 nízka otvorená chyba, 1 zastaraný test a 1 blokovaný |
| Zostavenie prejde | Áno | `npm run build` bez chýb |
| Aplikácia sa spustí | Áno | Spustená na štyroch portoch počas testovania |

Prečo nie plné „vyhovuje“: zostávajú otvorené nízke chyby (4 z tejto relácie, 2 čiastočné, 4 z relácie 001)
a testovanie má obmedzenia uvedené nižšie. Pravidlá pre taký stav určujú podmienečné vyhovenie.

## Podmienky pred demom

1. **Kolega si pozrie zlúčený výsledok.** Jeho vzhľad je teraz aj na obrazovkách, ktoré nenavrhoval
   (prehľady HR, podnety, poznámky, vývoj tímu, report, úvod s úlohami), a dotkli sa ho opravy (smer
   animácie otázok, kratšie konfety, skok na chybu vo formulári).
2. **Rozhodnúť, kde demo pobeží.** Na notebooku cez `localhost` funguje. Na internom serveri cez obyčajné
   HTTP by sa pre príznak `Secure` na cookie nedalo prihlásiť; vtedy treba HTTPS. Neoverené v prehliadači.
3. **Pripraviť dáta príkazom `npm run db:demo`** tesne pred demom. Úvodné stránky počítajú dni od uzavretia kôl.
4. **Prejsť demo scenár raz ručne v prehliadači a na obrazovke, na ktorej sa bude predvádzať,** so zapnutými
   animáciami. Animácie sa testovali meraním, nie okom, a iba v Edge.
5. **Zlúčiť vetvu do `main`** cez pull request s kontrolou človekom.

## Čo pri deme povedať nahlas

- **Prihlásenie heslom je len na demo.** Ostrá verzia potrebuje firemné SSO.
- **Návrhy krokov nie sú AI.** Sú to pripravené texty vyberané podľa priemerov.
- **Podnet sa skupine nedoručí;** skupina je zatiaľ iba označenie.
- **Komentáre sa nedajú nahlásiť** a v malom tíme môže byť autor rozpoznateľný podľa štýlu.

## Známe nedostatky, ktoré sa pri deme môžu prejaviť

| Čo | Kedy sa prejaví | Ako sa tomu vyhnúť |
|---|---|---|
| Úvod ukáže vyplnený prieskum znova ako nevyplnený (BUG-060) | Po odoslaní a návrate tlačidlom Späť v prehliadači | Vrátiť sa odkazom „Späť na moje prieskumy“ alebo cez menu |
| Stará karta po prepnutí účtu (BUG-036) | Pri striedaní účtov v jednom prehliadači | Na každý účet vlastné okno v režime súkromného prehliadania |
| Koncept s uplynutou uzávierkou sa nedá spustiť ani zmazať (BUG-010) | Ak koncept prejde cez uzávierku | Pred demom čerstvé dáta |
| Dvojitý koncept po opakovanom odoslaní pri výpadku siete (BUG-037) | Pri nestabilnom pripojení | Stabilné pripojenie |
| Hlavné menu je na počítači v jednom riadku až od šírky 1280 px | Na užšom okne alebo projektore s nižším rozlíšením je menu v druhom riadku | Predvádzať v okne širokom aspoň 1280 px |
| Slabý kontrast rámčekov polí (BUG-054) | Na projektore môžu rámčeky polí zaniknúť | Vyskúšať na projektore vopred |

## Čo treba pred pilotom so skutočnými ľuďmi

Platí zoznam z relácie 001 (SSO a obmedzenie pokusov o prihlásenie, ochrana proti CSRF, bezpečnostné
hlavičky, limit veľkosti požiadavky, rozhodnutia o dôvernosti, nahlasovanie komentárov, testy v ďalších
prehliadačoch a so skutočnou čítačkou obrazovky, posúdenie DPO, nezávislá bezpečnostná kontrola). Z tejto
relácie pribúda:

- **Záťažový test** s počtom ľudí, aký sa čaká v pilote. Zápis odpovedí je sériový v rámci jedného procesu;
  pri viacerých procesoch servera alebo inej databáze treba riešenie prehodnotiť.
- **Rozhodnutie o voľbe „Zapnuté“ v ponuke animácií,** ktorá prebije systémové nastavenie obmedzeného pohybu.
- **Prístupnosť formulárov:** označenie povinných polí a prepojenie chýb s poľami vo formulároch HR (BUG-055),
  kontrast rámčekov (BUG-054).
