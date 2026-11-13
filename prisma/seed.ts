// Seed with invented test data only (MVP-02, NFR-06).
// Creates 2 teams of 6 (1 manager + 5 employees), 1 HR user, the question
// library from the research (IT-03), and one closed round of team Beta
// with 4 responses — below the confidentiality threshold, for acceptance
// scenario step 4.
//
// Destructive: wipes every table first. Never run against real data.

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** Shared password of all test accounts. */
export const TEST_PASSWORD = "Heslo123";

// Question library from the research in docs/research/otazky-do-pulse.md (IT-03).
// Own wording inspired by published constructs; nothing is copied from
// licensed instruments. `starter` marks the recommended starting set of 12.
type SeedQuestion = { text: string; starter?: boolean; scale?: string };

/** The fixed trend question, added automatically to every round (IT-04). */
const FIXED_QUESTION = {
  text: "Celkovo, aké boli pre mňa posledné dva týždne v práci?",
  topic: "Stála otázka",
  scale: "QUALITY",
};

const QUESTIONS: Record<string, SeedQuestion[]> = {
  "Manažér a spätná väzba": [
    { text: "Spätná väzba od môjho manažéra mi pomáha zlepšovať sa.", starter: true },
    { text: "Rozhovory 1:1 s manažérom sú pre mňa užitočné." },
    { text: "S manažérom sa rozprávame 1:1 dosť často na to, čo potrebujem." },
    { text: "Môjmu manažérovi záleží na tom, ako sa mám." },
    { text: "Keď za manažérom prídem s problémom, niečo sa s ním začne diať.", starter: true },
    { text: "Mám dosť voľnosti rozhodnúť sa, ako svoju prácu urobím." },
  ],
  "Jasnosť a priority": [
    { text: "Viem, čo sa odo mňa v najbližších dvoch týždňoch očakáva.", starter: true },
    { text: "Priority nášho tímu sú mi jasné." },
    { text: "Priority nášho tímu boli za posledné dva týždne stabilné.", starter: true },
    { text: "Keď sa priority zmenia, viem prečo." },
    { text: "Rozumiem, ako moja práca prispieva k cieľom firmy alebo zákazníka." },
  ],
  "Záťaž a energia": [
    { text: "Moja pracovná záťaž bola za posledné dva týždne zvládnuteľná.", starter: true },
    { text: "Mám dosť času robiť prácu poriadne.", starter: true },
    {
      text: "Ako často bolo za posledné dva týždne potrebné pracovať nadčas alebo mimo bežného pracovného času?",
      scale: "OVERTIME",
    },
    { text: "Po práci dokážem vypnúť a oddýchnuť si." },
    {
      text: "Ako často sa za posledné dva týždne pracovný deň skončil pocitom vyčerpania?",
      scale: "FREQUENCY",
    },
    { text: "Pohotovosti a riešenie incidentov sú v tíme rozdelené spravodlivo." },
  ],
  "Sústredenie, nástroje a tok práce": [
    { text: "Mám dosť súvislého času na sústredenú prácu.", starter: true },
    { text: "Porady, na ktorých sa zúčastňujem, stoja za čas, ktorý im venujem." },
    { text: "Nástroje a prostredia, ktoré používam, mi prácu uľahčujú." },
    {
      text: "Keď potrebujem review, rozhodnutie alebo informáciu, dostanem ich dosť rýchlo.",
      starter: true,
    },
    { text: "Máme dosť priestoru opravovať veci, ktoré nás dlhodobo brzdia." },
    { text: "Nové úlohy dostávam s dostatkom informácií na to, aby sa dalo začať." },
  ],
  "Tím a psychologické bezpečie": [
    { text: "V tíme môžem otvorene povedať, že s niečím nesúhlasím.", starter: true },
    { text: "Keď sa v tíme stane chyba, hľadáme príčinu, nie vinníka.", starter: true },
    { text: "Pripomienky k mojej práci dostávam s rešpektom." },
    { text: "Keď potrebujem pomoc, v tíme ju dostanem." },
    { text: "Na dohody v našom tíme sa dá spoľahnúť." },
  ],
  "Rast, uznanie a silné stránky": [
    { text: "Posledný mesiac mi v práci priniesol niečo nové, čo viem využiť." },
    { text: "Viem, aké mám vo firme možnosti ďalšieho rastu." },
    { text: "Za posledné tri mesiace sme s manažérom hovorili o mojom rozvoji." },
    { text: "Keď odvediem dobrú prácu, niekto si to všimne.", starter: true },
    { text: "Moja práca mi dáva príležitosť robiť to, čo mi ide najlepšie.", starter: true },
  ],
  "Hybridná práca a prostredie": [
    { text: "Pri práci z domu mám rovnaký prístup k informáciám ako pri práci z kancelárie." },
    { text: "Na poradách, kde je časť ľudí online, sa viem zapojiť rovnako ako ostatní." },
    { text: "V kancelárii mám kde nerušene pracovať." },
  ],
  "Dôvera v prieskum": [
    { text: "Na základe týchto prieskumov sa v našom tíme niečo mení." },
  ],
};

