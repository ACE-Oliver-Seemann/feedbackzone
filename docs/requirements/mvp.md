# Feedback portál – požiadavky na MVP pre vývojárov

> Zdroj: Claude Docs „Feedback portál – požiadavky na MVP pre vývojárov“, stav k 11. 11. 2026.
> Tento súbor je **hlavný zdroj požiadaviek** pre Claude Code. Pri zmene dokumentu ho nahraďte novým exportom.

## Úvod

Dokument je zadanie pre vývojárov MVP. Termín je **3 pracovné dni**. Výsledkom je funkčná webová aplikácia na testovacích dátach, ktorá pokryje cyklus: zamestnanec vyplní pulse → manažér vidí výsledky tímu → zapíše krok → tím vidí „Povedali ste, urobili sme“. K tomu kudos medzi kolegami.

Ako čítať dokument:

- Každá požiadavka má ID (**MVP-xx** funkčné, **NFR-xx** nefunkčné) a akceptačné kritériá. Commity, pull requesty a testy na ID odkazujú.
- Stĺpec *Zdroj* odkazuje na ID v špecifikácii *Feedback portál v0.4*. Platí znenie v tomto dokumente; špecifikácia slúži na kontext.
- Čo tu nie je, sa nerobí. Nápady navyše patria do sekcie Mimo rozsahu.

## Funkčné požiadavky

17 požiadaviek v piatich oblastiach. Všetky sú Must; niečo sa dá vypustiť iba podľa plánu (kudos ako prvé).

### Prihlásenie a roly

| ID | Požiadavka | Akceptačné kritériá | Zdroj |
| --- | --- | --- | --- |
| MVP-01 | Prihlásenie e-mailom a heslom | Správne údaje prihlásia a presmerujú na úvodnú stránku roly. Zlé údaje zobrazia všeobecnú chybu bez upresnenia, či neexistuje e-mail alebo heslo. Odhlásenie zruší reláciu. | náhrada AUTH-01 |
| MVP-02 | Účty, tímy a roly z testovacích dát | Seed skript vytvorí 2 tímy po 6 ľuďoch (1 manažér + 5 zamestnancov), 1 HR a knižnicu otázok. Registrácia, obnova hesla ani správa používateľov v UI nie sú. | ADM-01 (zjednodušené) |
| MVP-03 | Prístup podľa roly | Každá stránka a každý API endpoint overí rolu a tím na serveri podľa matice v sekcii Roly a oprávnenia. Nepovolený prístup vráti 403, nie prázdne dáta. | ROL-01, ROL-03 |

### Tvorba prieskumu

| ID | Požiadavka | Akceptačné kritériá | Zdroj |
| --- | --- | --- | --- |
| MVP-04 | Vytvorenie kola | HR alebo manažér zadá názov, cieľový tím (manažér iba svoj) a dátum uzávierky. Vyberie 3 až 5 otázok z knižnice. Menej ako 3 alebo viac ako 5 otázok formulár neuloží. | SUR-01, SUR-02, PUL-05 |
| MVP-05 | Spustenie a uzavretie kola | Kolo má stavy *koncept → otvorené → uzavreté*. Spustí sa tlačidlom. Uzavrie sa tlačidlom alebo automaticky pri prvom načítaní po dátume uzávierky. Spustené kolo sa nedá upravovať. | SUR-04, A-31 |

### Vyplnenie pulse

| ID | Požiadavka | Akceptačné kritériá | Zdroj |
| --- | --- | --- | --- |
| MVP-06 | Zoznam mojich prieskumov | Zamestnanec vidí otvorené kolá svojho tímu, ktoré ešte nevyplnil, a pri vyplnených stav „Odoslané“. | DASH-09 |
| MVP-07 | Úvodná obrazovka | Pred prvou otázkou sa zobrazí text o dôvernosti z NFR-04. | FILL-04, A-30 |
| MVP-08 | Vyplnenie | Jedna otázka na obrazovku, škála 1–5, priebeh „2 z 4“, tlačidlá Späť a Ďalej. Posledný krok je nepovinný komentár (max. 1 000 znakov). Funguje na mobile od šírky 360 px. | FILL-02, FILL-03, PUL-02 |
| MVP-09 | Odoslanie | Odpoveď sa odošle naraz na konci. Po odoslaní sa zobrazí poďakovanie a posledné kroky tímu (MVP-14). Druhé odoslanie do toho istého kola server odmietne (409). Do uzavretého kola sa odpovedať nedá. | FILL-05, A-01 |

### Výsledky

