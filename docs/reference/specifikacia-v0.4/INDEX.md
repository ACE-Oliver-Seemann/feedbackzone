# Index požiadaviek

> Vygenerované z `Feedback_portal_poziadavky.docx` skriptom `tools/docx_to_md.py`. **Needitujte ručne**, upravte Word a spustite skript znova.

## Kapitoly

- [1. Úvod a ciele](01-uvod-a-ciele.md)
- [2. Používateľské roly a oprávnenia](02-pouzivatelske-roly-a-opravnenia.md)
- [3. Prihlásenie a správa identít](03-prihlasenie-a-sprava-identit.md)
- [4. Rytmus, dĺžka a otázky](04-rytmus-dlzka-a-otazky.md)
- [5. Funkčné požiadavky](05-funkcne-poziadavky.md)
- [6. Dôvernosť a prístup k údajom](06-dovernost-a-pristup-k-udajom.md)
- [7. Knižnica otázok](07-kniznica-otazok.md)
- [8. Nefunkčné požiadavky](08-nefunkcne-poziadavky.md)
- [9. Právne a etické zásady](09-pravne-a-eticke-zasady.md)
- [10. Čo do nástroja nedávať](10-co-do-nastroja-nedavat.md)
- [11. Metriky úspechu](11-metriky-uspechu.md)
- [12. Návrh fáz realizácie](12-navrh-faz-realizacie.md)
- [13. Otvorené otázky na rozhodnutie](13-otvorene-otazky-na-rozhodnutie.md)
- [14. Zdroje](14-zdroje.md)

## Všetky požiadavky