// Invented people. The example.test domain cannot receive mail.
const TEAMS = [
  {
    name: "Tím Alfa",
    manager: { name: "Alena Testová", email: "manazer.alfa@example.test" },
    employees: [
      { name: "Adam Vzorový", email: "adam.alfa@example.test" },
      { name: "Barbora Skúšobná", email: "barbora.alfa@example.test" },
      { name: "Cyril Ukážkový", email: "cyril.alfa@example.test" },
      { name: "Dana Príkladná", email: "dana.alfa@example.test" },
      { name: "Emil Pokusný", email: "emil.alfa@example.test" },
    ],
  },
  {
    name: "Tím Beta",
    manager: { name: "Boris Testovací", email: "manazer.beta@example.test" },
    employees: [
      { name: "Filip Vzorka", email: "filip.beta@example.test" },
      { name: "Gabriela Skúšková", email: "gabriela.beta@example.test" },
      { name: "Hugo Ukážka", email: "hugo.beta@example.test" },
      { name: "Ivana Príkladová", email: "ivana.beta@example.test" },
      { name: "Jakub Pokus", email: "jakub.beta@example.test" },
    ],
  },
];

const HR = { name: "Hana Personálna", email: "hr@example.test" };

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The seed wipes the database and must not run in production.");
  }

  // Children first, because of foreign keys. User.teamId and Team.managerId
  // reference each other, so the link from users is cut before deleting.
  await db.issueComment.deleteMany();
  await db.issue.deleteMany();
  await db.meetingNote.deleteMany();
  await db.kudos.deleteMany();
  await db.action.deleteMany();
  await db.response.deleteMany();
  await db.participation.deleteMany();
  await db.roundQuestion.deleteMany();
  await db.round.deleteMany();
  await db.question.deleteMany();
  await db.user.updateMany({ data: { teamId: null } });
  await db.team.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const fixedQuestion = await db.question.create({ data: { ...FIXED_QUESTION, fixed: true } });
  for (const [topic, questions] of Object.entries(QUESTIONS)) {
    for (const question of questions) {
      await db.question.create({
        data: {
          text: question.text,
          topic,
          starter: question.starter ?? false,
          scale: question.scale ?? "AGREEMENT",
        },
      });
    }
  }

  await db.user.create({ data: { ...HR, passwordHash, role: "HR" } });

  const teams: { id: string; memberIds: string[] }[] = [];
  for (const team of TEAMS) {
    const manager = await db.user.create({
      data: { ...team.manager, passwordHash, role: "MANAGER" },
    });
    const created = await db.team.create({ data: { name: team.name, managerId: manager.id } });
    // The manager is also a member of the team they manage.
    await db.user.update({ where: { id: manager.id }, data: { teamId: created.id } });

    const memberIds = [manager.id];
    for (const employee of team.employees) {
      const user = await db.user.create({
        data: { ...employee, passwordHash, role: "EMPLOYEE", teamId: created.id },
      });
      memberIds.push(user.id);
    }
    teams.push({ id: created.id, memberIds });
  }

  // Demo: closed round of team Beta with 4 responses (below the threshold).
  const beta = teams[1];
  // The fixed question first, then three from the starting set.
  const rotating = await db.question.findMany({
    where: {
      text: {
        in: [
          "Moja pracovná záťaž bola za posledné dva týždne zvládnuteľná.",
          "Mám dosť času robiť prácu poriadne.",
          "Mám dosť súvislého času na sústredenú prácu.",
        ],
      },
    },
    orderBy: { text: "asc" },
  });
  const demoQuestions = [fixedQuestion, ...rotating];
  const day = 24 * 60 * 60 * 1000;
  const round = await db.round.create({
    data: {
      teamId: beta.id,
      name: "Pulse – záťaž a sústredenie",
      status: "CLOSED",
      startsAt: new Date(Date.now() - 10 * day),
      closesAt: new Date(Date.now() - 3 * day),
      closedAt: new Date(Date.now() - 3 * day),
      questions: {
        create: demoQuestions.map((question, index) => ({
          questionId: question.id,
          position: index + 1,
        })),
      },
    },
  });
  const answers: { values: number[]; comment?: string }[] = [
    { values: [4, 3, 5, 4], comment: "Posledný šprint bol náročný, ale zvládli sme ho." },
    { values: [2, 2, 4, 3] },
    { values: [3, 4, 5, 5], comment: "Pomohlo by menej prepínania medzi úlohami." },
    { values: [5, 4, 4, 4] },
  ];
  // Employees at indexes 1..4; who gave which answer is not recorded anywhere.
  for (const [index, answer] of answers.entries()) {
    await db.$transaction([
      db.participation.create({
        data: { roundId: round.id, userId: beta.memberIds[index + 1] },
      }),
      db.response.create({
        data: {
          roundId: round.id,
          teamId: beta.id,
          v1: answer.values[0],
          v2: answer.values[1],
          v3: answer.values[2],
          v4: answer.values[3],
          comment: answer.comment,
        },
      }),
    ]);
  }

  // Demo for IT-10: one note from a meeting and two issues. Invented content.
  const hr = await db.user.findFirstOrThrow({ where: { role: "HR" } });
  const note = await db.meetingNote.create({
    data: {
      title: "Stretnutie s Tímom Beta",
      meetingDate: new Date(Date.now() - 2 * day),
      text: "V zasadačke na 3. poschodí je už druhý týždeň teplo, klimatizácia nechladí.\nTím by privítal menej prekrývajúcich sa porád v utorok.",
      createdById: hr.id,
    },
  });
  await db.issue.create({
    data: {
      title: "Nefunguje klimatizácia v zasadačke na 3. poschodí",
      description: "Podľa tímu nechladí už druhý týždeň.",
      source: "MEETING",
      ownerGroup: "FACILITY",
      teamId: beta.id,
      noteId: note.id,
      dueDate: new Date(Date.now() + 7 * day),
      createdById: hr.id,
    },
  });
  await db.issue.create({
    data: {
      title: "Príliš veľa porád v jednom dni",
      description: "Téma z posledného kola aj zo stretnutia.",
      source: "SURVEY",
      ownerGroup: "TEAM_MANAGER",
      status: "IN_PROGRESS",
      roundId: round.id,
      teamId: beta.id,
      createdById: hr.id,
    },
  });

  const counts = {
    users: await db.user.count(),
    teams: await db.team.count(),
    questions: await db.question.count(),
  };
  console.log(
    `Seed done: ${counts.users} users, ${counts.teams} teams, ${counts.questions} questions. ` +
      `Password of every test account: ${TEST_PASSWORD}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
