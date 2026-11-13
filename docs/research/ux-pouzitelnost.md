# Použiteľnosť: kde a prečo strácame ľudí

Rešerš z 12. 11. 2026. Iba verejné zdroje, vo vyhľadávaní nebol použitý žiadny názov firmy, osoby ani projektu.
Nadväzuje na [otazky-do-pulse.md](otazky-do-pulse.md), ktorý rieši znenie otázok, dĺžku a frekvenciu.

**Sila dôkazu**

- **Výskum** = recenzovaná štúdia alebo metaanalýza.
- **Dáta** = veľká vzorka z praxe bez recenzie.
- **Odporúčanie** = expertná zásada (Nielsen Norman Group, Baymard).
- **Dodávateľ** = tvrdenie firmy, ktorá niečo predáva.
- **Môj úsudok** = odvodené, nie zistené.

**Obmedzenie rešerše:** väčšina zistení pochádza z abstraktov a sekundárnych zhrnutí, nie z plných textov.
Plné texty boli otvorené iba pri prehľade Huebner a Zacher, pri štúdii o automatickom posune, pri článku
o úvodnej obrazovke a pri abstrakte metaanalýzy ukazovateľov priebehu. Čísla označené „sekundárne“ sa
nepodarilo dohľadať v pôvodnej štúdii.

---

## 1. Zhrnutie

Najsilnejšie a najkonzistentnejšie zistenia:

1. **Povinné odpovede zvyšujú odchody** a zhoršujú kvalitu odpovedí. (Výskum, viac experimentov)
2. **Dlhá alebo ťažká úvodná obrazovka** stráca ľudí skôr, než začnú. (Výskum)
3. **Krátky prieskum prispôsobený mobilu** stráca menej ľudí. (Výskum, metaanalýza)
4. **Ukazovateľ priebehu pri krátkom prieskume nepomáha.** (Výskum, metaanalýza 32 experimentov)
5. **Ľudia, ktorí vidia, že po prieskume niečo nasledovalo,** sú ochotnejší odpovedať nabudúce. (Výskum, jedna štúdia)
6. **Predvolené hodnoty silno ovplyvňujú, čo ľudia zvolia.** (Výskum, metaanalýza)

Slabšie podložené sú obrazovky manažéra, prehľady a hravé prvky: prevažne expertné odporúčania a tvrdenia dodávateľov.

---

## 2. Zistenia po fázach

### 2.1 Kým človek začne

| Zistenie | Sila | Zdroj |
|---|---|---|
| Prvá otázka priamo v pozvánke zvýšila počet dokončení z 24,4 % na 29,1 %. Málo štúdií. | Výskum | https://www.surveypractice.org/article/2791-improving-survey-response-rates-the-effect-of-embedded-questions-in-web-survey-email-invitations |
| Prihlásenie: jeden experiment nenašiel nižšiu účasť pri ručnom prihlásení. **Jasný efekt „jeden klik je lepší než prihlásenie“ sa nepodarilo potvrdiť.** | Výskum, málo a staré | https://scilit.com/publications/4e45f4ae9a0b198a9b6a76c62ec147c4 |
| Pripomienky pomáhajú, ale každá ďalšia menej. Po 2 až 3 je prínos malý. | Výskum (sekundárne) + Dodávateľ | https://www.intotheminds.com/blog/en/online-survey-reminders/ |
| Deň v týždni nemá celkový vplyv. Čas dňa nebol testovaný. | Výskum | https://www.iser.essex.ac.uk/research/publications/publication-557835 |
| Na telefóne ľudia odchádzajú častejšie než na počítači; po zohľadnení toho, kto si telefón vyberá, sa rozdiel zmenšuje. | Výskum, zmiešané | https://www.surveypractice.org/article/2830 |

### 2.2 Počas vypĺňania

