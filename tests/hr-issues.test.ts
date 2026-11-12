import { beforeEach, describe, expect, it } from "vitest";
import { PATCH as patchIssue } from "@/app/api/hr/issues/[id]/route";
import { GET as getIssues, POST as postIssue } from "@/app/api/hr/issues/route";
import { GET as getNotes, POST as postNote } from "@/app/api/hr/notes/route";
import { db } from "@/lib/db";
import { createRound, dateInDays, params, request, resetDb, type Fixture } from "./helpers";

// IT-10: HR's issues and notes from offline meetings.

let fx: Fixture;
beforeEach(async () => {
  fx = await resetDb();
});

type User = { id: string };

const VALID = { title: "Nefunguje klimatizácia", source: "MEETING", ownerGroup: "FACILITY" };

const addIssue = (as: User | undefined, overrides: Record<string, unknown> = {}) =>
  postIssue(
    request("/api/hr/issues", { method: "POST", as, body: { ...VALID, ...overrides } }),
    undefined,
  );

const list = async (query = "") =>
  (await (await getIssues(request(`/api/hr/issues${query}`, { as: fx.hr }), undefined)).json())
    .issues as Array<Record<string, unknown>>;

const patch = (as: User | undefined, id: string, body: unknown) =>
  patchIssue(request(`/api/hr/issues/${id}`, { method: "PATCH", as, body }), params({ id }));

const addNote = (as: User | undefined, overrides: Record<string, unknown> = {}) =>
  postNote(
    request("/api/hr/notes", {
      method: "POST",
      as,
      body: {
        title: "Stretnutie s tímom",
        meetingDate: dateInDays(-2),
        text: "V zasadačke je teplo.",
        ...overrides,
      },
    }),
    undefined,
  );

describe("HR issues [IT-10]", () => {
  it("HR adds an issue with defaults", async () => {
    const response = await addIssue(fx.hr, { description: "  Nechladí druhý týždeň.  " });
    expect(response.status).toBe(201);
    expect((await response.json()).issue).toMatchObject({
      title: "Nefunguje klimatizácia",
      description: "Nechladí druhý týždeň.",
      source: "MEETING",
      ownerGroup: "FACILITY",
      status: "OPEN",
      dueDate: null,
      round: null,
      team: null,
      note: null,
    });
    expect((await db.issue.findFirstOrThrow()).createdById).toBe(fx.hr.id);
  });

  it("an issue raised from a round takes the team of that round", async () => {
    const round = await createRound(fx, fx.a.team.id, "CLOSED");
    const response = await addIssue(fx.hr, {
      source: "SURVEY",
      roundId: round.id,
      teamId: fx.b.team.id, // ignored: the round decides
    });
    const { issue } = await response.json();
    expect(issue.round).toEqual({ id: round.id, name: round.name });
    expect(issue.team).toEqual({ id: fx.a.team.id, name: fx.a.team.name });
  });

  it("an issue can be linked to a team only, and to a note", async () => {
    const { note } = await (await addNote(fx.hr)).json();
    const { issue } = await (
      await addIssue(fx.hr, { teamId: fx.b.team.id, noteId: note.id, dueDate: dateInDays(7) })
    ).json();
    expect(issue.team).toEqual({ id: fx.b.team.id, name: fx.b.team.name });
    expect(issue.note).toEqual({ id: note.id, title: "Stretnutie s tímom" });
    expect(issue.dueDate).not.toBeNull();
  });

  it.each([
    ["a title under 3 characters", { title: "Ab" }],
    ["a title over 120 characters", { title: "x".repeat(121) }],
    ["a description over 2000 characters", { description: "x".repeat(2001) }],
    ["an unknown source", { source: "RUMOUR" }],
    ["an unknown owner group", { ownerGroup: "NOBODY" }],
    ["an invalid due date", { dueDate: "2026-02-31" }],
    ["an unknown round", { roundId: "no-such-round" }],
    ["an unknown team", { teamId: "no-such-team" }],
    ["an unknown note", { noteId: "no-such-note" }],
  ])("rejects %s", async (_label, override) => {
    expect((await addIssue(fx.hr, override)).status).toBe(400);
    expect(await db.issue.count()).toBe(0);
  });

  it("status, owner group and due date can be changed", async () => {
    const { issue } = await (await addIssue(fx.hr)).json();

    const moved = await patch(fx.hr, issue.id, { status: "IN_PROGRESS", ownerGroup: "IT_SUPPORT" });
    expect(moved.status).toBe(200);
    expect((await moved.json()).issue).toMatchObject({
      status: "IN_PROGRESS",
      ownerGroup: "IT_SUPPORT",
    });

    const dated = await patch(fx.hr, issue.id, { dueDate: dateInDays(3) });
    expect((await dated.json()).issue.dueDate).not.toBeNull();
    const cleared = await patch(fx.hr, issue.id, { dueDate: null });
    expect((await cleared.json()).issue.dueDate).toBeNull();
  });

  it("rejects an invalid update and keeps the issue unchanged", async () => {
    const { issue } = await (await addIssue(fx.hr)).json();
    expect((await patch(fx.hr, issue.id, { status: "CANCELLED" })).status).toBe(400);
    expect((await patch(fx.hr, issue.id, { ownerGroup: "NOBODY" })).status).toBe(400);
    expect((await patch(fx.hr, issue.id, {})).status).toBe(400);
    expect((await patch(fx.hr, "no-such-issue", { status: "DONE" })).status).toBe(404);
    expect(await db.issue.findUniqueOrThrow({ where: { id: issue.id } })).toMatchObject({
      status: "OPEN",
      ownerGroup: "FACILITY",
    });
  });

  it("lists newest first and filters by owner group and status", async () => {
    await addIssue(fx.hr, { title: "Klíma", ownerGroup: "FACILITY" });
    await db.issue.updateMany({ data: { createdAt: new Date(Date.now() - 60_000) } });
    const { issue: laptop } = await (
      await addIssue(fx.hr, { title: "Pomalé notebooky", ownerGroup: "IT_SUPPORT" })
    ).json();
    await patch(fx.hr, laptop.id, { status: "DONE" });

    expect((await list()).map((item) => item.title)).toEqual(["Pomalé notebooky", "Klíma"]);
    expect((await list("?group=FACILITY")).map((item) => item.title)).toEqual(["Klíma"]);
    expect((await list("?status=DONE")).map((item) => item.title)).toEqual(["Pomalé notebooky"]);
    expect(await list("?group=IT_SUPPORT&status=OPEN")).toEqual([]);
    // An unknown filter value is an error, not "show everything" (QA BE-009).
    expect(
      (await getIssues(request("/api/hr/issues?group=BOGUS", { as: fx.hr }), undefined)).status,
    ).toBe(400);
  });
});

