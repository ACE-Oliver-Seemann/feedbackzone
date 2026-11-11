// All UI texts in one place, ready for translation later (NFR-07).
// NFR-04: never use the word "anonymný" here — always "dôverný".

export const t = {
  app: {
    name: "Feedback portál",
    testDataNotice: "Demo na testovacích dátach",
  },
  roles: {
    EMPLOYEE: "Zamestnanec",
    MANAGER: "Manažér",
    HR: "HR",
  },
  nav: {
    mySurveys: "Moje prieskumy",
    hrRounds: "Prehľad kôl",
    newRound: "Nové kolo",
    logout: "Odhlásiť sa",
  },
  login: {
    title: "Prihlásenie",
    email: "E-mail",
    password: "Heslo",
    submit: "Prihlásiť sa",
    submitting: "Prihlasujem…",
    // MVP-01: one generic message, no hint which of the two was wrong.
    invalid: "Nesprávny e-mail alebo heslo.",
  },
  errors: {
    generic: "Niečo sa nepodarilo. Skús to znova.",
    forbiddenTitle: "Sem nemáš prístup",
    forbiddenText: "Táto stránka nie je dostupná pre tvoju rolu alebo tím.",
    backHome: "Späť na úvod",
  },
  roundStatus: {
    DRAFT: "Koncept",
    OPEN: "Otvorené",
    CLOSED: "Uzavreté",
  },
  rounds: {
    mySurveysTitle: "Moje prieskumy",
    mySurveysEmpty: "Momentálne nemáš žiadny otvorený prieskum.",
    submitted: "Odoslané",
    notSubmitted: "Čaká na vyplnenie",
    teamRoundsTitle: "Kolá môjho tímu",
    allRoundsTitle: "Prehľad kôl",
    empty: "Zatiaľ tu nie je žiadne kolo.",
    createFirst: "Vytvoriť kolo",
    colName: "Kolo",
    colTeam: "Tím",
    colStatus: "Stav",
    colDeadline: "Uzávierka",
    colParticipation: "Účasť",
    colActions: "Akcie",
    deadline: (date: string) => `Uzávierka ${date}`,
    questionCount: (count: number) => `${count} ${count >= 5 ? "otázok" : "otázky"}`,
    participation: (responded: number, teamSize: number) => `${responded} z ${teamSize}`,
    awaitingAction: "Čaká na krok",
    open: "Spustiť",
    close: "Uzavrieť",
    confirmOpen: "Spustiť kolo? Po spustení sa už nedá upravovať.",
    confirmClose: "Uzavrieť kolo? Potom sa do neho už nedá odpovedať.",
    invalidState: "Kolo medzitým zmenilo stav. Obnov stránku.",
    deadlinePassed: "Uzávierka kola už prešla, kolo sa nedá spustiť.",
  },
  newRound: {
    title: "Nové kolo",
    intro: "Kolo sa uloží ako koncept. Členovia tímu ho uvidia až po spustení.",
    name: "Názov kola",
    namePlaceholder: "napr. Pulse – 46. týždeň",
    team: "Tím",
    closesAt: "Dátum uzávierky",
    questions: "Otázky",
    questionsHint: "Vyber 3 až 5 otázok. Zobrazia sa v poradí, v akom ich vyberieš.",
    selected: (count: number) => `Vybrané: ${count} (treba 3 až 5)`,
    submit: "Uložiť koncept",
    submitting: "Ukladám…",
    fieldErrors: {
      name: "Zadaj názov kola (najviac 120 znakov).",
      teamId: "Vyber tím.",
      closesAt: "Zadaj dátum uzávierky, ktorý je dnes alebo neskôr.",
      questionIds: "Vyber 3 až 5 otázok.",
    },
  },
} as const;

export function formatDate(iso: string | Date): string {
  return new Intl.DateTimeFormat("sk-SK", { dateStyle: "medium" }).format(new Date(iso));
}
