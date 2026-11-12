# Pulse prieskum: ktoré otázky, koľko a ako často

Rešerš z 12. 11. 2026. Iba verejné zdroje, vo vyhľadávaní nebol použitý žiadny názov firmy, osoby ani projektu.

**Ako čítať istotu tvrdení**

- **Výskum** = recenzovaná štúdia alebo pôvodná správa s opísanou metodikou.
- **Dodávateľ** = tvrdenie firmy, ktorá predáva prieskumy alebo poradenstvo. Môže byť pravdivé, ale nedá sa overiť.
- **Môj úsudok** = odporúčanie odvodené z vyššie uvedeného, nie zistenie.

**Čo sa mi nepodarilo otvoriť:** článok McKinsey (stránka neodpovedala, obsah poznám iba zo zhrnutia vo vyhľadávaní), články SPACE a DevEx v ACM Queue (server odmietol prístup, uvádzam ich podľa bibliografických údajov a sekundárnych zhrnutí) a dokument na ResearchGate, na ktorý sa odvoláva CultureMonkey. Presné znenie Edmondsonovej škály a položiek COPSOQ som z primárneho textu neoveroval, v knižnici ich preto nepreberám, iba sa nimi inšpirujem.

---

## 1. Overenie tvrdení zo špecifikácie

| # | Tvrdenie | Verdikt | Čo zdroj naozaj hovorí | URL |
|---|---|---|---|---|
| 1 | Pulse každé 1–2 týždne, 3–5 otázok, do 2 minút | **Zdroj nenájdený** (zhoda dodávateľov) | Primárny výskum, ktorý by porovnal týždennú, dvojtýždennú a mesačnú frekvenciu, som nenašiel. Rozsah „3–5 otázok pri týždennom alebo dvojtýždennom rytme“ opakujú dodávatelia bez zdroja. Čas: podľa dát SurveyMonkey trvá otázka v prieskume s 3–10 otázkami približne 30 sekúnd, teda 5 otázok asi 2,5 minúty. Pri krátkych škálových otázkach je „do 2 minút“ uveriteľné, ale nie doložené. | https://surveymonkey.com/curiosity/survey_completion_times |
| 2 | „Väčšina respondentov odpadne v prvých 15 otázkach“ (SurveyMonkey, ~100 000 prieskumov) | **Čiastočne** – zdroj existuje, formulácia je skreslená | Zdroj hovorí, že **najprudší nárast** odpadnutia na každú pridanú otázku je do 15 otázok, potom sa krivka splošťuje. Nehovorí, že väčšina ľudí odpadne. Vzorka: 100 000 prieskumov (po 2 000 pre každú dĺžku 1–50 otázok), roky 2009–2010, všeobecné prieskumy, nie zamestnanecké. Sprievodný článok uvádza dokončenie 89 % pri 10 otázkach a 87 % pri 20. | https://www.surveymonkey.com/curiosity/survey_questions_and_completion_rates/ |
| 3 | „Rotovanie otázok drží účasť o 32 % vyššie“ (štúdia 2025, cituje CultureMonkey) | **Nepotvrdené** | CultureMonkey píše o „nedávnej štúdii z roku 2025“ bez názvu a autorov a odkazuje na dokument na ResearchGate, ktorý sa mi nepodarilo otvoriť ani dohľadať inde. Jediná recenzovaná štúdia o pulse prieskumoch z tohto obdobia, ktorú som našiel (Berthelsen a Muhonen), je kvalitatívna (16 rozhovorov) a číslo 32 % v nej nie je. Odporúčam toto číslo zo špecifikácie vypustiť. | https://www.culturemonkey.io/guides/pulse-survey/pulse-survey-best-practices/pulse-survey-frequency/ |
| 4 | „Manažéri vysvetľujú najmenej 70 % rozdielov v angažovanosti tímov“ (Gallup) | **Čiastočne** – citát sedí, dôkaz je slabší, než znie | Gallup (Harter, Adkins, 2015) to píše doslova. V zhrnutí toho istého článku je však „až do 70 %“. Podľa sekundárneho opisu metodiky ide o regresiu na 11 781 tímoch, kde sa angažovanosť tímu predpovedá z premenných o manažérovi. Je to správa firmy, nie recenzovaná štúdia, dáta sú z USA a ide o súvislosť, nie o dôkaz príčiny. Metodiku som v pôvodnej správe neoveril. | https://www.gallup.com/workplace/236570/employees-lot-managers.aspx |
| 5 | „Zamestnanci s pravidelnými stretnutiami s manažérom sú takmer trikrát častejšie angažovaní“ (Gallup) | **Potvrdené ako citát** | Presne táto veta je v článku Gallupu z 8. 4. 2015. Zdrojom je prieskum 7 712 dospelých v USA. Ide o súvislosť z vlastných výpovedí, nie o experiment. | https://www.gallup.com/workplace/236570/employees-lot-managers.aspx |
| 6 | „Keď sa manažér sústredí na silné stránky, je angažovaných 67 %, pri slabých 31 %“ (Gallup) | **Potvrdené ako citát** | Čísla sedia. Porovnávajú sa ľudia, ktorí **rozhodne súhlasia**, že sa manažér sústredí na ich silné stránky, s tými, ktorí rozhodne súhlasia, že na slabé. Veľkosť týchto podskupín článok neuvádza. | https://www.gallup.com/workplace/236570/employees-lot-managers.aspx |
| 7 | Minimálne 5 odpovedí pred zobrazením výsledkov (Culture Amp) | **Čiastočne** – prah 5 je bežný, pripísanie zdroju je nepresné | Dokumentácia Culture Amp používa 5 iba ako príklad, predvolenú hodnotu v nej neuvádza. Jasnejší zdroj je Microsoft Viva Glint: predvolený prah dôvernosti je 5, pre komentáre 10. Prah 5 je odvetvová zvyklosť, nie výsledok výskumu. Berthelsen a Muhonen považujú zobrazovanie výsledkov pre skupiny 3–5 ľudí za neprijateľné. | https://support.cultureamp.com/en/articles/7048386-confidentiality-protections-in-reporting · https://learn.microsoft.com/en-us/viva/glint/setup/manage-confidentiality-thresholds |
| 8 | Štruktúra: 1–2 stále otázky + 2–3 rotujúce + 1 nepovinný komentár | **Zdroj nenájdený** (zhoda dodávateľov, rozumná prax) | Experimentálny dôkaz som nenašiel. Kvalitatívna štúdia opisuje, že organizácie rotujúcu banku otázok bežne používajú (napr. 50–60 otázok, 10 týždenne) a že zmena tém udržiava záujem. Výskum škál podporuje, že jedna dobre napísaná otázka na jeden konštrukt je použiteľná (Wanous a kol., 1997). | https://www.frontiersin.org/journals/organizational-psychology/articles/10.3389/forgp.2025.1696769/full |
| 9 | Stála otázka: eNPS (0–10) alebo „Aký bol tvoj týždeň?“ (1–5) | **Čiastočne** | eNPS: recenzovaná štúdia (Brown, 2020) zistila, že na úrovni skupín predpovedá fluktuáciu podobne ako priemer alebo podiel priaznivých odpovedí. Kritika NPS sa týka hlavne zákazníckej verzie. Problém pre nás je iný: pri 5–10 odpovediach posunie jeden človek skóre tímu o 10–20 bodov (môj výpočet). Jednopoložková celková spokojnosť: metaanalýza (Wanous a kol., 1997) uvádza koreláciu 0,63 s viacpoložkovými škálami. Otázka „aký bol týždeň“ sama osebe validovaná nie je, ale je to ten istý typ otázky. | https://law-journals-books.vlex.com/vid/comparing-the-validity-of-855623482 · https://academicnewsletter.sufe.edu.cn/info/372882 |