describe("notes from offline meetings [IT-10]", () => {
  it("HR stores a typed note and sees it with its issues", async () => {
    const response = await addNote(fx.hr);
    expect(response.status).toBe(201);
    const { note } = await response.json();
    await addIssue(fx.hr, { noteId: note.id, title: "Klíma v zasadačke" });

    const notes = (
      await (await getNotes(request("/api/hr/notes", { as: fx.hr }), undefined)).json()
    ).notes;
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ title: "Stretnutie s tímom", text: "V zasadačke je teplo." });
    expect(notes[0].issues).toEqual([
      { id: expect.any(String), title: "Klíma v zasadačke", status: "OPEN" },
    ]);
  });

  it.each([
    ["a short title", { title: "A" }],
    ["an empty text", { text: "   " }],
    ["a text over 10 000 characters", { text: "x".repeat(10001) }],
    ["a missing date", { meetingDate: undefined }],
    ["an invalid date", { meetingDate: "včera" }],
  ])("rejects a note with %s", async (_label, override) => {
    expect((await addNote(fx.hr, override)).status).toBe(400);
    expect(await db.meetingNote.count()).toBe(0);
  });
});

describe("issues and notes are for HR only [NFR-03]", () => {
  it("nobody else can read, add or change them", async () => {
    const { issue } = await (await addIssue(fx.hr)).json();
    await addNote(fx.hr);

    for (const user of [undefined, fx.a.employees[0], fx.a.manager, fx.b.manager]) {
      const expected = user ? 403 : 401;
      expect((await getIssues(request("/api/hr/issues", { as: user }), undefined)).status).toBe(
        expected,
      );
      expect((await addIssue(user)).status).toBe(expected);
      expect((await patch(user, issue.id, { status: "DONE" })).status).toBe(expected);
      expect((await getNotes(request("/api/hr/notes", { as: user }), undefined)).status).toBe(
        expected,
      );
      expect((await addNote(user)).status).toBe(expected);
    }
    expect(await db.issue.count()).toBe(1);
    expect(await db.meetingNote.count()).toBe(1);
    expect((await db.issue.findFirstOrThrow()).status).toBe("OPEN");
  });
});

describe("issues never touch responses [NFR-01]", () => {
  it("the Issue and MeetingNote tables have no reference to a response", async () => {
    for (const table of ["Issue", "MeetingNote"]) {
      const rows = await db.$queryRawUnsafe<{ sql: string }[]>(
        `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '${table}'`,
      );
      expect(rows[0].sql).not.toMatch(/"Response"|responseId|"Participation"/);
    }
  });

  it("an issue raised from a round carries no comment or answer from it", async () => {
    const round = await createRound(fx, fx.a.team.id, "CLOSED");
    for (const employee of fx.a.employees) {
      await db.participation.create({ data: { roundId: round.id, userId: employee.id } });
      await db.response.create({
        data: { roundId: round.id, teamId: fx.a.team.id, v1: 1, v2: 2, v3: 3, comment: "Tajný komentár" },
      });
    }
    await addIssue(fx.hr, { source: "SURVEY", roundId: round.id });
    const raw = JSON.stringify(await list());
    expect(raw).not.toContain("Tajný komentár");
    expect(raw).not.toContain("comment");
    for (const response of await db.response.findMany({ select: { id: true } })) {
      expect(raw).not.toContain(response.id);
    }
  });
});
