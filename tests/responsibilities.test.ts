import { beforeEach, describe, expect, it } from "vitest";
import { POST as postComment } from "@/app/api/responsibilities/[id]/comments/route";
import { GET as getOne, PATCH as patchOne } from "@/app/api/responsibilities/[id]/route";
import { GET as getOptions } from "@/app/api/responsibilities/options/route";
import { GET as getList, POST as postOne } from "@/app/api/responsibilities/route";
import { GET as getHrIssues } from "@/app/api/hr/issues/route";
import { db } from "@/lib/db";
import { createRound, dateInDays, params, request, resetDb, type Fixture } from "./helpers";

// IT-14 Zodpovednosti: visibility and permissions on every read and write
// (NFR-03), HR-only notes and comments, manager create rules, completedAt,
// overdue and filters.

let fx: Fixture;
beforeEach(async () => {
  fx = await resetDb();
});

type User = { id: string };
type Item = Record<string, unknown> & { id: string };

const create = (as: User | undefined, body: Record<string, unknown>) =>
  postOne(request("/api/responsibilities", { method: "POST", as, body }), undefined);

const list = async (as: User, query = "") => {
  const response = await getList(request(`/api/responsibilities${query}`, { as }), undefined);
  return {
    status: response.status,
    items: ((await response.json()).responsibilities ?? []) as Item[],
  };
};

const get = (as: User | undefined, id: string) =>
  getOne(request(`/api/responsibilities/${id}`, { as }), params({ id }));

const patch = (as: User | undefined, id: string, body: unknown) =>
  patchOne(request(`/api/responsibilities/${id}`, { method: "PATCH", as, body }), params({ id }));

const comment = (as: User | undefined, id: string, body: unknown) =>
  postComment(
    request(`/api/responsibilities/${id}/comments`, {
      method: "POST",
      as,
      body,
    }),
    params({ id }),
  );

const createOk = async (as: User, body: Record<string, unknown>) => {
  const response = await create(as, body);
  expect(response.status).toBe(201);
  return (await response.json()).responsibility as Item;
};

