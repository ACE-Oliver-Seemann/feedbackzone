// Seed with invented test data only (MVP-02, NFR-06).
// Creates 2 teams of 6 (1 manager + 5 employees), 1 HR user, the question
// library from specification chapter 7.2, and one closed round of team Beta
// with 4 responses — below the confidentiality threshold, for acceptance
// scenario step 4.
//
// Destructive: wipes every table first. Never run against real data.

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** Shared password of all test accounts. */
export const TEST_PASSWORD = "Heslo123";

// Rotating topics, spec v0.4 chapter 7.2. "Dôvody odchodu" is left out:
// the spec says HR will supply those questions later.
const QUESTIONS: Record<string, string[]> = {
  Manažér: [
    "Môj manažér mi dáva feedback, podľa ktorého viem niečo zlepšiť.",
    "Za posledné 2 týždne sme mali 1:1, ktoré mi pomohlo.",
    "Môj manažér sa zaujíma o to, ako sa mám.",
  ],
  Vyťaženosť: [
    "Moja pracovná záťaž bola posledné 2 týždne zvládnuteľná.",
    "Mám dosť času robiť prácu kvalitne.",
  ],
  Rozvoj: [
    "Za posledný mesiac som sa naučil niečo, čo využijem.",
    "Viem, kam sa môžem v práci posunúť.",
  ],
  Uznanie: ["Moja práca bola v poslednom čase niekým ocenená."],
  "Jasnosť očakávaní": [
    "Viem, čo sa odo mňa tento týždeň očakáva.",
    "Priority tímu sú mi jasné.",
  ],
  Tím: [
    "V tíme si navzájom pomáhame, keď je to potrebné.",
    "V tíme môžem povedať aj nepopulárny názor.",
  ],
  "Pracovné prostredie": [
    "V kancelárii sa mi dobre pracuje (hluk, miesto, vybavenie).",
    "Mám miesto, kde sa viem sústrediť alebo nerušene telefonovať.",
  ],
  "Silné stránky": [
    "Tento týždeň som mohol robiť to, v čom som dobrý.",
    "Môj manažér vie, v čom sú moje silné stránky.",
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

  for (const [topic, texts] of Object.entries(QUESTIONS)) {
    for (const text of texts) {
      await db.question.create({ data: { text, topic } });
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
  const demoQuestions = await db.question.findMany({
    where: { topic: { in: ["Vyťaženosť", "Tím"] } },
    orderBy: { text: "asc" },
  });
  const day = 24 * 60 * 60 * 1000;
  const round = await db.round.create({
    data: {
      teamId: beta.id,
      name: "Pulse – vyťaženosť a tím",
      status: "CLOSED",
      startsAt: new Date(Date.now() - 10 * day),
      closesAt: new Date(Date.now() - 3 * day),
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
