# Register chýb – testovacia relácia 2026-11-12_002

Zlúčený register zo všetkých troch fáz podľa `TESTING_RULES.md`. Testovaná verzia: vetva
`feat/frontend-integration`, commit `cc58885` (kolegov redizajn zlúčený s iteráciami IT-03 až IT-13).

Tri fázy nahlásili spolu **23 chýb** (backend 4, frontend 14, celý systém 5). Žiadna sa medzi fázami
neopakuje. 16 je nových, 7 je zvyšok chyby známej z relácie 001. Číslovanie nadväzuje na
[register relácie 001](../2026-11-12_001/BUG_REGISTER.md). Podrobný opis, kroky a dôkazy sú v správach fáz
pod pôvodnými identifikátormi: [BACKEND_REPORT.md](BACKEND_REPORT.md), [FRONTEND_REPORT.md](FRONTEND_REPORT.md),
[INTEGRATION_REPORT.md](INTEGRATION_REPORT.md).

**Stav:** *Opravené* = opravené a znovu otestované (pozri [FIXES.md](FIXES.md)). *Čiastočne* = časť je opravená,
zvyšok je popísaný. *Otvorené* = neopravené, s dôvodom vo FIXES.md.

## Prehľad

| Závažnosť | Spolu | Opravené | Čiastočne | Otvorené |
|---|---|---|---|---|
| Kritická | 0 | – | – | – |
| Vysoká | 0 | – | – | – |
| Stredná | 2 | 2 | 0 | 0 |
| Nízka | 20 | 14 | 2 | 4 |
| Informačná | 1 | 1 | 0 | 0 |
| **Spolu** | **23** | **17** | **2** | **4** |

## Chyby

| ID | Fáza | Pôvod | Opis | Závažnosť | Nová / známa | Stav |
|---|---|---|---|---|---|---|
| BUG-039 | Backend | BE2-001 | Pri 14 a viac súčasných odoslaniach odpovede dostane asi polovica chybu 500 po 6 s a celé API medzitým stojí. Dáta sa nestratia, opakovanie funguje. Spôsobila to oprava BUG-002 z relácie 001. | Stredná | nová | Opravené |
| BUG-040 | Backend | BE2-002 | Päť súbežných požiadaviek s otázkou, ktorá sa líši iba veľkosťou písmen, vytvorí 3 až 5 duplicitných vlastných otázok (IT-07). | Nízka | nová (zvyšok BUG-005) | Opravené |
| BUG-041 | Backend | BE2-003 | Text iba z neviditeľných znakov prejde pri znakoch, ktoré pôvodná oprava nepokrývala (napr. U+3164, U+2800, U+200E, U+202E). | Nízka | známa (BUG-007) | Opravené |
| BUG-042 | Backend | BE2-004 | Vlastné otázky s rovnakým znením v rôznom tvare Unicode (NFC a NFD) sa nepovažujú za duplicitu. | Informačná | nová | Opravené |
| BUG-043 | Frontend | FE2-001 | Nové kolo: po kliknutí na „Uložiť koncept“ v prilepenej lište sa chyby zobrazia mimo obrazovky, stránka sa neposunie a tlačidlo vyzerá, že nič nerobí. | Stredná | nová | Opravené |
| BUG-044 | Frontend | FE2-002 | Konfety po odoslaní prieskumu trvajú 1,9 s; IT-02 povoľuje najviac 1,5 s. | Nízka | nová | Opravené |
| BUG-045 | Frontend | FE2-003 | Prechod medzi otázkami nie je v smere pohybu: „Ďalej“ aj „Späť“ hrajú rovnakú animáciu (IT-02). | Nízka | nová | Opravené |
| BUG-046 | Frontend | FE2-004 | Pri pohybe klávesnicou dozadu skončí zaostrený prvok schovaný pod prilepenou hlavičkou. | Nízka | nová | Opravené |
| BUG-047 | Frontend | FE2-005 | Nové kolo: prilepená lišta s tlačidlom prekrýva zaostrený riadok otázky. | Nízka | nová | Opravené |
| BUG-048 | Frontend | FE2-006 | Ponuka animácií je na šírke 320 px orezaná vľavo; riadky volieb majú na dotyku 32 px. | Nízka | nová | Opravené |
| BUG-049 | Frontend | FE2-007 | Po odoslaní sa fokus stratí: na poďakovaní, pri odmietnutom kudos a pri odmietnutom prihlásení. | Nízka | známa (zvyšok BUG-016) | Opravené |
| BUG-050 | Frontend | FE2-008 | Stránky 403 a 404 vnútri aplikácie: vnorený prvok `<main>`, zbytočné posúvanie o 177 px, titulok karty patrí pôvodnej stránke. | Nízka | nová | Čiastočne |
| BUG-051 | Frontend | FE2-009 | Dotykové ciele pod 44 px na 360 px: odhlásenie, zatvorenie hlásenia, odkaz späť v reporte, textové odkazy na tím a kolo. | Nízka | známa (zvyšok BUG-026) | Čiastočne |
| BUG-052 | Frontend | FE2-010 | Kudos, záložka „Poslať“: preskočená úroveň nadpisu (h1 → h3 „Náhľad“). | Nízka | nová | Opravené |
| BUG-053 | Frontend | FE2-011 | Komentár a text kudos: pole obmedzuje dĺžku v jednotkách UTF-16, počítadlo počíta znaky; 990 písmen a 10 emotikonov sa oreže na 995. | Nízka | známa (zvyšok BUG-006) | Opravené |
| BUG-054 | Frontend | FE2-012 | Kontrast rámčekov polí 1,46 : 1. | Nízka | známa (BUG-030) | Otvorené |
| BUG-055 | Frontend | FE2-013 | Chyby vo formulároch podnetu a poznámky nie sú prepojené s poľami; žiadny formulár neoznačuje povinné polia. | Nízka | známa (BUG-029, čiastočne zlepšené redizajnom) | Otvorené |
| BUG-056 | Frontend | FE2-014 | Krok s otázkou pri vypĺňaní nemá nadpis (otázka je `<legend>`). | Nízka | známa (BUG-028) | Otvorené |
| BUG-057 | Celý systém | E2E2-001 | Prvé kudos, ktoré človek kedy dostane, sa neoznámi hláškou „Máš nové kudos“. | Nízka | nová | Opravené |
| BUG-058 | Celý systém | E2E2-002 | Stav kroku: v druhej karte zostane po obnovení údajov starý stav, hoci v databáze je nový. | Nízka | nová (staršia než zlúčenie) | Opravené |
| BUG-059 | Celý systém | E2E2-003 | Podnety HR: to isté pri stave a skupine podnetu v druhej relácii HR. | Nízka | nová (staršia než zlúčenie) | Opravené |
| BUG-060 | Celý systém | E2E2-004 | Po odoslaní prieskumu a návrate tlačidlom Späť ukazuje úvod kolo znova ako „Čaká na vyplnenie“. Druhá odpoveď sa neuloží. | Nízka | nová (staršia než zlúčenie) | Otvorené |
| BUG-061 | Celý systém | E2E2-005 | Konfety za nové kudos vystrelia nad formulárom na odoslanie, kým hláška je v skrytej záložke. | Nízka | nová | Opravené |

