import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postResponse } from "@/app/api/rounds/[id]/responses/route";
import { GET as getRound } from "@/app/api/rounds/[id]/route";
import { GET as getRounds } from "@/app/api/rounds/route";
import { db } from "@/lib/db";
import { createRound, params, request, resetDb, type Fixture } from "./helpers";

let fx: Fixture;
beforeEach(async () => {
  fx = await resetDb();
});
afterEach(() => {
  vi.restoreAllMocks();
});

type User = { id: string };

const submit = (as: User | undefined, id: string, body: unknown = { answers: [4, 3, 5, 2] }) =>
  postResponse(
    request(`/api/rounds/${id}/responses`, { method: "POST", as, body }),
    params({ id }),
  );

const read = (as: User | undefined, id: string) =>
  getRound(request(`/api/rounds/${id}`, { as }), params({ id }));

const counts = async () => ({
  participations: await db.participation.count(),
  responses: await db.response.count(),
});

describe("questions of a round [MVP-08]", () => {
  it("returns the questions in order to a team member", async () => {
    const round = await createRound(fx, fx.a.team.id);
    const response = await read(fx.a.employees[0], round.id);
    expect(response.status).toBe(200);
    const body = (await response.json()).round;
    expect(body.submitted).toBe(false);
    expect(body.questions).toEqual(
      fx.questions.slice(0, 4).map((question, index) => ({
        position: index + 1,
        text: question.text,
      })),
    );
  });

  it("the manager fills in the round of their own team too", async () => {
    const round = await createRound(fx, fx.a.team.id);
    expect((await read(fx.a.manager, round.id)).status).toBe(200);
    expect((await submit(fx.a.manager, round.id)).status).toBe(201);
  });

  it("hides a draft from the team", async () => {
    const round = await createRound(fx, fx.a.team.id, "DRAFT");
    expect((await read(fx.a.employees[0], round.id)).status).toBe(404);
    expect((await submit(fx.a.employees[0], round.id)).status).toBe(404);
  });
});