---

## 2. Koľko a ako často

### Odporúčanie

| Parameter | Odporúčanie | Istota |
|---|---|---|
| Frekvencia | **Každé 2 týždne.** Ak tím nestíha medzi kolami zapísať aspoň jeden krok, prejsť na 4 týždne. | Nízka až stredná |
| Počet otázok | **4–5 škálových + 1 nepovinný komentár** | Stredná |
| Zloženie | 1 stála trendová otázka + 3 rotujúce + komentár. Druhú stálu otázku pridať, iba ak ju niekto naozaj sleduje. | Stredná (môj úsudok) |
| Čas vyplnenia | Cieľ do 2 minút bez komentára | Stredná |
| Rotácia | Aktívna sada **12 otázok**, každá sa vráti raz za 8 týždňov. Zvyšok knižnice je zásoba na výmenu. | Nízka (môj úsudok) |
| Podmienka | Po každom kole viditeľný krok alebo vysvetlenie, prečo krok nie je | **Vysoká** |

### Dôkazy

- **Frekvencia nemá tvrdý dôkaz.** Kontrolovanú štúdiu, ktorá by porovnala týždenný, dvojtýždenný a mesačný rytmus zamestnaneckých prieskumov, som nenašiel. Čísla na blogoch („účasť sa zrúti do 6–8 týždňov“, „85 % účasť“) nemajú zdroj. V praxi sa používa všetko od týždňa po tri mesiace (Berthelsen a Muhonen, 2026).
- **Únavu z prieskumov spôsobuje hlavne chýbajúca reakcia, nie počet otázok.** McKinsey na základe prehľadu vyše 20 akademických článkov uvádza, že hlavnou príčinou je očakávanie, že vedenie s výsledkami nič neurobí (obsah poznám iba zo zhrnutia). Systematický prehľad Huebner a Zacher (2021) hovorí, že práve následné kroky rozhodujú o prínose prieskumu a že sa v praxi zanedbávajú. V kvalitatívnej štúdii záviseli účasti 80–90 % od toho, či sa líniový manažér výsledkom venoval. Akademická literatúra priamo o „únave z prieskumov“ je však podľa prehľadu Fass-Holmesa tenká a protirečivá.
- **Dĺžka má merateľný, ale malý vplyv v našom rozsahu.** SurveyMonkey: odpadnutie rastie najrýchlejšie do 15 otázok a s dĺžkou klesá čas na otázku (z 30 na 19 sekúnd), čo naznačuje povrchné odpovedanie. Pri 5 otázkach sme hlboko pod týmito hranicami.
- **Z výskumu denníkových meraní** (EMA/ESM, viaceré metaanalýzy) nevyplýva jednoznačný vzťah medzi frekvenciou a ochotou odpovedať. Ide o iný kontext (viac meraní denne), takže to berte iba ako nepriamy signál.

