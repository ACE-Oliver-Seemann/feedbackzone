# Ako začať s Claude Code

## Čo je kde
| Súbor | Úloha | Kto mení |
|---|---|---|
| `../CLAUDE.md` | Pravidlá projektu. Claude ich načíta automaticky pri každej konverzácii. | Tím |
| `requirements/mvp.md` | Hlavný zdroj požiadaviek (export z Claude Docs) | Tím, novým exportom |
| `requirements/mvp-requirements.csv` | Zoznam úloh z nástroja na požiadavky, nezmenený | Nástroj |
| `reference/specifikacia-v0.4/` | Celá pôvodná špecifikácia, iba na kontext | Nemení sa |

## Prvé kroky vo VS Code
1. Otvorte tento priečinok cez **File → Open Folder**.
2. V paneli Claude prepnite režim na **Plan** a napíšte:
   > Prečítaj CLAUDE.md a docs/requirements/mvp.md. Zhrň rozsah MVP v 5 bodoch a navrhni plán na 3 dni. Zatiaľ nič neprogramuj.
3. Skontrolujte plán. Ak sedí, pokračujte:
   > Založ projekt podľa sekcie Stack v CLAUDE.md, vrátane Prisma schémy podľa dátového modelu v mvp.md a seedu (MVP-02). Otázky do seedu vezmi z docs/reference/specifikacia-v0.4/07-kniznica-otazok.md. Potom doplň príkazy do CLAUDE.md.
4. Ďalšie úlohy zadávajte po požiadavkách:
   > Implementuj MVP-04 a MVP-05 podľa akceptačných kritérií. Pridaj testy.
5. Na konci:
   > Over akceptačný scenár z mvp.md krok po kroku a napíš, čo prechádza a čo nie.

## Keď sa požiadavky zmenia
Exportujte dokument z Claude Docs ako Markdown a nahraďte `requirements/mvp.md`. Ak sa zmení CSV, nahraďte ho
a skontrolujte, či zoznam „Známe rozpory“ v `CLAUDE.md` stále platí.
