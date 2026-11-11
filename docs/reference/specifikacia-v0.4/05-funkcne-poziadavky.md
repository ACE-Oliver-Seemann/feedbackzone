# 5. Funkčné požiadavky

## 5.1 Tutoriál: Ako dávať kvalitný feedback

Krátka interaktívna sekcia, ktorá naučí zamestnancov aj manažérov písať feedback, ktorý je konkrétny, férový a použiteľný:

- **Model SBI (Situácia – Správanie – Dopad)** od Center for Creative Leadership; rozšírenie o návrh, čo ďalej.
- **Start / Stop / Continue** pre tímové a projektové spätné väzby.
- **Príklady zlé vs. dobré** – napr. „Si super“ → „Na stredajšom demo si pripravil dáta tak, že klient schválil návrh hneď. Ušetrilo nám to týždeň.“
- **Silné stránky** – ako pomenovať, v čom je kolega dobrý a ako to rozvíjať.
- **Ako dať kritický feedback a ako ho prijať.**
- **Pre manažérov:** ako viesť 1:1 a ako reagovať na výsledky prieskumu.

| ID | Požiadavka | Priorita |
|---|---|---|
| TUT-01 | Sekcia tutoriál s článkami, príkladmi a mini-kvízom; obsah spravuje HR (editor bez programovania). | Must |
| TUT-02 | Kontextová nápoveda pri písaní komentárov a kudos (model SBI). | Should |
| TUT-03 | AI „feedback coach“ upozorní na vágne alebo útočné formulácie a navrhne lepšiu verziu; text sa bez súhlasu používateľa nemení. | Should |

## 5.2 Tvorba prieskumov

- **Pulse** – opakujúci sa prieskum podľa kapitoly 4 (najčastejší prípad).
- **Zo šablóny** – mesačné a štvrťročné prieskumy, retrospektíva projektu, onboarding a check-upy, exit (kapitola 7).
- **Ručne** – editor otázok so sekciami a náhľadom.
- **Pomocou AI** – autor napíše cieľ, AI navrhne otázky v súlade s pravidlami dĺžky a rotácie; autor ich upraví.

| Typ otázky | Použitie |
|---|---|
| Škála 1–5 | Rotujúce otázky, „Ako sa ti tento týždeň pracovalo?“ |
| eNPS 0–10 | Stála otázka na trend |
| Nepovinný komentár | Jedno pole na konci každého kola |
| Otvorená otázka | Mesačné/štvrťročné prieskumy, retrospektívy, exit |
| Výber z možností / zoradenie | Priority zlepšení, kategorizácia |
| Start / Stop / Continue | Retrospektívy |

| ID | Požiadavka | Priorita |
|---|---|---|
| SUR-01 | Editor prieskumu s typmi otázok podľa tabuľky, sekciami a náhľadom pre respondenta (desktop aj mobil). | Must |
| SUR-02 | Výber cieľovej skupiny: tím, viac tímov, pobočka, rola, konkrétni ľudia; vylúčenie osôb (napr. hodnotený manažér). | Must |
| SUR-03 | Všetky prieskumy sú **dôverné** podľa kapitoly 6. Iný režim nie je k dispozícii. | Must |
| SUR-04 | Plánovanie: začiatok, koniec kola, opakovanie; **najviac 2 pripomienky na kolo** iba tým, ktorí ešte neodpovedali. | Must |
| SUR-05 | AI generovanie prieskumu z cieľa autora; AI upozorní na zlé otázky (sugestívne, dvojité, príliš všeobecné) a na porušenie pravidiel dĺžky. | Should |
| SUR-06 | Personalizácia AI návrhu: úprava otázok, tónu, dĺžky a jazyka. | Should |
| SUR-07 | Viacjazyčné prieskumy (SK, CZ, EN) s návrhom prekladu cez AI. | Should |
| SUR-08 | Dotazník môže vytvoriť aj **zamestnanec** a poslať ho **konkrétnym kolegom** (aj z iných tímov); manažér a HR tiež. Pravidlá dôvernosti podľa 6.8. | Must |