describe("submit a response [MVP-09]", () => {
  it("stores exactly one participation and one response", async () => {
    const round = await createRound(fx, fx.a.team.id);
    const response = await submit(fx.a.employees[0], round.id, {
      answers: [4, 3, 5, 2],
      comment: "  Testovací komentár.  ",
    });
    expect(response.status).toBe(201);
    expect(await counts()).toEqual({ participations: 1, responses: 1 });

    const stored = await db.response.findFirstOrThrow();
    expect(stored).toMatchObject({
      roundId: round.id,
      teamId: fx.a.team.id,
      v1: 4,
      v2: 3,
      v3: 5,
      v4: 2,
      v5: null,
      comment: "Testovací komentár.",
    });
  });

  it("rejects a second submission to the same round with 409", async () => {
    const round = await createRound(fx, fx.a.team.id);
    const employee = fx.a.employees[0];
    expect((await submit(employee, round.id)).status).toBe(201);

    const second = await submit(employee, round.id, { answers: [1, 1, 1, 1] });
    expect(second.status).toBe(409);
    expect((await second.json()).error).toBe("already_submitted");
    expect(await counts()).toEqual({ participations: 1, responses: 1 });
    expect((await db.response.findFirstOrThrow()).v1).toBe(4);
  });

  it("marks the round as submitted in the list and in the detail [MVP-06]", async () => {
    const round = await createRound(fx, fx.a.team.id);
    const employee = fx.a.employees[0];
    await submit(employee, round.id);

    const list = await (await getRounds(request("/api/rounds", { as: employee }), undefined)).json();
    expect(list.rounds[0].submitted).toBe(true);
    expect((await (await read(employee, round.id)).json()).round.submitted).toBe(true);

    const other = await (
      await getRounds(request("/api/rounds", { as: fx.a.employees[1] }), undefined)
    ).json();
    expect(other.rounds[0].submitted).toBe(false);
  });

  it("rejects a response to a closed round", async () => {
    const round = await createRound(fx, fx.a.team.id, "CLOSED");
    const response = await submit(fx.a.employees[0], round.id);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("round_closed");
    expect(await counts()).toEqual({ participations: 0, responses: 0 });
  });

  it("rejects a response after the deadline even if nobody closed the round", async () => {
    const round = await createRound(fx, fx.a.team.id);
    await db.round.update({
      where: { id: round.id },
      data: { closesAt: new Date(Date.now() - 1000) },
    });
    expect((await submit(fx.a.employees[0], round.id)).status).toBe(409);
    expect(await counts()).toEqual({ participations: 0, responses: 0 });
  });

  it.each([
    ["too few answers", { answers: [4, 3, 5] }],
    ["too many answers", { answers: [4, 3, 5, 2, 1] }],
    ["value 0", { answers: [0, 3, 5, 2] }],
    ["value 6", { answers: [6, 3, 5, 2] }],
    ["fraction", { answers: [3.5, 3, 5, 2] }],
    ["string value", { answers: ["4", 3, 5, 2] }],
    ["null value", { answers: [null, 3, 5, 2] }],
    ["missing answers", {}],
    ["comment over 1000 characters", { answers: [4, 3, 5, 2], comment: "x".repeat(1001) }],
    ["comment of a wrong type", { answers: [4, 3, 5, 2], comment: 42 }],
  ])("rejects %s and stores nothing", async (_label, body) => {
    const round = await createRound(fx, fx.a.team.id);
    expect((await submit(fx.a.employees[0], round.id, body)).status).toBe(400);
    expect(await counts()).toEqual({ participations: 0, responses: 0 });
  });

  it("accepts a comment of exactly 1000 characters and an empty comment", async () => {
    const round = await createRound(fx, fx.a.team.id);
    expect(
      (await submit(fx.a.employees[0], round.id, { answers: [4, 3, 5, 2], comment: "x".repeat(1000) }))
        .status,
    ).toBe(201);
    expect(
      (await submit(fx.a.employees[1], round.id, { answers: [4, 3, 5, 2], comment: "   " })).status,
    ).toBe(201);
    const comments = (await db.response.findMany()).map((response) => response.comment);
    expect(comments.filter((comment) => comment === null)).toHaveLength(1);
  });

  it("works with 3 and with 5 questions", async () => {
    const three = await createRound(fx, fx.a.team.id, "OPEN", 3);
    const five = await createRound(fx, fx.a.team.id, "OPEN", 5);
    expect((await submit(fx.a.employees[0], three.id, { answers: [1, 2, 3] })).status).toBe(201);
    expect((await submit(fx.a.employees[0], five.id, { answers: [1, 2, 3, 4, 5] })).status).toBe(201);
    expect((await submit(fx.a.employees[1], three.id, { answers: [1, 2, 3, 4] })).status).toBe(400);
  });

  it("the database itself rejects values outside 1–5 [MVP-08]", async () => {
    const round = await createRound(fx, fx.a.team.id);
    const base = { roundId: round.id, teamId: fx.a.team.id, v1: 3, v2: 3, v3: 3 };
    await expect(db.response.create({ data: { ...base, v1: 6 } })).rejects.toThrow();
    await expect(db.response.create({ data: { ...base, v2: 0 } })).rejects.toThrow();
    await expect(db.response.create({ data: { ...base, v4: 9 } })).rejects.toThrow();
    await expect(
      db.response.create({ data: { ...base, comment: "x".repeat(1001) } }),
    ).rejects.toThrow();
    expect(await db.response.count()).toBe(0);
  });
});

describe("response permissions [NFR-03]", () => {
  it("returns 401 without a session", async () => {
    const round = await createRound(fx, fx.a.team.id);
    expect((await read(undefined, round.id)).status).toBe(401);
    expect((await submit(undefined, round.id)).status).toBe(401);
  });

  it("a member of team B cannot read or answer a round of team A", async () => {
    const round = await createRound(fx, fx.a.team.id);
    for (const user of [fx.b.employees[0], fx.b.manager]) {
      expect((await read(user, round.id)).status).toBe(403);
      expect((await submit(user, round.id)).status).toBe(403);
    }
    expect(await counts()).toEqual({ participations: 0, responses: 0 });
  });

  it("HR cannot fill in a round", async () => {
    const round = await createRound(fx, fx.a.team.id);
    expect((await read(fx.hr, round.id)).status).toBe(403);
    expect((await submit(fx.hr, round.id)).status).toBe(403);
    expect(await counts()).toEqual({ participations: 0, responses: 0 });
  });

  it("an unknown round looks the same as a foreign one", async () => {
    expect((await read(fx.a.employees[0], "no-such-round")).status).toBe(403);
  });
});

