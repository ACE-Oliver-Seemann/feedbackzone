// Library of suggested actions per topic (IT-09). Own wording; each one is a
// small, concrete step a team manager can take within two weeks.
//
// Keys are the topic names of the question library in prisma/seed.ts. A topic
// without an entry (for example a team's own questions) uses FALLBACK.

export const SUGGESTIONS: Record<string, string[]> = {
  "Manažér a spätná väzba": [
    "Dohodni si s každým členom tímu 1:1 v najbližších dvoch týždňoch a opýtaj sa, akú spätnú väzbu od teba potrebuje.",
    "Na najbližšej tímovej porade povedz, čo sa stalo s podnetmi z minulého kola, aj s tými, ktoré sa nedajú vyriešiť.",
    "Pri najbližšej úlohe povedz iba cieľ a termín a spôsob riešenia nechaj na tíme.",
  ],
  "Jasnosť a priority": [
    "Na začiatku týždňa pošli tímu tri priority v poradí dôležitosti a pri každej jednu vetu, prečo je dôležitá.",
    "Keď sa priorita zmení, oznám to tímu v ten istý deň aj s dôvodom a s tým, čo sa kvôli tomu odkladá.",
    "Prejdi s tímom rozpracované úlohy a pri každej potvrď, kto ju robí a dokedy.",
  ],
  "Záťaž a energia": [
    "Prejdi s tímom rozpracované úlohy a dohodnite, ktoré dve sa odložia alebo zrušia.",
    "Zaveď limit rozpracovaných úloh na človeka a dva týždne ho spolu dodržiavajte.",
    "Spíš, kto mal za posledný mesiac pohotovosť alebo nadčas, a na ďalšie obdobie to rozdeľ rovnomernejšie.",
  ],
  "Sústredenie, nástroje a tok práce": [
    "Dohodnite v tíme dva bloky bez porád v týždni a zapíšte ich do kalendára.",
    "Prejdi pravidelné porady tímu a pri každej rozhodnite: ponechať, skrátiť, alebo zrušiť.",
    "Dohodnite, dokedy má byť hotové review alebo rozhodnutie, a kto zaskočí, keď sa to nestíha.",
    "Vyhraď v najbližšom šprinte pevný čas na jednu vec, ktorá tím dlhodobo brzdí, a nechaj tím vybrať ktorú.",
  ],
  "Tím a psychologické bezpečie": [
    "Na najbližšej retrospektíve začni vlastnou chybou a ponaučením z nej.",
    "Po najbližšej chybe alebo incidente prejdite spolu príčiny bez hľadania vinníka a zapíšte jednu zmenu postupu.",
    "Pri rozhodovaní sa najprv opýtaj na názor najtichších členov tímu a svoj povedz až na konci.",
  ],
  "Rast, uznanie a silné stránky": [
    "V najbližšom 1:1 sa s každým porozprávaj o tom, čo sa chce v najbližšom polroku naučiť, a dohodnite jeden konkrétny krok.",
    "Raz týždenne pred tímom konkrétne pomenuj, čo sa komu podarilo a aký to malo dopad.",
    "Pri rozdeľovaní ďalších úloh sa opýtaj, kto si ktorú chce vziať, a zohľadni, čo komu ide najlepšie.",
  ],
  "Hybridná práca a prostredie": [
    "Dohodnite, že rozhodnutia z porád sa vždy zapíšu na jedno miesto dostupné aj ľuďom, ktorí pri tom neboli.",
    "Na hybridných poradách daj slovo najprv ľuďom, ktorí sú pripojení online.",
    "Zisti, čo tímu v kancelárii bráni v nerušenej práci, a jednu vec posuň ďalej tomu, kto ju vie vyriešiť.",
  ],
  "Dôvera v prieskum": [
    "Na najbližšej porade prejdi kroky z posledných kôl a pri každom povedz, v akom je stave.",
    "Vyber z tohto kola jednu vec, ktorú vieš zmeniť do dvoch týždňov, a oznám tímu termín.",
  ],
};

export const FALLBACK_SUGGESTIONS = [
  "Otvor túto tému na najbližšej tímovej porade a opýtaj sa, čo by pomohlo najviac.",
  "Vyber s tímom jednu malú zmenu k tejto téme, ktorú viete vyskúšať do dvoch týždňov.",
];