## Stále otvorené z relácie 001

| ID | Opis | Stav |
|---|---|---|
| BUG-010 | Koncept s uplynutou uzávierkou sa nedá spustiť, upraviť ani zmazať. | Čiastočne, bez zmeny |
| BUG-014 | Chybné percentové kódovanie v adrese vráti holú odpoveď 500 z frameworku. | Otvorené, bez zmeny |
| BUG-036 | Stará karta po prepnutí účtu odošle odpoveď pod novým účtom. | Otvorené, bez zmeny |
| BUG-037 | Opakovanie požiadavky po stratenej odpovedi vytvorí duplicitný koncept kola. | Otvorené, bez zmeny |

BUG-034 (chýbal náznak načítavania) redizajn vyriešil: na kliknutej položke menu sa pri pomalom prechode
zobrazí indikátor.

## Regresia opráv z relácie 001

Všetky opravené chyby z relácie 001 zostali po redizajne opravené: backend 8 z 8, frontend 21 z 21,
celý systém 12 z 12. Tri majú malý zvyšok, ktorý je v tomto registri (BUG-040, 041, 049, 051, 053).

## Riziká, ktoré nie sú chyby

Riziká z [registra relácie 001](../2026-11-12_001/BUG_REGISTER.md) platia bez zmeny (obmedzenie pokusov o
prihlásenie, CSRF iba cez `SameSite`, bezpečnostné hlavičky, `Cache-Control`, limit veľkosti požiadavky,
cookie `Secure` na obyčajnom HTTP, manažér počítaný do prahu 5, priebežné počítadlo účasti). Nové postrehy:

| Postreh | Pôvod | Poznámka |
|---|---|---|
| Voľba „Zapnuté“ v ponuke animácií prebije systémové nastavenie „obmedziť pohyb“. | Frontend | IT-02 píše, že sa animácie pri systémovom nastavení vypnú. Predvolená voľba „Podľa systému“ to dodržiava a ponuka prebitie vysvetľuje. Rozhodnutie pre zadávateľa. |
| Navigácia v rámci aplikácie na zakázanú stránku vráti HTTP 200 s označením 403 a bez údajov stránky. | Backend | Správanie frameworku; bežná požiadavka na stránku vráti skutočné 403. |
| Stránka 404 pre neznámu adresu nemá menu, stránka 403 ho má. | Celý systém | Neznáma adresa je mimo aplikačnej časti. |
| Pridanie podnetu potvrdia dve hlášky naraz (hlásenie aj text vo formulári). | Frontend | Vec vzhľadu. |
| Porovnanie tímov a vývoj ukazujú čísla s rôznym počtom desatinných miest („3,2“ vedľa „2,66“). | Frontend | Vec vzhľadu. |
| Natívne pole dátumu sa riadi jazykom prehliadača, nie slovenčinou. | Frontend | Obmedzenie prehliadača. |
| Sériový zápis odpovedí a vlastných otázok platí v rámci jedného procesu servera. | Oprava BUG-039, 040 | Pri nasadení na viac procesov alebo serverov treba riešenie na úrovni databázy. Pre SQLite a jeden proces postačuje. |
