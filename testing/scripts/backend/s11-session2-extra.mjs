// Suite 11 (session 2026-11-12_002): framework-level access to pages (RSC requests, internal headers)
// and the formal test cases for defect BE2-001 (submissions under concurrent load).
// Runs after s10-session2.mjs from run-session2.mjs; needs only a seeded database.
import fs from "node:fs";
import path from "node:path";
import { ROOT, closeR, ctx, db, mkOpenRound, req, reset, suite, submit, t } from "./lib.mjs";

const loc = (r) => r.headers.get("location") ?? "";
// Next 16 answers an RSC request that lacks the cache-busting `_rsc` parameter with a 307 to the same
// path plus `?_rsc=<hash>`; a real browser sends the parameter, so that hop is followed here.
const G = async (p, as, headers) => {
  const r = await req("GET", p, { as, headers });
  if (headers?.rsc && r.status === 307 && /[?&]_rsc/.test(loc(r))) return req("GET", loc(r), { as, headers });
  return r;
};
const tally = (rs) => { const m = {}; for (const r of rs) m[r.status] = (m[r.status] ?? 0) + 1; return JSON.stringify(m); };

export default async function run() {
  await reset(false);
  const U = ctx.users, A = ctx.teamA, B = ctx.teamB;
  const seedB = ctx.round(B, "záťaž a sústredenie").id;
  const alfa = ["a1", "a2", "a3", "a4", "a5", "mA"], beta = ["b1", "b2", "b3", "b4", "b5", "mB"];

  // =====================================================================
  suite("N14 Framework-level access: RSC requests and internal headers", "clean seed (issue 'klimatizácia', note 'Stretnutie s Tímom Beta', closed Beta round 'Pulse – záťaž a sústredenie')");
  const RSC = { rsc: "1" };
  const guarded = [
    ["/hr/issues", "a1", "klimatiz", "IT-10"],
    ["/hr/notes", "mA", "Stretnutie s T", "IT-10"],
    ["/hr/rounds", "a1", "a sústredenie", "MVP-12"],
    ["/hr/overview", "mB", "a sústredenie", "IT-05"],
    [`/team/${B}`, "a1", "a sústredenie", "MVP-14 matrix"],
    [`/rounds/${seedB}/results`, "mA", "a sústredenie", "MVP-10 matrix, NFR-03"],
    [`/team/${B}/trend`, "mA", "a sústredenie", "IT-08"],
  ];
  for (const [p, as, marker, reqId] of guarded) {
    await t("AUTHZ-RSC", `RSC request (header 'rsc: 1') for ${p.replace(/c[a-z0-9]{24}/g, ":id")} as ${as}`, `the payload is the 403 boundary (HTTP 403, or the framework's RSC answer with digest NEXT_HTTP_ERROR_FALLBACK;403) and does not contain the protected content (${reqId}; MVP-03)`, async () => {
      const r = await G(p, as, RSC);
      const denied = r.status === 403 || (r.status === 200 && r.text.includes("NEXT_HTTP_ERROR_FALLBACK;403"));
      return { ok: denied && !r.text.includes(marker), actual: `HTTP ${r.status} ${r.headers.get("content-type")}, 403 digest in payload: ${r.text.includes("NEXT_HTTP_ERROR_FALLBACK;403")}, protected text present: ${r.text.includes(marker)}` };
    });
  }
  await t("AUTHZ-RSC", "RSC request for /hr/issues and / without a session", "redirect to /login (307, or an RSC payload with digest NEXT_REDIRECT;replace;/login); issue text absent", async () => {
    const a = await G("/hr/issues", undefined, RSC), b = await G("/", undefined, RSC);
    const okOne = (r) => (r.status === 307 && loc(r).startsWith("/login")) || (r.status === 200 && r.text.includes("NEXT_REDIRECT;replace;/login") && !r.text.includes("klimatiz"));
    return { ok: okOne(a) && okOne(b), actual: `${a.status} redirect digest: ${a.text.includes("NEXT_REDIRECT;replace;/login")} / ${b.status} redirect digest: ${b.text.includes("NEXT_REDIRECT;replace;/login")}` };
  });
  await t("AUTHZ-RSC", "RSC request for /hr/issues as HR (control)", "200 with the issue text – the check above is not vacuous", async () => { const r = await G("/hr/issues", "hr", RSC); return { ok: r.status === 200 && r.text.includes("klimatiz"), actual: `${r.status}, text present: ${r.text.includes("klimatiz")}` }; });
  await t("AUTHZ-RSC", "prefetch request (next-router-prefetch: 1) for /hr/notes as employee", "note text absent from whatever is returned (403, or a prefetch payload without page data)", async () => { const r = await G("/hr/notes", "a1", { rsc: "1", "next-router-prefetch": "1" }); return { ok: r.status < 500 && !r.text.includes("Stretnutie s T"), actual: `HTTP ${r.status}, ${r.text.length} bytes, note text present: ${r.text.includes("Stretnutie s T")}` }; });
  await t("AUTHZ-RSC", "internal header x-middleware-subrequest on a protected page and endpoint", "still 403 for the employee (no bypass)", async () => {
    const h = { "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware" };
    const a = await G("/hr/issues", "a1", h), b = await G("/api/hr/issues", "a1", h), c = await G("/api/me", undefined, h);
    return { ok: a.status === 403 && b.status === 403 && c.status === 401, actual: `${a.status}/${b.status}/${c.status}` };
  });
  await t("AUTHZ-RSC", "POST with a Next-Action header (there are no server actions) to / and /kudos", "no 500 and nothing happens (404/405/400)", async () => {
    const n = await db.kudos.count();
    const h = { "next-action": "0000000000000000000000000000000000000000", "content-type": "text/plain;charset=UTF-8" };
    const a = await req("POST", "/", { as: "a1", raw: "[]", headers: h }), b = await req("POST", "/kudos", { as: "a1", raw: `[{"toUserId":"${U.a2.id}"}]`, headers: h });
    return { ok: a.status < 500 && b.status < 500 && a.status !== 200 && (await db.kudos.count()) === n, actual: `${a.status}/${b.status}` };
  });
  await t("HEADER", "X-Forwarded-Host / Host of another site on a redirecting page", "Location stays the relative /login – no redirect to the foreign host", async () => {
    const a = await G("/", undefined, { "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" });
    return { ok: a.status === 307 && loc(a) === "/login", actual: `${a.status} location=${loc(a)}` };
  });
  await t("HEADER", "an unknown API path answers 404 without touching the session", "404 for anonymous and logged-in, no Set-Cookie", async () => { const a = await G("/api/users"), b = await G("/api/users", "hr"), c = await G("/api/rounds/x/y/z", "hr"); return { ok: [a, b, c].every((r) => r.status === 404 && r.setCookie.length === 0), actual: `${a.status}/${b.status}/${c.status}` }; });

  // =====================================================================
  suite("N15 Submissions under concurrent load (defect BE2-001)", "clean seed; rounds created and opened through the API; all requests of a test are sent at the same moment with Promise.all");
  await t("LOAD-SUBMIT", "12 first-time submissions at once: both teams answer one round each", "12 × 201 (MVP-09)", async () => {
    const ra = await mkOpenRound(A, 3), rb = await mkOpenRound(B, 3);
    const rs = await Promise.all([...alfa.map((u) => submit(u, ra, [3, 3, 3, 3])), ...beta.map((u) => submit(u, rb, [3, 3, 3, 3]))]);
    await closeR(ra); await closeR(rb);
    return { ok: rs.every((r) => r.status === 201), actual: `${tally(rs)}, slowest ${Math.max(...rs.map((r) => r.ms))} ms` };
  });
  let plan, first, rounds;
  await t("LOAD-SUBMIT", "24 first-time submissions at once: both teams answer two open rounds each", "24 × 201 – every valid answer is stored (MVP-09)", async () => {
    rounds = [await mkOpenRound(A, 3), await mkOpenRound(A, 3), await mkOpenRound(B, 3), await mkOpenRound(B, 3)];
    plan = [];
    for (const u of alfa) plan.push([u, rounds[0]], [u, rounds[1]]);
    for (const u of beta) plan.push([u, rounds[2]], [u, rounds[3]]);
    first = await Promise.all(plan.map(([u, id]) => submit(u, id, [3, 3, 3, 3], "QA2-LOAD-COMMENT")));
    return { ok: first.every((r) => r.status === 201), actual: `${tally(first)}; fastest ${Math.min(...first.map((r) => r.ms))} ms, slowest ${Math.max(...first.map((r) => r.ms))} ms` };
  });
  await t("LOAD-SUBMIT", "consistency after the failed burst", "participations = responses in every round; a refused answer left nothing behind (NFR-01 transaction)", async () => {
    const pairs = [];
    for (const id of rounds) pairs.push([await db.participation.count({ where: { roundId: id } }), await db.response.count({ where: { roundId: id } })]);
    const stored = pairs.reduce((n, p) => n + p[1], 0), ok201 = first.filter((r) => r.status === 201).length;
    return { ok: pairs.every(([p, n]) => p === n) && stored === ok201, actual: `per round participations/responses ${pairs.map((p) => p.join("/")).join(" ")}; stored ${stored}, accepted ${ok201}` };
  });
  await t("LOAD-SUBMIT", "the refused users try again one by one", "every retry 201; in the end 24 responses", async () => {
    const again = [];
    for (const [i, [u, id]] of plan.entries()) if (first[i].status !== 201) again.push(await submit(u, id, [3, 3, 3, 3], "QA2-LOAD-COMMENT"));
    let n = 0; for (const id of rounds) n += await db.response.count({ where: { roundId: id } });
    for (const id of rounds) await closeR(id);
    return { ok: again.every((r) => r.status === 201) && n === 24, actual: `${again.length} retries: ${tally(again)}; responses ${n}` };
  });
  const dup = await mkOpenRound(B, 3);
  for (const u of beta) await submit(u, dup, [3, 3, 3, 3]);
  for (const n of [13, 14]) {
    await t("LOAD-SUBMIT", `${n} duplicate submissions at once (everybody already answered)`, `${n} × 409 already_submitted, each within 2 s (MVP-09)`, async () => {
      const rs = await Promise.all(Array.from({ length: n }, (_, i) => submit(beta[i % 6], dup, [5, 5, 5, 5])));
      return { ok: rs.every((r) => r.status === 409) && Math.max(...rs.map((r) => r.ms)) < 2000, actual: `${tally(rs)}, slowest ${Math.max(...rs.map((r) => r.ms))} ms` };
    });
  }
  await t("LOAD-SUBMIT", "an unrelated read while 20 submissions are in flight", "GET /api/me of another user answers within 2 s", async () => {
    const jobs = Array.from({ length: 20 }, (_, i) => submit(beta[i % 6], dup, [5, 5, 5, 5]));
    await new Promise((r) => setTimeout(r, 300));
    const t0 = Date.now();
    const r = await G("/api/me", "a1");
    const ms = Date.now() - t0;
    const rs = await Promise.all(jobs);
    return { ok: r.status === 200 && ms < 2000, actual: `GET /api/me ${r.status} after ${ms} ms; submissions ${tally(rs)}` };
  });
  await closeR(dup);
  await t("LOAD-SUBMIT", "control: 24 kudos at once (plain insert, no interactive transaction)", "24 × 201 within 2 s", async () => {
    const all = [...alfa, ...beta];
    const rs = await Promise.all(Array.from({ length: 24 }, (_, i) => req("POST", "/api/kudos", { as: all[i % 12], body: { toUserId: U[all[(i + 1) % 12]].id, emoji: "⭐", value: "QUALITY", visibility: "PRIVATE" } })));
    return { ok: rs.every((r) => r.status === 201) && Math.max(...rs.map((r) => r.ms)) < 2000, actual: `${tally(rs)}, slowest ${Math.max(...rs.map((r) => r.ms))} ms` };
  });
  await t("NFR-01-LOG", "server log after the 500 answers of this suite", "error lines name only method, path and error class; no comment text of the failed submissions", async () => {
    const txt = fs.readFileSync(path.join(ROOT, "testing", "reports", "2026-11-12_002", "evidence", "server-backend.log"), "utf8");
    const lines = txt.split(/\r?\n/).filter((l) => l.includes("[api]") && !/^\s*\+ /.test(l)).map((l) => l.replace(/^npx\.cmd : /, "").trim());
    const bad = lines.filter((l) => !/^\[api\] [A-Z]+ \/\S* failed: \w+$/.test(l));
    return { ok: lines.length > 0 && bad.length === 0 && !/QA2-LOAD-COMMENT|QA2-PROBE-COMMENT/.test(txt), actual: `${lines.length} error lines, ${bad.length} with extra content; comment marker in the log: ${/QA2-LOAD-COMMENT|QA2-PROBE-COMMENT/.test(txt)}` };
  });
}