describe("a response cannot be linked to a user [NFR-01]", () => {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("after 5 responses the database holds nothing that tells who sent which", async () => {
    const round = await createRound(fx, fx.a.team.id);
    const answers = [
      [1, 1, 1, 1],
      [2, 2, 2, 2],
      [3, 3, 3, 3],
      [4, 4, 4, 4],
      [5, 5, 5, 5],
    ];
    for (const [index, employee] of fx.a.employees.entries()) {
      const response = await submit(employee, round.id, {
        answers: answers[index],
        comment: `Komentár ${index + 1}`,
      });
      expect(response.status).toBe(201);
    }

    // Raw rows, exactly as stored — every column of the Response table.
    const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM "Response"`);
    expect(rows).toHaveLength(5);

    const userIds = (await db.user.findMany({ select: { id: true } })).map((user) => user.id);
    const userData = await db.user.findMany({ select: { name: true, email: true } });
    for (const row of rows) {
      // Only content columns exist; no user, no time.
      expect(Object.keys(row).sort()).toEqual(
        ["comment", "id", "roundId", "teamId", "v1", "v2", "v3", "v4", "v5"].sort(),
      );
      // The id is a random UUID, not a sequence number.
      expect(row.id).toMatch(UUID_V4);
      // No value in the row is a user id, name or e-mail.
      for (const value of Object.values(row)) {
        expect(userIds).not.toContain(value);
        for (const user of userData) {
          expect(String(value)).not.toContain(user.email);
          expect(String(value)).not.toContain(user.name);
        }
      }
    }

    // Participation says who answered, but carries no content and no order.
    const participations = await db.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "Participation"`,
    );
    expect(participations).toHaveLength(5);
    for (const row of participations) {
      expect(Object.keys(row).sort()).toEqual(["roundId", "userId"]);
    }

    // The storage order of responses is by random id, not by submission order,
    // and there is no rowid to fall back on.
    const storedOrder = rows.map((row) => row.id);
    expect(storedOrder).toEqual([...storedOrder].sort());
    await expect(db.$queryRawUnsafe(`SELECT rowid FROM "Response"`)).rejects.toThrow();
    await expect(db.$queryRawUnsafe(`SELECT rowid FROM "Participation"`)).rejects.toThrow();

    // No other table references a response.
    const referencing = await db.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name != 'Response' AND sql LIKE '%REFERENCES "Response"%'`,
    );
    expect(referencing).toEqual([]);
  });

  it("the reply to a submission carries no response id and no user data", async () => {
    const round = await createRound(fx, fx.a.team.id);
    const response = await submit(fx.a.employees[0], round.id);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("server logs never contain the body of a response", async () => {
    const logged: string[] = [];
    for (const method of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(" "));
      });
    }
    const secret = "TAJNY-KOMENTAR-12345";
    const round = await createRound(fx, fx.a.team.id);
    const employee = fx.a.employees[0];

    await submit(employee, round.id, { answers: [4, 3, 5, 2], comment: secret }); // success
    await submit(employee, round.id, { answers: [4, 3, 5, 2], comment: secret }); // 409
    await submit(fx.a.employees[1], round.id, { answers: [9, 3, 5, 2], comment: secret }); // 400
    await submit(fx.b.employees[0], round.id, { answers: [4, 3, 5, 2], comment: secret }); // 403

    // Force an unexpected failure inside the handler → the 500 path logs.
    vi.spyOn(db, "$transaction").mockRejectedValueOnce(
      new Error(`boom with ${secret} and answers 4,3,5,2`),
    );
    const failed = await submit(fx.a.employees[2], round.id, {
      answers: [4, 3, 5, 2],
      comment: secret,
    });
    expect(failed.status).toBe(500);
    expect(JSON.stringify(await failed.json())).not.toContain(secret);

    expect(logged.length).toBeGreaterThan(0); // the 500 was logged…
    expect(logged.join("\n")).not.toContain(secret); // …without the body
    expect(logged.join("\n")).toContain("/api/rounds/");
  });
});