### Prečo dva týždne (môj úsudok)

- Referenčné obdobie „za posledné dva týždne“ sa prekrýva s bežnou dĺžkou šprintu a ľudia si ho ešte pamätajú.
- Manažér má medzi kolami čas niečo urobiť. Týždenný rytmus vyrába dáta rýchlejšie, než sa dajú použiť.
- Pri tíme 6–10 ľudí a prahu 5 stačí, aby dvaja až traja nevyplnili, a kolo je bez výsledkov. Kratší prieskum a viditeľné kroky sú hlavná poistka.

### Dve veci na zváženie mimo rozsahu MVP (neimplementovať bez rozhodnutia)

- Viva Glint má pre **komentáre** vyšší prah (10) než pre čísla (5). V malom tíme sa autor komentára dá spoznať podľa štýlu.
- Kvalitatívna štúdia považuje skupiny 3–5 ľudí za príliš malé. Prah 5 je obhájiteľné minimum, nie bezpečná rezerva.

---

## 3. Pravidlá pre dobrú otázku

1. **Jedna otázka, jedna vec.** Žiadne „a“, „alebo“ ani zoznam v zátvorke. Ak sa dá s jednou časťou súhlasiť a s druhou nie, otázku rozdeľ.
2. **Vlastná skúsenosť, nie odhad o iných.** „Keď potrebujem pomoc, dostanem ju“ je lepšie než „manažér vie…“ alebo „všetci v tíme…“.
3. **Konkrétne obdobie.** „Za posledné dva týždne“, zhodné s rytmom prieskumu. Nie „v poslednom čase“.
4. **Dá sa s tým niečo urobiť.** Ku každej otázke má existovať krok, ktorý vie urobiť vedúci tímu. Ak nie, patrí do firemného prieskumu.
5. **Neutrálne znenie.** Bez hodnotiacich slov a bez náznaku správnej odpovede.
6. **Pri súhlasnej škále 5 bodov.** Revilla, Saris a Krosnick (2014) zistili, že 5 kategórií dáva pri súhlasných škálach kvalitnejšie dáta než 7 alebo 11.
7. **Kde ide o častosť alebo množstvo, použi vecnú škálu** (nikdy … takmer denne). Saris a kol. (2010) zistili, že súhlasné škály majú výrazne nižšiu kvalitu než škály šité na otázku, a to aj pre sklon súhlasiť so všetkým. Súhlasnú škálu si pre jednoduchosť nechávame, ale pri nadčasoch a vyčerpaní sa oplatí vecná.
8. **Vyhni sa záporom.** „Nemám problém s…“ a dvojité zápory vedú k chybám. Záporne ladenú otázku (napr. vyčerpanie) v grafe jasne označ, lebo vyššie číslo znamená horšie.
9. **Rovnaké znenie v čase.** Otázku, ktorú sleduješ ako trend, neprepisuj. Zmena znenia začína nový rad.
10. **Rodovo neutrálne a bežným jazykom.** Prítomný čas alebo neosobné väzby namiesto „mohol som“, bez žargónu.
11. **Nepýtaj sa na to, čo neplánuješ riešiť.** Otázka vytvára očakávanie.
12. **Slovo „dôverný“, nikdy iné označenie.**

---

## 4. Navrhovaná knižnica otázok

Znenie je vlastné, inšpirované konštruktmi z výskumu. Nič nie je prevzaté doslova.

**Licencie a autorské práva**

| Nástroj | Stav | Čo to znamená pre nás |
|---|---|---|
| Gallup Q12 | Chránené, bez písomného súhlasu sa nesmie použiť ani reprodukovať | Nepreberať znenie ani poradie. Konštrukty (jasné očakávania, uznanie, rozvoj) sú všeobecné. |
| UWES | Zadarmo iba na nekomerčný vedecký výskum | Vo firemnom nástroji nepoužívať, písať vlastné otázky o energii a zmysle. |
| COPSOQ III | CC BY-NC-ND 4.0, upravená verzia sa nesmie šíriť pod týmto názvom | Dá sa inšpirovať oblasťami (záťaž, tempo, vplyv, podpora), nevolať to COPSOQ. |
| Edmondson (1999) | Publikovaná vedecká škála, 7 položiek | Vlastné znenie, citovať zdroj. |
| Westrum / DORA | Verejne publikované tvrdenia | Vlastné znenie. |
| eNPS | Otázka na odporučenie je voľne používaná, názov NPS je ochranná známka | Ak sa použije, v rozhraní ju tak nenazývať. |

