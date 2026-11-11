# Feedback portál – MVP

Interná webová aplikácia: zamestnanec vyplní krátky pulse prieskum → manažér vidí výsledky tímu → zapíše krok →
tím vidí „Povedali ste, urobili sme“. Beží **iba na vymyslených testovacích dátach**.

Požiadavky sú v [docs/requirements/mvp.md](docs/requirements/mvp.md), pravidlá projektu v [CLAUDE.md](CLAUDE.md).

## Spustenie

Potrebuješ Node.js (overené na verzii 26 LTS).

```
npm run demo
```

Príkaz nainštaluje závislosti, vytvorí `.env`, databázu `prisma/dev.db` s testovacími dátami a spustí aplikáciu
na http://localhost:3000. Pri ďalšom spustení stačí `npm run dev`.

`npm run setup` (je súčasťou `npm run demo`) vždy **zmaže a nanovo naplní** `prisma/dev.db`.

## Testovacie účty

Všetky účty majú heslo `Heslo123`.

| Rola | E-mail |
|---|---|
| HR | `hr@example.test` |
| Manažér, Tím Alfa | `manazer.alfa@example.test` |
| Zamestnanci, Tím Alfa | `adam.alfa@example.test`, `barbora.alfa@…`, `cyril.alfa@…`, `dana.alfa@…`, `emil.alfa@…` |
| Manažér, Tím Beta | `manazer.beta@example.test` |
| Zamestnanci, Tím Beta | `filip.beta@example.test`, `gabriela.beta@…`, `hugo.beta@…`, `ivana.beta@…`, `jakub.beta@…` |

Seed pripraví aj jedno uzavreté kolo Tímu Beta so 4 odpoveďami (pod prahom dôvernosti 5).

## Vývoj

| Príkaz | Čo robí |
|---|---|
| `npm run dev` | Vývojový server |
| `npm test` | Automatické testy |
| `npm run typecheck` | Kontrola typov |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Nová migrácia po zmene `prisma/schema.prisma` |
| `npm run db:seed` | Zmaže a naplní testovacie dáta |

## Stav

Hotový je 1. deň plánu: prihlásenie a roly (MVP-01 až MVP-03), tvorba, spustenie a uzavretie kola (MVP-04, MVP-05),
zoznam kôl podľa roly. Vypĺňanie, výsledky, kroky, stránka tímu a kudos ešte nie sú.