| Zistenie | Sila | Zdroj |
|---|---|---|
| **Najviac ľudí odíde na úvodnej obrazovke.** Dlhší text o súkromí aj dlhší uvedený čas znížili počet začatí aj dokončení. | Výskum | https://www150.statcan.gc.ca/n1/pub/12-001-x/2013002/article/11885-eng.htm |
| Menej odchodov na mobile: prispôsobenie mobilu, kratší prieskum, jednoduchší dizajn. | Výskum (metaanalýza) | https://dx.doi.org/10.5334/bar.f |
| **Ukazovateľ priebehu** s rovnomernou rýchlosťou odchody neznižuje; ak vyzerá pomaly, zvyšuje ich. | Výskum (metaanalýza) | https://research.google/pubs/where-am-i-a-meta-analysis-of-experiments-on-the-effects-of-progress-indicators-for-web-surveys/ |
| Jedna otázka na obrazovku oproti posúvaniu: bez významného rozdielu v odchodoch. | Výskum | https://api.isr.umich.edu/?p=189462 |
| Tabuľky otázok (mriežky) sú na mobile horšie; odporúča sa otázka po otázke. | Výskum | https://journals.sagepub.com/doi/10.1177/08944393221132644 |
| **Automatický posun** po výbere: bez významného vplyvu na odchody ani čas; ľudia menej opravovali odpovede, lebo si mysleli, že sa nedá vrátiť. | Výskum (cca 20 500 respondentov) | https://www.surveypractice.org/article/6381 |
| **Povinné odpovede** zvyšujú odchody a vyvolávajú odpor. | Výskum | https://doaj.org/article/0ca5f5115f4a482daeec2ddca191c8f8 |
| **Posuvníky** majú oproti tlačidlám výrazne viac odchodov (pomer šancí 6,9). | Výskum | https://iscience.uni-konstanz.de/wp-content/uploads/2011/09/2011FunkeReipsThomas_final.pdf |
| Otvorené otázky: samostatný nepovinný komentár odchody jasne nezvyšuje; doplňujúce otázky áno. | Výskum, zmiešané | https://ideas.repec.org/a/sae/somere/v54y2025i1p106-139.html |
| Uvedená dlhšia dĺžka znižuje počet začatí. | Výskum | https://bibbase.org/network/publication/galesic-bosnjak-effectsofquestionnairelengthonparticipationandindicatorsofresponsequalityinawebsurvey-2009 |
| Dotykové ciele asi 9,2 až 9,6 mm; odporúča sa približne 1 × 1 cm. | Výskum + Odporúčanie | https://www.nngroup.com/articles/touch-target-size/ |

### 2.3 Dôvera

| Zistenie | Sila | Zdroj |
|---|---|---|
| Silnejšie ubezpečenia o dôvernosti účasť celkovo **nezvyšujú**; mierne pomáhajú pri citlivých témach. | Výskum (metaanalýza) | https://api.isr.umich.edu/?p=215346 |
| Rozsiahle ubezpečenia môžu signalizovať „toto je citlivé“ a neupokojiť. Na webe sa tento efekt nepotvrdil. | Výskum | https://www.surveypractice.org/article/2872 |
| Čo presne presvedčí zamestnanca, že interný prieskum je bezpečný: **recenzovaná štúdia sa nenašla**, iba tvrdenia z praxe. | – | – |

### 2.4 Po odoslaní

| Zistenie | Sila | Zdroj |
|---|---|---|
| Ľudia, ktorí **videli** následné kroky, považovali prieskum za užitočnejší a častejšie chceli odpovedať znova. Kroky si cenili viac než samotné výsledky. | Výskum (N = 236) | Thompson a Surface, 2009 |
| Samotné poslanie súhrnných výsledkov účasť experimentálne **nezvýšilo**. | Výskum, málo | https://www.diw.de/documents/publikationen/73/diw_01.c.538287.de/diw_sp0855.pdf |

### 2.5 Manažér a HR

| Zistenie | Sila | Zdroj |
|---|---|---|
| Prečo manažéri nekonajú: čas, chýbajúca podpora vedenia, chýbajúci tréning, denný tlak. Pomáhajú **konkrétne položky, s ktorými sa dá niečo urobiť**, tréning a zapojenie tímu. | Výskum (prehľad 53 štúdií) | https://pmc.ncbi.nlm.nih.gov/articles/PMC8696015/ |
| Manažéri si vyberajú témy podľa skóre, ale **menej konajú pri témach o sebe** (vedenie, možnosť ozvať sa). | Výskum (iba abstrakt) | https://doaj.org/article/573a4bc2453d42b193d2c5abe2a27538 |
| Pripomienky manažérom zlepšili psychologické bezpečie tímu. Experiment, ktorý by zvýšil počet dokončených krokov, sa nenašiel. | Výskum / pracovný dokument | https://www.hec.edu/sites/default/files/documents/Castro%20%26%20Englmaier%20%26%20Guadalupe%20-%20Fostering%20Psychological%20Safety%20in%20Teams.pdf |
| Koľko čísel alebo položiek manažér zvládne: **overené číslo neexistuje.** | – | – |