**Škála:** ak nie je uvedené inak, 1 = rozhodne nesúhlasím … 5 = rozhodne súhlasím.
**Stĺpec „Manažér“:** či s tým vie niečo urobiť vedúci tímu.
**Poznámka k slovu „manažér“:** nechávam ho ako názov roly. Ak chcete úplne neutrálne znenie, dá sa nahradiť spojením „vedenie tímu“.

### Stála trendová otázka (kandidáti)

| # | Otázka | Škála | Meria | Inšpirácia | Manažér |
|---|---|---|---|---|---|
| T1 | Celkovo, aké boli pre mňa posledné dva týždne v práci? | 1 = veľmi zlé … 5 = veľmi dobré | Celková pracovná spokojnosť v danom období | Jednopoložkové meranie spokojnosti (Wanous a kol., 1997), „dobrý pracovný deň“ (Meyer a kol.) | áno, nepriamo |
| T2 | Nakoľko je pravdepodobné, že prácu v našej firme odporučím niekomu známemu? | 0–10 | Ochota odporučiť zamestnávateľa | eNPS, Brown (2020) | nie, skôr firma |

**Odporúčam T1.** T2 patrí na úroveň firmy raz za štvrťrok, lebo v malom tíme je skóre nestabilné a vedúci tímu ho priamo neovplyvní.

### A. Manažér a spätná väzba

| # | Otázka | Meria | Inšpirácia | Manažér |
|---|---|---|---|---|
| A1 | Spätná väzba od môjho manažéra mi pomáha zlepšovať sa. | Užitočnosť spätnej väzby | Project Oxygen (koučovanie), Gallup 2015 | áno |
| A2 | Rozhovory 1:1 s manažérom sú pre mňa užitočné. | Kvalita 1:1 | Gallup 2015 (pravidelné stretnutia) | áno |
| A3 | S manažérom sa rozprávame 1:1 dosť často na to, čo potrebujem. | Dostupnosť manažéra | Gallup 2015 | áno |
| A4 | Môjmu manažérovi záleží na tom, ako sa mám. | Osobný záujem | Project Oxygen (záujem o človeka) | áno |
| A5 | Keď za manažérom prídem s problémom, niečo sa s ním začne diať. | Reakcia na podnety | Huebner a Zacher (následné kroky) | áno |
| A6 | Mám dosť voľnosti rozhodnúť sa, ako svoju prácu urobím. | Autonómia | Project Oxygen (bez mikromanažmentu), COPSOQ (vplyv), Meyer a kol. (kontrola nad dňom) | áno |

### B. Jasnosť a priority

| # | Otázka | Meria | Inšpirácia | Manažér |
|---|---|---|---|---|
| B1 | Viem, čo sa odo mňa v najbližších dvoch týždňoch očakáva. | Jasnosť roly | Project Aristotle (štruktúra a jasnosť), COPSOQ | áno |
| B2 | Priority nášho tímu sú mi jasné. | Jasnosť priorít | Project Aristotle | áno |
| B3 | Priority nášho tímu boli za posledné dva týždne stabilné. | Stabilita priorít | DORA 2024 (nestabilné priority zvyšujú vyhorenie) | čiastočne |
| B4 | Keď sa priority zmenia, viem prečo. | Vysvetľovanie zmien | DORA 2024 | áno |
| B5 | Rozumiem, ako moja práca prispieva k cieľom firmy alebo zákazníka. | Dopad práce | Project Aristotle (dopad) | áno |

### C. Záťaž a energia

| # | Otázka | Škála | Meria | Inšpirácia | Manažér |
|---|---|---|---|---|---|
| C1 | Moja pracovná záťaž bola za posledné dva týždne zvládnuteľná. | súhlas | Množstvo práce | COPSOQ (kvantitatívne nároky) | áno |
| C2 | Mám dosť času robiť prácu poriadne. | súhlas | Časový tlak a kvalita | COPSOQ (tempo), DevEx | áno |
| C3 | Ako často bolo za posledné dva týždne potrebné pracovať nadčas alebo mimo bežného pracovného času? | nikdy / raz či dvakrát / každý týždeň / väčšinu dní / takmer denne | Nadčasy | COPSOQ, vecná škála podľa Saris a kol. | áno |
| C4 | Po práci dokážem vypnúť a oddýchnuť si. | súhlas | Zotavenie, hranica práca–súkromie | COPSOQ (konflikt práca–súkromie) | čiastočne |
| C5 | Ako často sa za posledné dva týždne pracovný deň skončil pocitom vyčerpania? | nikdy / zriedka / občas / často / takmer vždy | Vyčerpanie (skorý signál vyhorenia) | Jednopoložkové meranie vyhorenia (West a kol., 2009, 2012; Dolan a kol., 2014) | čiastočne |
| C6 | Pohotovosti a riešenie incidentov sú v tíme rozdelené spravodlivo. | súhlas | Záťaž z pohotovostí | DORA, SPACE (pohoda) | áno |

C5 je záporne ladená: vyššia hodnota znamená horší stav. C6 iba pre tímy, ktoré pohotovosti majú.

### D. Sústredenie, nástroje a tok práce

