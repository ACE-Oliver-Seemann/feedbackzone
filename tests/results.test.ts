import { beforeEach, describe, expect, it } from "vitest";
import { POST as postResponse } from "@/app/api/rounds/[id]/responses/route";
import { GET as getResults } from "@/app/api/rounds/[id]/results/route";
import { MIN_GROUP_SIZE } from "@/config/privacy";
import { db } from "@/lib/db";
import { createRound, params, request, resetDb, type Fixture } from "./helpers";

let fx: Fixture;
beforeEach(async () => {
  fx = await resetDb();
});

type User = { id: string };

const results = (as: User | undefined, id: string) =>
  getResults(request(`/api/rounds/${id}/results`, { as }), params({ id }));

/** Team members of team A in a fixed order: 5 employees, then the manager. */
const members = () => [...fx.a.employees, fx.a.manager];

/** Opens a round of team A, collects `count` responses and closes it. */
async function closedRoundWith(count: number, answers?: number[][], comments?: (string | null)[]) {
  const round = await createRound(fx, fx.a.team.id);
  for (let index = 0; index < count; index++) {
    const response = await postResponse(
      request(`/api/rounds/${round.id}/responses`, {
        method: "POST",
        as: members()[index],
        body: { answers: answers?.[index] ?? [3, 3, 3, 3], comment: comments?.[index] ?? null },
      }),
      params({ id: round.id }),
    );
    expect(response.status).toBe(201);
  }
  await db.round.update({ where: { id: round.id }, data: { status: "CLOSED" } });
  return round;
}

describe("confidentiality threshold [NFR-02, MVP-11]", () => {
  it("the team fixture is large enough to test the boundary", () => {
    expect(members().length).toBeGreaterThanOrEqual(MIN_GROUP_SIZE);
  });

  it(`hides everything with MIN_GROUP_SIZE - 1 responses`, async () => {
    const below = MIN_GROUP_SIZE - 1;
    const round = await closedRoundWith(
      below,
      undefined,
      Array.from({ length: below }, (_, index) => `Skrytý komentár ${index}`),
    );
    const response = await results(fx.a.manager, round.id);
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.status).toBe("insufficient_responses");
    expect(body.responseCount).toBe(below);
    // Nothing but the state, the count and round metadata.
    expect(Object.keys(body).sort()).toEqual(
      ["participation", "responseCount", "round", "status"].sort(),
    );
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("Skrytý komentár");
    expect(raw).not.toContain("average");
    expect(raw).not.toContain("distribution");
    expect(raw).not.toContain("comments");
    expect(raw).not.toContain("questions");
  });

  it(`shows results with exactly MIN_GROUP_SIZE responses`, async () => {
    const round = await closedRoundWith(MIN_GROUP_SIZE);
    const body = await (await results(fx.a.manager, round.id)).json();
    expect(body.status).toBe("ok");
    expect(body.responseCount).toBe(MIN_GROUP_SIZE);
    expect(body.questions).toHaveLength(4);
  });

  it("applies the same threshold to HR [MVP-12]", async () => {
    const below = await closedRoundWith(MIN_GROUP_SIZE - 1);
    expect((await (await results(fx.hr, below.id)).json()).status).toBe("insufficient_responses");
  });

  it("hides everything for a closed round with no responses", async () => {
    const round = await closedRoundWith(0);
    const body = await (await results(fx.a.manager, round.id)).json();
    expect(body).toMatchObject({ status: "insufficient_responses", responseCount: 0 });
  });
});

