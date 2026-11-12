// Demo data on top of the seed: several closed rounds with answers, comments
// and actions, so that results, suggestions, the team trend, the comparison of
// teams and the HR overview have something to show without filling in rounds
// by hand. Invented content only (NFR-06).
//
// Run with `npm run db:demo` (it reseeds first, so everything typed into the
// app before is lost).
//
// NFR-01: answers are written exactly like the application writes them — a
// Participation row and a Response row in one transaction, with nothing that
// links the two. Who "gave" which answer is not recorded anywhere, not even here.

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;

/** Small deterministic generator, so that the demo looks the same every time. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** An answer 1–5 scattered around a target average. */
function answerAround(target: number, random: () => number): number {
  const value = Math.round(target + (random() - 0.5) * 2.2);
  return Math.min(5, Math.max(1, value));
}

type RoundPlan = {
  name: string;
  closedDaysAgo: number;
  /** Texts of the rotating questions; the fixed question is always first. */
  questions: string[];
  /** Target averages: fixed question first, then the rotating ones. */
  targets: number[];
  /** How many of the 6 team members answered. */
  responses: number;
  comments: string[];
  actions: {
    topic: string;
    description: string;
    status: "PLANNED" | "IN_PROGRESS" | "DONE";
    /** Days after closing the round when the manager wrote it. */
    afterDays: number;
    dueInDays: number;
  }[];
};

const Q = {
  workload: "Moja pracovná záťaž bola za posledné dva týždne zvládnuteľná.",
  time: "Mám dosť času robiť prácu poriadne.",
  focus: "Mám dosť súvislého času na sústredenú prácu.",
  meetings: "Porady, na ktorých sa zúčastňujem, stoja za čas, ktorý im venujem.",
  priorities: "Priority nášho tímu boli za posledné dva týždne stabilné.",
  expectations: "Viem, čo sa odo mňa v najbližších dvoch týždňoch očakáva.",
  feedback: "Spätná väzba od môjho manažéra mi pomáha zlepšovať sa.",
  disagree: "V tíme môžem otvorene povedať, že s niečím nesúhlasím.",
  mistakes: "Keď sa v tíme stane chyba, hľadáme príčinu, nie vinníka.",
  recognition: "Keď odvediem dobrú prácu, niekto si to všimne.",
  overtime:
    "Ako často bolo za posledné dva týždne potrebné pracovať nadčas alebo mimo bežného pracovného času?",
  review: "Keď potrebujem review, rozhodnutie alebo informáciu, dostanem ich dosť rýchlo.",
};