| # | Otázka | Meria | Inšpirácia | Manažér |
|---|---|---|---|---|
| D1 | Mám dosť súvislého času na sústredenú prácu. | Sústredenie, vyrušovanie | DevEx (stav plynutia), Mark a kol. 2008, Meyer a kol. | áno |
| D2 | Porady, na ktorých sa zúčastňujem, stoja za čas, ktorý im venujem. | Záťaž poradami | Meyer a kol. | áno |
| D3 | Nástroje a prostredia, ktoré používam, mi prácu uľahčujú. | Trenie v nástrojoch | DevEx (kognitívna záťaž), SPACE (efektivita) | čiastočne |
| D4 | Keď potrebujem review, rozhodnutie alebo informáciu, dostanem ich dosť rýchlo. | Rýchlosť spätných slučiek | DevEx (spätné slučky) | áno |
| D5 | Máme dosť priestoru opravovať veci, ktoré nás dlhodobo brzdia. | Technický dlh | DevEx, DORA | čiastočne |
| D6 | Nové úlohy dostávam s dostatkom informácií na to, aby sa dalo začať. | Kvalita zadania | DevEx (kognitívna záťaž), Meyer a kol. (nestabilné požiadavky) | áno |

D4 vymenúva tri príklady toho istého javu (čakanie na druhých). Ak chcete prísne jednu vec, ponechajte iba „review“ pre vývojárov a „rozhodnutie“ pre analytikov.

### E. Tím a psychologické bezpečie

| # | Otázka | Meria | Inšpirácia | Manažér |
|---|---|---|---|---|
| E1 | V tíme môžem otvorene povedať, že s niečím nesúhlasím. | Psychologické bezpečie | Edmondson 1999, Project Aristotle | áno |
| E2 | Keď sa v tíme stane chyba, hľadáme príčinu, nie vinníka. | Kultúra chýb | Edmondson 1999, Westrum / DORA | áno |
| E3 | Pripomienky k mojej práci dostávam s rešpektom. | Bezpečie pri review | Edmondson 1999 | áno |
| E4 | Keď potrebujem pomoc, v tíme ju dostanem. | Podpora kolegov | Edmondson 1999, COPSOQ (sociálna podpora) | áno |
| E5 | Na dohody v našom tíme sa dá spoľahnúť. | Spoľahlivosť | Project Aristotle (spoľahlivosť) | áno |

### F. Rast, uznanie a silné stránky

| # | Otázka | Meria | Inšpirácia | Manažér |
|---|---|---|---|---|
| F1 | Posledný mesiac mi v práci priniesol niečo nové, čo viem využiť. | Učenie | COPSOQ (možnosti rozvoja), SPACE | áno |
| F2 | Viem, aké mám vo firme možnosti ďalšieho rastu. | Kariérna perspektíva | Project Oxygen (rozvoj) | čiastočne |
| F3 | Za posledné tri mesiace sme s manažérom hovorili o mojom rozvoji. | Rozhovor o rozvoji | Project Oxygen, Gallup 2015 | áno |
| F4 | Keď odvediem dobrú prácu, niekto si to všimne. | Uznanie | COPSOQ (uznanie) | áno |
| F5 | Moja práca mi dáva príležitosť robiť to, čo mi ide najlepšie. | Využitie silných stránok | Gallup 2015 (silné stránky) | áno |

### G. Hybridná práca a prostredie

| # | Otázka | Meria | Inšpirácia | Manažér |
|---|---|---|---|---|
| G1 | Pri práci z domu mám rovnaký prístup k informáciám ako pri práci z kancelárie. | Rovnosť prístupu | Výskum hybridnej práce (Bloom a kol., 2024) – nepriamo | áno |
| G2 | Na poradách, kde je časť ľudí online, sa viem zapojiť rovnako ako ostatní. | Začlenenie na hybridných poradách | Môj úsudok, priamy výskum som nenašiel | áno |
| G3 | V kancelárii mám kde nerušene pracovať. | Pracovné prostredie | Mark a kol. 2008 (vyrušovanie) | čiastočne |

### H. Dôvera v prieskum

| # | Otázka | Meria | Inšpirácia | Manažér |
|---|---|---|---|---|
| H1 | Na základe týchto prieskumov sa v našom tíme niečo mení. | Viditeľnosť krokov | Huebner a Zacher 2021, McKinsey | áno |

H1 klásť raz za štvrťrok. Je to priama kontrola, či funguje „Povedali ste, urobili sme“.

**Spolu:** 2 kandidáti na trend + 37 rotujúcich otázok. Za najsilnejších 12 na štart považujem: A1, A5, B1, B3, C1, C2, D1, D4, E1, E2, F4, F5.

### Nepovinný komentár

**Odporúčané znenie:**
> Čo by nášmu tímu najviac uľahčilo prácu v najbližších dvoch týždňoch? (nepovinné)

Pomocný text pod poľom:
> Stačí jedna veta. Odpoveď je dôverná, nepíšte do nej mená ani podrobnosti, podľa ktorých by sa dalo spoznať, kto ju napísal.