describe("visibility matrix [IT-14, NFR-03]", () => {
  // Cards: HR → manager A (related: employee A2), manager A personal, manager A →
  // employee A1, HR → manager B, HR unassigned.
  let cards: Record<string, Item>;
  let actors: Record<string, User>;

  beforeEach(async () => {
    cards = {
      hrToManagerA: await createOk(fx.hr, {
        title: "Zabezpečiť školenie",
        assigneeId: fx.a.manager.id,
        relatedUserId: fx.a.employees[1].id,
      }),
      managerAPersonal: await createOk(fx.a.manager, {
        title: "Pripraviť plán tímu",
      }),
      managerAToEmployee: await createOk(fx.a.manager, {
        title: "Dokončiť dokumentáciu",
        assigneeId: fx.a.employees[0].id,
      }),
      hrToManagerB: await createOk(fx.hr, {
        title: "Úloha pre tím B",
        assigneeId: fx.b.manager.id,
      }),
      hrUnassigned: await createOk(fx.hr, {
        title: "Interná vec HR",
        ownerGroup: "FACILITY",
      }),
    };
    actors = {
      hr: fx.hr,
      managerA: fx.a.manager,
      managerB: fx.b.manager,
      employeeAssignee: fx.a.employees[0],
      employeeRelated: fx.a.employees[1],
      employeeOther: fx.a.employees[2],
    };
  });

  const VISIBLE: Record<string, string[]> = {
    hr: ["hrToManagerA", "managerAPersonal", "managerAToEmployee", "hrToManagerB", "hrUnassigned"],
    managerA: ["hrToManagerA", "managerAPersonal", "managerAToEmployee"],
    managerB: ["hrToManagerB"],
    employeeAssignee: ["managerAToEmployee"],
    // Being the related employee does not make a card visible (confidentiality).
    employeeRelated: [],
    employeeOther: [],
  };

  it("list returns exactly the cards each viewer may see", async () => {
    for (const [actor, expected] of Object.entries(VISIBLE)) {
      const { status, items } = await list(actors[actor], "?status=ALL");
      expect(status).toBe(200);
      expect(items.map((item) => item.id).sort(), actor).toEqual(
        expected.map((key) => cards[key].id).sort(),
      );
    }
  });

  it("get, patch status and comment: visible → 200/201, not visible → 403, unknown → 404", async () => {
    for (const [actor, expected] of Object.entries(VISIBLE)) {
      for (const [key, card] of Object.entries(cards)) {
        const visible = expected.includes(key);
        const label = `${actor} → ${key}`;
        expect((await get(actors[actor], card.id)).status, label).toBe(visible ? 200 : 403);
        expect((await patch(actors[actor], card.id, { status: "IN_PROGRESS" })).status, label).toBe(
          visible ? 200 : 403,
        );
        expect((await comment(actors[actor], card.id, { text: "Stav" })).status, label).toBe(
          visible ? 201 : 403,
        );
      }
      expect((await get(actors[actor], "no-such-card")).status).toBe(404);
      expect((await patch(actors[actor], "no-such-card", { status: "DONE" })).status).toBe(404);
      expect((await comment(actors[actor], "no-such-card", { text: "x" })).status).toBe(404);
    }
  });

  it("anonymous requests get 401", async () => {
    expect((await getList(request("/api/responsibilities"), undefined)).status).toBe(401);
    expect((await get(undefined, cards.hrToManagerA.id)).status).toBe(401);
    expect((await create(undefined, { title: "Niečo" })).status).toBe(401);
  });

  it("field edits: HR anything, manager only own cards, employee nothing", async () => {
    const edit = { title: "Nový názov úlohy", priority: "HIGH" };
    expect((await patch(fx.hr, cards.managerAPersonal.id, edit)).status).toBe(200);
    expect((await patch(fx.a.manager, cards.managerAToEmployee.id, edit)).status).toBe(200);
    // Visible but created by HR: the manager may work on it, not rewrite it.
    expect((await patch(fx.a.manager, cards.hrToManagerA.id, edit)).status).toBe(403);
    expect(
      (
        await patch(fx.a.manager, cards.hrToManagerA.id, {
          assigneeId: fx.a.employees[3].id,
        })
      ).status,
    ).toBe(403);
    expect((await patch(fx.a.employees[0], cards.managerAToEmployee.id, edit)).status).toBe(403);
    expect(
      (
        await patch(fx.a.employees[0], cards.managerAToEmployee.id, {
          dueDate: dateInDays(3),
        })
      ).status,
    ).toBe(403);
    // A manager never moves a card to another team or owner group.
    expect(
      (
        await patch(fx.a.manager, cards.managerAPersonal.id, {
          teamId: fx.b.team.id,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await patch(fx.a.manager, cards.managerAPersonal.id, {
          ownerGroup: "FACILITY",
        })
      ).status,
    ).toBe(403);
  });

  it("permissions object per viewer", async () => {
    const perms = async (as: User, id: string) =>
      (await (await get(as, id)).json()).responsibility.permissions;
    expect(await perms(fx.hr, cards.hrToManagerA.id)).toEqual({
      canEdit: true,
      canReassign: true,
      canChangeStatus: true,
      canComment: true,
      canCommentInternal: true,
    });
    expect(await perms(fx.a.manager, cards.hrToManagerA.id)).toMatchObject({
      canEdit: false,
      canReassign: false,
      canChangeStatus: true,
      canComment: true,
      canCommentInternal: false,
    });
    expect(await perms(fx.a.manager, cards.managerAToEmployee.id)).toMatchObject({
      canEdit: true,
      canReassign: true,
    });
    expect(await perms(fx.a.employees[0], cards.managerAToEmployee.id)).toMatchObject({
      canEdit: false,
      canReassign: false,
      canChangeStatus: true,
      canComment: true,
      canCommentInternal: false,
    });
  });

  it("kind tells HR cards, personal cards and team cards apart", async () => {
    const kinds = Object.fromEntries(
      (await list(fx.a.manager, "?status=ALL")).items.map((item) => [item.id, item.kind]),
    );
    expect(kinds[cards.hrToManagerA.id]).toBe("HR_ASSIGNED");
    expect(kinds[cards.managerAPersonal.id]).toBe("PERSONAL");
    expect(kinds[cards.managerAToEmployee.id]).toBe("TEAM");
    const { items } = await list(fx.a.manager, "?status=ALL&kind=PERSONAL");
    expect(items.map((item) => item.id)).toEqual([cards.managerAPersonal.id]);
  });

  it("a card stays visible to the manager when assigned to a team member by HR", async () => {
    const card = await createOk(fx.hr, {
      title: "Školenie pre člena",
      assigneeId: fx.a.employees[4].id,
    });
    expect((await get(fx.a.manager, card.id)).status).toBe(200);
    expect((await get(fx.b.manager, card.id)).status).toBe(403);
    expect((await get(fx.a.employees[4], card.id)).status).toBe(200);
  });
});

describe("confidential HR content [IT-14, NFR-03]", () => {
  it("non-HR viewers never get the meeting note or internal comments", async () => {
    const note = await db.meetingNote.create({
      data: {
        title: "Dôverné stretnutie",
        meetingDate: new Date(),
        text: "Poznámka iba pre HR.",
        createdById: fx.hr.id,
      },
    });
    const card = await createOk(fx.hr, {
      title: "Podnet zo stretnutia",
      source: "MEETING",
      noteId: note.id,
      assigneeId: fx.a.manager.id,
    });
    expect(card.note).toEqual({ id: note.id, title: "Dôverné stretnutie" });

    expect(
      (
        await comment(fx.hr, card.id, {
          text: "Interná poznámka HR",
          internal: true,
        })
      ).status,
    ).toBe(201);
    expect((await comment(fx.hr, card.id, { text: "Verejný stav" })).status).toBe(201);
    expect((await comment(fx.a.manager, card.id, { text: "Riešim" })).status).toBe(201);

    const hrView = (await (await get(fx.hr, card.id)).json()).responsibility;
    expect(hrView.comments.map((item: Item) => item.text)).toEqual([
      "Interná poznámka HR",
      "Verejný stav",
      "Riešim",
    ]);
    expect(hrView.commentCount).toBe(3);

    const response = await get(fx.a.manager, card.id);
    const raw = await response.clone().text();
    const managerView = (await response.json()).responsibility;
    expect(managerView.note).toBeNull();
    expect(managerView.comments.map((item: Item) => item.text)).toEqual(["Verejný stav", "Riešim"]);
    expect(managerView.commentCount).toBe(2);
    expect(raw).not.toContain("Interná poznámka HR");
    expect(raw).not.toContain("Dôverné stretnutie");

    const listed = (await list(fx.a.manager)).items.find((item) => item.id === card.id)!;
    expect(listed.note).toBeNull();
    expect(listed.commentCount).toBe(2);
  });

  it("only HR may write an internal comment", async () => {
    const card = await createOk(fx.a.manager, {
      title: "Moja úloha",
      assigneeId: fx.a.employees[0].id,
    });
    expect((await comment(fx.a.manager, card.id, { text: "Tajné", internal: true })).status).toBe(
      403,
    );
    expect(
      (
        await comment(fx.a.employees[0], card.id, {
          text: "Tajné",
          internal: true,
        })
      ).status,
    ).toBe(403);
    expect(await db.issueComment.count()).toBe(0);
  });

  it.each([
    ["an empty text", { text: "   " }],
    ["a text over 2000 characters", { text: "x".repeat(2001) }],
    ["a text of the wrong type", { text: 5 }],
    ["internal of the wrong type", { text: "Ok", internal: "yes" }],
  ])("rejects a comment with %s", async (_label, body) => {
    const card = await createOk(fx.hr, {
      title: "Úloha",
      assigneeId: fx.a.manager.id,
    });
    expect((await comment(fx.hr, card.id, body)).status).toBe(400);
  });
});

describe("creating cards [IT-14]", () => {
  it("an employee cannot create a card", async () => {
    expect((await create(fx.a.employees[0], { title: "Moja úloha" })).status).toBe(403);
    expect(await db.issue.count()).toBe(0);
  });

  it("HR creates a full card; the team defaults to the assignee's team", async () => {
    const card = await createOk(fx.hr, {
      title: "Zabezpečiť školenie Excel",
      description: "Pre nového kolegu.",
      assigneeId: fx.a.manager.id,
      relatedUserId: fx.a.employees[0].id,
      priority: "HIGH",
      dueDate: dateInDays(10),
    });
    expect(card).toMatchObject({
      title: "Zabezpečiť školenie Excel",
      status: "OPEN",
      priority: "HIGH",
      kind: "HR_ASSIGNED",
      ownerGroup: "TEAM_MANAGER",
      source: "OTHER",
      overdue: false,
      completedAt: null,
      team: { id: fx.a.team.id, name: fx.a.team.name },
      assignee: { id: fx.a.manager.id, role: "MANAGER" },
      relatedEmployee: { id: fx.a.employees[0].id, role: "EMPLOYEE" },
      createdBy: { id: fx.hr.id, role: "HR" },
      comments: [],
    });
  });

  it("a manager's card defaults to themselves, team and group are forced", async () => {
    const card = await createOk(fx.a.manager, {
      title: "Vlastná úloha",
      teamId: fx.a.team.id,
      ownerGroup: "FACILITY",
    });
    expect(card).toMatchObject({
      assignee: { id: fx.a.manager.id },
      team: { id: fx.a.team.id },
      ownerGroup: "TEAM_MANAGER",
      source: "OTHER",
      kind: "PERSONAL",
      priority: "MEDIUM",
    });
  });

  it.each([
    [
      "another team's employee as assignee",
      () => ({ assigneeId: fx.b.employees[0].id }),
      "assigneeId",
    ],
    ["another manager as assignee", () => ({ assigneeId: fx.b.manager.id }), "assigneeId"],
    ["HR as assignee", () => ({ assigneeId: fx.hr.id }), "assigneeId"],
    [
      "another team's employee as related",
      () => ({ relatedUserId: fx.b.employees[0].id }),
      "relatedUserId",
    ],
    ["another team", () => ({ teamId: fx.b.team.id }), "teamId"],
    ["a meeting note", () => ({ noteId: "any-note" }), "noteId"],
  ])("a manager cannot create a card with %s", async (_label, body, field) => {
    const response = await create(fx.a.manager, {
      title: "Úloha mimo tímu",
      ...body(),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).fields[field]).toBe("not_allowed");
    expect(await db.issue.count()).toBe(0);
  });

  it("a manager may link a round of their own team, not of another", async () => {
    const own = await createRound(fx, fx.a.team.id, "CLOSED");
    const other = await createRound(fx, fx.b.team.id, "CLOSED");
    expect((await create(fx.a.manager, { title: "Z kola", roundId: own.id })).status).toBe(201);
    expect((await create(fx.a.manager, { title: "Z kola", roundId: other.id })).status).toBe(400);
  });

  it.each([
    ["a short title", { title: "Ab" }],
    ["a long title", { title: "x".repeat(121) }],
    ["a long description", { description: "x".repeat(2001) }],
    ["a wrongly typed description", { description: 5 }],
    ["an unknown priority", { priority: "ASAP" }],
    ["an unknown status", { status: "CANCELLED" }],
    ["an invalid due date", { dueDate: "2026-02-31" }],
    ["an unknown assignee", { assigneeId: "nobody" }],
    ["a wrongly typed assignee", { assigneeId: 7 }],
    ["an unknown related employee", { relatedUserId: "nobody" }],
    ["a manager as related employee", { relatedUserId: "MANAGER_A" }],
    ["an unknown team", { teamId: "no-team" }],
    ["an unknown owner group", { ownerGroup: "NOBODY" }],
    ["no owner group and no assignee", { ownerGroup: "" }],
    ["an unknown source", { source: "RUMOUR", ownerGroup: "OTHER" }],
  ])("HR create rejects %s", async (_label, override) => {
    const body: Record<string, unknown> = {
      title: "Platná úloha",
      assigneeId: fx.a.manager.id,
      ...override,
    };
    if (body.relatedUserId === "MANAGER_A") body.relatedUserId = fx.a.manager.id;
    if (body.ownerGroup === "") delete body.assigneeId;
    const response = await create(fx.hr, body);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("validation_error");
    expect(await db.issue.count()).toBe(0);
  });
});

describe("updating cards [IT-14]", () => {
  it("status DONE sets completedAt, leaving DONE clears it", async () => {
    const card = await createOk(fx.hr, {
      title: "Úloha",
      assigneeId: fx.a.employees[0].id,
    });
    const done = (await (await patch(fx.a.employees[0], card.id, { status: "DONE" })).json())
      .responsibility;
    expect(done.status).toBe("DONE");
    expect(done.completedAt).not.toBeNull();

    const waiting = (await (await patch(fx.a.employees[0], card.id, { status: "WAITING" })).json())
      .responsibility;
    expect(waiting.status).toBe("WAITING");
    expect(waiting.completedAt).toBeNull();
  });

  it("a manager reassigns own card within the team only", async () => {
    const card = await createOk(fx.a.manager, { title: "Úloha tímu" });
    const moved = await patch(fx.a.manager, card.id, {
      assigneeId: fx.a.employees[2].id,
    });
    expect(moved.status).toBe(200);
    expect((await moved.json()).responsibility.assignee.id).toBe(fx.a.employees[2].id);
    expect((await patch(fx.a.manager, card.id, { assigneeId: fx.b.employees[0].id })).status).toBe(
      400,
    );
    expect((await patch(fx.a.manager, card.id, { assigneeId: null })).status).toBe(400);
    expect((await get(fx.a.employees[2], card.id)).status).toBe(200);
  });

  it("HR reassigns to another team and may unassign", async () => {
    const card = await createOk(fx.hr, {
      title: "Úloha",
      assigneeId: fx.a.manager.id,
    });
    const moved = await patch(fx.hr, card.id, {
      assigneeId: fx.b.manager.id,
      teamId: fx.b.team.id,
    });
    expect(moved.status).toBe(200);
    expect((await get(fx.a.manager, card.id)).status).toBe(403);
    expect((await get(fx.b.manager, card.id)).status).toBe(200);
    const cleared = await patch(fx.hr, card.id, { assigneeId: null });
    expect((await cleared.json()).responsibility.assignee).toBeNull();
  });

  it("HR reassigning to another team's person moves the card to that team (QA IT-14 #1)", async () => {
    const card = await createOk(fx.hr, {
      title: "Úloha",
      assigneeId: fx.a.manager.id,
      teamId: fx.a.team.id,
    });
    const moved = await patch(fx.hr, card.id, { assigneeId: fx.b.employees[0].id });
    expect(moved.status).toBe(200);
    expect((await moved.json()).responsibility.team.id).toBe(fx.b.team.id);
    const betaFilter = await list(fx.hr, `?teamId=${fx.b.team.id}`);
    expect(JSON.stringify(betaFilter)).toContain(card.id);
  });

  it("rejects invalid values and an empty update", async () => {
    const card = await createOk(fx.hr, {
      title: "Úloha",
      assigneeId: fx.a.manager.id,
    });
    expect((await patch(fx.hr, card.id, { status: "CANCELLED" })).status).toBe(400);
    expect((await patch(fx.hr, card.id, { priority: "ASAP" })).status).toBe(400);
    expect((await patch(fx.hr, card.id, { title: "x" })).status).toBe(400);
    expect((await patch(fx.hr, card.id, { dueDate: "zajtra" })).status).toBe(400);
    expect((await patch(fx.hr, card.id, {})).status).toBe(400);
    expect((await db.issue.findUniqueOrThrow({ where: { id: card.id } })).status).toBe("OPEN");
  });
});

describe("overdue, filters and sorting [IT-14]", () => {
  it("overdue is a passed deadline that is not done", async () => {
    const late = await createOk(fx.hr, {
      title: "Po termíne",
      assigneeId: fx.a.manager.id,
      dueDate: dateInDays(-2),
    });
    const today = await createOk(fx.hr, {
      title: "Dnes",
      assigneeId: fx.a.manager.id,
      dueDate: dateInDays(0),
    });
    expect(late.overdue).toBe(true);
    expect(today.overdue).toBe(false);
    const done = (await (await patch(fx.hr, late.id, { status: "DONE" })).json()).responsibility;
    expect(done.overdue).toBe(false);
  });

  it("filters by status, priority, team, assignee, related employee and overdue", async () => {
    const a1 = await createOk(fx.hr, {
      title: "Alfa urgentná",
      assigneeId: fx.a.manager.id,
      relatedUserId: fx.a.employees[0].id,
      priority: "URGENT",
      dueDate: dateInDays(-1),
    });
    const a2 = await createOk(fx.hr, {
      title: "Alfa nízka",
      assigneeId: fx.a.employees[1].id,
      priority: "LOW",
    });
    const b1 = await createOk(fx.hr, {
      title: "Beta",
      assigneeId: fx.b.manager.id,
      status: "DONE",
    });

    const ids = async (query: string) =>
      (await list(fx.hr, query)).items.map((item) => item.id).sort();
    expect(await ids("")).toEqual([a1.id, a2.id].sort()); // ACTIVE by default
    expect(await ids("?status=DONE")).toEqual([b1.id]);
    expect(await ids("?status=ALL")).toEqual([a1.id, a2.id, b1.id].sort());
    expect(await ids("?priority=URGENT")).toEqual([a1.id]);
    expect(await ids(`?teamId=${fx.a.team.id}`)).toEqual([a1.id, a2.id].sort());
    expect(await ids(`?status=ALL&teamId=${fx.b.team.id}`)).toEqual([b1.id]);
    expect(await ids(`?assigneeId=${fx.a.employees[1].id}`)).toEqual([a2.id]);
    expect(await ids(`?relatedUserId=${fx.a.employees[0].id}`)).toEqual([a1.id]);
    expect(await ids("?overdue=true")).toEqual([a1.id]);
    expect(await ids("?overdue=false")).toEqual([a2.id]);
  });

  it.each(["?status=CLOSED", "?priority=ASAP", "?kind=SECRET", "?sort=random", "?overdue=maybe"])(
    "rejects the unknown filter %s",
    async (query) => {
      expect((await list(fx.hr, query)).status).toBe(400);
    },
  );

  it("default sort: overdue, nearest deadline (none last), priority, newest", async () => {
    const noDeadlineUrgent = await createOk(fx.hr, {
      title: "Bez termínu",
      assigneeId: fx.a.manager.id,
      priority: "URGENT",
    });
    const later = await createOk(fx.hr, {
      title: "Neskôr",
      assigneeId: fx.a.manager.id,
      dueDate: dateInDays(9),
    });
    const soonLow = await createOk(fx.hr, {
      title: "Čoskoro nízka",
      assigneeId: fx.a.manager.id,
      dueDate: dateInDays(2),
      priority: "LOW",
    });
    const soonHigh = await createOk(fx.hr, {
      title: "Čoskoro vysoká",
      assigneeId: fx.a.manager.id,
      dueDate: dateInDays(2),
      priority: "HIGH",
    });
    const late = await createOk(fx.hr, {
      title: "Po termíne",
      assigneeId: fx.a.manager.id,
      dueDate: dateInDays(-3),
      priority: "LOW",
    });

    const order = (await list(fx.a.manager)).items.map((item) => item.id);
    expect(order).toEqual([late.id, soonHigh.id, soonLow.id, later.id, noDeadlineUrgent.id]);

    const byPriority = (await list(fx.a.manager, "?sort=priority")).items.map((item) => item.id);
    expect(byPriority[0]).toBe(noDeadlineUrgent.id);
  });
});

describe("options for the form [IT-14]", () => {
  const options = async (as: User) =>
    (await (await getOptions(request("/api/responsibilities/options", { as }), undefined)).json())
      .options;

  it("HR may pick any manager or employee and any team", async () => {
    const result = await options(fx.hr);
    expect(result.canCreate).toBe(true);
    expect(result.assignees).toHaveLength(12);
    expect(result.relatedEmployees).toHaveLength(10);
    expect(result.teams).toHaveLength(2);
  });

  it("a manager may pick only themselves and their own team", async () => {
    const result = await options(fx.a.manager);
    expect(result.canCreate).toBe(true);
    expect(result.assignees.map((item: Item) => item.id).sort()).toEqual(
      [fx.a.manager.id, ...fx.a.employees.map((item) => item.id)].sort(),
    );
    expect(result.relatedEmployees).toHaveLength(5);
    expect(result.teams).toEqual([{ id: fx.a.team.id, name: fx.a.team.name }]);
  });

  it("an employee gets nothing to pick", async () => {
    expect(await options(fx.a.employees[0])).toEqual({
      canCreate: false,
      assignees: [],
      relatedEmployees: [],
      teams: [],
    });
  });
});

describe("IT-10 list keeps working with the new statuses [IT-14]", () => {
  it("the HR issue list treats WAITING as active", async () => {
    const card = await createOk(fx.hr, {
      title: "Čaká sa",
      assigneeId: fx.a.manager.id,
      status: "WAITING",
    });
    const response = await getHrIssues(
      request("/api/hr/issues?status=ACTIVE", { as: fx.hr }),
      undefined,
    );
    const { issues } = await response.json();
    expect(issues.map((item: Item) => item.id)).toContain(card.id);
  });
});