## 5.3 Vypĺňanie prieskumov (UX pre zamestnanca)

| ID | Požiadavka | Priorita |
|---|---|---|
| FILL-01 | Prieskum sa otvorí **jedným klikom** z e-mailu alebo z Teams bez ďalšieho prihlasovania (AUTH-05). | Must |
| FILL-02 | Plne funkčný na mobile. | Must |
| FILL-03 | **Jedna otázka na obrazovke** a viditeľný priebeh (napr. „2 z 4“). | Must |
| FILL-04 | Na úvodnej obrazovke je text o dôvernosti podľa A-30. | Must |
| FILL-05 | Na konci: poďakovanie, **čo sa zmenilo po minulom kole** („Povedali ste, urobili sme“) a tlačidlo „Chcem, aby ma niekto z HR kontaktoval“ (A-25). | Must |
| FILL-06 | Automatické ukladanie rozpracovanej odpovede. | Should |

## 5.4 Reakcia na výsledky (najdôležitejšia časť)

Hlavnou príčinou únavy z prieskumov je pocit, že firma s výsledkami nič neurobí (McKinsey, prehľad vyše 20 štúdií). Gallup dodáva, že ak sa firma pýta a nekoná, angažovanosť klesne a odchody stúpnu. Nástroj preto reakciu na výsledky nielen umožňuje, ale aj vyžaduje.

| ID | Požiadavka | Priorita |
|---|---|---|
| ACT-01 | Po každom kole dostane manažér výsledky tímu a **musí v nástroji zaznamenať aspoň jeden krok**, ktorý urobí (téma → krok → zodpovedný → termín → stav). Kým krok nezaznamená, kolo sa mu zobrazuje ako nedokončené a HR vidí stav. | Must |
| ACT-02 | Tím vidí odpoveď „**Povedali ste, urobili sme**“ – zhrnutie výsledkov a zaznamenané kroky (v portáli aj na konci ďalšieho kola). | Must |
| ACT-03 | **Na dôverné komentáre sa dá odpovedať bez odhalenia autora.** Autor uvidí odpoveď vo svojom portáli, manažér nevie, komu odpovedá. (GuideOne: CIO odpovedal osobne a to udržalo účasť.) | Must |
| ACT-04 | Pri **zhoršení skóre tímu** (napr. pokles o viac ako stanovenú hranicu oproti priemeru posledných kôl) dostane HR podpora upozornenie. | Must |
| ACT-05 | Pri **rizikových odpovediach** sa odpoveď automaticky nahlási a HR postupuje podľa A-17 a A-23. | Must |
| ACT-06 | **Cieľ reakcie 24 hodín:** angažovaní ľudia uvádzajú, že manažér im odpovie do 24 hodín (Gallup). Nástroj sleduje čas od zverejnenia výsledkov po prvú reakciu manažéra a pripomína ju. | Should |
| ACT-07 | V ďalšom kole možnosť ohodnotiť, či sa zaznamenané kroky prejavili. | Could |

## 5.5 AI insight report

Ku každému kolu AI pripraví vyhodnotenie, aby manažér či HR za pár minút pochopili, čo ľudia hovoria a čo s tým robiť.

- **Zhrnutie** – 3–5 viet, zmena oproti minulým kolám.
- **Čísla a trend** – účasť, skóre stálych otázok, vývoj v čase, rotujúce okruhy.
- **Témy z komentárov** – hlavné témy, frekvencia, sentiment; silné stránky aj problémy.
- **Komentáre bez identifikačných údajov** – AI odstráni mená a detaily, podľa ktorých by sa dal autor spoznať.
- **Návrhy krokov** – 2–3 návrhy, ktoré manažér prevezme do ACT-01.