| ID | Požiadavka | Akceptačné kritériá | Zdroj |
| --- | --- | --- | --- |
| MVP-10 | Výsledky kola pre manažéra | Po uzavretí kola manažér vidí: počet odpovedí / počet členov tímu, priemer a rozdelenie odpovedí 1–5 pre každú otázku, zoznam komentárov v náhodnom poradí. Otvorené kolo ukazuje iba účasť. | DASH-01, A-08 |
| MVP-11 | Prah dôvernosti | Ak má kolo menej ako `MIN_GROUP_SIZE` (5) odpovedí, API nevráti žiadne priemery, rozdelenie ani komentáre, iba stav `insufficient_responses` a počet. UI zobrazí „Nedostatok odpovedí“. | A-05, A-06 |
| MVP-12 | Prehľad pre HR | HR vidí zoznam všetkých kôl: tím, stav, účasť a či manažér zapísal krok. Detail kola rovnako ako MVP-10 vrátane prahu. | DASH-08 (zjednodušené) |

### Reakcia na výsledky

| ID | Požiadavka | Akceptačné kritériá | Zdroj |
| --- | --- | --- | --- |
| MVP-13 | Zápis kroku | Pri uzavretom kole manažér pridá krok: téma, čo sa urobí, termín, stav (*plánované / prebieha / hotové*). Krokov môže byť viac a stav sa dá meniť. | ACT-01 |
| MVP-14 | „Povedali ste, urobili sme“ | Stránka tímu ukazuje uzavreté kolá (najnovšie hore): účasť, priemery otázok (iba nad prahom) a kroky so stavom. Kroky posledného uzavretého kola sa zobrazia aj po odoslaní odpovede (MVP-09). | ACT-02, FILL-05 |
| MVP-15 | Nedokončené kolo | Uzavreté kolo bez kroku má u manažéra aj v prehľade HR označenie „Čaká na krok“. | ACT-01 |

### Kudos

| ID | Požiadavka | Akceptačné kritériá | Zdroj |
| --- | --- | --- | --- |
| MVP-16 | Poslanie kudos | Formulár: príjemca (ktokoľvek okrem seba), text 20 až 500 znakov, hodnota zo zoznamu (Spolupráca, Kvalita, Pomoc kolegom, Inovácia, Zákazník), viditeľnosť *verejné v tíme / súkromné*. Kudos je podpísané menom odosielateľa. | KUD-01, KUD-02 |
| MVP-17 | Feed kudos | Stránka tímu ukazuje verejné kudos tímu, najnovšie hore. Súkromné kudos vidí iba príjemca na stránke „Moje kudos“; nevidí ich ani manažér, ani HR. | KUD-02, KUD-03 |

## Mimo rozsahu

Všetko nižšie zostáva v špecifikácii pre ďalšie fázy. Do MVP sa nezmestí, lebo potrebuje externý systém, právne schválenie alebo viac ako deň práce.

| Vynechané | ID | Prečo teraz nie |
| --- | --- | --- |
| Firemné SSO, prieskum na jeden klik | AUTH-01 až 06 | Vyžaduje registráciu aplikácie u IT |
| Databáza odpovedí s menami pre HR, audit prístupov | A-10 až A-14 | Vyžaduje DPIA a schválenie DPO; v MVP sa mená k odpovediam vôbec neukladajú |
| Nahlasovanie odpovedí, sprístupnenie mena, postup pri ohrození života | A-15 až A-24 | Závisí od databázy s menami a od schváleného postupu HR |
| Tlačidlo „Kontaktujte ma z HR“ | A-25 | Nevybrané do MVP |
| Dotazníky medzi kolegami, dotazník s menom | SUR-08, A-26 až A-28 | Nový režim dôvernosti, rozpor so SUR-03 |
| Automatická rotácia otázok, check-upy, plánovanie kôl | PUL-01, PUL-02, PUL-06 | Kolá sa v MVP spúšťajú ručne |
| Odpovede na komentáre bez odhalenia autora | ACT-03 | Komplexné smerovanie správ |
| Upozornenia pre HR, teplotná mapa, export | ACT-04, DASH-04 až 08 | Príliš málo dát na zmysluplný výstup |
| AI report, AI tvorba prieskumu, feedback coach | AI-01 až 06, SUR-05, TUT-03 | Vyžaduje schválenú AI s nulovým uchovávaním dát |
| Gamifikácia, kudos ako podklad k povýšeniu | GAM-01 až 06 | Potrebuje detekciu zneužitia |
| Tutoriál | TUT-01, TUT-02 | Obsah dodá HR neskôr |
| E-mail, Teams, HR systém, kalendár | INT-01 až 04 | Externé integrácie |
| Viac jazykov, viac pobočiek | SUR-07, kap. 1.4 | MVP je iba slovensky, jedna pobočka |

