import type { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import { PATCH as patchAction } from "@/app/api/actions/[id]/route";
import { GET as getMyKudos } from "@/app/api/kudos/me/route";
import { POST as postKudos } from "@/app/api/kudos/route";
import { POST as logout } from "@/app/api/logout/route";
import { GET as getMe } from "@/app/api/me/route";
import { GET as getQuestions } from "@/app/api/questions/route";
import { POST as postAction } from "@/app/api/rounds/[id]/actions/route";
import { POST as closeRound } from "@/app/api/rounds/[id]/close/route";
import { POST as openRound } from "@/app/api/rounds/[id]/open/route";
import { POST as postResponse } from "@/app/api/rounds/[id]/responses/route";
import { GET as getResults } from "@/app/api/rounds/[id]/results/route";
import { GET as getRound } from "@/app/api/rounds/[id]/route";
import { GET as getRounds, POST as postRound } from "@/app/api/rounds/route";
import { GET as getSummary } from "@/app/api/teams/[id]/summary/route";
import { db } from "@/lib/db";
import { createRound, dateInDays, params, request, resetDb, type Fixture } from "./helpers";

// NFR-03 / MVP-03: the permission matrix from mvp.md, checked for every
// endpoint and every kind of user. All targets belong to team A.
//
// Expected status per actor:
//   anon | employee A | manager A | employee B | manager B | HR

type Handler = (request: NextRequest, context: never) => Promise<Response>;
type Actor = "anon" | "employeeA" | "managerA" | "employeeB" | "managerB" | "hr";
const ACTORS: Actor[] = ["anon", "employeeA", "managerA", "employeeB", "managerB", "hr"];

type Case = {
  name: string;
  /** Fresh state per actor, so that one actor's success cannot affect the next. */
  call: (as: { id: string } | undefined) => Promise<Response>;
  expected: Record<Actor, number>;
};

let fx: Fixture;
let actors: Record<Actor, { id: string } | undefined>;

beforeAll(async () => {
  fx = await resetDb();
  actors = {
    anon: undefined,
    employeeA: fx.a.employees[0],
    managerA: fx.a.manager,
    employeeB: fx.b.employees[0],
    managerB: fx.b.manager,
    hr: fx.hr,
  };
});

const invoke = (
  handler: unknown,
  path: string,
  as: { id: string } | undefined,
  options: { method?: string; body?: unknown; id?: string } = {},
) =>
  (handler as Handler)(
    request(path, { method: options.method, as, body: options.body }),
    (options.id ? params({ id: options.id }) : undefined) as never,
  );

const status = (codes: [number, number, number, number, number, number]) =>
  Object.fromEntries(ACTORS.map((actor, index) => [actor, codes[index]])) as Record<Actor, number>;

const CASES: Case[] = [
  {
    name: "GET /api/me",
    call: (as) => invoke(getMe, "/api/me", as),
    expected: status([401, 200, 200, 200, 200, 200]),
  },
  {
    name: "POST /api/logout",
    call: (as) => invoke(logout, "/api/logout", as, { method: "POST" }),
    expected: status([401, 200, 200, 200, 200, 200]),
  },
  {
    name: "GET /api/questions",
    call: (as) => invoke(getQuestions, "/api/questions", as),
    expected: status([401, 403, 200, 403, 200, 200]),
  },
  {
    name: "GET /api/rounds",
    call: (as) => invoke(getRounds, "/api/rounds", as),
    expected: status([401, 200, 200, 200, 200, 200]),
  },
  {
    name: "POST /api/rounds (for team A)",
    call: (as) =>
      invoke(postRound, "/api/rounds", as, {
        method: "POST",
        body: {
          name: "Pulse",
          teamId: fx.a.team.id,
          closesAt: dateInDays(7),
          questionIds: fx.questions.slice(0, 3).map((question) => question.id),
        },
      }),
    expected: status([401, 403, 201, 403, 403, 201]),
  },
  {
    name: "POST /api/rounds/:id/open",
    call: async (as) => {
      const round = await createRound(fx, fx.a.team.id, "DRAFT");
      return invoke(openRound, `/api/rounds/${round.id}/open`, as, { method: "POST", id: round.id });
    },
    expected: status([401, 403, 200, 403, 403, 200]),
  },
  {
    name: "POST /api/rounds/:id/close",
    call: async (as) => {
      const round = await createRound(fx, fx.a.team.id, "OPEN");
      return invoke(closeRound, `/api/rounds/${round.id}/close`, as, { method: "POST", id: round.id });
    },
    expected: status([401, 403, 200, 403, 403, 200]),
  },
  {
    name: "GET /api/rounds/:id (questions to fill in)",
    call: async (as) => {
      const round = await createRound(fx, fx.a.team.id, "OPEN");
      return invoke(getRound, `/api/rounds/${round.id}`, as, { id: round.id });
    },
    expected: status([401, 200, 200, 403, 403, 403]),
  },
  {
    name: "POST /api/rounds/:id/responses",
    call: async (as) => {
      const round = await createRound(fx, fx.a.team.id, "OPEN");
      return invoke(postResponse, `/api/rounds/${round.id}/responses`, as, {
        method: "POST",
        id: round.id,
        body: { answers: [3, 3, 3, 3] },
      });
    },
    expected: status([401, 201, 201, 403, 403, 403]),
  },
  {
    name: "GET /api/rounds/:id/results",
    call: async (as) => {
      const round = await createRound(fx, fx.a.team.id, "CLOSED");
      return invoke(getResults, `/api/rounds/${round.id}/results`, as, { id: round.id });
    },
    expected: status([401, 403, 200, 403, 403, 200]),
  },
  {
    name: "POST /api/rounds/:id/actions",
    call: async (as) => {
      const round = await createRound(fx, fx.a.team.id, "CLOSED");
      return invoke(postAction, `/api/rounds/${round.id}/actions`, as, {
        method: "POST",
        id: round.id,
        body: { topic: "Téma", description: "Čo sa urobí", dueDate: dateInDays(7) },
      });
    },
    expected: status([401, 403, 201, 403, 403, 403]),
  },
  {
    name: "PATCH /api/actions/:id",
    call: async (as) => {
      const round = await createRound(fx, fx.a.team.id, "CLOSED");
      const action = await db.action.create({
        data: { roundId: round.id, topic: "Téma", description: "Opis", dueDate: new Date() },
      });
      return invoke(patchAction, `/api/actions/${action.id}`, as, {
        method: "PATCH",
        id: action.id,
        body: { status: "DONE" },
      });
    },
    expected: status([401, 403, 200, 403, 403, 403]),
  },
  {
    name: "GET /api/teams/:id/summary",
    call: (as) => invoke(getSummary, `/api/teams/${fx.a.team.id}/summary`, as, { id: fx.a.team.id }),
    expected: status([401, 200, 200, 403, 403, 200]),
  },
  {
    name: "POST /api/kudos",
    call: (as) =>
      invoke(postKudos, "/api/kudos", as, {
        method: "POST",
        body: {
          toUserId: fx.a.employees[4].id,
          text: "Ďakujem za pomoc s testovaním.",
          value: "HELPING",
          visibility: "TEAM",
        },
      }),
    expected: status([401, 201, 201, 201, 201, 201]),
  },
  {
    name: "GET /api/kudos/me",
    call: (as) => invoke(getMyKudos, "/api/kudos/me", as),
    expected: status([401, 200, 200, 200, 200, 200]),
  },
];

describe("permission matrix on every endpoint [NFR-03, MVP-03]", () => {
  for (const testCase of CASES) {
    it(testCase.name, async () => {
      const actual: Record<string, number> = {};
      for (const actor of ACTORS) {
        actual[actor] = (await testCase.call(actors[actor])).status;
      }
      expect(actual).toEqual(testCase.expected);
    });
  }

  it("covers every API route file in the project", async () => {
    const { readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const routes = (directory: string): string[] =>
      readdirSync(directory).flatMap((name) => {
        const path = join(directory, name);
        if (statSync(path).isDirectory()) return routes(path);
        return name === "route.ts" ? [path.replaceAll("\\", "/")] : [];
      });
    // login is public by design; every other route file must have a case above.
    const files = routes("src/app/api").filter((path) => !path.endsWith("api/login/route.ts"));
    const covered = new Set(
      CASES.map((testCase) =>
        testCase.name
          .replace(/^\w+ /, "")
          .replace(/ \(.*\)$/, "")
          .replaceAll(":id", "[id]"),
      ),
    );
    const uncovered = files
      .map((path) => path.replace("src/app", "").replace("/route.ts", ""))
      .filter((path) => !covered.has(path));
    expect(uncovered).toEqual([]);
  });
});
