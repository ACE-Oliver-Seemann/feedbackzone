import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getIssues, POST as postIssue } from "@/app/api/hr/issues/route";
import { POST as postKudos } from "@/app/api/kudos/route";
import { POST as login } from "@/app/api/login/route";
import { POST as logout } from "@/app/api/logout/route";
import { GET as me } from "@/app/api/me/route";
import { POST as postQuestion } from "@/app/api/questions/route";
import { POST as postResponse } from "@/app/api/rounds/[id]/responses/route";
import { POST as postRound } from "@/app/api/rounds/route";
import { GET as getSummary } from "@/app/api/teams/[id]/summary/route";
import { db } from "@/lib/db";
import { SESSION_COOKIE, createSessionToken, type SessionUser } from "@/lib/session";
import { charLength, cleanText } from "@/lib/text";
import { t } from "@/lib/texts.sk";
import { NextRequest } from "next/server";
import { listLatestClosedRoundActions } from "@/server/actions";
import { getHomeTasks } from "@/server/home";
import { PASSWORD, createRound, dateInDays, params, request, resetDb, type Fixture } from "./helpers";

// Regression tests for defects found by QA session 2026-11-12_001
// (testing/reports/2026-11-12_001/BUG_REGISTER.md).

let fx: Fixture;
beforeEach(async () => {
  fx = await resetDb();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const DAY = 24 * 60 * 60 * 1000;
const EMOJI = "😀";
const withCookie = (path: string, token: string, method = "GET") =>
  new NextRequest(`http://localhost${path}`, {
    method,
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
  });
const asUser = (user: { id: string; name: string; role: string; teamId: string | null }) =>
  ({ id: user.id, name: user.name, role: user.role, teamId: user.teamId }) as SessionUser;

describe("logout ends the session on the server [BUG-001, MVP-01]", () => {
  it("a cookie copied before logout stops working, a new login works", async () => {
    const stolen = createSessionToken(fx.a.manager.id, Date.now() - 1000);
    expect((await me(withCookie("/api/me", stolen), undefined)).status).toBe(200);

    expect((await logout(withCookie("/api/logout", stolen, "POST"), undefined)).status).toBe(200);
    expect((await me(withCookie("/api/me", stolen), undefined)).status).toBe(401);

    const again = await login(
      request("/api/login", {
        method: "POST",
        body: { email: fx.a.manager.email, password: PASSWORD },
      }),
      undefined,
    );
    expect(again.status).toBe(200);
    const fresh = /fz_session=([^;]+)/.exec(again.headers.get("set-cookie") ?? "")?.[1] ?? "";
    expect((await me(withCookie("/api/me", fresh), undefined)).status).toBe(200);
  });

  it("logging out one user does not log out another", async () => {
    const other = createSessionToken(fx.hr.id, Date.now() - 1000);
    await logout(request("/api/logout", { method: "POST", as: fx.a.manager }), undefined);
    expect((await me(withCookie("/api/me", other), undefined)).status).toBe(200);
  });
});

describe("a response cannot slip into a round that was just closed [BUG-002, MVP-09]", () => {
  const submit = (as: { id: string }, id: string) =>
    postResponse(
      request(`/api/rounds/${id}/responses`, { method: "POST", as, body: { answers: [3, 3, 3, 3] } }),
      params({ id }),
    );

  it("rejects the response when the round closes between the check and the write", async () => {
    const round = await createRound(fx, fx.a.team.id, "OPEN");
    const original = db.$transaction.bind(db);
    // The round is closed at the worst possible moment: after it was loaded as
    // open, right before the response is written.
    vi.spyOn(db, "$transaction").mockImplementationOnce(async (...args: unknown[]) => {
      await db.round.update({ where: { id: round.id }, data: { status: "CLOSED" } });
      return (original as (...a: unknown[]) => Promise<unknown>)(...args);
    });

    const response = await submit(fx.a.employees[0], round.id);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("round_closed");
    expect(await db.response.count()).toBe(0);
    expect(await db.participation.count()).toBe(0);
  });

  it("still stores exactly one response for a normal submission", async () => {
    const round = await createRound(fx, fx.a.team.id, "OPEN");
    expect((await submit(fx.a.employees[0], round.id)).status).toBe(201);
    expect((await submit(fx.a.employees[0], round.id)).status).toBe(409);
    expect(await db.response.count()).toBe(1);
    expect((await db.round.findUniqueOrThrow({ where: { id: round.id } })).status).toBe("OPEN");
  });

  it("five people submitting at the same moment are all stored once", async () => {
    const round = await createRound(fx, fx.a.team.id, "OPEN");
    const statuses = await Promise.all(
      fx.a.employees.map(async (employee) => (await submit(employee, round.id)).status),
    );
    expect(statuses).toEqual([201, 201, 201, 201, 201]);
    expect(await db.response.count()).toBe(5);
    expect(await db.participation.count()).toBe(5);
  });
});

describe("ill-formed text is refused, not a server error [BUG-003]", () => {
  const LONE = "\ud800";

  it("login with a lone surrogate returns 400", async () => {
    const response = await login(
      request("/api/login", { method: "POST", body: { email: `x${LONE}@example.test`, password: "x" } }),
      undefined,
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_text");
  });

  it("write endpoints return 400 and store nothing", async () => {
    const kudos = await postKudos(
      request("/api/kudos", {
        method: "POST",
        as: fx.a.employees[0],
        body: {
          toUserId: fx.a.employees[1].id,
          text: `Ďakujem za pomoc s nasadením ${LONE}`,
          value: "HELPING",
          visibility: "TEAM",
        },
      }),
      undefined,
    );
    expect(kudos.status).toBe(400);

    const round = await postRound(
      request("/api/rounds", {
        method: "POST",
        as: fx.hr,
        body: {
          name: `Kolo ${LONE}`,
          teamId: fx.a.team.id,
          closesAt: dateInDays(7),
          questionIds: fx.questions.slice(0, 3).map((question) => question.id),
          nested: { deep: [LONE] },
        },
      }),
      undefined,
    );
    expect(round.status).toBe(400);
    expect(await db.kudos.count()).toBe(0);
    expect(await db.round.count()).toBe(0);
  });
});

describe("own question cannot be duplicated by parallel requests [BUG-005, IT-07]", () => {
  it("five identical requests at once create exactly one question", async () => {
    const add = () =>
      postQuestion(
        request("/api/questions", {
          method: "POST",
          as: fx.a.manager,
          body: { text: "Rozdelenie úloh v tíme je spravodlivé." },
        }),
        undefined,
      );
    const statuses = (await Promise.all([add(), add(), add(), add(), add()])).map((r) => r.status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 400)).toHaveLength(4);
    expect(await db.question.count({ where: { teamId: fx.a.team.id } })).toBe(1);
  });
});

describe("length is counted in characters and invisible text is empty [BUG-006, BUG-007]", () => {
  it("helpers", () => {
    expect(charLength(EMOJI.repeat(3))).toBe(3);
    expect(charLength("ďakujem")).toBe(7);
    expect(cleanText("  text​  ")).toBe("text");
    expect(cleanText("​​﻿")).toBe("");
    expect(cleanText("‍ ‌")).toBe("");
    expect(cleanText(42)).toBe("");
    // A joined emoji keeps its joiner.
    expect(cleanText("👨‍👩‍👧")).toBe("👨‍👩‍👧");
  });

  it("a comment of 1000 emoji is accepted and one of 1001 is rejected [MVP-08]", async () => {
    const round = await createRound(fx, fx.a.team.id, "OPEN");
    const submit = (as: { id: string }, comment: string) =>
      postResponse(
        request(`/api/rounds/${round.id}/responses`, {
          method: "POST",
          as,
          body: { answers: [3, 3, 3, 3], comment },
        }),
        params({ id: round.id }),
      );
    expect((await submit(fx.a.employees[0], EMOJI.repeat(1000))).status).toBe(201);
    expect((await submit(fx.a.employees[1], EMOJI.repeat(1001))).status).toBe(400);
  });

  it("kudos and own questions count emoji as single characters [MVP-16, IT-07]", async () => {
    const kudos = (text: string) =>
      postKudos(
        request("/api/kudos", {
          method: "POST",
          as: fx.a.employees[0],
          body: { toUserId: fx.a.employees[1].id, text, value: "HELPING", visibility: "TEAM" },
        }),
        undefined,
      );
    expect((await kudos(EMOJI.repeat(10))).status).toBe(400); // 10 characters, minimum is 20
    expect((await kudos(EMOJI.repeat(20))).status).toBe(201);
    expect((await kudos(EMOJI.repeat(500))).status).toBe(201);
    expect((await kudos(EMOJI.repeat(501))).status).toBe(400);

    const question = (text: string) =>
      postQuestion(request("/api/questions", { method: "POST", as: fx.a.manager, body: { text } }), undefined);
    expect((await question(EMOJI.repeat(5))).status).toBe(400); // 5 characters, minimum is 10
  });

  it("text made only of invisible characters is treated as empty", async () => {
    const INVISIBLE = "​".repeat(30);
    const round = await postRound(
      request("/api/rounds", {
        method: "POST",
        as: fx.hr,
        body: {
          name: INVISIBLE,
          teamId: fx.a.team.id,
          closesAt: dateInDays(7),
          questionIds: fx.questions.slice(0, 3).map((question) => question.id),
        },
      }),
      undefined,
    );
    expect(round.status).toBe(400);
    expect((await round.json()).fields.name).toBe("required");

    const kudos = await postKudos(
      request("/api/kudos", {
        method: "POST",
        as: fx.a.employees[0],
        body: { toUserId: fx.a.employees[1].id, text: INVISIBLE, value: "HELPING", visibility: "TEAM" },
      }),
      undefined,
    );
    expect(kudos.status).toBe(400);

    const question = await postQuestion(
      request("/api/questions", { method: "POST", as: fx.a.manager, body: { text: INVISIBLE } }),
      undefined,
    );
    expect(question.status).toBe(400);
  });
});

describe("HR issues reject wrong types and unknown filters [BUG-008, BUG-009]", () => {
  const add = (body: Record<string, unknown>) =>
    postIssue(
      request("/api/hr/issues", {
        method: "POST",
        as: fx.hr,
        body: { title: "Podnet", source: "OTHER", ownerGroup: "FACILITY", ...body },
      }),
      undefined,
    );

  it.each([
    ["a numeric roundId", { roundId: 123 }],
    ["an array teamId", { teamId: ["x"] }],
    ["an object noteId", { noteId: {} }],
    ["a numeric description", { description: 5 }],
  ])("rejects %s instead of dropping it", async (_label, body) => {
    expect((await add(body)).status).toBe(400);
    expect(await db.issue.count()).toBe(0);
  });

  it("still accepts absent, null and empty optional fields", async () => {
    expect((await add({ roundId: null, teamId: "", noteId: undefined })).status).toBe(201);
  });

  it("an unknown filter value is an error", async () => {
    const list = (query: string) =>
      getIssues(request(`/api/hr/issues${query}`, { as: fx.hr }), undefined);
    expect((await list("?group=NOPE")).status).toBe(400);
    expect((await list("?status=NOPE")).status).toBe(400);
    expect((await list("?group=FACILITY&status=ACTIVE")).status).toBe(200);
    expect((await list("?status=ALL")).status).toBe(200);
    expect((await list("")).status).toBe(200);
  });
});

describe("a draft past its deadline does not hide 'start a round' [BUG-010, IT-11]", () => {
  it("the manager is still told to start a round", async () => {
    const draft = await createRound(fx, fx.a.team.id, "DRAFT");
    await db.round.update({ where: { id: draft.id }, data: { closesAt: new Date(Date.now() - DAY) } });
    const tasks = await getHomeTasks(asUser(fx.a.manager));
    expect(tasks.map((task) => task.kind)).toEqual(["start_round"]);
  });

  it("a draft that can still be opened keeps the task away", async () => {
    await createRound(fx, fx.a.team.id, "DRAFT");
    expect(await getHomeTasks(asUser(fx.a.manager))).toEqual([]);
  });
});

describe("'closed' is the moment of closing, not the deadline [BUG-019, BUG-020]", () => {
  async function closedRound(name: string, closedDaysAgo: number, deadlineInDays: number) {
    const round = await createRound(fx, fx.a.team.id, "CLOSED");
    return db.round.update({
      where: { id: round.id },
      data: {
        name,
        closedAt: new Date(Date.now() - closedDaysAgo * DAY),
        closesAt: new Date(Date.now() + deadlineInDays * DAY),
      },
    });
  }

  it("the team page orders and dates rounds by when they were closed", async () => {
    // Closed by hand long ago, although its deadline is the furthest in the future.
    const early = await closedRound("Uzavreté ručne dávno", 10, 30);
    const recent = await closedRound("Uzavreté včera", 1, 2);

    const body = await (
      await getSummary(
        request(`/api/teams/${fx.a.team.id}/summary`, { as: fx.a.employees[0] }),
        params({ id: fx.a.team.id }),
      )
    ).json();
    expect(body.rounds.map((round: { id: string }) => round.id)).toEqual([recent.id, early.id]);
    expect(new Date(body.rounds[1].closedAt).getTime()).toBeLessThan(Date.now());
  });

  it("the thank-you screen shows the actions of the round closed last [MVP-09]", async () => {
    const early = await closedRound("Uzavreté ručne dávno", 10, 30);
    const recent = await closedRound("Uzavreté včera", 1, 2);
    await db.action.create({
      data: { roundId: early.id, topic: "Starý", description: "Starý krok", dueDate: new Date() },
    });
    await db.action.create({
      data: { roundId: recent.id, topic: "Nový", description: "Nový krok", dueDate: new Date() },
    });
    const latest = await listLatestClosedRoundActions(asUser(fx.a.employees[0]), fx.a.team.id);
    expect(latest?.roundName).toBe("Uzavreté včera");
    expect(latest?.actions.map((action) => action.topic)).toEqual(["Nový"]);
  });
});

describe("public kudos needs a team page to appear on [BUG-024, MVP-17]", () => {
  const send = (visibility: string) =>
    postKudos(
      request("/api/kudos", {
        method: "POST",
        as: fx.a.employees[0],
        body: {
          toUserId: fx.hr.id,
          text: "Ďakujem za rýchle vybavenie žiadosti.",
          value: "HELPING",
          visibility,
        },
      }),
      undefined,
    );

  it("public kudos to a recipient without a team is refused with a reason", async () => {
    const response = await send("TEAM");
    expect(response.status).toBe(400);
    expect((await response.json()).fields.visibility).toBe("no_team");
    expect(await db.kudos.count()).toBe(0);
  });

  it("private kudos to the same recipient works", async () => {
    expect((await send("PRIVATE")).status).toBe(201);
  });
});

describe("Slovak plurals in generated sentences [BUG-015]", () => {
  it("days", () => {
    expect(t.home.tasks.roundAwaitingAction("Kolo", 1)).toContain("uzavreté 1 deň");
    expect(t.home.tasks.roundAwaitingAction("Kolo", 3)).toContain("uzavreté 3 dni");
    expect(t.home.tasks.roundAwaitingAction("Kolo", 5)).toContain("uzavreté 5 dní");
    expect(t.home.tasks.roundsAwaitingAction(2, "Tím Alfa", 2)).toContain("Tím Alfa, 2 dni.");
    expect(t.home.tasks.startRound(1)).toContain("pred 1 dňom");
    expect(t.home.tasks.startRound(0)).toContain("dnes");
    expect(t.hrOverview.awaitingSince(0)).toBe("uzavreté dnes");
    expect(t.home.tasks.lowParticipation("Kolo", "Tím", 1, 6, 5)).toContain("o 5 dní");
  });

  it("counts of rounds", () => {
    expect(t.hrOverview.headlineWaiting(1, 1, "Tím Alfa", 1)).toBe(
      "1 z 1 uzavretého kola čaká na krok. Najdlhšie Tím Alfa, 1 deň.",
    );
    expect(t.hrOverview.headlineWaiting(3, 8, "Tím Alfa", 4)).toContain("3 z 8 uzavretých kôl čakajú");
    expect(t.hrOverview.headlineWaiting(5, 8, "Tím Alfa", 7)).toContain("5 z 8 uzavretých kôl čaká na");
    expect(t.hrOverview.headlineAllDone(1)).toBe("Jediné uzavreté kolo má zapísaný krok.");
    expect(t.hrOverview.headlineAllDone(2)).toBe("Všetky 2 uzavreté kolá majú zapísaný krok.");
    expect(t.hrOverview.headlineAllDone(5)).toBe("Všetkých 5 uzavretých kôl má zapísaný krok.");
    expect(t.hrOverview.teamLine(1, 1)).toBe("Krok má 1 z 1 uzavretého kola.");
  });
});

// Regression tests for defects found by QA session 2026-11-12_002
// (testing/reports/2026-11-12_002/BUG_REGISTER.md).

describe("many submissions at once neither fail nor stall [BE2-001, MVP-09]", () => {
  const submit = (as: { id: string }, id: string) =>
    postResponse(
      request(`/api/rounds/${id}/responses`, { method: "POST", as, body: { answers: [3, 3, 3, 3] } }),
      params({ id }),
    );

  it("30 parallel submissions from six people: six stored, the rest refused, none fail", async () => {
    const round = await createRound(fx, fx.a.team.id, "OPEN");
    const people = [fx.a.manager, ...fx.a.employees];
    const responses = await Promise.all(
      Array.from({ length: 30 }, (_, index) => submit(people[index % people.length], round.id)),
    );
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(people.length);
    expect(statuses.filter((status) => status === 409)).toHaveLength(30 - people.length);
    expect(await db.response.count()).toBe(people.length);
    expect(await db.participation.count()).toBe(people.length);
  });

  it("a failed submission does not block the next one", async () => {
    const round = await createRound(fx, fx.a.team.id, "OPEN");
    vi.spyOn(db, "$transaction").mockImplementationOnce(async () => {
      throw new Error("database unavailable");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await submit(fx.a.employees[0], round.id)).status).toBe(500);
    expect((await submit(fx.a.employees[1], round.id)).status).toBe(201);
  });
});

describe("own questions differing only in case or Unicode form are one question [BE2-002, BE2-004, IT-07]", () => {
  const add = (text: string) =>
    postQuestion(request("/api/questions", { method: "POST", as: fx.a.manager, body: { text } }), undefined);

  it("five parallel requests with different letter case create one question", async () => {
    const variants = [
      "Porady v tíme majú jasný cieľ.",
      "PORADY V TÍME MAJÚ JASNÝ CIEĽ.",
      "porady v tíme majú jasný cieľ.",
      "Porady V Tíme Majú Jasný Cieľ.",
      "pORADY v TÍME majú JASNÝ cieľ.",
    ];
    const statuses = (await Promise.all(variants.map(add))).map((response) => response.status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 400)).toHaveLength(4);
    expect(await db.question.count({ where: { teamId: fx.a.team.id } })).toBe(1);
  });

  it("composed and decomposed accents are the same wording", async () => {
    const composed = "Úlohy v tíme sú rozdelené férovo.";
    expect((await add(composed)).status).toBe(201);
    expect((await add(composed.normalize("NFD"))).status).toBe(400);
  });
});

describe("more kinds of invisible text are treated as empty [BE2-003]", () => {
  it("helpers", () => {
    // Direction marks and overrides are removed, blank-looking letters alone are empty.
    expect(cleanText("‎ahoj‮")).toBe("ahoj");
    for (const blank of ["ㅤ", "⠀", "ᅟ", "ᅠ", "ﾠ", "‎", "‮"]) {
      expect(cleanText(blank.repeat(25))).toBe("");
    }
    expect(cleanText("á")).toBe("á");
    // Marks that only modify a neighbour are nothing on their own.
    for (const mark of [0x034f, 0xfe0f, 0xe0061]) {
      expect(cleanText(String.fromCodePoint(mark).repeat(25))).toBe("");
    }
    expect(cleanText(String.fromCodePoint(0x2764, 0xfe0f))).toBe(String.fromCodePoint(0x2764, 0xfe0f));
    // Emoji sequences and subdivision flags survive.
    expect(cleanText("👨‍👩‍👧")).toBe("👨‍👩‍👧");
    const scotland = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
    expect(cleanText(scotland)).toBe(scotland);
  });

  it("kudos made of blank braille patterns is refused", async () => {
    const response = await postKudos(
      request("/api/kudos", {
        method: "POST",
        as: fx.a.employees[0],
        body: { toUserId: fx.a.employees[1].id, text: "⠀".repeat(30), value: "HELPING", visibility: "TEAM" },
      }),
      undefined,
    );
    expect(response.status).toBe(400);
    expect(await db.kudos.count()).toBe(0);
  });
});