### 2.6 Všeobecné zásady

| Zistenie | Sila | Zdroj |
|---|---|---|
| **Priveľa možností**: metaanalýza 50 experimentov našla priemerný efekt približne **nula**, s veľkým rozptylom. | Výskum (metaanalýza) | https://abcwest.cogs.indiana.edu/pmwiki/pdf/scheibehenne.options.2010.pdf |
| **Predvolené hodnoty**: stredne silný až silný efekt naprieč 58 štúdiami. | Výskum (metaanalýza) | https://ideas.repec.org/a/cup/bpubpo/v3y2019i02p159-186_00.html |
| **Skrytá navigácia** znižuje nájditeľnosť a spomaľuje. | Odporúčanie so štúdiou | https://www.nngroup.com/articles/hamburger-menus/ |
| Jednoduchý jazyk pomáha aj odborníkom. | Odporúčanie | Nielsen Norman Group |
| Nielsenove zásady, najrelevantnejšie tu: viditeľnosť stavu systému, rozpoznanie namiesto pamätania, minimalistický dizajn, predchádzanie chybám. | Odporúčanie | https://www.nngroup.com/articles/ten-usability-heuristics/ |

### 2.7 Hravé prvky a maskot

| Zistenie | Sila | Zdroj |
|---|---|---|
| Hravé prvky zvyšujú pôžitok a záujem; vplyv na dokončenie a kvalitu dát je **nejasný**. | Výskum (prehľad) | https://madoc.bib.uni-mannheim.de/41417/ |
| Vnímaný prínos **klesá s dlhším používaním** (efekt novosti). Pri prieskume každé dva týždne je to podstatné. | Výskum | https://lescahiersdelinnovation.com/wp-content/uploads/2019/06/2014-hamari_et_al-does_gamification_work.pdf |
| Maskot v prieskumoch alebo pracovných nástrojoch: **štúdia sa nenašla.** | – | – |

---

## 3. Čo dôkazy nepotvrdzujú

- „Ukazovateľ priebehu znižuje odchody.“ Pri krátkom prieskume nie.
- „Viac textu o dôvernosti zvyšuje dôveru.“ Bez všeobecného efektu; dlhý text znížil počet začatí.
- „Menej možností je vždy lepšie.“ Priemerný efekt je približne nula.
- „Hravé prvky zvyšujú dokončenie.“ Preukázaný je iba pôžitok a ten časom slabne.
- „Automatický posun prieskum zrýchli.“ Bez konzistentného rozdielu.
- „Ukázanie výsledkov zvýši účasť nabudúce.“ Experimentálne nepreukázané; preukázané je to pri viditeľných krokoch.

---

## 4. Nálezy v našej aplikácii

Zadávateľ pri skúšaní označil ako najslabšie **obrazovky HR** a **celkovú orientáciu**; vadilo mu
**priveľa textu a možností**, **nejasný ďalší krok** a to, že aplikácia pôsobí **sucho a úradne**.