// Team Alfa: a team that started overloaded and slowly improved after the
// manager acted. One round has only 4 answers and shows as a gap.
const ALFA: RoundPlan[] = [
  {
    name: "Pulse – 38. týždeň",
    closedDaysAgo: 56,
    questions: [Q.workload, Q.focus, Q.priorities],
    targets: [2.8, 2.2, 2.6, 2.4],
    responses: 6,
    comments: [
      "Priority sa menia každý druhý deň, ťažko sa niečo dokončí.",
      "Príliš veľa rozrobených vecí naraz.",
      "Chýba mi čas na sústredenú prácu, stále ma niekto vyrušuje.",
    ],
    actions: [
      {
        topic: "Záťaž a energia",
        description: "Zaviedli sme limit dvoch rozpracovaných úloh na človeka.",
        status: "DONE",
        afterDays: 2,
        dueInDays: -40,
      },
    ],
  },
  {
    name: "Pulse – 40. týždeň",
    closedDaysAgo: 42,
    questions: [Q.workload, Q.meetings, Q.expectations],
    targets: [3.1, 2.9, 2.5, 3.4],
    responses: 5,
    comments: [
      "Limit rozpracovaných úloh pomohol, vďaka.",
      "Porady v utorok sa prekrývajú a sú príliš dlhé.",
    ],
    actions: [
      {
        topic: "Sústredenie, nástroje a tok práce",
        description: "Zrušili sme utorkovú poradu a nahradili ju písomným statusom.",
        status: "DONE",
        afterDays: 3,
        dueInDays: -28,
      },
      {
        topic: "Jasnosť a priority",
        description: "Každý pondelok posielam tímu tri priority týždňa.",
        status: "IN_PROGRESS",
        afterDays: 3,
        dueInDays: -20,
      },
    ],
  },
  {
    name: "Pulse – 42. týždeň",
    closedDaysAgo: 28,
    questions: [Q.focus, Q.feedback, Q.disagree],
    targets: [3.2, 3.0, 3.6, 4.0],
    responses: 4, // below the threshold: a gap in the trend, "Nedostatok odpovedí"
    comments: ["Bola dovolenková sezóna, málo ľudí v práci."],
    actions: [],
  },
  {
    name: "Pulse – 44. týždeň",
    closedDaysAgo: 14,
    questions: [Q.workload, Q.overtime, Q.recognition],
    targets: [3.7, 3.6, 2.4, 3.3],
    responses: 6,
    comments: [
      "Posledné dva týždne boli pokojnejšie.",
      "Ocenil by som, keby sa dobrá práca spomenula aj pred tímom.",
      "Nadčasy pred vydaním boli potrebné, ale bolo ich menej než minule.",
    ],
    actions: [
      {
        topic: "Rast, uznanie a silné stránky",
        description: "Na piatkovom stretnutí vždy pomenujem, čo sa komu v týždni podarilo.",
        status: "PLANNED",
        afterDays: 1,
        dueInDays: 7,
      },
    ],
  },
  {
    name: "Pulse – 46. týždeň",
    closedDaysAgo: 1,
    questions: [Q.time, Q.review, Q.mistakes],
    targets: [3.9, 3.5, 2.7, 4.1],
    responses: 5,
    comments: [
      "Na review sa čaká aj dva dni, to brzdí celý tím.",
      "Chyby riešime vecne, to je na tíme fajn.",
    ],
    actions: [], // newest round: still waiting for an action
  },
];

// Team Beta: a steadier team, for the comparison of teams. The seed already
// gave it one closed round with 4 answers.
const BETA: RoundPlan[] = [
  {
    name: "Pulse – 40. týždeň",
    closedDaysAgo: 42,
    questions: [Q.workload, Q.focus, Q.disagree],
    targets: [3.9, 3.8, 3.4, 4.2],
    responses: 5,
    comments: ["Tím funguje dobre, len občas chýba čas na sústredenie."],
    actions: [
      {
        topic: "Sústredenie, nástroje a tok práce",
        description: "Dohodli sme dva bloky bez porád v týždni.",
        status: "DONE",
        afterDays: 6,
        dueInDays: -25,
      },
    ],
  },
  {
    name: "Pulse – 44. týždeň",
    closedDaysAgo: 14,
    questions: [Q.priorities, Q.feedback, Q.recognition],
    targets: [4.0, 3.2, 3.9, 3.7],
    responses: 6,
    comments: [
      "Priority sa minulý týždeň dvakrát zmenili bez vysvetlenia.",
      "Spätná väzba na 1:1 je konkrétna a pomáha.",
    ],
    actions: [],
  },
];

