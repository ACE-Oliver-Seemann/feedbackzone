# Feedback portál

Interná webová aplikácia Asseco CE: zamestnanec vyplní krátky pulse prieskum → manažér vidí výsledky tímu
→ zapíše krok → tím vidí „Povedali ste, urobili sme“. Plus kudos medzi kolegami.
**Stav:** MVP (MVP-01 až MVP-17) je hotové a zlúčené v `main`. Projekt je vo fáze iterácií: rozširuje sa
po malých krokoch, každý sa testuje a upravuje. Beží iba na testovacích dátach.

## Požiadavky a ich priorita
1. **`docs/requirements/iteracie.md`** – nové požiadavky po MVP (IT-xx) s akceptačnými kritériami a stavom.
   Implementuj iba položky so stavom **schválené**.
2. **`docs/requirements/mvp.md`** – základ, ktorý sa nemení. Požiadavky MVP-01 až MVP-17 a NFR-01 až NFR-07
   s akceptačnými kritériami, matica oprávnení, dátový model, API, obrazovky.
3. `docs/requirements/mvp-requirements.csv` – obsah mvp.md rozpísaný na položky (FREQ_xxxx, NREQ_xxxx).
4. `docs/reference/specifikacia-v0.4/` – celá pôvodná špecifikácia. **Iba na kontext** a ako zásobník nápadov
   pre ďalšie iterácie. Nič z nej neimplementuj, kým to nie je zapísané v `iteracie.md`.
5. `docs/research/` – podklady z výskumu (napr. otázky do prieskumov). Sú to odporúčania, nie požiadavky.

**Pri rozpore platí 1 pred 2 pred 3 pred 4.** Iterácia smie zmeniť správanie z mvp.md iba vtedy, keď to
v `iteracie.md` výslovne píše. Pravidlá zo sekcie „Pravidlá, ktoré sa nesmú porušiť“ iterácia zmeniť nesmie. Ak rozpor nevieš vyriešiť podľa tohto poradia, zastav sa a opýtaj sa.

## Známe rozpory v CSV (platí mvp.md)
- **NREQ_0026** („API nevracia komentáre“) neplatí. Komentáre sa vracajú v `GET /api/rounds/:id/results`
  nad prahom 5 (MVP-10, MVP-11). Zakázané je vracať **autora** odpovede alebo komentára (NFR-01).
- **NREQ_0044, NREQ_0045** (SSO, nahlasovanie komentárov) nie sú súčasť MVP. Sú to podmienky pred pilotom. Neimplementuj.
- **FREQ_0080** nie je samostatný „denník“. „Povedali ste, urobili sme“ je zobrazenie krokov (MVP-13, MVP-14).
- **FREQ_0024**: každý vypĺňa kolo svojho tímu sám za seba, nie „pre členov tímu“.
- **Duplicity** (FREQ_0069 až FREQ_0083, NREQ_0027, NREQ_0029, NREQ_0038, NREQ_0040) opakujú iné položky.
  Neimplementuj ich zvlášť, iba over, že sú splnené.

## Čo nerobiť
- Nič zo sekcie „Mimo rozsahu“ v mvp.md ani nič s prioritou Won't v CSV, pokiaľ to nie je výslovne schválené
  v `iteracie.md`.
- Žiadne funkcie navyše. Nápad zapíš do sekcie „Nápady“ v `iteracie.md` a do odpovede, neimplementuj ho.
- Nič, čo potrebuje externý systém (SSO, e-mail, Teams, AI služba) alebo skutočné údaje zamestnancov,
  bez výslovného rozhodnutia používateľa.

## Pravidlá, ktoré sa nesmú porušiť
- **NFR-01:** odpoveď sa nedá spárovať s používateľom. Tabuľka `Odpoveď` nemá stĺpec používateľa ani času,
  `id` je UUID. Kto odpovedal, je iba v tabuľke `Účasť` (unikátny kľúč kolo + používateľ), zápis oboch v jednej transakcii.
  Logy neobsahujú telo odpovede.
- **NFR-02:** `MIN_GROUP_SIZE = 5` je v jednom konfiguračnom súbore. Pod prahom API vráti iba `insufficient_responses` a počet.
- **NFR-03:** oprávnenia sa overujú na serveri pri každom endpointe podľa matice v mvp.md. Nepovolený prístup = 403.
- **NFR-04:** v UI nikdy slovo „anonymný“, vždy „dôverný“.
- **NFR-06:** iba vymyslené testovacie dáta. Nikdy skutočné mená, e-maily ani odpovede zamestnancov.

