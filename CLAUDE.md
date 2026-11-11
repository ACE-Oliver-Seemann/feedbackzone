# Feedback portál – MVP

Interná webová aplikácia Asseco CE: zamestnanec vyplní krátky pulse prieskum → manažér vidí výsledky tímu
→ zapíše krok → tím vidí „Povedali ste, urobili sme“. Plus kudos medzi kolegami.
**Termín: 3 pracovné dni.** Beží iba na testovacích dátach.

## Požiadavky a ich priorita
1. **`docs/requirements/mvp.md`** – hlavný zdroj. Požiadavky MVP-01 až MVP-17 a NFR-01 až NFR-07
   s akceptačnými kritériami, matica oprávnení, dátový model, API, obrazovky.
2. `docs/requirements/mvp-requirements.csv` – ten istý obsah rozpísaný na položky (FREQ_xxxx, NREQ_xxxx).
   Používaj ho ako zoznam úloh.
3. `docs/reference/specifikacia-v0.4/` – celá pôvodná špecifikácia. **Iba na kontext**
   (napr. otázky do seedu sú v `07-kniznica-otazok.md`, kapitola 7.2). Nič z nej neimplementuj navyše.

**Pri rozpore platí 1 pred 2 pred 3.** Ak rozpor nevieš vyriešiť podľa tohto poradia, zastav sa a opýtaj sa.

## Známe rozpory v CSV (platí mvp.md)
- **NREQ_0026** („API nevracia komentáre“) neplatí. Komentáre sa vracajú v `GET /api/rounds/:id/results`
  nad prahom 5 (MVP-10, MVP-11). Zakázané je vracať **autora** odpovede alebo komentára (NFR-01).
- **NREQ_0044, NREQ_0045** (SSO, nahlasovanie komentárov) nie sú súčasť MVP. Sú to podmienky pred pilotom. Neimplementuj.
- **FREQ_0080** nie je samostatný „denník“. „Povedali ste, urobili sme“ je zobrazenie krokov (MVP-13, MVP-14).
- **FREQ_0024**: každý vypĺňa kolo svojho tímu sám za seba, nie „pre členov tímu“.
- **Duplicity** (FREQ_0069 až FREQ_0083, NREQ_0027, NREQ_0029, NREQ_0038, NREQ_0040) opakujú iné položky.
  Neimplementuj ich zvlášť, iba over, že sú splnené.
- **Plán v mvp.md je na 5 dní, termín je 3 dni.** Poradie práce z plánu platí, dni sú orientačné.
  Ak čas nestačí, ako prvé sa vypustí kudos (MVP-16, MVP-17).

## Čo nerobiť
- Nič zo sekcie „Mimo rozsahu“ v mvp.md ani nič s prioritou Won't v CSV.
- Žiadne funkcie navyše. Nápad zapíš do odpovede, neimplementuj ho.

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
Príkazy (build, test, seed) sem doplň hneď po založení projektu.

## Ako pracovať
- Pred väčšou úlohou najprv navrhni plán a počkaj na schválenie.
- Každý commit, pull request a test odkazuje na ID požiadavky, napr. `feat(results): hide below threshold [MVP-11]`.
- Po každej úlohe spusti testy. NFR-01, NFR-02 a NFR-03 musia mať automatické testy.
- Kód, názvy v kóde a commity po anglicky. Texty v UI po slovensky, v jednom súbore (NFR-07).