**Prečo takto**

- Pýta sa na jednu konkrétnu vec smerom dopredu, takže odpoveď je priamo podklad pre krok manažéra.
- Smyth a kol. (2009) zistili, že krátke vysvetlenie, na čo odpoveď slúži, zlepšuje kvalitu voľných odpovedí.
- Upozornenie na mená chráni dôvernosť v malom tíme.

**Alternatíva** na striedanie raz za čas: „Čo sa nám za posledné dva týždne podarilo a chceme v tom pokračovať?“

---

## 5. Existujúcich 16 otázok: ponechať, prepísať, vyradiť

| # | Pôvodná otázka | Verdikt | Nové znenie | Dôvod |
|---|---|---|---|---|
| 1 | Môj manažér mi dáva feedback, podľa ktorého viem niečo zlepšiť. | Prepísať (drobne) | Spätná väzba od môjho manažéra mi pomáha zlepšovať sa. | Obsah je dobrý, znenie je kratšie a bez anglicizmu. |
| 2 | Za posledné 2 týždne sme mali 1:1, ktoré mi pomohlo. | Prepísať (rozdeliť) | Rozhovory 1:1 s manažérom sú pre mňa užitočné. + S manažérom sa rozprávame 1:1 dosť často na to, čo potrebujem. | Dve veci naraz (či bolo, či pomohlo). Kto 1:1 nemal, nevie odpovedať. |
| 3 | Môj manažér sa zaujíma o to, ako sa mám. | Ponechať | Môjmu manažérovi záleží na tom, ako sa mám. (voliteľne) | Jasná, jedna vec, manažér ju vie ovplyvniť. |
| 4 | Moja pracovná záťaž bola posledné 2 týždne zvládnuteľná. | Ponechať | – | Vzorová otázka: jedna vec, jasné obdobie. |
| 5 | Mám dosť času robiť prácu kvalitne. | Ponechať | Mám dosť času robiť prácu poriadne. (voliteľne) | Dobrá, odlišná od záťaže (meria tlak na kvalitu). |
| 6 | Za posledný mesiac som sa naučil niečo, čo využijem. | Prepísať | Posledný mesiac mi v práci priniesol niečo nové, čo viem využiť. | Mužský rod v minulom čase. |
| 7 | Viem, kam sa môžem v práci posunúť. | Prepísať (drobne) | Viem, aké mám vo firme možnosti ďalšieho rastu. | Pôvodné „posunúť“ je nejasné. Klásť zriedka, vedúci tímu to ovplyvní iba čiastočne. |
| 8 | Moja práca bola v poslednom čase niekým ocenená. | Prepísať | Keď odvediem dobrú prácu, niekto si to všimne. | „V poslednom čase“ je neurčité, trpný rod je ťažkopádny. |
| 9 | Viem, čo sa odo mňa tento týždeň očakáva. | Prepísať (drobne) | Viem, čo sa odo mňa v najbližších dvoch týždňoch očakáva. | Zosúladiť obdobie s rytmom prieskumu. |
| 10 | Priority tímu sú mi jasné. | Ponechať | – | Krátka a použiteľná. Doplniť otázkou o stabilite priorít (B3). |
| 11 | V tíme si navzájom pomáhame, keď je to potrebné. | Prepísať (drobne) | Keď potrebujem pomoc, v tíme ju dostanem. | Vlastná skúsenosť je spoľahlivejšia než hodnotenie celého tímu. |
| 12 | V tíme môžem povedať aj nepopulárny názor. | Ponechať | V tíme môžem otvorene povedať, že s niečím nesúhlasím. (voliteľne) | Jadro psychologického bezpečia. Nové znenie je konkrétnejšie. |
| 13 | V kancelárii sa mi dobre pracuje (hluk, miesto, vybavenie). | Vyradiť z tímového pulse | Ak ostane: V kancelárii mám kde nerušene pracovať. | Tri veci v zátvorke, vedúci tímu ich neovplyvní, pri hybride sa netýka všetkých. Patrí do firemného prieskumu. |
| 14 | Mám miesto, kde sa viem sústrediť alebo nerušene telefonovať. | Vyradiť (zlúčiť s 13) | Mám dosť súvislého času na sústredenú prácu. | Dve veci cez „alebo“ a prekryv s 13. Pre IT tím je užitočnejšie pýtať sa na čas na sústredenie. |
| 15 | Tento týždeň som mohol robiť to, v čom som dobrý. | Prepísať | Moja práca mi dáva príležitosť robiť to, čo mi ide najlepšie. | Mužský rod v minulom čase, týždeň je na túto tému príliš krátke obdobie. |
| 16 | Môj manažér vie, v čom sú moje silné stránky. | Prepísať | Pri rozdeľovaní práce sa berie ohľad na to, čo mi ide najlepšie. | Respondent háda, čo vie niekto iný. Nové znenie sa pýta na pozorovateľné správanie. |

**Súhrn:** ponechať 5 (č. 3, 4, 5, 10, 12), prepísať 9, vyradiť 2 (č. 13, 14).

---

## 6. Čo treba zistiť od firmy na personalizáciu