async function createRound(teamId: string, memberIds: string[], plan: RoundPlan, seed: number) {
  const random = createRandom(seed);
  const fixed = await db.question.findFirstOrThrow({ where: { fixed: true } });
  const rotating = await Promise.all(
    plan.questions.map((text) => db.question.findFirstOrThrow({ where: { text, teamId: null } })),
  );
  const questions = [fixed, ...rotating];

  const closedAt = new Date(Date.now() - plan.closedDaysAgo * DAY);
  const round = await db.round.create({
    data: {
      teamId,
      name: plan.name,
      status: "CLOSED",
      startsAt: new Date(closedAt.getTime() - 7 * DAY),
      closesAt: closedAt,
      closedAt,
      questions: {
        create: questions.map((question, index) => ({
          questionId: question.id,
          position: index + 1,
        })),
      },
    },
  });

  for (let index = 0; index < plan.responses; index++) {
    const values = plan.targets.map((target) => answerAround(target, random));
    await db.$transaction([
      db.participation.create({ data: { roundId: round.id, userId: memberIds[index] } }),
      db.response.create({
        data: {
          roundId: round.id,
          teamId,
          v1: values[0],
          v2: values[1],
          v3: values[2],
          v4: values[3] ?? null,
          // Comments go to the first rows; the row order says nothing about people.
          comment: plan.comments[index] ?? null,
        },
      }),
    ]);
  }

  for (const action of plan.actions) {
    await db.action.create({
      data: {
        roundId: round.id,
        topic: action.topic,
        description: action.description,
        status: action.status,
        createdAt: new Date(closedAt.getTime() + action.afterDays * DAY),
        dueDate: new Date(Date.now() + action.dueInDays * DAY),
      },
    });
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo data must not be created in production.");
  }

  const teams = await db.team.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, managerId: true, members: { select: { id: true } } },
  });
  const alfa = teams.find((team) => team.name === "Tím Alfa");
  const beta = teams.find((team) => team.name === "Tím Beta");
  if (!alfa || !beta) throw new Error("Run the seed first: npm run db:seed");

  // Employees first, the manager last, so that 5 answers come from employees.
  const membersOf = (team: NonNullable<typeof alfa>) => [
    ...team.members.map((member) => member.id).filter((id) => id !== team.managerId),
    team.managerId,
  ];

  for (const [index, plan] of ALFA.entries()) {
    await createRound(alfa.id, membersOf(alfa), plan, 100 + index);
  }
  for (const [index, plan] of BETA.entries()) {
    await createRound(beta.id, membersOf(beta), plan, 200 + index);
  }

  // One open round for team Alfa, so that filling in can be tried too.
  const fixed = await db.question.findFirstOrThrow({ where: { fixed: true } });
  const rotating = await Promise.all(
    [Q.workload, Q.focus, Q.expectations].map((text) =>
      db.question.findFirstOrThrow({ where: { text, teamId: null } }),
    ),
  );
  await db.round.create({
    data: {
      teamId: alfa.id,
      name: "Pulse – 48. týždeň",
      status: "OPEN",
      startsAt: new Date(),
      closesAt: new Date(Date.now() + 10 * DAY),
      questions: {
        create: [fixed, ...rotating].map((question, index) => ({
          questionId: question.id,
          position: index + 1,
        })),
      },
    },
  });

  // A few kudos, with and without an emoji.
  const [adam, barbora, cyril] = membersOf(alfa);
  await db.kudos.createMany({
    data: [
      {
        fromUserId: adam,
        toUserId: barbora,
        text: "Ďakujem za pomoc s nasadením novej verzie, ušetrila si mi celý deň.",
        value: "HELPING",
        visibility: "TEAM",
        createdAt: new Date(Date.now() - 6 * DAY),
      },
      {
        fromUserId: barbora,
        toUserId: cyril,
        text: "",
        emoji: "👏",
        value: "QUALITY",
        visibility: "TEAM",
        createdAt: new Date(Date.now() - 3 * DAY),
      },
      {
        fromUserId: alfa.managerId,
        toUserId: adam,
        text: "Vďaka za pokojné zvládnutie incidentu minulý týždeň.",
        emoji: "💪",
        value: "CUSTOMER",
        visibility: "PRIVATE",
        createdAt: new Date(Date.now() - 2 * DAY),
      },
    ],
  });

  const closed = await db.round.count({ where: { status: "CLOSED" } });
  const responses = await db.response.count();
  console.log(
    `Demo data done: ${closed} closed rounds, ${responses} responses, 1 open round for Tím Alfa.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