## Stack
Next.js + TypeScript, SQLite cez Prisma, Tailwind CSS, heslá cez bcrypt, relácia v cookie (`HttpOnly`, `SameSite=Lax`).
Ak tím zvolí Django, túto sekciu prepíšte skôr, ako začne vývoj.

Verzie: Next.js 16.4 (App Router, `src/`), Prisma 6 (nie 8 RC), Vitest, `bcryptjs`. Overené na Node.js 26 LTS.
**Next.js 16 sa líši od starších verzií** – pred písaním kódu pre Next si prečítaj príslušný návod
v `node_modules/next/dist/docs/` (pozri `AGENTS.md`).

### Príkazy
| Príkaz | Čo robí |
|---|---|
| `npm run demo` | Všetko naraz: inštalácia, `.env`, migrácie, seed, spustenie na http://localhost:3000 |
| `npm run setup` | Vytvorí `.env` (ak chýba), aplikuje migrácie, naplní testovacie dáta. **Zmaže dáta v `prisma/dev.db`.** |
| `npm run dev` | Vývojový server |
| `npm test` | Testy (Vitest) nad `prisma/test.db`; databáza sa pred každým behom vytvorí nanovo z migrácií |
| `npm run acceptance` | Akceptačný scenár z mvp.md (kroky 1–6) cez HTTP proti bežiacej aplikácii na čerstvom seede |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Produkčný build |
| `npm run db:migrate` | `prisma migrate dev` po zmene schémy |
| `npm run db:seed` | Iba seed (zmaže a naplní `prisma/dev.db`) |

Testovacie účty sú v `prisma/seed.ts` (doména `example.test`, spoločné heslo `Heslo123`).

### Kde čo je
- `src/config/privacy.ts` – `MIN_GROUP_SIZE` (NFR-02), jediné miesto. `src/config/kudos.ts` – pravidlá kudos.
  `src/config/scales.ts` – škály odpovedí (IT-03); popisy bodov sú v `texts.sk.ts`.
- `prisma/seed.ts` – knižnica otázok podľa `docs/research/otazky-do-pulse.md`. Znenie otázok nemeň bez schválenia.
- `src/lib/authz.ts` – matica oprávnení (NFR-03). `src/lib/session.ts` – podpísaná cookie, `requireUser`.
- `src/lib/errors.ts` – `route()` obaľuje každý endpoint; loguje iba metódu, cestu a typ chyby (NFR-01).
- `src/server/*` – logika. Volajú ju endpointy v `src/app/api/**/route.ts` aj serverové stránky; oprávnenia sa overujú tu.
- `src/lib/page-auth.ts` – ochrana stránok (bez relácie → `/login`, zlá rola → 403).
- `src/lib/texts.sk.ts` – všetky texty UI (NFR-07, NFR-04).
- `tests/` – testy volajú priamo handlery endpointov; `tests/helpers.ts` má fixtures.

### Pozor pri zmene schémy (NFR-01)
`prisma/migrations/*_init/migration.sql` je ručne upravená: tabuľky `Response` a `Participation` sú `WITHOUT ROWID`
(inak by skrytý `rowid` prezradil poradie vkladania a odpovede by sa dali spárovať s účasťou) a `Response` má `CHECK`
obmedzenia (hodnoty 1–5, komentár do 1 000 znakov). Prisma to nevie vygenerovať. Ak nová migrácia tieto tabuľky
pretvára, doplň oboje ručne; `tests/schema.test.ts` na to upozorní.

## Ako pracovať
- Pred väčšou úlohou najprv navrhni plán a počkaj na schválenie.
- Každý commit, pull request a test odkazuje na ID požiadavky, napr. `feat(results): hide below threshold [MVP-11]`
  alebo `feat(ui): brand colours [IT-01]`.
- Jedna iterácia (IT-xx) = jedna vetva z `main` a jeden pull request.
- Po každej úlohe spusti testy. NFR-01, NFR-02 a NFR-03 musia mať automatické testy.
- Kód, názvy v kóde a commity po anglicky. Texty v UI po slovensky, v jednom súbore (NFR-07).
