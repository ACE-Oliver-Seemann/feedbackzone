// Suite 9: follow-up probes for weaknesses found in suites 1–8 and deeper race / page checks.
import { closeR, ctx, dateStr, db, is, mkOpenRound, mkRound, req, reset, suite, submit, t } from "./lib.mjs";

export default async function run() {
  suite("S9 Deep probes: invalid unicode, races, pages, load", "fresh seed + demo data");
  await reset(true);
  const closedA = ctx.round(ctx.teamA, "46. týždeň");
  const raw = (method, p, as, json) => req(method, p, { as, raw: json, headers: { "content-type": "application/json" } });
  const S = "\\ud800"; // lone surrogate, as an escape inside raw JSON text

  // ---- lone surrogate in every free-text field ----
  const R = await mkOpenRound(ctx.teamB, 2);
  const cases = [
    ["POST /api/kudos text", () => raw("POST", "/api/kudos", "a1", `{"toUserId":"${ctx.users.a2.id}","text":"Ďakujem veľmi pekne ${S} za pomoc","value":"QUALITY","visibility":"PRIVATE"}`)],
    ["POST /api/rounds name", () => raw("POST", "/api/rounds", "hr", `{"name":"Kolo ${S}","teamId":"${ctx.teamB}","closesAt":"${dateStr(5)}","questionIds":${JSON.stringify(ctx.lib.slice(0, 3).map((q) => q.id))}}`)],
    ["POST /api/questions text", () => raw("POST", "/api/questions", "mA", `{"text":"Je táto otázka ${S} v poriadku?"}`)],
    ["POST /api/rounds/:id/actions topic", () => raw("POST", `/api/rounds/${closedA.id}/actions`, "mA", `{"topic":"Téma ${S}","description":"Opis","dueDate":"${dateStr(5)}"}`)],
    ["POST /api/hr/issues title", () => raw("POST", "/api/hr/issues", "hr", `{"title":"Podnet ${S}","source":"OTHER","ownerGroup":"HR"}`)],
    ["POST /api/hr/notes text", () => raw("POST", "/api/hr/notes", "hr", `{"title":"Poznámka","text":"Text ${S}","meetingDate":"${dateStr(-1)}"}`)],
    ["POST /api/login email", () => raw("POST", "/api/login", undefined, `{"email":"hr${S}@example.test","password":"Heslo123"}`)],
  ];
  for (const [label, fn] of cases) {
    await t("UNICODE", `lone surrogate (\\ud800) in ${label}`, "400 validation error (or stored safely) – never 500", async () => {
      const r = await fn();
      return { ok: r.status < 500, actual: `${r.status} ${r.text.slice(0, 80)}` };
    });
  }
  await t("UNICODE", "failed (500) submission leaves no Participation row and the user can still answer", "0 participations for b1 after the 500; a clean retry returns 201", async () => {
    const bad = await raw("POST", `/api/rounds/${R}/responses`, "b1", `{"answers":[3,3,3],"comment":"zly ${S} znak"}`);
    if (bad.status !== 500) return { ok: true, actual: `invalid comment answered ${bad.status}, no 500 to recover from` };
    const before = await db.participation.count({ where: { roundId: R, userId: ctx.users.b1.id } });
    const r = await submit("b1", R, [3, 3, 3], "v poriadku");
    return { ok: before === 0 && r.status === 201, actual: `participation rows after the 500: ${before}; retry: ${r.status}` };
  });
  await t("UNICODE", "NUL character inside a comment is removed before storing", "201; stored comment is 'predza!' (control characters are stripped, BUG-007 fix)", async () => { // updated in session 2026-11-12_002
    const r = await submit("b2", R, [3, 3, 3], "pred\u0000za!");
    const row = await db.response.findFirst({ where: { roundId: R, comment: { startsWith: "pred" } } });
    return { ok: r.status === 201 && row?.comment === "predza!", actual: `${r.status}; stored length ${row?.comment?.length}; NUL removed: ${row?.comment === "predza!"}` };
  });
  await t("UNICODE", "length limits count UTF-16 units, not characters: kudos text of 300 emoji (300 characters)", "201 – MVP-16 allows up to 500 characters", async () => {
    const r = await req("POST", "/api/kudos", { as: "a1", body: { toUserId: ctx.users.a2.id, text: "🎉".repeat(300), value: "QUALITY", visibility: "PRIVATE" } });
    return { ok: r.status === 201, actual: `${r.status} ${r.text.slice(0, 80)}` };
  });
  await t("UNICODE", "length limits count UTF-16 units: kudos text of 10 emoji (10 characters) without the emoji field", "400 too_short – MVP-16 needs at least 20 characters", async () => {
    const r = await req("POST", "/api/kudos", { as: "a1", body: { toUserId: ctx.users.a2.id, text: "🎉".repeat(10), value: "QUALITY", visibility: "PRIVATE" } });
    return { ok: r.status === 400, actual: `${r.status} (10-character text accepted as >= 20: ${r.status === 201})` };
  });
  await t("UNICODE", "own question of 5 emoji (5 characters)", "400 too_short – IT-07 needs at least 10 characters", async () => {
    const r = await req("POST", "/api/questions", { as: "mA", body: { text: "🙂".repeat(5) } });
    return { ok: r.status === 400, actual: `${r.status} (5-character text accepted as >= 10: ${r.status === 201})` };
  });

  // ---- malformed percent-encoding ----
  for (const p of ["/api/rounds/%E0%A4%A", "/api/rounds/%/results", "/api/teams/%ZZ/summary", "/api/actions/%E0%A4%A", "/api/hr/issues/%C0%AF"]) {
    await t("URL", `malformed percent-encoding in path: ${p}`, "400/404 JSON error – never 500", async () => {
      const r = await req(p.includes("actions") || p.includes("issues") ? "PATCH" : "GET", p, { as: "hr", ...(p.includes("actions") || p.includes("issues") ? { body: { status: "DONE" } } : {}) });
      return { ok: r.status < 500, actual: `${r.status} ${r.text.slice(0, 60)} (content-type ${r.headers.get("content-type")})` };
    });
  }
  await t("URL", "malformed percent-encoding without a session", "401/400/404 – never 500", async () => {
    const r = await req("GET", "/api/rounds/%E0%A4%A/results");
    return { ok: r.status < 500, actual: `${r.status} ${r.text.slice(0, 60)}` };
  });
  await t("URL", "static files and project files are not served", "404 for /.env, /prisma/dev.db, /package.json, /prisma/schema.prisma, /.git/config", async () => {
    const codes = [];
    for (const p of ["/.env", "/prisma/dev.db", "/package.json", "/prisma/schema.prisma", "/.git/config", "/_next/../.env"]) codes.push((await req("GET", p, { as: "hr" })).status);
    return { ok: codes.every((c) => c === 404 || c === 400), actual: `statuses ${codes}` };
  });

  // ---- race: answer accepted after the round was closed ----
  await t("RACE", "submission racing with close (30 rounds): can a response be stored AFTER the round was already closed and its results read?", "never: once close returned and results were read, the response count must not grow (MVP-09 'Do uzavretého kola sa odpovedať nedá')", async () => {
    let late = 0, both = 0;
    for (let i = 0; i < 30; i++) {
      const id = await mkOpenRound(ctx.teamB, 2);
      const closeThenRead = closeR(id).then(async (c) => ({ c, seen: (await req("GET", `/api/rounds/${id}/results`, { as: "hr" })).json.responseCount }));
      const sub = new Promise((res) => setTimeout(res, i % 6)).then(() => submit("b3", id, [3, 3, 3]));
      const [{ c, seen }, s] = await Promise.all([closeThenRead, sub]);
      const final = await db.response.count({ where: { roundId: id } });
      if (c.status === 200 && s.status === 201) both++;
      if (final > (seen ?? 0)) late++;
    }
    return { ok: late === 0, actual: `30 iterations: submit=201 & close=200 in ${both}; response stored after results of the closed round were already read: ${late}` };
  });
  await t("RACE", "60 parallel writes by 12 users (kudos + actions + issues)", "no 5xx (SQLite write contention)", async () => {
    const users = ["a1", "a2", "a3", "a4", "a5", "b1", "b2", "b3", "b4", "b5", "mA", "mB"];
    const jobs = [];
    for (let i = 0; i < 40; i++) jobs.push(req("POST", "/api/kudos", { as: users[i % 12], body: { toUserId: ctx.users[users[(i + 1) % 12]].id, emoji: "⭐", value: "QUALITY", visibility: "PRIVATE" } }));
    for (let i = 0; i < 10; i++) jobs.push(req("POST", `/api/rounds/${closedA.id}/actions`, { as: "mA", body: { topic: "Paralelný krok " + i, description: "opis", dueDate: dateStr(9) } }));
    for (let i = 0; i < 10; i++) jobs.push(req("POST", "/api/hr/issues", { as: "hr", body: { title: "Paralelný podnet " + i, source: "OTHER", ownerGroup: "HR" } }));
    const rs = await Promise.all(jobs);
    const codes = {};
    for (const r of rs) codes[r.status] = (codes[r.status] ?? 0) + 1;
    return { ok: rs.every((r) => r.status === 201), actual: JSON.stringify(codes) };
  });
  await t("RACE", "the same round created twice in parallel with an identical body (double click)", "informational: two drafts are created (no idempotency required by MVP-04)", async () => {
    const body = { name: "Dvojklik", teamId: ctx.teamB, closesAt: dateStr(5), questionIds: ctx.lib.slice(0, 3).map((q) => q.id) };
    const rs = await Promise.all([req("POST", "/api/rounds", { as: "mB", body }), req("POST", "/api/rounds", { as: "mB", body })]);
    return { ok: rs.every((r) => r.status === 201), actual: `statuses ${rs.map((r) => r.status)}; drafts named 'Dvojklik': ${await db.round.count({ where: { name: "Dvojklik" } })}` };
  });
  await t("LOAD", "100 parallel failed logins: latency of an authenticated request during the burst", "informational: no rate limit; record how long GET /api/me waits while bcrypt runs", async () => {
    const base = (await req("GET", "/api/me", { as: "hr" })).ms;
    const burst = Array.from({ length: 100 }, (_, i) => req("POST", "/api/login", { body: { email: `x${i}@example.test`, password: "zle" } }));
    await new Promise((r) => setTimeout(r, 50));
    const during = await req("GET", "/api/me", { as: "hr" });
    const rs = await Promise.all(burst);
    const codes = new Set(rs.map((r) => r.status));
    await new Promise((r) => setTimeout(r, 7000)); // let stale keep-alive sockets expire
    return { ok: during.status === 200 && !codes.has(500), actual: `baseline ${base} ms; during burst ${during.ms} ms; burst statuses {${[...codes]}}; slowest login ${Math.max(...rs.map((r) => r.ms))} ms` };
  });

  // ---- business edge cases ----
  await reset(true);
  const home = async (as) => (await req("GET", "/", { as })).text;
  let hadTask;
  await t("HOME", "manager Beta without an open/draft round and last round closed 14 days ago gets the 'start a round' task", "home page links to /rounds/new (IT-11)", async () => {
    const old = new Date(Date.now() - 20 * 86400000);
    await db.round.update({ where: { id: ctx.round(ctx.teamB, "záťaž a sústredenie").id }, data: { closesAt: old, closedAt: old } });
    hadTask = (await home("mB")).includes('href="/rounds/new"');
    return hadTask;
  }, { pre: "seed round of Beta (closed 3 days ago) moved to 20 days ago in the DB, so the newest closed Beta round is 14 days old" });
  await t("HOME", "a stale draft whose deadline has passed (cannot be opened, edited or deleted) suppresses the 'start a round' task", "task still shown – the dead draft is not a running or usable round (IT-11 'žiadne kolo 14 dní')", async () => {
    const id = await mkRound("mB", ctx.teamB);
    await db.round.update({ where: { id }, data: { closesAt: new Date(Date.now() - 86400000) } });
    const open = await req("POST", `/api/rounds/${id}/open`, { as: "mB" });
    const html = await home("mB");
    return { ok: !hadTask ? null : html.includes('href="/rounds/new"'), actual: `open of the stale draft: ${open.status} ${open.text}; task shown: ${html.includes('href="/rounds/new"')}` };
  }, { pre: "draft created by manager Beta through the API; closesAt moved 1 day into the past directly in the DB (simulates a draft left unopened past its deadline)" });
  await t("ROUND-LIFE", "an expired draft can never leave the DRAFT state through the API", "informational: open → 409, close → 409, no edit/delete endpoint", async () => {
    const d = await db.round.findFirst({ where: { teamId: ctx.teamB, status: "DRAFT" } });
    const codes = [(await req("POST", `/api/rounds/${d.id}/open`, { as: "hr" })).status, (await closeR(d.id)).status, (await req("DELETE", `/api/rounds/${d.id}`, { as: "hr" })).status, (await req("PATCH", `/api/rounds/${d.id}`, { as: "hr", body: { closesAt: dateStr(5) } })).status];
    return { ok: true, actual: `open/close/DELETE/PATCH → ${codes}; draft stays in every manager/HR list forever` };
  });
  await t("HOME", "home shows at most 3 tasks", "at most 3 task rows for manager Alfa and HR, at least 1 for the manager (IT-11)", async () => {
    // updated in session 2026-11-12_002: counts the task sentences (one <p> per task in home-tasks.tsx), not links –
    // the menu and the list of own surveys link to the same pages
    const count = (html) => (html.match(/<p class="min-w-0 text-\[0\.9375rem\] leading-relaxed font-medium text-ink">/g) ?? []).length;
    const a = count(await home("mA")), h = count(await home("hr"));
    return { ok: a <= 3 && h <= 3 && a >= 1, actual: `manager Alfa task rows: ${a}; HR task rows: ${h}` };
  });

  for (const [picked, n] of [[4, 5], [2, 3]]) {
    await t("RESULTS", `${n}-question round with 5 responses: results`, `status ok with ${n} questions; averages ${[1, 2, 3, 4, 5].slice(0, n)} for constant answers per question`, async () => {
      const id = await mkOpenRound(ctx.teamB, picked);
      for (const u of ["b1", "b2", "b3", "b4", "b5"]) await submit(u, id, [1, 2, 3, 4, 5].slice(0, n));
      await closeR(id);
      const r = (await req("GET", `/api/rounds/${id}/results`, { as: "mB" })).json;
      return { ok: r.status === "ok" && r.questions.length === n && r.questions.map((q) => q.average).join() === [1, 2, 3, 4, 5].slice(0, n).join(), actual: `status=${r.status} averages=${r.questions?.map((q) => q.average)}` };
    });
  }

  // ---- pages must respect threshold and comment rules ----
  const small = ctx.round(ctx.teamA, "42. týždeň"); // 4 responses, 1 comment
  const big = ctx.round(ctx.teamA, "44. týždeň"); // 6 responses, 3 comments
  for (const [p, as] of [[`/rounds/${small.id}/results`, "mA"], [`/rounds/${small.id}/results`, "hr"], [`/rounds/${small.id}/report`, "mA"], [`/team/${ctx.teamA}`, "a1"], [`/team/${ctx.teamA}`, "mA"], [`/team/${ctx.teamA}/trend`, "mA"]]) {
    await t("THRESHOLD-PAGE", `page ${p.replace(/c[a-z0-9]{20,}/g, ":id")} as ${as}: round with 4 responses`, "HTML (incl. embedded RSC payload) does not contain the round's comment text (MVP-11)", async () => {
      const r = await req("GET", p, { as });
      return { ok: r.status === 200 && !r.text.includes("dovolenková sezóna"), actual: `HTTP ${r.status}; comment of the 4-response round present: ${r.text.includes("dovolenková sezóna")}` };
    });
  }
  for (const [p, as] of [[`/team/${ctx.teamA}`, "a1"], [`/rounds/${big.id}/report`, "mA"], [`/team/${ctx.teamA}/trend`, "hr"], ["/", "a1"], ["/hr/overview", "hr"], ["/hr/heatmap", "hr"]]) {
    await t("NFR-01-PAGE", `page ${p.replace(/c[a-z0-9]{20,}/g, ":id")} as ${as}: comments of a 6-response round`, "HTML does not contain comment text (comments only on the results screen of manager/HR)", async () => {
      const r = await req("GET", p, { as });
      return { ok: r.status === 200 && !r.text.includes("pokojnejšie") && !r.text.includes("pred tímom"), actual: `HTTP ${r.status}; comment text present: ${r.text.includes("pokojnejšie")}` };
    });
  }
  await t("NFR-01-PAGE", "results page of the manager shows comments but no Response ids / respondent names next to them", "comment present; no UUID in the HTML", async () => {
    const r = await req("GET", `/rounds/${big.id}/results`, { as: "mA" });
    return { ok: r.text.includes("pokojnejšie") && !/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/.test(r.text), actual: `HTTP ${r.status}; comment shown: ${r.text.includes("pokojnejšie")}` };
  });
  await t("NFR-04", "fill page shows the confidentiality sentence and never the word 'anonym'", "HTML contains 'Tvoje odpovede sú dôverné' and no 'anonym' (MVP-07, NFR-04)", async () => {
    const r = await req("GET", `/rounds/${ctx.round(ctx.teamA, "48. týždeň").id}/fill`, { as: "a1" });
    return { ok: r.status === 200 && r.text.includes("Tvoje odpovede sú dôverné") && !/anonym/i.test(r.text), actual: `HTTP ${r.status}; sentence present: ${r.text.includes("Tvoje odpovede sú dôverné")}; 'anonym' present: ${/anonym/i.test(r.text)}` };
  });
  await t("NFR-04", "no page of any role contains 'anonym'", "0 matches across 12 pages", async () => {
    const hits = [];
    for (const [p, as] of [["/login", undefined], ["/", "a1"], ["/", "mA"], ["/", "hr"], [`/team/${ctx.teamA}`, "a1"], ["/kudos/new", "a1"], ["/kudos/me", "a1"], ["/rounds/new", "mA"], ["/rounds", "mA"], ["/hr/rounds", "hr"], ["/hr/issues", "hr"], [`/rounds/${big.id}/results`, "hr"]]) {
      const r = await req("GET", p, as ? { as } : {});
      if (/anonym/i.test(r.text)) hits.push(p);
    }
    return { ok: hits.length === 0, actual: hits.length ? "found on " + hits.join(",") : "none" };
  });
  await t("AUTHZ-PAGE", "kudos form page lists every user as a recipient but exposes no e-mail or role", "HTML of /kudos?tab=send has names, no '@example.test' (/kudos/new redirects there since the frontend merge)", async () => {
    const r = await req("GET", "/kudos?tab=send", { as: "b1" }); // updated in session 2026-11-12_002
    return { ok: r.status === 200 && !r.text.includes("@example.test") && !r.text.includes("passwordHash"), actual: `HTTP ${r.status}; e-mails present: ${r.text.includes("@example.test")}` };
  });
  await t("SESSION", "pages accept a session whose cookie was already 'logged out' (token replay on pages)", "redirect to /login – MVP-01", async () => {
    const tok = (await req("POST", "/api/login", { body: { email: "jakub.beta@example.test", password: "Heslo123" } })).setCookie[0].split(";")[0];
    await req("POST", "/api/logout", { cookie: tok });
    const r = await req("GET", "/", { cookie: tok });
    return { ok: r.status !== 200, actual: `HTTP ${r.status} (page rendered with the logged-out token: ${r.status === 200})` };
  });
}