Toto sa z webu zistiť nedá.

**O firme a ľuďoch**

1. Firemné hodnoty a to, čo má podľa vedenia znamenať „dobrý tím“. Otázky majú používať tie isté slová.
2. Najčastejšie dôvody odchodov z výstupných rozhovorov za posledné 1–2 roky a z ktorých rolí sa odchádza.
3. Výsledky posledného veľkého prieskumu spokojnosti: najslabšie oblasti a čo sa odvtedy zmenilo.
4. Aktuálne bolesti, o ktorých sa hovorí: nadčasy, pohotovosti, zmeny priorít, nástroje, odmeňovanie, kariérny postup.

**O tímoch a práci**

5. Veľkosti tímov. Koľko tímov má menej než 6–7 ľudí, kde prah 5 často nebude splnený.
6. Zloženie rolí (vývojári, analytici, konzultanti, testeri, podpora). Otázky o review alebo technickom dlhu nedávajú zmysel všetkým.
7. Ktoré tímy majú pohotovosti a prácu u zákazníka.
8. Pravidlá hybridnej práce: počet dní v kancelárii, zdieľané miesta, tímy rozdelené medzi lokality.
9. Rytmus práce: šprinty, vydania, uzávierky. Podľa toho sa nastaví deň otvorenia kola.

**O manažéroch a procese**

10. Ako často manažéri robia 1:1 a či je to povinné.
11. Čo vedúci tímu naozaj smie zmeniť (rozdelenie práce, porady, priority) a čo nie (platy, kancelária, nástroje). Podľa toho sa určí, ktoré otázky sú pre neho použiteľné.
12. Kto rieši podnety, ktoré tím nevie vyriešiť sám.
13. Iné prieskumy, ktoré ľudia v priebehu roka dostávajú, aby sa neprekrývali.

**O jazyku a dôvere**

14. Tykanie alebo vykanie v internej komunikácii a zaužívané pojmy („manažér“, „vedúci tímu“, „team lead“).
15. Či sú v tímoch ľudia, ktorí nehovoria po slovensky.
16. Doterajšia skúsenosť s dôvernosťou prieskumov a čo k dôvernosti vyžaduje právne oddelenie alebo zástupcovia zamestnancov.

---

## 7. Zdroje

### Primárny výskum (recenzované alebo pôvodné správy s metodikou)

| Zdroj | URL | Poznámka |
|---|---|---|
| Berthelsen, Muhonen (2026). Taking the pulse: a qualitative study on pulse survey implementation. Frontiers in Organizational Psychology | https://www.frontiersin.org/journals/organizational-psychology/articles/10.3389/forgp.2025.1696769/full | Otvorené a prečítané |
| Huebner, Zacher (2021). Following Up on Employee Surveys. Frontiers in Psychology | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8696015/ | Iba abstrakt |
| Saris, Revilla, Krosnick, Shaeffer (2010). Agree/Disagree vs. Item-Specific. Survey Research Methods | https://ojs.ub.uni-konstanz.de/srm/article/view/2682 | Iba abstrakt |
| Revilla, Saris, Krosnick (2014). Choosing the Number of Categories in Agree–Disagree Scales. Sociological Methods & Research | https://ideas.repec.org/a/sae/somere/v43y2014i1p73-97.html | Iba abstrakt |
| Wanous, Reichers, Hudy (1997). Overall job satisfaction: how good are single-item measures? Journal of Applied Psychology | https://academicnewsletter.sufe.edu.cn/info/372882 | Iba záznam a abstrakt |
| Brown (2020). Comparing the validity of net promoter and benchmark scoring. Human Resource Development Quarterly | https://law-journals-books.vlex.com/vid/comparing-the-validity-of-855623482 | Iba abstrakt |
| West a kol. (2012). Concurrent validity of single-item measures of emotional exhaustion and depersonalization. JGIM | https://pmc.ncbi.nlm.nih.gov/articles/PMC3475825 | Zdravotníci, nie IT |
| Dolan a kol. (2014). Using a single item to measure burnout in primary care staff. JGIM | https://link.springer.com/content/pdf/10.1007%2Fs11606-014-3112-6.pdf | Zdravotníci, nie IT |
| Edmondson (1999). Psychological Safety and Learning Behavior in Work Teams. Administrative Science Quarterly | https://doi.org/10.2307/2666999 | Pôvodný text neotvorený |
| Schaufeli a kol. (2019). UWES-3. European Journal of Psychological Assessment | https://www.wilmarschaufeli.nl/new-publication-on-the-3-item-work-engagement-scale/ | Licencia: iba nekomerčný výskum |
| Burr a kol. (2019). The Third Version of the Copenhagen Psychosocial Questionnaire. Safety and Health at Work | https://pmc.ncbi.nlm.nih.gov/articles/PMC6933167 | Licencia: https://copsoq-network.org/guidelines |
| Mark, Gudith, Klocke (2008). The Cost of Interrupted Work. CHI 2008 | https://www.ics.uci.edu/~gmark/chi08-mark.pdf | Laboratórny experiment |
| Meyer, Barr, Bird, Zimmermann. Today was a Good Day: The Daily Life of Software Developers. IEEE TSE | https://discovery.ucl.ac.uk/10090507/1/Barr_Today%20was%20a%20Good%20Day.%20The%20Daily%20Life%20of%20Software%20Developers_AAM2.pdf | 5 971 odpovedí vývojárov jednej firmy |
| Forsgren a kol. (2021). The SPACE of Developer Productivity. ACM Queue | https://queue.acm.org/detail.cfm?id=3454124 | Neotvorené (prístup odmietnutý) |
| Noda, Storey, Forsgren, Greiler (2023). DevEx: What Actually Drives Productivity. ACM Queue | https://queue.acm.org/detail.cfm?id=3595878 | Neotvorené (prístup odmietnutý) |
| DORA (2024). Accelerate State of DevOps Report | https://dora.dev/report/2024 | Pôvodná správa, sponzorovaná dodávateľom |
| Bloom a kol. (2024). Hybrid working from home improves retention without damaging performance. Nature | https://siepr.stanford.edu/news/hybrid-work-win-win-win-companies-workers-study-finds | Odkaz je tlačová správa univerzity |
| Smyth, Dillman, Christian, McBride (2009). Open-Ended Questions in Web Surveys. Public Opinion Quarterly | https://digitalcommons.unl.edu/sociologyfacpub/668 | Iba abstrakt |
| Rogelberg, Stanton (2007). Understanding and Dealing With Organizational Survey Nonresponse. Organizational Research Methods | https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_proquest_miscellaneous_753750508 | Iba záznam |
| Wrzus, Neubauer (2023). Ecological Momentary Assessment: A Meta-Analysis. Assessment | https://pmc.ncbi.nlm.nih.gov/articles/PMC9999286 | Iný kontext, nepriamy dôkaz |
| Fass-Holmes. Survey Fatigue – Literature Search. Journal of Interdisciplinary Studies in Education | https://www.ojed.org/index.php/jise/article/view/3262 | Prehľad, študentské prieskumy |

