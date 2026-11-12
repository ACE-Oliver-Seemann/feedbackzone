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
| `npm run acceptance` | Akceptačný scenár proti bežiacej aplikácii (čerstvý seed) |
| `npm run typecheck` | Kontrola typov |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Nová migrácia po zmene `prisma/schema.prisma` |
| `npm run db:seed` | Zmaže a naplní testovacie dáta |

## Stav

MVP (MVP-01 až MVP-17, NFR-01 až NFR-07) je hotové a zlúčené v `main`. Ďalší vývoj ide po iteráciách,
ktoré sú zapísané v [docs/requirements/iteracie.md](docs/requirements/iteracie.md).

Overenie:

- `npm test` – automatické testy vrátane povinných pre NFR-01, NFR-02 a NFR-03,
- `npm run acceptance` – akceptačný scenár z mvp.md (kroky 1 až 6) proti bežiacej aplikácii.
  Spusti ho nad čerstvým seedom: `npm run setup`, `npm run dev` a v druhom termináli `npm run acceptance`.

Podklady k otázkam v prieskumoch (výskum so zdrojmi) sú v [docs/research/otazky-do-pulse.md](docs/research/otazky-do-pulse.md).
