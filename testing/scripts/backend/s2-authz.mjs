// Suite 2: every role against every endpoint (MVP-03, NFR-03, permission matrix in mvp.md).
// Resources belong to team Alfa; "B" actors are from team Beta (IDOR / cross-team).
import { ctx, dateStr, mkOpenRound, mkRound, req, reset, suite, t } from "./lib.mjs";

const ACTORS = [
  ["anon", "anonymous"],
  ["a2", "employee Alfa"],
  ["b2", "employee Beta"],
  ["mA", "manager Alfa"],
  ["mB", "manager Beta"],
  ["hr", "HR"],
];

export default async function run() {
  suite("S2 Authorization matrix (role x endpoint)", "seed + demo data; target resources belong to team Alfa");
  await reset(true);
  const closedA = ctx.round(ctx.teamA, "46. týždeň"); // closed, 5 responses, no action
  const openA = ctx.round(ctx.teamA, "48. týždeň");
  const actionA = ctx.round(ctx.teamA, "44. týždeň").actions[0];
  const hrIssue = (await req("POST", "/api/hr/issues", { as: "hr", body: { title: "QA podnet matica", source: "OTHER", ownerGroup: "HR" } })).json.issue;

  // [label, method, path|fn, body|fn, {alias: expectedStatus}], default expected for anon = 401
  const ALL200 = { a2: 200, b2: 200, mA: 200, mB: 200, hr: 200 };
  const HR_ONLY = (ok) => ({ a2: 403, b2: 403, mA: 403, mB: 403, hr: ok });
  const MGR_A_HR = (ok) => ({ a2: 403, b2: 403, mA: ok, mB: 403, hr: ok });
  let n = 0;
  const E = [
    ["GET /api/me", "GET", "/api/me", null, ALL200],
    ["GET /api/questions", "GET", "/api/questions", null, { a2: 403, b2: 403, mA: 200, mB: 200, hr: 200 }],
    ["POST /api/questions (own question)", "POST", "/api/questions", () => ({ text: `QA vlastná otázka číslo ${++n} pre maticu?` }), { a2: 403, b2: 403, mA: 201, mB: 201, hr: 403 }],
    ["GET /api/rounds", "GET", "/api/rounds", null, ALL200],
    ["POST /api/rounds (teamId = Alfa)", "POST", "/api/rounds", () => ({ name: "QA matica", teamId: ctx.teamA, closesAt: dateStr(5), questionIds: ctx.lib.slice(0, 3).map((q) => q.id) }), MGR_A_HR(201)],
    ["POST /api/rounds/:id/open (Alfa draft)", "POST", async () => `/api/rounds/${await mkRound("hr", ctx.teamA)}/open`, null, MGR_A_HR(200)],
    ["POST /api/rounds/:id/close (Alfa open round)", "POST", async () => `/api/rounds/${await mkOpenRound(ctx.teamA)}/close`, null, MGR_A_HR(200)],
    ["GET /api/rounds/:id (Alfa open round)", "GET", `/api/rounds/${openA.id}`, null, { a2: 200, b2: 403, mA: 200, mB: 403, hr: 403 }],
    ["POST /api/rounds/:id/responses (Alfa open round)", "POST", `/api/rounds/${openA.id}/responses`, { answers: [3, 3, 3, 3] }, { a2: 201, b2: 403, mA: 201, mB: 403, hr: 403 }],
    ["GET /api/rounds/:id/results (Alfa closed round)", "GET", `/api/rounds/${closedA.id}/results`, null, MGR_A_HR(200)],
    ["GET /api/rounds/:id/suggestions (Alfa closed round)", "GET", `/api/rounds/${closedA.id}/suggestions`, null, MGR_A_HR(200)],
    ["POST /api/rounds/:id/actions (Alfa closed round)", "POST", `/api/rounds/${closedA.id}/actions`, { topic: "QA téma", description: "QA krok", dueDate: dateStr(10) }, { a2: 403, b2: 403, mA: 201, mB: 403, hr: 403 }],
    ["PATCH /api/actions/:id (action of Alfa)", "PATCH", `/api/actions/${actionA.id}`, { status: "IN_PROGRESS" }, { a2: 403, b2: 403, mA: 200, mB: 403, hr: 403 }],
    ["GET /api/teams/:id/summary (Alfa)", "GET", `/api/teams/${ctx.teamA}/summary`, null, { a2: 200, b2: 403, mA: 200, mB: 403, hr: 200 }],
    ["GET /api/teams/:id/trend (Alfa)", "GET", `/api/teams/${ctx.teamA}/trend`, null, MGR_A_HR(200)],
    ["POST /api/kudos", "POST", "/api/kudos", { toUserId: ctx.users.a1.id, emoji: "👏", value: "QUALITY", visibility: "TEAM" }, { a2: 201, b2: 201, mA: 201, mB: 201, hr: 201 }],
    ["GET /api/kudos/me", "GET", "/api/kudos/me", null, ALL200],
    ["GET /api/hr/overview", "GET", "/api/hr/overview", null, HR_ONLY(200)],
    ["GET /api/hr/heatmap", "GET", "/api/hr/heatmap", null, HR_ONLY(200)],
    ["GET /api/hr/issues", "GET", "/api/hr/issues", null, HR_ONLY(200)],
    ["POST /api/hr/issues", "POST", "/api/hr/issues", { title: "QA podnet", source: "OTHER", ownerGroup: "HR" }, HR_ONLY(201)],
    ["PATCH /api/hr/issues/:id", "PATCH", `/api/hr/issues/${hrIssue.id}`, { status: "IN_PROGRESS" }, HR_ONLY(200)],
    ["GET /api/hr/notes", "GET", "/api/hr/notes", null, HR_ONLY(200)],
    ["POST /api/hr/notes", "POST", "/api/hr/notes", { title: "QA poznámka", text: "Text poznámky", meetingDate: dateStr(-1) }, HR_ONLY(201)],
    ["POST /api/logout", "POST", "/api/logout", null, ALL200],
  ];

  for (const [label, method, p, body, exp] of E) {
    for (const [alias, who] of ACTORS) {
      const want = alias === "anon" ? 401 : exp[alias];
      await t("AUTHZ", `${label} as ${who}`, `${want}${want === 403 ? " forbidden (NFR-03)" : want === 401 ? " unauthorized" : ""}`, async () => {
        const url = typeof p === "function" ? await p() : p;
        const b = typeof body === "function" ? body() : body;
        const r = await req(method, url, { ...(alias === "anon" ? {} : { as: alias }), ...(b ? { body: b } : {}) });
        const ok = r.status === want && (want !== 403 || r.json?.error === "forbidden") && (want !== 401 || r.json?.error === "unauthorized");
        return { ok, actual: `${r.status} ${r.text.slice(0, 140)}` };
      }, { steps: `${method} ${typeof p === "string" ? p : label.split(" ")[1]} as ${who}${body ? " with a valid body" : ""}` });
    }
  }

  // 403/401 answers must not carry data.
  await t("AUTHZ", "403 body carries nothing but the error code", 'exactly {"error":"forbidden"}', async () => {
    const r = await req("GET", `/api/rounds/${closedA.id}/results`, { as: "mB" });
    return r.text === '{"error":"forbidden"}';
  });
  await t("AUTHZ", "manager Beta cannot tell an existing Alfa round from a non-existent id (results)", "both 403 with identical bodies", async () => {
    const a = await req("GET", `/api/rounds/${closedA.id}/results`, { as: "mB" });
    const b = await req("GET", `/api/rounds/cmdoesnotexist0000000000/results`, { as: "mB" });
    return { ok: a.status === 403 && b.status === 403 && a.text === b.text, actual: `${a.status} ${a.text} / ${b.status} ${b.text}` };
  });
  await t("AUTHZ", "employee Beta cannot tell an existing Alfa team from a non-existent id (summary)", "both 403", async () => {
    const a = await req("GET", `/api/teams/${ctx.teamA}/summary`, { as: "b2" });
    const b = await req("GET", `/api/teams/cmdoesnotexist0000000000/summary`, { as: "b2" });
    return a.status === 403 && b.status === 403 && a.text === b.text;
  });
  await t("AUTHZ", "employee: existing DRAFT of own team vs non-existent round id (GET /api/rounds/:id)", "informational: 404 for draft vs 403 for unknown id (existence oracle limited to own team)", async () => {
    const draft = await mkRound("hr", ctx.teamA);
    const a = await req("GET", `/api/rounds/${draft}`, { as: "a2" });
    const b = await req("GET", `/api/rounds/cmdoesnotexist0000000000`, { as: "a2" });
    return { ok: a.status === 404 && b.status === 403, actual: `draft ${a.status} ${a.text} / unknown ${b.status} ${b.text}` };
  });

  // Server-rendered pages enforce the same matrix (MVP-03).
  const pages = [
    ["/hr/overview", "a2", 403], ["/hr/issues", "mA", 403], ["/hr/heatmap", "mA", 403], ["/hr/notes", "a2", 403],
    [`/rounds/${closedA.id}/results`, "a2", 403], [`/rounds/${closedA.id}/results`, "mB", 403], [`/rounds/${closedA.id}/results`, "mA", 200],
    [`/team/${ctx.teamA}`, "b2", 403], [`/team/${ctx.teamA}`, "a2", 200], ["/rounds/new", "a2", 403], [`/rounds/${openA.id}/fill`, "b2", 403], [`/rounds/${openA.id}/fill`, "hr", 403],
    [`/rounds/${closedA.id}/report`, "mB", 403], [`/team/${ctx.teamA}/trend`, "a2", 403],
  ];
  for (const [p, alias, want] of pages) {
    await t("AUTHZ-PAGE", `page ${p.replace(/c[a-z0-9]{20,}/, ":id")} as ${alias}`, `HTTP ${want}`, async () => {
      const r = await req("GET", p, { as: alias });
      return { ok: r.status === want, actual: `HTTP ${r.status}` };
    });
  }
  await t("AUTHZ-PAGE", "page / without session", "redirect (307) to /login", async () => {
    const r = await req("GET", "/");
    return { ok: [302, 307, 308].includes(r.status) && /\/login/.test(r.headers.get("location") ?? ""), actual: `HTTP ${r.status} location=${r.headers.get("location")}` };
  });
  await t("AUTHZ-PAGE", "page /hr/overview without session", "redirect to /login", async () => {
    const r = await req("GET", "/hr/overview");
    return { ok: [302, 307, 308].includes(r.status) && /\/login/.test(r.headers.get("location") ?? ""), actual: `HTTP ${r.status} location=${r.headers.get("location")}` };
  });
}