### Správy a dáta firiem (vlastné dáta, bez recenzie)

| Zdroj | URL | Poznámka |
|---|---|---|
| Gallup: Employees Want a Lot More From Their Managers (2015) | https://www.gallup.com/workplace/236570/employees-lot-managers.aspx | Zdroj tvrdení 4, 5, 6. Otvorené a prečítané |
| Gallup Q12 Meta-Analysis 2024 | https://www.gallup.com/workplace/321725/gallup-q12-meta-analysis-2024.aspx | Vrátane upozornenia na autorské práva |
| SurveyMonkey: počet otázok a miera dokončenia | https://www.surveymonkey.com/curiosity/survey_questions_and_completion_rates/ | Zdroj tvrdenia 2. Otvorené a prečítané |
| SurveyMonkey: čas vyplnenia | https://surveymonkey.com/curiosity/survey_completion_times | Otvorené a prečítané |
| Google re:Work: Understand team effectiveness (Project Aristotle) | https://rework.withgoogle.com/intl/en/guides/understand-team-effectiveness | 180 tímov jednej firmy. Otvorené a prečítané |
| Google re:Work: výskum manažérov (Project Oxygen) | https://rework.withgoogle.com/intl/en/guides/following-the-data-the-research-behind-great-managers | Neotvorené |
| McKinsey: Survey fatigue? Blame the leader, not the question | https://www.mckinsey.com/capabilities/people-and-organization/our-insights/the-organization-blog/survey-fatigue-blame-the-leader-not-the-question | Neotvorené, iba zhrnutie z vyhľadávania |

### Dokumentácia produktov

| Zdroj | URL | Poznámka |
|---|---|---|
| Culture Amp: Confidentiality protections in reporting | https://support.cultureamp.com/en/articles/7048386-confidentiality-protections-in-reporting | 5 iba ako príklad |
| Microsoft Viva Glint: Manage confidentiality thresholds | https://learn.microsoft.com/en-us/viva/glint/setup/manage-confidentiality-thresholds | Predvolený prah 5, komentáre 10 |
| DORA: Generative organizational culture | https://dora.dev/capabilities/generative-organizational-culture/ | Westrumove tvrdenia |

### Blog dodávateľa (nepoužívať ako dôkaz)

| Zdroj | URL | Poznámka |
|---|---|---|
| CultureMonkey: Pulse survey frequency | https://www.culturemonkey.io/guides/pulse-survey/pulse-survey-best-practices/pulse-survey-frequency/ | Zdroj neovereného čísla 32 % |

### Sekundárne zhrnutie

| Zdroj | URL | Poznámka |
|---|---|---|
| Becker's Hospital Review: Managers account for 70% of variance | https://www.beckershospitalreview.com/hospital-management-administration/managers-account-for-70-of-variance-in-employee-engagement | Preberá Gallup |
| Happily.ai: Gallup's 70% Variance Stat | https://happily.ai/blog/gallup-70-percent-engagement-variance-source-citation/ | Blog dodávateľa, opis metodiky Gallupu neoverený |