describe("round results [MVP-10]", () => {
  it("returns participation, averages, distributions and comments", async () => {
    const round = await closedRoundWith(
      5,
      [
        [1, 5, 3, 2],
        [2, 5, 3, 2],
        [3, 5, 3, 4],
        [4, 5, 3, 4],
        [5, 5, 4, 5],
      ],
      ["Prvý", null, "Druhý", null, "Tretí"],
    );
    const body = await (await results(fx.a.manager, round.id)).json();

    expect(body.participation).toEqual({ responded: 5, teamSize: 6 });
    expect(body.round).toMatchObject({ id: round.id, status: "CLOSED", teamId: fx.a.team.id });
    expect(body.questions).toEqual([
      { position: 1, text: fx.questions[0].text, average: 3, distribution: [1, 1, 1, 1, 1] },
      { position: 2, text: fx.questions[1].text, average: 5, distribution: [0, 0, 0, 0, 5] },
      { position: 3, text: fx.questions[2].text, average: 3.2, distribution: [0, 0, 4, 1, 0] },
      { position: 4, text: fx.questions[3].text, average: 3.4, distribution: [0, 2, 0, 2, 1] },
    ]);
    expect([...body.comments].sort()).toEqual(["Druhý", "Prvý", "Tretí"]);
  });

  it("returns comments in a random order", async () => {
    const texts = Array.from({ length: 6 }, (_, index) => `Komentár ${index}`);
    const round = await closedRoundWith(6, undefined, texts);

    const orders = new Set<string>();
    for (let attempt = 0; attempt < 12; attempt++) {
      const body = await (await results(fx.a.manager, round.id)).json();
      expect([...body.comments].sort()).toEqual(texts);
      orders.add(body.comments.join("|"));
    }
    // 12 draws from 720 permutations: one single order would mean no shuffling.
    expect(orders.size).toBeGreaterThan(1);
  });

  it("shows only participation while the round is open", async () => {
    const round = await createRound(fx, fx.a.team.id);
    for (const employee of fx.a.employees) {
      await postResponse(
        request(`/api/rounds/${round.id}/responses`, {
          method: "POST",
          as: employee,
          body: { answers: [5, 5, 5, 5], comment: "Ešte nie" },
        }),
        params({ id: round.id }),
      );
    }
    const body = await (await results(fx.a.manager, round.id)).json();
    expect(body.status).toBe("not_closed");
    expect(body.participation).toEqual({ responded: 5, teamSize: 6 });
    expect(Object.keys(body).sort()).toEqual(["participation", "round", "status"]);
    expect(JSON.stringify(body)).not.toContain("Ešte nie");
  });

  it("never contains the id, name or e-mail of anyone who answered [NFR-01]", async () => {
    const round = await closedRoundWith(6, undefined, ["a", "b", "c", "d", "e", "f"]);
    const raw = JSON.stringify(await (await results(fx.hr, round.id)).json());
    for (const user of await db.user.findMany()) {
      expect(raw).not.toContain(user.id);
      expect(raw).not.toContain(user.email);
      expect(raw).not.toContain(user.name);
    }
    for (const response of await db.response.findMany({ select: { id: true } })) {
      expect(raw).not.toContain(response.id);
    }
  });
});

describe("results permissions [NFR-03]", () => {
  it("the manager of team B gets 403 on the results of team A", async () => {
    const round = await closedRoundWith(MIN_GROUP_SIZE);
    const response = await results(fx.b.manager, round.id);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
  });

  it("the manager of team A and HR get 200", async () => {
    const round = await closedRoundWith(MIN_GROUP_SIZE);
    expect((await results(fx.a.manager, round.id)).status).toBe(200);
    expect((await results(fx.hr, round.id)).status).toBe(200);
  });

  it("an employee gets 403 even for their own team", async () => {
    const round = await closedRoundWith(MIN_GROUP_SIZE);
    expect((await results(fx.a.employees[0], round.id)).status).toBe(403);
  });

  it("returns 401 without a session", async () => {
    const round = await closedRoundWith(MIN_GROUP_SIZE);
    expect((await results(undefined, round.id)).status).toBe(401);
  });

  it("an unknown round is 403 for a manager and 404 for HR", async () => {
    expect((await results(fx.a.manager, "no-such-round")).status).toBe(403);
    expect((await results(fx.hr, "no-such-round")).status).toBe(404);
  });
});