| ID | Požiadavka | Priorita |
|---|---|---|
| AI-01 | Automatické vygenerovanie reportu po ukončení kola, rešpektujúce prah dôvernosti (A-05 až A-07). | Must |
| AI-02 | Každé tvrdenie AI je dohľadateľné na zdrojové (dôverné) komentáre a počty. | Must |
| AI-03 | Odstránenie identifikačných údajov z komentárov pred zobrazením. | Must |
| AI-04 | Export do prezentácie (PPTX) a PDF vo firemnom dizajne. | Should |
| AI-05 | Jasné označenie obsahu generovaného AI a upozornenie na overenie. | Must |
| AI-06 | „Opýtaj sa reportu“ – chat nad výsledkami kola v rámci oprávnení a prahu dôvernosti. | Could |

## 5.6 Krátke feedbacky medzi kolegami (Kudos)

Zamestnanci si môžu kedykoľvek poslať krátke, podpísané poďakovanie. Príklad: „Marek, dnes si urobil výbornú prácu na optimalizácii databázy – vďaka tomu sme stihli nasadiť report pre klienta o deň skôr.“ Kudos slúžia výhradne na **pozitívne uznanie**; kritický feedback medzi kolegami patrí do osobného rozhovoru, nie do skrytých hodnotení (kap. 10).

| ID | Požiadavka | Priorita |
|---|---|---|
| KUD-01 | Formulár: príjemca, text (min. ~80 znakov), firemná hodnota (napr. Spolupráca, Kvalita, Pomoc kolegom, Inovácia, Zákazník). | Must |
| KUD-02 | Viditeľnosť: verejné v tíme / verejné v pobočke / súkromné (**iba príjemca**). Kudos o kolegovi sa nikdy neposielajú skryto manažérovi. | Must |
| KUD-03 | Feed uznaní tímu a pobočky s reakciami. | Should |
| KUD-04 | Odoslanie kudos priamo z Teams. | Should |
| KUD-05 | AI upozornenie na príliš všeobecný text s návrhom konkrétnejšej formulácie. | Should |
| KUD-06 | Nahlásenie nevhodného obsahu a moderácia HR. | Must |

## 5.7 Gamifikácia

Gamifikácia má podporiť, aby sa feedback a uznanie reálne dávali – pravidelne a kvalitne. **Body ani účasť v prieskumoch nie sú prepojené s hodnotením, povýšeniami ani odmeňovaním.** Ako podklad k povýšeniu môže HR použiť **iba obsah prijatých kudos**.

| Aktivita | Body | Pravidlo |
|---|---|---|
| Odoslanie kola pulse | +5 | Za odoslanie, nezávisle od obsahu odpovedí |
| Odoslanie kudos | +3 | Max. 10 započítaných kudos mesačne; tej istej osobe max. 2× mesačne |
| Prijatie kudos | +5 | Zníženie pri vzájomných výmenách |
| Absolvovanie tutoriálu | +20 | Jednorazovo |
| Tímová výzva (napr. 80 % účasť) | Tímový odznak | Odmeňuje tím, nie jednotlivca |

| ID | Požiadavka | Priorita |
|---|---|---|
| GAM-01 | Bodový systém podľa tabuľky (konfigurovateľný HR). Body nikdy nezávisia od obsahu odpovedí v prieskume. | Must |
| GAM-02 | Odznaky a tímové výzvy; individuálne rebríčky sa nepoužívajú. | Should |
| GAM-03 | Detekcia zneužitia (vzájomné výmeny, kopírovaný text, nárazové posielanie). Keďže kudos slúžia ako podklad k povýšeniu, podozrivé kudos sa HR označia. | Must |
| GAM-04 | Odpovede z prieskumov, skóre, body ani účasť v prieskumoch sa nikdy nepoužívajú pri hodnotení, povýšení ani odmeňovaní a nezobrazujú sa v hodnotiacom formulári. | Must |
| GAM-05 | HR (a manažér zamestnanca) vidí pri rozhodovaní o povýšení **prijaté kudos** daného zamestnanca: text, od koho, hodnotu a dátum. Posudzuje sa obsah, nie počet. Súkromné kudos iba so súhlasom zamestnanca. | Must |
| GAM-06 | Zamestnanec vie, že jeho prijaté kudos môžu slúžiť ako podklad k povýšeniu (pravidlo je zverejnené v portáli). | Must |