| # | Nález | Dôkaz | Návrh | Kto |
|---|---|---|---|---|
| 1 | Po prihlásení nie je jasné, čo treba urobiť. HR pristane na zozname všetkých kôl. | Odporúčanie (viditeľnosť stavu); prehľad 53 štúdií: pomáha jasný ďalší krok | Úvod „Čo treba urobiť teraz“ s najviac 3 úlohami podľa roly (**IT-11**) | logika |
| 2 | HR má 9 položiek menu v troch riadkoch na mobile. | Odporúčanie (minimalistický dizajn). **Pozor:** výskum o priveľa možnostiach efekt nepotvrdzuje, takže toto stojí na náleze zadávateľa, nie na štúdii. | Najviac 5 položiek, zvyšok ako viditeľné záložky v stránke (**IT-12**) | logika |
| 3 | Záložky a zbalené časti môžu obsah skryť. | Odporúčanie so štúdiou: skrytá navigácia znižuje nájditeľnosť | Druhá úroveň vždy viditeľná, nie za ikonou. Zbalené časti majú nadpis s počtom a kľúčové číslo zostáva vonku. | logika |
| 4 | Výsledky kola ukazujú všetko naraz: rozdelenia, komentáre, návrhy, kroky, formulár. | Prehľad 53 štúdií: konať pomáhajú konkrétne položky | Hore zhrnutie v dvoch vetách a jeden návrh, detail na klik (**IT-13**) | logika |
| 5 | Nové kolo je zoznam 38 otázok. | Metaanalýza: predvolené hodnoty silno fungujú | Predvybrané odporúčané otázky, kolo na dva kliky (**IT-13**). **Riziko:** predvoľba sa bude preberať bez čítania, preto sa musí striedať a byť viditeľná. | logika |
| 6 | Návrhy krokov môžu obchádzať témy o manažérovi. | Výskum: manažéri pri témach o sebe konajú menej | Pravidlo už dnes vyberá podľa skóre bez ohľadu na tému. Ponechať a nikdy nepridať filter, ktorý by tieto témy vynechal. | hotové |
| 7 | **Úvodná obrazovka pred prvou otázkou** je klik navyše. | Výskum: úvodná obrazovka je najväčšie miesto odchodu | Vetu o dôvernosti ukázať nad prvou otázkou namiesto samostatnej obrazovky. **Mení MVP-07, treba rozhodnutie.** | na rozhodnutie |
| 8 | **Všetky otázky sú povinné** („Ďalej“ je zablokované). | Výskum: povinné odpovede zvyšujú odchody | Možnosť „Preskočiť“. **Mení tabuľku odpovedí (NFR-01, MVP-08), treba rozhodnutie.** | na rozhodnutie |
| 9 | Ukazovateľ priebehu. | Výskum: pri krátkom prieskume nepomáha ani neškodí | Ponechať text „2 z 4“ (MVP-08). Nič nemeniť. | bez zmeny |
| 10 | Tlačidlá škály. | Výskum: tlačidlá, nie posuvník; cieľ asi 1 cm | Máme tlačidlá 59 × 56 px. V poriadku. | bez zmeny |
| 11 | Pôsobí to sucho a úradne. | Výskum: hravé prvky zvyšujú pôžitok, nie dokončenie, a efekt slabne | Vec vzhľadu a tónu. Podklad: odložená vetva `feat/it-01-design` (farby, animácie). Maskota odporúčam skôr nie alebo striedmo. | kolega |
| 12 | Vstup do prieskumu vyžaduje prihlásenie heslom; nie sú pripomienky. | Výskum: prvá otázka v pozvánke pomáha; pripomienky pomáhajú do 2 až 3 | Vyžaduje SSO a e-mail alebo Teams. Mimo dosahu bez externých systémov. | neskôr |

---

## 5. Čo z toho plynie pre poradie

1. **IT-11, IT-12, IT-13** riešia nálezy zadávateľa (1 až 5) a výskum im neodporuje.
2. **Nálezy 7 a 8 majú najsilnejšie dôkazy z celej rešerše**, ale menia požiadavky MVP a jeden z nich
   aj tabuľku odpovedí. Sú zapísané ako nápady na rozhodnutie zadávateľa.
3. Nález 12 je pravdepodobne najväčšia príčina straty ľudí v praxi, ale bez SSO a pripomienok sa nedá riešiť.

## 6. Čo sa nepodarilo overiť

- Plné texty: metaanalýza odchodov na mobile, Huebner a Zacher 2023, Galesic a Bosnjak, Peytchev 2009,
  Singer 1992, Keusch a Zhang 2017.
- Bez primárneho zdroja: veľkosť efektu „jeden klik oproti prihláseniu“, vplyv času dňa, vplyv rýchlosti
  spätnej väzby, overený počet čísel na prehľade, experimenty s dokončovaním krokov manažérmi, maskot.
- Limity ako „1 až 3 položky pre manažéra“ a „najviac 2 pripomienky“ sú úsudok, nie zistenie.
