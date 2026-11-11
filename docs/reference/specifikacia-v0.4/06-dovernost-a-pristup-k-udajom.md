# 6. Dôvernosť a prístup k údajom

## 6.1 Princíp

Prieskum je **dôverný, nie anonymný**. Manažér, tím ani autor dotazníka nevidia, kto čo odpovedal – vidia iba súhrn za skupinu aspoň 5 ľudí. **Mená vidí iba HR** v databáze odpovedí. Manažérovi HR sprístupní meno autora konkrétnej odpovede iba na jeho žiadosť a iba pri vážnom porušení pravidiel alebo ohrození života.

**Prečo nie úplná anonymita:**

- aby sa dali riešiť odpovede, ktoré vážne porušujú pravidlá (nenávisť, rasizmus, vyhrážky, obťažovanie),
- aby bolo možné rýchlo pomôcť človeku, ktorý je v ohrození (napr. zmienka o samovražde, vyhorenie, krízová situácia).

Ďalšie zásady: pravidlá dôvernosti sa ukazujú na úvode prieskumu a po spustení sa nemenia (Culture Amp). **Odpovede z prieskumov sa nikdy nepoužijú pri hodnotení, povýšení ani odmeňovaní** (ponaučenie z Amazonu) – jediným podkladom sú kudos (5.7).

## 6.2 Ukladanie údajov

| ID | Požiadavka |
|---|---|
| A-01 | Odpovede sa ukladajú pod náhodným ID respondenta, nie pod e-mailom. |
| A-02 | Prepojenie „náhodné ID ↔ e-mail“ je uložené oddelene od odpovedí (samostatná tabuľka alebo databáza) a je šifrované. |
| A-03 | K prepojeniu má prístup iba aplikácia pre rolu HR (databáza odpovedí, 6.4). Zamestnanci, manažéri ani administrátor k nemu nemajú prístup cez aplikáciu ani priamo cez databázu. |
| A-04 | Doba uchovávania údajov je stanovená (návrh: 24 mesiacov). Po jej uplynutí sa prepojenie s identitou vymaže a odpovede zostanú iba anonymne pre dlhodobé trendy. |

## 6.3 Zobrazovanie výsledkov

| ID | Požiadavka |
|---|---|
| A-05 | Výsledky skupiny (tímu, oddelenia) sa zobrazia až pri minimálne 5 respondentoch. |
| A-06 | Komentáre skupiny sa zobrazia až pri minimálne 5 respondentoch v danej skupine. Počíta sa počet ľudí, ktorí odpovedali, nie počet komentárov. |
| A-07 | Ochrana pred nepriamou identifikáciou: ak by filter (napr. vek, pozícia, dĺžka zamestnania) izoloval skupinu pod limitom, výsledok sa nezobrazí a skryje sa aj ďalšia najmenšia skupina (predvolené nastavenie podľa Culture Amp). |
| A-08 | Manažér vidí iba agregované výsledky svojho tímu a komentáre bez mena (výnimka: 6.6). |
| A-09 | Žiadny prehľad, export ani API pre zamestnancov a manažérov nevracia identitu respondenta. |

## 6.4 Databáza odpovedí pre HR

| ID | Požiadavka |
|---|---|
| A-10 | HR má k dispozícii databázu všetkých odpovedí (pulse aj dotazníky) s **menom autora**, tímom, dotazníkom, hodnoteniami a textom; s filtrom podľa dotazníka a vyhľadávaním podľa mena alebo textu. |
| A-11 | Prístup k databáze majú iba určení pracovníci HR. Manažér tímu ani vedenie tímov túto rolu mať nemôžu. Ak sa odpoveď týka samotného pracovníka HR, rieši ju iný pracovník HR. |
| A-12 | Prístup je cez osobný účet s dvojfaktorovým overením, nie cez spoločné heslo. |
| A-13 | Každé otvorenie databázy, vyhľadávanie podľa mena a export s menami sa zapisuje do nemenného auditného záznamu (kto, kedy, čo). Záznam štvrťročne kontroluje DPO. |
| A-14 | Mená z databázy smie HR použiť iba na riešenie nahlásených odpovedí a na pomoc zamestnancom. Nesmie ich použiť pri hodnotení, povýšení ani odmeňovaní (GAM-04). |

## 6.5 Nahlásenie odpovede

| ID | Požiadavka |
|---|---|
| A-15 | Pod každou odpoveďou, ktorú používateľ vidí (komentáre v prehľade tímu, výsledky dotazníkov), je tlačidlo **„Nahlásiť odpoveď“**. Môže ho použiť zamestnanec, manažér aj HR. |
| A-16 | Pri nahlásení sa vyberie dôvod:<br>(a) **vážne porušenie pravidiel** – nenávisť, rasizmus, vyhrážky, obťažovanie, diskriminácia,<br>(b) **ohrozenie života alebo zdravia** – napr. zmienka o samovražde alebo o tom, že niekto môže ublížiť sebe či iným.<br>Poznámka pre HR je nepovinná. Meno toho, kto nahlásil, vidí iba HR. |
| A-17 | Systém **automaticky nahlási** odpovede s kľúčovými slovami, ktoré naznačujú ohrozenie života, a odpovede zachytené filtrom nevhodného obsahu. Takéto odpovede sa manažérovi nezobrazia, kým ich HR neposúdi. |
| A-18 | HR v zozname **Nahlásené** vidí odpoveď, jej autora, dôvod a kto nahlásil. Prípady ohrozenia života sú navrchu ako urgentné. HR rozhodne: skryť odpoveď / ponechať (bez porušenia) / vyriešené. Skrytá odpoveď sa nezobrazí manažérovi ani autorovi dotazníka. |