**Rozhodnutie (v0.4):** HR môže pri povýšení vychádzať iba z kudos, aby ľudia v prieskumoch odpovedali úprimne. **Riziko:** keď kudos ovplyvňujú povýšenie, môžu si ich ľudia začať vymieňať („ty mne, ja tebe“). Preto GAM-03 (detekcia zneužitia) je povinná, platia limity na počet kudos a posudzuje sa obsah, nie počet. O povýšení vždy rozhoduje človek; AI kudos nehodnotí ani neradí ľudí.

## 5.8 Prehľady (UX pre manažéra a HR)

### Manažér

| ID | Požiadavka | Priorita |
|---|---|---|
| DASH-01 | **Prehľad o tíme na jednej obrazovke:** trend skóre, témy, ktoré sa zhoršujú, komentáre (od 5 respondentov), stav krokov. | Must |
| DASH-02 | **Podklady na najbližšie 1:1:** témy tímu, ktoré stojí za to otvoriť, otvorené kroky, prijaté kudos člena tímu (verejné). Bez individuálnych odpovedí z prieskumu. | Must |
| DASH-03 | **Zoznam dohodnutých krokov** s termínmi a stavom. | Must |

### HR

| ID | Požiadavka | Priorita |
|---|---|---|
| DASH-04 | **Teplotná mapa tímov** podľa okruhov (iba skupiny nad prahom dôvernosti). | Must |
| DASH-05 | **Upozornenia na riziko odchodu** na úrovni tímu (pokles skóre, zhoršujúce sa okruhy). | Must |
| DASH-06 | **Porovnanie s dátami o odchodoch** (dobrovoľné odchody tímov z HR systému oproti skóre). | Should |
| DASH-07 | **Export výsledkov** (CSV/XLSX, PPTX) bez identity respondentov (A-09). Export s menami je možný iba z databázy odpovedí pre HR a zaznamenáva sa (A-13). | Must |
| DASH-08 | Prehľad plnenia reakcie: podiel kôl so zaznamenaným krokom, čas reakcie manažérov. | Must |

### Zamestnanec

| ID | Požiadavka | Priorita |
|---|---|---|
| DASH-09 | Moje prieskumy, „Povedali ste, urobili sme“ tímu, odpovede na moje komentáre, moje kudos a body. | Must |

## 5.9 Notifikácie a integrácie

| ID | Požiadavka | Priorita |
|---|---|---|
| INT-01 | E-mail a Teams: nové kolo, max. 2 pripomienky na kolo, výsledky a kroky zverejnené, odpoveď na môj komentár, nové kudos. | Must |
| INT-02 | Vyplnenie krátkeho pulse priamo v Teams. | Should |
| INT-03 | Napojenie na HR systém: organizačná štruktúra, dátum nástupu (check-upy), odchody (DASH-06). | Should |
| INT-04 | Napojenie na kalendár pre plánovanie 1:1. | Could |

## 5.10 Administrácia

| ID | Požiadavka | Priorita |
|---|---|---|
| ADM-01 | Správa rolí, tímov, pobočiek (prednostne synchronizácia z HR systému). | Must |
| ADM-02 | Nastavenia AI: povolené funkcie, jazyk, logovanie, vypnutie AI pre citlivé prieskumy. | Must |
| ADM-03 | Nastavenia frekvencie, pripomienok, hraníc pre upozornenia a gamifikácie. | Must |
| ADM-04 | Auditný log citlivých akcií (zobrazenie výsledkov, export, zmena oprávnení). | Must |