## Roly a oprávnenia

Tri roly. Manažér má aj všetky práva zamestnanca vo svojom tíme. Matica platí pre UI aj API (MVP-03).

| Akcia | Zamestnanec | Manažér | HR |
| --- | --- | --- | --- |
| Vyplniť kolo svojho tímu | áno | áno | — |
| Vytvoriť, spustiť, uzavrieť kolo | nie | iba svoj tím | každý tím |
| Vidieť výsledky kola (nad prahom) | nie, iba stránka tímu | iba svoj tím | každý tím |
| Vidieť komentáre (nad prahom) | nie | iba svoj tím | každý tím |
| Zapísať a meniť krok | nie | iba svoj tím | nie |
| Vidieť stránku tímu a kroky | svoj tím | svoj tím | každý tím |
| Poslať kudos | áno | áno | áno |
| Vidieť súkromné kudos | iba prijaté | iba prijaté | iba prijaté |
| Zistiť autora odpovede | nikto | nikto | nikto |

## Obrazovky a hlavný tok

Celé MVP je jeden cyklus piatich krokov. Najdôležitejší je krok 4: bez neho tím neuvidí, že sa s feedbackom niečo stalo.

1. Vytvorenie kola (HR alebo manažér): 3–5 otázok, tím, termín.
2. Vyplnenie pulse (zamestnanec): jedna otázka na obrazovku, do 2 minút.
3. Výsledky tímu (manažér): priemery a komentáre od 5 ľudí, po uzávierke kola.
4. Krok po kole (manažér): téma, čo urobí, termín.
5. „Povedali ste, urobili sme“ (tím): výsledky a kroky. Potom ďalšie kolo.

Kudos beží mimo cyklu: zamestnanec ho môže poslať kedykoľvek.

| Obrazovka | Cesta | Rola | Požiadavky |
| --- | --- | --- | --- |
| Prihlásenie | `/login` | všetci | MVP-01 |
| Moje prieskumy | `/` | zamestnanec, manažér | MVP-06 |
| Vypĺňanie kola | `/rounds/:id/fill` | zamestnanec, manažér | MVP-07 až MVP-09 |
| Stránka tímu | `/team/:id` | všetci (podľa matice) | MVP-14, MVP-17 |
| Poslať kudos | `/kudos/new` | všetci | MVP-16 |
| Moje kudos | `/kudos/me` | všetci | MVP-17 |
| Nové kolo | `/rounds/new` | manažér, HR | MVP-04 |
| Výsledky kola a kroky | `/rounds/:id/results` | manažér, HR | MVP-10, MVP-11, MVP-13, MVP-15 |
| Prehľad kôl | `/hr/rounds` | HR | MVP-12, MVP-15 |

## Dátový model

Deväť tabuliek. Kľúčové je, že **odpoveď neobsahuje ID používateľa**: kto už odpovedal, sa eviduje v samostatnej tabuľke Účasť.

| Tabuľka | Hlavné stĺpce | Poznámka |
| --- | --- | --- |
| Používateľ | id, meno, e-mail, hash hesla, rola, tím | Heslo iba ako hash (bcrypt alebo argon2) |
| Tím | id, názov, manažér | |
| Otázka | id, text, typ (škála 1–5), okruh | Pevná knižnica z kap. 7.2, naplnená skriptom |
| Kolo | id, tím, názov, začiatok, uzávierka, stav (koncept / otvorené / uzavreté) | |
| Otázka v kole | kolo, otázka, poradie | 3–5 záznamov na kolo |
| Účasť | kolo, používateľ | Iba že odpovedal, bez obsahu. Zabráni dvojitej odpovedi. |
| Odpoveď | id, kolo, tím, hodnoty otázok, komentár | **Bez používateľa a bez presného času** |
| Krok | id, kolo, téma, čo sa urobí, termín, stav | Zapisuje manažér |
| Kudos | id, od koho, komu, text, hodnota, viditeľnosť, dátum | Kudos sú podpísané, autor je známy |

Účasť a odpoveď sa zapíšu v jednej transakcii. Preto sa nedá spätne zistiť, ktorá odpoveď patrí komu, a zároveň nikto neodpovie dvakrát.

Obmedzenia v databáze:

- `Účasť`: unikátny kľúč (kolo, používateľ), aby sa nedalo odpovedať dvakrát.
- `Odpoveď.id` je UUID, nie poradové číslo. Odpoveď ani účasť nemajú `createdAt`.
- Hodnoty otázok sú celé čísla 1–5, kontrola na serveri aj v databáze.

## API

REST nad JSON, všetko za prihlásením okrem `POST /api/login`. Oprávnenia podľa matice v sekcii Roly a oprávnenia.

| Metóda a cesta | Čo robí | Kto | Požiadavky |
| --- | --- | --- | --- |
| `POST /api/login`, `POST /api/logout` | Prihlásenie, odhlásenie | všetci | MVP-01 |
| `GET /api/me` | Prihlásený používateľ, rola, tím | všetci | MVP-03 |
| `GET /api/questions` | Knižnica otázok | manažér, HR | MVP-04 |
| `GET /api/rounds` | Kolá podľa roly (moje / tímu / všetky) | všetci | MVP-06, MVP-12 |
| `POST /api/rounds` | Vytvoriť kolo (koncept) | manažér, HR | MVP-04 |
| `POST /api/rounds/:id/open`, `/close` | Spustiť, uzavrieť | manažér, HR | MVP-05 |
| `GET /api/rounds/:id` | Otázky kola na vyplnenie | člen tímu | MVP-08 |
| `POST /api/rounds/:id/responses` | Odoslať odpoveď; 409 pri druhom pokuse | člen tímu | MVP-09 |
| `GET /api/rounds/:id/results` | Výsledky; pod prahom iba `insufficient_responses` | manažér, HR | MVP-10, MVP-11 |
| `POST /api/rounds/:id/actions`, `PATCH /api/actions/:id` | Pridať krok, zmeniť stav | manažér | MVP-13 |
| `GET /api/teams/:id/summary` | Uzavreté kolá, priemery nad prahom, kroky, verejné kudos | člen tímu, HR | MVP-14, MVP-17 |
| `POST /api/kudos`, `GET /api/kudos/me` | Poslať kudos, moje prijaté | všetci | MVP-16, MVP-17 |

Žiadna odpoveď API neobsahuje ID ani meno používateľa, ktorý poslal odpoveď alebo komentár (NFR-01). Text komentárov sa vracia iba v GET /api/rounds/:id/results nad prahom dôvernosti (MVP-10, MVP-11).

## Nefunkčné požiadavky

MVP je dôvernejšie ako plná verzia: mená sa k odpovediam neukladajú vôbec, takže autora nezistí nikto, ani HR.

| ID | Požiadavka | Akceptačné kritériá | Zdroj |
| --- | --- | --- | --- |
| NFR-01 | Odpoveď sa nedá spárovať s používateľom | Tabuľka odpovedí nemá stĺpec používateľa ani času. Logy servera neobsahujú telo odpovede. Test: po 5 odpovediach sa z databázy nedá určiť, kto poslal ktorú. | A-01, A-09, ROL-04 |
| NFR-02 | Prah dôvernosti v konfigurácii | `MIN_GROUP_SIZE = 5` je v jednom konfiguračnom súbore, nie natvrdo v kóde. Testy počítajú hranicu z tejto hodnoty (4 → skryté, 5 → zobrazené). | A-05, A-06 |
| NFR-03 | Oprávnenia na serveri | Každý endpoint overí rolu a tím. Test: manažér tímu B dostane 403 na výsledky tímu A. | ROL-03, A-08 |
| NFR-04 | Slovo „dôverný“ | V UI nie je slovo „anonymný“. Úvodný text prieskumu: *„Tvoje odpovede sú dôverné. Manažér ani tím neuvidia, kto čo napísal, výsledky vidia iba za skupinu aspoň 5 ľudí.“* | A-29, A-30 |
| NFR-05 | Heslá a relácia | Heslá iba ako hash (bcrypt alebo argon2). Relácia v cookie s `HttpOnly` a `SameSite=Lax`. | kap. 8 |
| NFR-06 | Iba testovacie dáta | V kóde, testoch, seede ani v konverzácii s AI nie sú skutočné mená, e-maily ani odpovede zamestnancov. | kap. 13, otázka 8 |
| NFR-07 | Mobil a jazyk | Vypĺňanie funguje od šírky 360 px. UI je po slovensky, texty v jednom súbore pre neskorší preklad. | FILL-02, kap. 8 |

Komentáre sa v MVP nedajú nahlásiť. Pred pilotom so skutočnými ľuďmi ich treba ručne kontrolovať alebo vypnúť.

## Technológie

Odporúčam jednu aplikáciu v jednom repozitári, bez samostatného backendu a bez databázového servera. Za týždeň je každá ďalšia súčasť riziko.