| ID | Priorita | Sekcia | Požiadavka (skrátené) | Súbor |
|---|---|---|---|---|
| ROL-01 | Must | 2. Používateľské roly a oprávnenia | Systém podporuje roly podľa tabuľky vyššie a ich kombinácie (okrem obmedzení v A-11). | [02-pouzivatelske-roly-a-opravnenia.md](02-pouzivatelske-roly-a-opravnenia.md) |
| ROL-02 | Must | 2. Používateľské roly a oprávnenia | Oprávnenia sa odvodzujú od organizačnej štruktúry (tím, pobočka, nadriadený) a automaticky sa aktualizujú… | [02-pouzivatelske-roly-a-opravnenia.md](02-pouzivatelske-roly-a-opravnenia.md) |
| ROL-03 | Must | 2. Používateľské roly a oprávnenia | Manažér nevidí výsledky iných tímov, pokiaľ mu to HR výslovne nepovolí. | [02-pouzivatelske-roly-a-opravnenia.md](02-pouzivatelske-roly-a-opravnenia.md) |
| ROL-04 | Must | 2. Používateľské roly a oprávnenia | Okrem postupu v kapitole 6 nesmie žiadna rola (vrátane administrátora) zistiť autora odpovede cez UI,… | [02-pouzivatelske-roly-a-opravnenia.md](02-pouzivatelske-roly-a-opravnenia.md) |
| AUTH-01 | Must | 3. Prihlásenie a správa identít | Prihlásenie výhradne firemným kontom cez Single Sign-On (OpenID Connect alebo SAML 2.0) voči firemnému… | [03-prihlasenie-a-sprava-identit.md](03-prihlasenie-a-sprava-identit.md) |
| AUTH-02 | Must | 3. Prihlásenie a správa identít | Viacfaktorové overenie podľa firemnej politiky; pre rolu HR vždy povinné (A-12). | [03-prihlasenie-a-sprava-identit.md](03-prihlasenie-a-sprava-identit.md) |
| AUTH-03 | Must | 3. Prihlásenie a správa identít | Automatické zakladanie a deaktivácia účtov (SCIM alebo synchronizácia z HR systému). Odchod zamestnanca =… | [03-prihlasenie-a-sprava-identit.md](03-prihlasenie-a-sprava-identit.md) |
| AUTH-04 | Must | 3. Prihlásenie a správa identít | Načítanie atribútov: meno, e-mail, oddelenie, tím, pobočka, nadriadený, jazyk. | [03-prihlasenie-a-sprava-identit.md](03-prihlasenie-a-sprava-identit.md) |
| AUTH-05 | Must | 3. Prihlásenie a správa identít | Prieskum na jeden klik: odkaz z e-mailu alebo Teams otvorí prieskum bez ďalšieho prihlasovania (tiché SSO… | [03-prihlasenie-a-sprava-identit.md](03-prihlasenie-a-sprava-identit.md) |
| AUTH-06 | Should | 3. Prihlásenie a správa identít | Automatické odhlásenie po nečinnosti (napr. 30 min) a možnosť odhlásiť všetky relácie. | [03-prihlasenie-a-sprava-identit.md](03-prihlasenie-a-sprava-identit.md) |
| PUL-01 | Must | 4.4 Požiadavky na nástroj | Opakujúci sa pulse s nastaviteľnou frekvenciou (týždenne, každé 2 týždne; predvolene každé 2 týždne). | [04-rytmus-dlzka-a-otazky.md](04-rytmus-dlzka-a-otazky.md) |
| PUL-02 | Must | 4.4 Požiadavky na nástroj | Štruktúra kola: 1–2 stále otázky + 2–3 rotujúce otázky + 1 nepovinný komentár. Systém rotujúce otázky… | [04-rytmus-dlzka-a-otazky.md](04-rytmus-dlzka-a-otazky.md) |
| PUL-03 | Must | 4.4 Požiadavky na nástroj | Knižnica tematických okruhov (manažér, vyťaženosť, rozvoj, uznanie, jasnosť očakávaní, tím, silné stránky,… | [04-rytmus-dlzka-a-otazky.md](04-rytmus-dlzka-a-otazky.md) |
| PUL-04 | Should | 4.4 Požiadavky na nástroj | HR môže pridať okruh vytvorený z najčastejších dôvodov odchodu (z exit rozhovorov). | [04-rytmus-dlzka-a-otazky.md](04-rytmus-dlzka-a-otazky.md) |
| PUL-05 | Must | 4.4 Požiadavky na nástroj | Kontrola dĺžky pred spustením: pulse max. 5 otázok a odhad do 2 min; mesačný 5–10; štvrťročný 15–20. Pri… | [04-rytmus-dlzka-a-otazky.md](04-rytmus-dlzka-a-otazky.md) |
| PUL-06 | Should | 4.4 Požiadavky na nástroj | Automatické kolá check-upov: po 2 týždňoch a 3 mesiacoch od nástupu, potom štvrťročne (spúšťa sa podľa… | [04-rytmus-dlzka-a-otazky.md](04-rytmus-dlzka-a-otazky.md) |
| PUL-07 | Should | 4.4 Požiadavky na nástroj | Podpora 1:1: manažér má pre každého člena tímu pripomienku 1:1 (predvolene každé 2 týždne) a podklady… | [04-rytmus-dlzka-a-otazky.md](04-rytmus-dlzka-a-otazky.md) |
| TUT-01 | Must | 5.1 Tutoriál: Ako dávať kvalitný feedback | Sekcia tutoriál s článkami, príkladmi a mini-kvízom; obsah spravuje HR (editor bez programovania). | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| TUT-02 | Should | 5.1 Tutoriál: Ako dávať kvalitný feedback | Kontextová nápoveda pri písaní komentárov a kudos (model SBI). | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| TUT-03 | Should | 5.1 Tutoriál: Ako dávať kvalitný feedback | AI „feedback coach“ upozorní na vágne alebo útočné formulácie a navrhne lepšiu verziu; text sa bez súhlasu… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| SUR-01 | Must | 5.2 Tvorba prieskumov | Editor prieskumu s typmi otázok podľa tabuľky, sekciami a náhľadom pre respondenta (desktop aj mobil). | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| SUR-02 | Must | 5.2 Tvorba prieskumov | Výber cieľovej skupiny: tím, viac tímov, pobočka, rola, konkrétni ľudia; vylúčenie osôb (napr. hodnotený… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| SUR-03 | Must | 5.2 Tvorba prieskumov | Všetky prieskumy sú dôverné podľa kapitoly 6. Iný režim nie je k dispozícii. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| SUR-04 | Must | 5.2 Tvorba prieskumov | Plánovanie: začiatok, koniec kola, opakovanie; najviac 2 pripomienky na kolo iba tým, ktorí ešte neodpovedali. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| SUR-05 | Should | 5.2 Tvorba prieskumov | AI generovanie prieskumu z cieľa autora; AI upozorní na zlé otázky (sugestívne, dvojité, príliš všeobecné)… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| SUR-06 | Should | 5.2 Tvorba prieskumov | Personalizácia AI návrhu: úprava otázok, tónu, dĺžky a jazyka. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| SUR-07 | Should | 5.2 Tvorba prieskumov | Viacjazyčné prieskumy (SK, CZ, EN) s návrhom prekladu cez AI. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| SUR-08 | Must | 5.2 Tvorba prieskumov | Dotazník môže vytvoriť aj zamestnanec a poslať ho konkrétnym kolegom (aj z iných tímov); manažér a HR… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| FILL-01 | Must | 5.3 Vypĺňanie prieskumov (UX pre zamestnanca) | Prieskum sa otvorí jedným klikom z e-mailu alebo z Teams bez ďalšieho prihlasovania (AUTH-05). | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| FILL-02 | Must | 5.3 Vypĺňanie prieskumov (UX pre zamestnanca) | Plne funkčný na mobile. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| FILL-03 | Must | 5.3 Vypĺňanie prieskumov (UX pre zamestnanca) | Jedna otázka na obrazovke a viditeľný priebeh (napr. „2 z 4“). | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| FILL-04 | Must | 5.3 Vypĺňanie prieskumov (UX pre zamestnanca) | Na úvodnej obrazovke je text o dôvernosti podľa A-30. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| FILL-05 | Must | 5.3 Vypĺňanie prieskumov (UX pre zamestnanca) | Na konci: poďakovanie, čo sa zmenilo po minulom kole („Povedali ste, urobili sme“) a tlačidlo „Chcem, aby… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| FILL-06 | Should | 5.3 Vypĺňanie prieskumov (UX pre zamestnanca) | Automatické ukladanie rozpracovanej odpovede. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| ACT-01 | Must | 5.4 Reakcia na výsledky (najdôležitejšia časť) | Po každom kole dostane manažér výsledky tímu a musí v nástroji zaznamenať aspoň jeden krok, ktorý urobí… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| ACT-02 | Must | 5.4 Reakcia na výsledky (najdôležitejšia časť) | Tím vidí odpoveď „Povedali ste, urobili sme“ – zhrnutie výsledkov a zaznamenané kroky (v portáli aj na… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| ACT-03 | Must | 5.4 Reakcia na výsledky (najdôležitejšia časť) | Na dôverné komentáre sa dá odpovedať bez odhalenia autora. Autor uvidí odpoveď vo svojom portáli, manažér… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| ACT-04 | Must | 5.4 Reakcia na výsledky (najdôležitejšia časť) | Pri zhoršení skóre tímu (napr. pokles o viac ako stanovenú hranicu oproti priemeru posledných kôl) dostane… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| ACT-05 | Must | 5.4 Reakcia na výsledky (najdôležitejšia časť) | Pri rizikových odpovediach sa odpoveď automaticky nahlási a HR postupuje podľa A-17 a A-23. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| ACT-06 | Should | 5.4 Reakcia na výsledky (najdôležitejšia časť) | Cieľ reakcie 24 hodín: angažovaní ľudia uvádzajú, že manažér im odpovie do 24 hodín (Gallup). Nástroj… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| ACT-07 | Could | 5.4 Reakcia na výsledky (najdôležitejšia časť) | V ďalšom kole možnosť ohodnotiť, či sa zaznamenané kroky prejavili. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| AI-01 | Must | 5.5 AI insight report | Automatické vygenerovanie reportu po ukončení kola, rešpektujúce prah dôvernosti (A-05 až A-07). | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| AI-02 | Must | 5.5 AI insight report | Každé tvrdenie AI je dohľadateľné na zdrojové (dôverné) komentáre a počty. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| AI-03 | Must | 5.5 AI insight report | Odstránenie identifikačných údajov z komentárov pred zobrazením. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| AI-04 | Should | 5.5 AI insight report | Export do prezentácie (PPTX) a PDF vo firemnom dizajne. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| AI-05 | Must | 5.5 AI insight report | Jasné označenie obsahu generovaného AI a upozornenie na overenie. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| AI-06 | Could | 5.5 AI insight report | „Opýtaj sa reportu“ – chat nad výsledkami kola v rámci oprávnení a prahu dôvernosti. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| KUD-01 | Must | 5.6 Krátke feedbacky medzi kolegami (Kudos) | Formulár: príjemca, text (min. ~80 znakov), firemná hodnota (napr. Spolupráca, Kvalita, Pomoc kolegom,… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| KUD-02 | Must | 5.6 Krátke feedbacky medzi kolegami (Kudos) | Viditeľnosť: verejné v tíme / verejné v pobočke / súkromné (iba príjemca). Kudos o kolegovi sa nikdy… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| KUD-03 | Should | 5.6 Krátke feedbacky medzi kolegami (Kudos) | Feed uznaní tímu a pobočky s reakciami. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| KUD-04 | Should | 5.6 Krátke feedbacky medzi kolegami (Kudos) | Odoslanie kudos priamo z Teams. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| KUD-05 | Should | 5.6 Krátke feedbacky medzi kolegami (Kudos) | AI upozornenie na príliš všeobecný text s návrhom konkrétnejšej formulácie. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| KUD-06 | Must | 5.6 Krátke feedbacky medzi kolegami (Kudos) | Nahlásenie nevhodného obsahu a moderácia HR. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| GAM-01 | Must | 5.7 Gamifikácia | Bodový systém podľa tabuľky (konfigurovateľný HR). Body nikdy nezávisia od obsahu odpovedí v prieskume. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| GAM-02 | Should | 5.7 Gamifikácia | Odznaky a tímové výzvy; individuálne rebríčky sa nepoužívajú. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| GAM-03 | Must | 5.7 Gamifikácia | Detekcia zneužitia (vzájomné výmeny, kopírovaný text, nárazové posielanie). Keďže kudos slúžia ako podklad… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| GAM-04 | Must | 5.7 Gamifikácia | Odpovede z prieskumov, skóre, body ani účasť v prieskumoch sa nikdy nepoužívajú pri hodnotení, povýšení… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| GAM-05 | Must | 5.7 Gamifikácia | HR (a manažér zamestnanca) vidí pri rozhodovaní o povýšení prijaté kudos daného zamestnanca: text, od… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| GAM-06 | Must | 5.7 Gamifikácia | Zamestnanec vie, že jeho prijaté kudos môžu slúžiť ako podklad k povýšeniu (pravidlo je zverejnené v portáli). | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| DASH-01 | Must | 5.8 Prehľady (UX pre manažéra a HR) | Prehľad o tíme na jednej obrazovke: trend skóre, témy, ktoré sa zhoršujú, komentáre (od 5 respondentov),… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| DASH-02 | Must | 5.8 Prehľady (UX pre manažéra a HR) | Podklady na najbližšie 1:1: témy tímu, ktoré stojí za to otvoriť, otvorené kroky, prijaté kudos člena tímu… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| DASH-03 | Must | 5.8 Prehľady (UX pre manažéra a HR) | Zoznam dohodnutých krokov s termínmi a stavom. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| DASH-04 | Must | 5.8 Prehľady (UX pre manažéra a HR) | Teplotná mapa tímov podľa okruhov (iba skupiny nad prahom dôvernosti). | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| DASH-05 | Must | 5.8 Prehľady (UX pre manažéra a HR) | Upozornenia na riziko odchodu na úrovni tímu (pokles skóre, zhoršujúce sa okruhy). | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| DASH-06 | Should | 5.8 Prehľady (UX pre manažéra a HR) | Porovnanie s dátami o odchodoch (dobrovoľné odchody tímov z HR systému oproti skóre). | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| DASH-07 | Must | 5.8 Prehľady (UX pre manažéra a HR) | Export výsledkov (CSV/XLSX, PPTX) bez identity respondentov (A-09). Export s menami je možný iba z… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| DASH-08 | Must | 5.8 Prehľady (UX pre manažéra a HR) | Prehľad plnenia reakcie: podiel kôl so zaznamenaným krokom, čas reakcie manažérov. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| DASH-09 | Must | 5.8 Prehľady (UX pre manažéra a HR) | Moje prieskumy, „Povedali ste, urobili sme“ tímu, odpovede na moje komentáre, moje kudos a body. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| INT-01 | Must | 5.9 Notifikácie a integrácie | E-mail a Teams: nové kolo, max. 2 pripomienky na kolo, výsledky a kroky zverejnené, odpoveď na môj… | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| INT-02 | Should | 5.9 Notifikácie a integrácie | Vyplnenie krátkeho pulse priamo v Teams. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| INT-03 | Should | 5.9 Notifikácie a integrácie | Napojenie na HR systém: organizačná štruktúra, dátum nástupu (check-upy), odchody (DASH-06). | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| INT-04 | Could | 5.9 Notifikácie a integrácie | Napojenie na kalendár pre plánovanie 1:1. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| ADM-01 | Must | 5.10 Administrácia | Správa rolí, tímov, pobočiek (prednostne synchronizácia z HR systému). | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| ADM-02 | Must | 5.10 Administrácia | Nastavenia AI: povolené funkcie, jazyk, logovanie, vypnutie AI pre citlivé prieskumy. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| ADM-03 | Must | 5.10 Administrácia | Nastavenia frekvencie, pripomienok, hraníc pre upozornenia a gamifikácie. | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| ADM-04 | Must | 5.10 Administrácia | Auditný log citlivých akcií (zobrazenie výsledkov, export, zmena oprávnení). | [05-funkcne-poziadavky.md](05-funkcne-poziadavky.md) |
| A-01 | — | 6.2 Ukladanie údajov | Odpovede sa ukladajú pod náhodným ID respondenta, nie pod e-mailom. | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-02 | — | 6.2 Ukladanie údajov | Prepojenie „náhodné ID ↔ e-mail“ je uložené oddelene od odpovedí (samostatná tabuľka alebo databáza) a je… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-03 | — | 6.2 Ukladanie údajov | K prepojeniu má prístup iba aplikácia pre rolu HR (databáza odpovedí, 6.4). Zamestnanci, manažéri ani… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-04 | — | 6.2 Ukladanie údajov | Doba uchovávania údajov je stanovená (návrh: 24 mesiacov). Po jej uplynutí sa prepojenie s identitou… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-05 | — | 6.3 Zobrazovanie výsledkov | Výsledky skupiny (tímu, oddelenia) sa zobrazia až pri minimálne 5 respondentoch. | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-06 | — | 6.3 Zobrazovanie výsledkov | Komentáre skupiny sa zobrazia až pri minimálne 5 respondentoch v danej skupine. Počíta sa počet ľudí,… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-07 | — | 6.3 Zobrazovanie výsledkov | Ochrana pred nepriamou identifikáciou: ak by filter (napr. vek, pozícia, dĺžka zamestnania) izoloval… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-08 | — | 6.3 Zobrazovanie výsledkov | Manažér vidí iba agregované výsledky svojho tímu a komentáre bez mena (výnimka: 6.6). | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-09 | — | 6.3 Zobrazovanie výsledkov | Žiadny prehľad, export ani API pre zamestnancov a manažérov nevracia identitu respondenta. | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-10 | — | 6.4 Databáza odpovedí pre HR | HR má k dispozícii databázu všetkých odpovedí (pulse aj dotazníky) s menom autora, tímom, dotazníkom,… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-11 | — | 6.4 Databáza odpovedí pre HR | Prístup k databáze majú iba určení pracovníci HR. Manažér tímu ani vedenie tímov túto rolu mať nemôžu. Ak… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-12 | — | 6.4 Databáza odpovedí pre HR | Prístup je cez osobný účet s dvojfaktorovým overením, nie cez spoločné heslo. | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-13 | — | 6.4 Databáza odpovedí pre HR | Každé otvorenie databázy, vyhľadávanie podľa mena a export s menami sa zapisuje do nemenného auditného… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-14 | — | 6.4 Databáza odpovedí pre HR | Mená z databázy smie HR použiť iba na riešenie nahlásených odpovedí a na pomoc zamestnancom. Nesmie ich… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-15 | — | 6.5 Nahlásenie odpovede | Pod každou odpoveďou, ktorú používateľ vidí (komentáre v prehľade tímu, výsledky dotazníkov), je tlačidlo… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-16 | — | 6.5 Nahlásenie odpovede | Pri nahlásení sa vyberie dôvod: | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-17 | — | 6.5 Nahlásenie odpovede | Systém automaticky nahlási odpovede s kľúčovými slovami, ktoré naznačujú ohrozenie života, a odpovede… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-18 | — | 6.5 Nahlásenie odpovede | HR v zozname Nahlásené vidí odpoveď, jej autora, dôvod a kto nahlásil. Prípady ohrozenia života sú navrchu… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-19 | — | 6.6 Sprístupnenie mena manažérovi | Manažér môže pri nahlásenej odpovedi zo svojho tímu alebo zo svojho dotazníka požiadať HR o meno autora.… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-20 | — | 6.6 Sprístupnenie mena manažérovi | HR žiadosť schváli alebo zamietne. Meno možno sprístupniť iba pri dôvode (a) alebo (b) z A-16. Bez… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-21 | — | 6.6 Sprístupnenie mena manažérovi | Meno sa sprístupní iba pri danej odpovedi a iba manažérovi, ktorý oň žiadal. Ostatné odpovede toho istého… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-22 | — | 6.6 Sprístupnenie mena manažérovi | Žiadosť, rozhodnutie HR aj zobrazenie mena sa zapisujú do auditného záznamu (A-13). | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-23 | — | 6.7 Ohrozenie života a pomoc zamestnancovi | Pri dôvode (b) HR kontaktuje zamestnanca v ten istý deň osobne alebo telefonicky a ponúkne pomoc (napr.… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-24 | — | 6.7 Ohrozenie života a pomoc zamestnancovi | HR pri ohrození nečaká na žiadosť manažéra – meno vidí v databáze a koná samo. Manažérovi meno sprístupní… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-25 | — | 6.7 Ohrozenie života a pomoc zamestnancovi | Na konci každého prieskumu je tlačidlo „Chcem, aby ma niekto z HR kontaktoval“. Ak ho zamestnanec stlačí,… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-26 | — | 6.8 Dotazníky medzi kolegami | Zamestnanec, manažér aj HR môžu poslať dotazník konkrétnym kolegom (aj z iných tímov), napr. keď potrebujú… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-27 | — | 6.8 Dotazníky medzi kolegami | Ak je adresátov menej ako 5, dotazník je vždy s menom – autor vidí, kto čo odpovedal. Pri 5 a viac… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-28 | — | 6.8 Dotazníky medzi kolegami | Pred vyplnením dotazníka s menom sa respondentovi jasne zobrazí, že autor uvidí jeho meno. Aj na tieto… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-29 | — | 6.9 Komunikácia voči zamestnancom | Nástroj ani komunikácia nesmú používať slovo „anonymný“. Používa sa „dôverný“. | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-30 | — | 6.9 Komunikácia voči zamestnancom | Na úvodnej obrazovke prieskumu je zrozumiteľne vysvetlené, ako sa s odpoveďami narába (text nižšie). | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-31 | — | 6.9 Komunikácia voči zamestnancom | Pravidlá dôvernosti sa počas prebiehajúceho prieskumu nemenia. Zmena platí až od ďalšieho kola a vopred sa… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-32 | — | 6.10 GDPR a právne požiadavky | Pred spustením pilotu: konzultácia s DPO a právnym oddelením. | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-33 | — | 6.10 GDPR a právne požiadavky | Vypracovať posúdenie vplyvu na ochranu údajov (DPIA), keďže ide o údaje zamestnancov a potenciálne citlivé… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-34 | — | 6.10 GDPR a právne požiadavky | Zdokumentovať účel spracovania, právny základ, dobu uchovávania a okruh osôb s prístupom. | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-35 | — | 6.10 GDPR a právne požiadavky | Zamestnanci dostanú informáciu o spracovaní osobných údajov pred prvým prieskumom, vrátane toho, že mená… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-36 | — | 6.10 GDPR a právne požiadavky | Zabezpečiť práva dotknutých osôb (prístup k vlastným odpovediam, výmaz po uplynutí doby uchovávania). | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |
| A-37 | — | 6.10 GDPR a právne požiadavky | Údaje o zdraví (napr. pri ohrození života) sa spracúvajú iba v rozsahu nevyhnutnom na pomoc zamestnancovi… | [06-dovernost-a-pristup-k-udajom.md](06-dovernost-a-pristup-k-udajom.md) |

## Údaje o dokumente

**ASSECO CENTRAL EUROPE · STÁŽNY PROJEKT**

**Feedback portál**

Špecifikácia požiadaviek (návrh na revíziu)

| Položka | Hodnota |
|---|---|
| Verzia | 0.4 – pracovný návrh |
| Dátum | 11. 11. 2026 |
| Autor | Oliver Seemann (stážista) s podporou Claude |
| Stav | Na revíziu tímom – všetky body sú otvorené na úpravu |
| Účel dokumentu | Vstup pre interný vývojový nástroj Asseco a pre tím, ktorý bude portál navrhovať a programovať |
**Obsah**