## 6.6 Sprístupnenie mena manažérovi

| ID | Požiadavka |
|---|---|
| A-19 | Manažér môže pri **nahlásenej** odpovedi zo svojho tímu alebo zo svojho dotazníka požiadať HR o meno autora. Musí napísať, prečo ho potrebuje. |
| A-20 | HR žiadosť schváli alebo zamietne. Meno možno sprístupniť **iba pri dôvode (a) alebo (b)** z A-16. Bez schválenia HR manažér meno nevidí. |
| A-21 | Meno sa sprístupní iba pri danej odpovedi a iba manažérovi, ktorý oň žiadal. Ostatné odpovede toho istého človeka zostávajú dôverné. |
| A-22 | Žiadosť, rozhodnutie HR aj zobrazenie mena sa zapisujú do auditného záznamu (A-13). |

## 6.7 Ohrozenie života a pomoc zamestnancovi

| ID | Požiadavka |
|---|---|
| A-23 | Pri dôvode (b) HR kontaktuje zamestnanca **v ten istý deň** osobne alebo telefonicky a ponúkne pomoc (napr. program psychologickej podpory). Ak hrozí bezprostredné nebezpečenstvo, volá **112**. Portál tento postup HR zobrazí priamo pri nahlásenej odpovedi. |
| A-24 | HR pri ohrození nečaká na žiadosť manažéra – meno vidí v databáze a koná samo. Manažérovi meno sprístupní iba podľa 6.6 a iba ak to zamestnancovi pomôže. |
| A-25 | Na konci každého prieskumu je tlačidlo „Chcem, aby ma niekto z HR kontaktoval“. Ak ho zamestnanec stlačí, HR dostane jeho kontakt bez obsahu odpovedí. |

## 6.8 Dotazníky medzi kolegami

| ID | Požiadavka |
|---|---|
| A-26 | Zamestnanec, manažér aj HR môžu poslať dotazník **konkrétnym kolegom** (aj z iných tímov), napr. keď potrebujú niečo zistiť (SUR-08). |
| A-27 | Ak je adresátov **menej ako 5**, dotazník je vždy **s menom** – autor vidí, kto čo odpovedal. Pri 5 a viac adresátoch si autor vyberie: dôverný (iba súhrn) alebo s menom. |
| A-28 | Pred vyplnením dotazníka s menom sa respondentovi jasne zobrazí, že autor uvidí jeho meno. Aj na tieto odpovede sa vzťahuje nahlasovanie (6.5). |

## 6.9 Komunikácia voči zamestnancom

| ID | Požiadavka |
|---|---|
| A-29 | Nástroj ani komunikácia nesmú používať slovo „anonymný“. Používa sa „dôverný“. |
| A-30 | Na úvodnej obrazovke prieskumu je zrozumiteľne vysvetlené, ako sa s odpoveďami narába (text nižšie). |
| A-31 | Pravidlá dôvernosti sa počas prebiehajúceho prieskumu nemenia. Zmena platí až od ďalšieho kola a vopred sa oznámi. |

**Text na úvodnú obrazovku dôverného prieskumu:**

Tvoje odpovede sú dôverné. Manažér ani tím neuvidia, kto čo napísal – výsledky vidia iba za skupinu aspoň 5 ľudí. Mená vidí iba HR. Manažérovi ich sprístupní len pri vážnom porušení pravidiel (napr. nenávisť, rasizmus, vyhrážky) alebo pri ohrození života.

**Text na úvodnú obrazovku dotazníka s menom:**

Tento dotazník je s menom – autor uvidí, čo si odpovedal.

## 6.10 GDPR a právne požiadavky

| ID | Požiadavka |
|---|---|
| A-32 | Pred spustením pilotu: konzultácia s DPO a právnym oddelením. |
| A-33 | Vypracovať posúdenie vplyvu na ochranu údajov (DPIA), keďže ide o údaje zamestnancov a potenciálne citlivé údaje (zdravie, pohoda). DPIA musí osobitne posúdiť **prístup HR k menám** (6.4). |
| A-34 | Zdokumentovať účel spracovania, právny základ, dobu uchovávania a okruh osôb s prístupom. |
| A-35 | Zamestnanci dostanú informáciu o spracovaní osobných údajov pred prvým prieskumom, vrátane toho, že mená vidí HR. |
| A-36 | Zabezpečiť práva dotknutých osôb (prístup k vlastným odpovediam, výmaz po uplynutí doby uchovávania). |
| A-37 | Údaje o zdraví (napr. pri ohrození života) sa spracúvajú iba v rozsahu nevyhnutnom na pomoc zamestnancovi a nezdieľajú sa ďalej bez jeho súhlasu, okrem bezprostredného ohrozenia. |

**Zmena oproti v0.3:** širší prístup HR k menám (namiesto 1–2 Správcov dôvernosti so schvaľovaním dvoma osobami) zvyšuje riziko z pohľadu GDPR aj dôvery zamestnancov. Odporúčame ho prebrať s DPO ešte pred pilotom (A-32, A-33).