| Vrstva | Návrh | Prečo |
| --- | --- | --- |
| Aplikácia | Next.js + TypeScript | Frontend aj API v jednom projekte, Claude Code v ňom pracuje dobre |
| Databáza | SQLite cez Prisma | Jeden súbor, žiadna inštalácia servera; neskôr sa dá prejsť na PostgreSQL |
| Prihlásenie | E-mail + heslo, hash cez bcrypt, relácia v cookie | Najjednoduchšie riešenie, SSO sa doplní neskôr |
| Vzhľad | Tailwind CSS | Rýchle a funguje aj na mobile |
| Testovacie dáta | Seed skript (Prisma) | 2 tímy po 6 ľuďoch, 1 HR, knižnica otázok |

Ak tím lepšie pozná Python, rovnako dobre poslúži **Django**: má hotové prihlásenie aj administráciu, čo ušetrí deň práce. Rozhodujúcim kritériom je, čo tím už pozná.

## Plán na 5 dní

Každý deň končí niečím, čo sa dá ukázať. Ak sa deň nestihne, ako prvé sa vynechá kudos (deň 4), jadro prieskum → výsledky → krok zostáva.

| Deň | Čo sa robí | Hotovo, keď |
| --- | --- | --- |
| 1 | Kostra projektu, databáza, seed s testovacími dátami, prihlásenie e-mailom a heslom, menu podľa roly | Používateľ sa prihlási a vidí menu svojej roly |
| 2 | Tvorba prieskumu (HR, manažér) a vyplnenie pulse (zamestnanec) vrátane úvodného textu a ochrany pred dvojitou odpoveďou | Kolo sa dá vytvoriť, spustiť a vyplniť na mobile |
| 3 | Uzavretie kola, výsledky tímu s prahom 5, zápis kroku manažérom | Manažér vidí výsledky a zapíše krok; pod 5 vidí „Nedostatok odpovedí“ |
| 4 | „Povedali ste, urobili sme“ (stránka tímu, koniec ďalšieho kola) a kudos (formulár, feed) | Zamestnanec vidí kroky po minulom kole a pošle kudos |
| 5 | Testy pravidiel dôvernosti, oprava chýb, úprava vzhľadu, generálka dema | Demo scenár prejde od začiatku do konca bez chýb |

## Akceptačný scenár a definícia hotového

MVP je hotové, keď tento scenár prejde na testovacích dátach bez zásahu do kódu:

1. HR sa prihlási a vytvorí kolo so 4 otázkami pre tím A.
2. Päť členov tímu A ho vyplní, jeden aj na mobile. Druhý pokus o vyplnenie systém odmietne.
3. Manažér tímu A vidí priemery a komentáre. Manažér tímu B ich nevidí.
4. V kole tímu B so 4 odpoveďami manažér vidí iba „Nedostatok odpovedí“.
5. Manažér tímu A zapíše krok. Zamestnanec ho vidí v „Povedali ste, urobili sme“.
6. Zamestnanec pošle kolegovi verejné kudos a to sa zobrazí vo feede tímu.

Požiadavka je hotová, keď:

- [ ] spĺňa všetky svoje akceptačné kritériá,
- [ ] NFR-01, NFR-02 a NFR-03 majú automatické testy, ktoré prechádzajú,
- [ ] kód je v hlavnej vetve cez pull request s ID požiadavky a prešiel kontrolou druhého vývojára,
- [ ] aplikácia sa dá spustiť podľa README jedným príkazom vrátane seedu.

## Riziká a otvorené otázky

| Riziko | Čo s ním |
| --- | --- |
| Nestihneme všetko za 5 dní | Kudos je prvé na vypustenie; jadro (dni 1–3) má prednosť |
| Komentáre bez nahlasovania | Pilot so skutočnými ľuďmi až po doplnení nahlasovania, alebo bez komentárov |
| Vlastné prihlásenie heslom nie je pre ostrú prevádzku | Iba na demo; pred pilotom nahradiť firemným SSO |
| Demo sa bude brať ako hotový produkt | Pri prezentácii jasne ukázať zoznam vynechaných funkcií |

Pred začiatkom treba rozhodnúť:

- [ ] Koľko ľudí bude na MVP programovať a kto vlastní ktorý deň plánu.
- [ ] Technológie: Next.js alebo Django (podľa toho, čo tím pozná).
- [ ] Ktoré otázky z knižnice (kap. 7.2) budú v deme.
- [ ] Kde demo pobeží: lokálne na notebooku, alebo na internom serveri.
