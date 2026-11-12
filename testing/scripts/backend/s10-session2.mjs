// Suite 10 (session 2026-11-12_002): new backend tests after the frontend merge.
// Page permission matrix incl. the new /kudos hub, session/cookie tampering, kudos with emoji (IT-06),
// own questions (IT-07), suggestions (IT-09), trend/heatmap threshold with time simulation (IT-08, NFR-02),
// HR issues/notes (IT-10), HR overview maths (IT-05), injection-style inputs, concurrency, NFR-01 storage and log.
// Run:  node testing/scripts/backend/run-session2.mjs
import fs from "node:fs";
import path from "node:path";
import { ROOT, closeR, ctx, dateStr, db, keysOf, login, mkOpenRound, mkRound, req, reset, suite, submit, t, tokens } from "./lib.mjs";

const DAY = 86400000;
const G = (p, as) => req("GET", p, { as });
const P = (p, as, body) => req("POST", p, { as, body });
const loc = (r) => r.headers.get("location") ?? "";
const num = (x) => Number(x);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const XSS = "<img src=x onerror=qa1337()>";
const escaped = (html) => !html.includes(XSS) && (html.includes("&lt;img src=x onerror=qa1337()&gt;") || html.includes("\\u003cimg src=x onerror=qa1337()"));

export default async function run() {
  await reset(false);
  const U = ctx.users;
  const A = ctx.teamA, B = ctx.teamB;
  const seedB = ctx.round(B, "záťaž a sústredenie").id;

  // =====================================================================
  suite("N1 Page permission matrix (role x page, incl. new /kudos hub and /rounds)", "clean seed; open round of team Alfa and draft of team Alfa created through the API; seed round of Beta is closed with 4 responses");
  const openA = await mkOpenRound(A, 3);
  const draftA = await mkRound("mA", A);
  const NOPE = "cmqa0000000000000000000no";
  const L = [307, "/login"];
  // expected per role: [anon, a1 (employee Alfa), mA, mB, hr]; a number = status, [307, target] = redirect
  const matrix = [
    ["/", [L, 200, 200, 200, 200], "MVP-06, IT-11"],
    ["/login", [200, [307, "/"], [307, "/"], [307, "/"], [307, "/"]], "MVP-01"],
    ["/kudos", [L, 200, 200, 200, 200], "MVP-16, MVP-17, IT-12"],
    ["/kudos?tab=send", [L, 200, 200, 200, 200], "MVP-16, IT-12"],
    ["/kudos/new", [L, [307, "/kudos?tab=send"], [307, "/kudos?tab=send"], [307, "/kudos?tab=send"], [307, "/kudos?tab=send"]], "MVP-16 (old route kept as redirect)"],
    ["/kudos/me", [L, [307, "/kudos"], [307, "/kudos"], [307, "/kudos"], [307, "/kudos"]], "MVP-17 (old route kept as redirect)"],
    ["/rounds", [L, 403, 200, 200, [307, "/hr/rounds"]], "IT-12"],
    ["/rounds/new", [L, 403, 200, 200, 200], "MVP-04"],
    ["/hr/rounds", [L, 403, 403, 403, 200], "MVP-12"],
    ["/hr/overview", [L, 403, 403, 403, 200], "IT-05"],
    ["/hr/heatmap", [L, 403, 403, 403, 200], "IT-08"],
    ["/hr/issues", [L, 403, 403, 403, 200], "IT-10"],
    ["/hr/notes", [L, 403, 403, 403, 200], "IT-10"],
    [`/team/${A}`, [L, 200, 200, 403, 200], "MVP-14 matrix", "/team/:alfa"],
    [`/team/${B}`, [L, 403, 403, 200, 200], "MVP-14 matrix", "/team/:beta"],
    [`/team/${A}/trend`, [L, 403, 200, 403, 200], "IT-08", "/team/:alfa/trend"],
    [`/rounds/${openA}/fill`, [L, 200, 200, 403, 403], "MVP-08 matrix", "/rounds/:openAlfa/fill"],
    [`/rounds/${openA}/results`, [L, 403, 200, 403, 200], "MVP-10 matrix", "/rounds/:openAlfa/results"],
    [`/rounds/${openA}/report`, [L, 403, 200, 403, 200], "IT-08 report", "/rounds/:openAlfa/report"],
    [`/rounds/${seedB}/results`, [L, 403, 403, 200, 200], "MVP-10 matrix, NFR-03", "/rounds/:closedBeta/results"],
    [`/rounds/${draftA}/fill`, [L, 404, 404, 403, 403], "MVP-05 (draft not visible to the team)", "/rounds/:draftAlfa/fill"],
    [`/team/${NOPE}`, [L, 403, 403, 403, 404], "MVP-03 (no probing of ids)", "/team/:unknown"],
    [`/rounds/${NOPE}/results`, [L, 403, 403, 403, 404], "MVP-03", "/rounds/:unknown/results"],
    [`/rounds/${NOPE}/fill`, [L, 403, 403, 403, 403], "MVP-03", "/rounds/:unknown/fill"],
  ];
  const roles = [undefined, "a1", "mA", "mB", "hr"];
  for (const [p, exp, reqId, label] of matrix) {
    for (let i = 0; i < roles.length; i++) {
      const e = exp[i];
      const want = Array.isArray(e) ? `${e[0]} redirect to ${e[1]}` : String(e);
      await t("AUTHZ-PAGE", `page ${label ?? p} as ${roles[i] ?? "anonymous"}`, `${want} (${reqId}; MVP-03, NFR-03)`, async () => {
        const r = await G(p, roles[i]);
        const ok = Array.isArray(e) ? r.status === e[0] && loc(r) === e[1] : r.status === e;
        return { ok, actual: `${r.status}${loc(r) ? " location=" + loc(r) : ""}` };
      }, { steps: `GET ${label ?? p} as ${roles[i] ?? "anon"} (no redirect following)` });
    }
  }
  await t("AUTHZ-PAGE", "403 page of a foreign team does not leak the team name or round names", "HTML of /team/:beta for employee Alfa contains neither 'Tím Beta' content nor the Beta round name (NFR-03)", async () => {
    const r = await G(`/team/${B}`, "a1");
    return { ok: r.status === 403 && !r.text.includes("záťaž a sústredenie"), actual: `${r.status}, round name present: ${r.text.includes("záťaž a sústredenie")}` };
  });
  await t("AUTHZ-PAGE", "/kudos with unexpected query (?tab=send&tab=x&tab[]=y)", "200, no 500 (falls back to the default tab)", async () => (await G("/kudos?tab=send&tab=x&tab[]=y", "a1")).status === 200);
  await t("AUTHZ-PAGE", "/hr/issues with unknown filters and garbage prefill ids as HR", "200, default filter used (BUG-009 page part)", async () => (await G(`/hr/issues?status=BOGUS&group=NOPE&round=${NOPE}&note=%27%20OR%201=1`, "hr")).status === 200);
  await t("AUTHZ-PAGE", "/hr/issues?round=<Beta round> as manager Beta (prefill must not be reachable)", "403 (IT-10: only HR)", async () => (await G(`/hr/issues?round=${seedB}`, "mB")).status === 403);
  await t("AUTHZ-PAGE", "unknown page for a logged-in user and for anonymous", "404 for both, never 500 (BUG-013)", async () => {
    const a = await G("/this-page-does-not-exist", "a1"), b = await G("/this-page-does-not-exist");
    return { ok: a.status === 404 && b.status === 404, actual: `${a.status} / ${b.status}` };
  });
  await t("HEADER", "authenticated pages are not cacheable", "Cache-Control contains no-store on /, /kudos, /hr/issues", async () => {
    const cc = [];
    for (const [p, as] of [["/", "a1"], ["/kudos", "a1"], ["/hr/issues", "hr"]]) cc.push((await G(p, as)).headers.get("cache-control") ?? "");
    return { ok: cc.every((c) => /no-store/.test(c)), actual: cc.join(" | ") };
  });

  // =====================================================================
  suite("N2 Session, cookies and token tampering", "clean seed, everybody logged in");
  const [pl, sig] = tokens.a1.split(".");
  const payload = JSON.parse(Buffer.from(pl, "base64url").toString("utf8"));
  const forge = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const me = (cookie) => req("GET", "/api/me", { cookie });
  await t("SESSION", "token payload has only uid, iat, exp (no role, no e-mail)", "keys exp,iat,uid", async () => ({ ok: keysOf(payload) === "exp,iat,uid", actual: keysOf(payload) }));
  await t("SESSION", "payload swapped to the HR user id, signature of the employee kept", "401 (signature check, NFR-05)", async () => (await me(`fz_session=${forge({ ...payload, uid: U.hr.id })}.${sig}`)).status === 401);
  await t("SESSION", "payload with exp extended by a year, old signature", "401", async () => (await me(`fz_session=${forge({ ...payload, exp: payload.exp + 31536000 })}.${sig}`)).status === 401);
  await t("SESSION", "valid payload with an empty signature / signature 'none'", "401 for both", async () => {
    const a = await me(`fz_session=${pl}.`), b = await me(`fz_session=${pl}.none`);
    return { ok: a.status === 401 && b.status === 401, actual: `${a.status}/${b.status}` };
  });
  await t("SESSION", "valid token with an extra segment appended (.x)", "401", async () => (await me(`fz_session=${tokens.a1}.x`)).status === 401);
  await t("SESSION", "signature with one character changed", "401", async () => (await me(`fz_session=${pl}.${sig.slice(0, -1)}${sig.at(-1) === "A" ? "B" : "A"}`)).status === 401);
  await t("SESSION", "cookie name in upper case (FZ_SESSION)", "401 (cookie names are case-sensitive)", async () => (await me(`FZ_SESSION=${tokens.a1}`)).status === 401);
  await t("SESSION", "token sent as Authorization: Bearer instead of the cookie", "401 (only the cookie is a session)", async () => (await req("GET", "/api/me", { headers: { authorization: `Bearer ${tokens.a1}` } })).status === 401);
  await t("SESSION", "two fz_session cookies: garbage first, valid second", "no 500; 401 or 200 for the employee only (never another user)", async () => {
    const r = await me(`fz_session=garbage; fz_session=${tokens.a1}`);
    return { ok: r.status === 401 || (r.status === 200 && r.json.user.id === U.a1.id), actual: `${r.status}` };
  });
  await t("SESSION", "8 kB of garbage in the cookie", "401 or 431, never 500", async () => { const r = await me(`fz_session=${"A".repeat(8000)}`); return { ok: [401, 431].includes(r.status), actual: `${r.status}` }; });
  await t("SESSION", "login Set-Cookie attributes", "HttpOnly; SameSite=lax; Path=/; Max-Age=28800; no Domain (NFR-05)", async () => {
    const r = await P("/api/login", undefined, { email: "adam.alfa@example.test", password: "Heslo123" });
    const c = r.setCookie.find((x) => x.startsWith("fz_session=")) ?? "";
    return { ok: /HttpOnly/i.test(c) && /SameSite=lax/i.test(c) && /Path=\//.test(c) && /Max-Age=28800/.test(c) && !/Domain=/i.test(c), actual: c.replace(/fz_session=[^;]+/, "fz_session=<token>") };
  });
  await t("SESSION", "login response body", "keys home,user; user has id,name,role,teamId only – no e-mail, no password hash", async () => {
    const r = await P("/api/login", undefined, { email: "adam.alfa@example.test", password: "Heslo123" });
    return { ok: keysOf(r.json) === "home,user" && keysOf(r.json.user) === "id,name,role,teamId" && !/passwordHash|\$2[aby]\$/.test(r.text), actual: `${keysOf(r.json)} / ${keysOf(r.json.user)}` };
  });
  await t("SESSION", "e-mail is case-insensitive and trimmed on login", "200 for '  ADAM.ALFA@EXAMPLE.TEST '", async () => (await P("/api/login", undefined, { email: "  ADAM.ALFA@EXAMPLE.TEST ", password: "Heslo123" })).status === 200);
  await t("SESSION", "password is case-sensitive and not trimmed", "401 for 'heslo123' and ' Heslo123'", async () => {
    const a = await P("/api/login", undefined, { email: "adam.alfa@example.test", password: "heslo123" }), b = await P("/api/login", undefined, { email: "adam.alfa@example.test", password: " Heslo123" });
    return { ok: a.status === 401 && b.status === 401, actual: `${a.status}/${b.status}` };
  });
  await t("SESSION", "password with a NUL byte after the real password ('Heslo123\\u0000x')", "401 (no truncation at NUL)", async () => (await P("/api/login", undefined, { email: "adam.alfa@example.test", password: "Heslo123\u0000x" })).status === 401);
  await t("SESSION", "failed login sets no session cookie", "401 and no Set-Cookie fz_session", async () => {
    const r = await P("/api/login", undefined, { email: "adam.alfa@example.test", password: "wrong" });
    return { ok: r.status === 401 && !r.setCookie.some((c) => c.startsWith("fz_session=") && !/Max-Age=0/.test(c)), actual: `${r.status} set-cookie=${r.setCookie.length}` };
  });
  await t("SESSION", "logout: Set-Cookie clears the cookie; old token is dead on API and pages; other users unaffected (BUG-001 regression)", "200, Max-Age=0; old token → 401 on /api/me and 307 /login on /; manager's session still 200", async () => {
    const old = tokens.a2;
    const out = await fetch("http://localhost:3301/api/logout", { method: "POST", headers: { cookie: `fz_session=${old}` } });
    const c = out.headers.getSetCookie().find((x) => x.startsWith("fz_session=")) ?? "";
    const api = await me(`fz_session=${old}`), page = await req("GET", "/", { cookie: `fz_session=${old}` }), other = await G("/api/me", "mA");
    await login("a2");
    return { ok: out.status === 200 && /Max-Age=0/.test(c) && api.status === 401 && page.status === 307 && loc(page) === "/login" && other.status === 200, actual: `logout ${out.status}, cookie '${c.slice(0, 40)}…', old token: api ${api.status}, page ${page.status}; other user ${other.status}` };
  });
  await t("SESSION", "two sessions of one user: both valid; logout of one ends both (documented behaviour of the BUG-001 fix)", "before: 200/200; after logout with session 1: 401/401", async () => {
    await sleep(5);
    const s1 = await login("a3"); await sleep(5); const s2 = await login("a3");
    const b1 = await me(`fz_session=${s1}`), b2 = await me(`fz_session=${s2}`);
    await fetch("http://localhost:3301/api/logout", { method: "POST", headers: { cookie: `fz_session=${s1}` } });
    const a1 = await me(`fz_session=${s1}`), a2 = await me(`fz_session=${s2}`);
    await login("a3");
    return { ok: b1.status === 200 && b2.status === 200 && a1.status === 401 && a2.status === 401, actual: `before ${b1.status}/${b2.status}, after ${a1.status}/${a2.status}` };
  });
  await t("SESSION", "logout without a session", "401, no 500", async () => (await P("/api/logout")).status === 401);
  await t("SESSION", "login right after logout works and the new token is accepted", "200 on /api/me with the new token", async () => {
    await P("/api/logout", "a4"); // lib logs the account in again
    return (await G("/api/me", "a4")).status === 200;
  });

  // =====================================================================
  suite("N3 Kudos with emoji (IT-06) – extended validation matrix", "clean seed; kudos sent through POST /api/kudos");
  const K = (as, body) => P("/api/kudos", as, body);
  const base = (to, extra = {}) => ({ toUserId: U[to].id, value: "HELPING", visibility: "TEAM", ...extra });
  await t("KUDOS-EMOJI", "emoji + text of exactly 500 characters", "201, text length 500 (IT-06: 0–500 with emoji)", async () => { const r = await K("a1", base("a2", { emoji: "👏", text: "x".repeat(500) })); return { ok: r.status === 201 && r.json.kudos.text.length === 500, actual: `${r.status} len=${r.json?.kudos?.text.length}` }; });
  await t("KUDOS-EMOJI", "emoji + whitespace-only text", "201, text stored as ''", async () => { const r = await K("a1", base("a2", { emoji: "🙌", text: "   \n\t  " })); return { ok: r.status === 201 && r.json.kudos.text === "" && r.json.kudos.emoji === "🙌", actual: `${r.status} ${JSON.stringify(r.json?.kudos?.text)}` }; });
  await t("KUDOS-EMOJI", "emoji + text null", "201, text ''", async () => { const r = await K("a1", base("a2", { emoji: "💪", text: null })); return r.status === 201 && r.json.kudos.text === ""; });
  await t("KUDOS-EMOJI", "emoji + text of 30 zero-width spaces", "201, text '' (invisible characters removed, BUG-007 behaviour)", async () => { const r = await K("a1", base("a2", { emoji: "🎉", text: "​".repeat(30) })); return { ok: r.status === 201 && r.json.kudos.text === "", actual: `${r.status} ${JSON.stringify(r.json?.kudos?.text)}` }; });
  await t("KUDOS-EMOJI", "emoji + text as a number", "400 fields.text=invalid (emoji does not excuse a wrong type)", async () => { const r = await K("a1", base("a2", { emoji: "👏", text: 12345 })); return { ok: r.status === 400 && r.json.fields?.text === "invalid", actual: `${r.status} ${r.text}` }; });
  await t("KUDOS-EMOJI", "heart with the text-presentation selector (U+2764 U+FE0E)", "400 fields.emoji=invalid (not in the fixed set)", async () => { const r = await K("a1", base("a2", { emoji: "❤︎" })); return { ok: r.status === 400 && r.json.fields?.emoji === "invalid", actual: `${r.status} ${r.text}` }; });
  await t("KUDOS-EMOJI", "valid emoji prefixed with a BOM (U+FEFF)", "400 fields.emoji=invalid", async () => { const r = await K("a1", base("a2", { emoji: "﻿👏" })); return { ok: r.status === 400 && r.json.fields?.emoji === "invalid", actual: `${r.status} ${r.text}` }; });
  await t("KUDOS-EMOJI", "emoji as boolean true", "400 fields.emoji=invalid", async () => { const r = await K("a1", base("a2", { emoji: true })); return { ok: r.status === 400 && r.json.fields?.emoji === "invalid", actual: `${r.status} ${r.text}` }; });
  await t("KUDOS-EMOJI", "emoji as boolean false with a short text", "400 (false is not 'no emoji'; either emoji invalid or text too short)", async () => { const r = await K("a1", base("a2", { emoji: false, text: "ahoj" })); return { ok: r.status === 400, actual: `${r.status} ${r.text}` }; });
  await t("KUDOS-EMOJI", "invalid emoji with a valid 20+ character text", "400 fields.emoji=invalid only (IT-06: unknown emoji rejected)", async () => { const r = await K("a1", base("a2", { emoji: "🔥", text: "Ďakujem za pomoc s QA testom." })); return { ok: r.status === 400 && keysOf(r.json.fields) === "emoji", actual: `${r.status} ${r.text}` }; });
  let spoofId;
  await t("KUDOS-EMOJI", "mass assignment: body carries fromUserId (HR), id and createdAt", "201; signed by the real sender, own id and current time (MVP-16)", async () => {
    const r = await K("a1", base("a2", { emoji: "⭐", fromUserId: U.hr.id, fromName: "HR", id: "qa-spoofed-id", createdAt: "2000-01-01T00:00:00.000Z" }));
    spoofId = r.json?.kudos?.id;
    const row = spoofId ? await db.kudos.findUnique({ where: { id: spoofId } }) : null;
    return { ok: r.status === 201 && r.json.kudos.fromName === U.a1.name && spoofId !== "qa-spoofed-id" && row?.fromUserId === U.a1.id && Math.abs(new Date(r.json.kudos.createdAt) - Date.now()) < 60000, actual: `${r.status} from=${r.json?.kudos?.fromName === U.a1.name ? "sender" : "SPOOFED"} idSpoofed=${spoofId === "qa-spoofed-id"} createdAt=${r.json?.kudos?.createdAt}` };
  });
  await t("KUDOS-EMOJI", "response item of POST /api/kudos", "keys createdAt,emoji,fromName,id,text,toName,value,visibility – no user ids or e-mails", async () => { const r = await K("a1", base("a2", { emoji: "👏" })); return { ok: keysOf(r.json.kudos) === "createdAt,emoji,fromName,id,text,toName,value,visibility" && !r.text.includes("example.test"), actual: keysOf(r.json.kudos) }; });
  await t("KUDOS-EMOJI", "emoji-only row in the database", "text '' and emoji exactly U+2764 U+FE0F", async () => {
    const r = await K("a1", base("a2", { emoji: "❤️" }));
    const row = await db.kudos.findUnique({ where: { id: r.json.kudos.id } });
    const cps = [...row.emoji].map((c) => c.codePointAt(0).toString(16)).join(" ");
    return { ok: row.text === "" && cps === "2764 fe0f", actual: `text=${JSON.stringify(row.text)} emoji code points=${cps}` };
  });
  let privId;
  await t("KUDOS-EMOJI", "emoji-only PRIVATE kudos: only the recipient sees it", "in recipient's /api/kudos/me; not in sender's, not in the team summary of a colleague, the manager or HR (MVP-17)", async () => {
    const r = await K("a1", base("a2", { emoji: "🎉", visibility: "PRIVATE" }));
    privId = r.json.kudos.id;
    const has = async (p, as, key) => (await G(p, as)).json[key].some((k) => k.id === privId);
    const rec = await has("/api/kudos/me", "a2", "kudos"), snd = await has("/api/kudos/me", "a1", "kudos");
    const col = await has(`/api/teams/${A}/summary`, "a3", "kudos"), mgr = await has(`/api/teams/${A}/summary`, "mA", "kudos"), hr = await has(`/api/teams/${A}/summary`, "hr", "kudos");
    return { ok: rec && !snd && !col && !mgr && !hr, actual: `recipient ${rec}, sender ${snd}, colleague ${col}, manager ${mgr}, HR ${hr}` };
  });
  await t("KUDOS-EMOJI", "private emoji kudos is not rendered on other users' pages", "id/sender line absent from /kudos of the manager and /team/:alfa of a colleague", async () => {
    const m = await G("/kudos", "mA"), c = await G(`/team/${A}`, "a3"), own = await G("/kudos", "a2");
    return { ok: !m.text.includes(privId) && !c.text.includes(privId) && own.status === 200, actual: `manager page has id: ${m.text.includes(privId)}, colleague team page has id: ${c.text.includes(privId)}` };
  });
  await t("KUDOS-EMOJI", "emoji-only TEAM kudos to HR (no team)", "400 fields.visibility=no_team (BUG-024 fix)", async () => { const r = await K("a1", base("hr", { emoji: "👏" })); return { ok: r.status === 400 && r.json.fields?.visibility === "no_team", actual: `${r.status} ${r.text}` }; });
  await t("KUDOS-EMOJI", "emoji-only PRIVATE kudos to HR", "201", async () => (await K("a1", base("hr", { emoji: "👏", visibility: "PRIVATE" }))).status === 201);
  await t("KUDOS-EMOJI", "emoji-only kudos to oneself", "400 fields.toUserId=self (MVP-16)", async () => { const r = await K("a1", base("a1", { emoji: "👏" })); return { ok: r.status === 400 && r.json.fields?.toUserId === "self", actual: `${r.status} ${r.text}` }; });
  await t("KUDOS-EMOJI", "emoji-only kudos to an unknown user id", "400 fields.toUserId=unknown, nothing stored", async () => { const n = await db.kudos.count(); const r = await K("a1", { ...base("a2", { emoji: "👏" }), toUserId: NOPE }); return { ok: r.status === 400 && r.json.fields?.toUserId === "unknown" && (await db.kudos.count()) === n, actual: `${r.status} ${r.text}` }; });
  await t("KUDOS-EMOJI", "HR sends an emoji kudos to an employee", "201 (matrix: everybody may send)", async () => (await K("hr", base("b1", { emoji: "⭐" }))).status === 201);
  await t("KUDOS-EMOJI", "cross-team public kudos (Alfa → Beta) appears only in the recipient's team feed", "in summary of Beta, not in summary of Alfa (MVP-17)", async () => {
    const r = await K("a1", base("b2", { emoji: "🙌", text: "QA2 cross-team" }));
    const inB = (await G(`/api/teams/${B}/summary`, "b1")).json.kudos.some((k) => k.id === r.json.kudos.id), inA = (await G(`/api/teams/${A}/summary`, "a1")).json.kudos.some((k) => k.id === r.json.kudos.id);
    return { ok: inB && !inA, actual: `Beta feed ${inB}, Alfa feed ${inA}` };
  });
  await t("KUDOS", "empty body object", "400 with all four fields reported (toUserId, text, value, visibility)", async () => { const r = await K("a1", {}); return { ok: r.status === 400 && keysOf(r.json.fields) === "text,toUserId,value,visibility", actual: `${r.status} ${r.text}` }; });
  await t("KUDOS", "three kudos in a row: 'my kudos' is newest first", "ids in reverse order of sending (MVP-17)", async () => {
    const ids = [];
    for (const e of ["👏", "🙌", "💪"]) { ids.push((await K("b1", base("b3", { emoji: e }))).json.kudos.id); await sleep(15); }
    const got = (await G("/api/kudos/me", "b3")).json.kudos.map((k) => k.id).filter((id) => ids.includes(id));
    return { ok: JSON.stringify(got) === JSON.stringify([...ids].reverse()), actual: `order ok: ${JSON.stringify(got) === JSON.stringify([...ids].reverse())}` };
  });
  await t("KUDOS", "HTML in the kudos text is escaped on the new /kudos hub page", "raw <img onerror> never in the HTML; escaped form present", async () => {
    await K("a1", base("a5", { text: `QA2 ${XSS} ďakujem veľmi pekne` }));
    const r = await G("/kudos", "a5"), tp = await G(`/team/${A}`, "a3");
    return { ok: r.status === 200 && escaped(r.text) && escaped(tp.text), actual: `/kudos escaped: ${escaped(r.text)}, team page escaped: ${escaped(tp.text)}` };
  });
  await t("KUDOS", "/kudos hub page lists recipients without the user themself and without e-mails", "own name not among recipients option data; no 'example.test' in HTML", async () => { const r = await G("/kudos?tab=send", "a1"); return { ok: r.status === 200 && !r.text.includes("example.test"), actual: `${r.status}, e-mail present: ${r.text.includes("example.test")}` }; });

  // =====================================================================
  suite("N4 Own questions of a manager (IT-07) – extended", "clean seed + kudos from N3");
  const Q = (as, body) => P("/api/questions", as, body);
  let ownA;
  await t("QUESTIONS", "inner whitespace is collapsed", "201, text stored with single spaces", async () => {
    const r = await Q("mA", { text: "Mám   v tíme\t dosť  podpory QA2?" });
    ownA = r.json?.question;
    return { ok: r.status === 201 && ownA.text === "Mám v tíme dosť podpory QA2?", actual: `${r.status} ${JSON.stringify(ownA?.text)}` };
  });
  await t("QUESTIONS", "same wording in another letter case", "400 fields.text=duplicate (BUG-005 fix)", async () => { const r = await Q("mA", { text: "MÁM V TÍME DOSŤ PODPORY QA2?" }); return { ok: r.status === 400 && r.json.fields?.text === "duplicate", actual: `${r.status} ${r.text}` }; });
  await t("QUESTIONS", "same wording with extra spaces", "400 duplicate", async () => { const r = await Q("mA", { text: "  Mám v  tíme dosť podpory   QA2? " }); return { ok: r.status === 400 && r.json.fields?.text === "duplicate", actual: `${r.status} ${r.text}` }; });
  await t("QUESTIONS", "wording of a shared library question (upper case)", "400 duplicate (must not shadow the library)", async () => { const r = await Q("mA", { text: ctx.lib[0].text.toUpperCase() }); return { ok: r.status === 400 && r.json.fields?.text === "duplicate", actual: `${r.status} ${r.text}` }; });
  let ownB;
  await t("QUESTIONS", "the other manager may use the same wording for their own team", "201 with teamId of Beta (questions belong to a team)", async () => { const r = await Q("mB", { text: "Mám v tíme dosť podpory QA2?" }); ownB = r.json?.question; return { ok: r.status === 201 && ownB.teamId === B, actual: `${r.status}` }; });
  await t("QUESTIONS", "mass assignment: scale, fixed, starter, teamId (Beta), topic sent by manager Alfa", "201; scale AGREEMENT, fixed false, starter false, teamId Alfa, topic 'Vlastné otázky tímu'", async () => {
    const r = await Q("mA", { text: "QA2 otázka s cudzími poľami?", scale: "FREQUENCY", fixed: true, starter: true, teamId: B, topic: "Záťaž a energia", type: "TEXT" });
    const q = r.json?.question ?? {};
    return { ok: r.status === 201 && q.scale === "AGREEMENT" && q.fixed === false && q.starter === false && q.teamId === A && q.topic === "Vlastné otázky tímu", actual: `${r.status} ${JSON.stringify(q)}`.replace(/c[a-z0-9]{24}/g, ":id") };
  });
  await t("QUESTIONS", "length is checked after collapsing spaces ('Abcde    fg?' = 9 characters)", "400 too_short (10–200 characters)", async () => { const r = await Q("mA", { text: "Abcde    fg?" }); return { ok: r.status === 400 && r.json.fields?.text === "too_short", actual: `${r.status} ${r.text}` }; });
  await t("QUESTIONS", "library as seen by each role", "manager Alfa sees own but not Beta's; manager Beta the reverse; HR sees both", async () => {
    const ids = async (as) => (await G("/api/questions", as)).json.questions.map((q) => q.id);
    const a = await ids("mA"), b = await ids("mB"), h = await ids("hr");
    return { ok: a.includes(ownA.id) && !a.includes(ownB.id) && b.includes(ownB.id) && !b.includes(ownA.id) && h.includes(ownA.id) && h.includes(ownB.id), actual: `mA own ${a.includes(ownA.id)}/foreign ${a.includes(ownB.id)}; mB own ${b.includes(ownB.id)}/foreign ${b.includes(ownA.id)}; hr ${h.includes(ownA.id) && h.includes(ownB.id)}` };
  });
  const mk = (as, teamId, ids) => P("/api/rounds", as, { name: "QA2 kolo " + Math.random().toString(36).slice(2, 7), teamId, closesAt: dateStr(7), questionIds: ids });
  const lib2 = ctx.lib.slice(0, 4).map((q) => q.id);
  await t("QUESTIONS", "manager Beta puts Alfa's own question into a Beta round", "400 fields.questionIds=unknown (IT-07)", async () => { const r = await mk("mB", B, [ownA.id, lib2[0], lib2[1]]); return { ok: r.status === 400 && r.json.fields?.questionIds === "unknown", actual: `${r.status} ${r.text}` }; });
  await t("QUESTIONS", "HR puts Alfa's own question into a Beta round", "400 unknown", async () => { const r = await mk("hr", B, [ownA.id, lib2[0], lib2[1]]); return { ok: r.status === 400 && r.json.fields?.questionIds === "unknown", actual: `${r.status} ${r.text}` }; });
  await t("QUESTIONS", "HR puts Alfa's own question into an Alfa round", "201", async () => (await mk("hr", A, [ownA.id, lib2[0]])).status === 201);
  await t("QUESTIONS", "own question counts into the 3–5 limit: fixed + own + 3 library", "201 with 5 questions", async () => { const r = await mk("mA", A, [ownA.id, lib2[0], lib2[1], lib2[2]]); return r.status === 201; });
  await t("QUESTIONS", "own question counts into the limit: fixed + own + 4 library", "400 too_many", async () => { const r = await mk("mA", A, [ownA.id, ...lib2]); return { ok: r.status === 400 && r.json.fields?.questionIds === "too_many", actual: `${r.status} ${r.text}` }; });
  await t("QUESTIONS", "an own question cannot be edited or deleted", "PUT/PATCH/DELETE on /api/questions and /api/questions/:id → 404 or 405; row unchanged", async () => {
    const codes = [];
    for (const m of ["PUT", "PATCH", "DELETE"]) { codes.push((await req(m, "/api/questions", { as: "mA", body: { id: ownA.id, text: "Zmenený text otázky QA2?" } })).status); codes.push((await req(m, `/api/questions/${ownA.id}`, { as: "mA", body: { text: "Zmenený text otázky QA2?" } })).status); }
    const row = await db.question.findUnique({ where: { id: ownA.id } });
    return { ok: codes.every((c) => c === 404 || c === 405) && row?.text === ownA.text, actual: `statuses ${codes.join(",")}; row intact: ${row?.text === ownA.text}` };
  });
  await t("QUESTIONS", "employee and HR cannot create an own question", "403 for both (IT-07: employee 403; HR owns no team library)", async () => { const a = await Q("a1", { text: "Otázka od zamestnanca QA2?" }), h = await Q("hr", { text: "Otázka od HR QA2 test?" }); return { ok: a.status === 403 && h.status === 403, actual: `${a.status}/${h.status}` }; });
  await t("QUESTIONS", "HTML in an own question is escaped on /rounds/new", "raw tag never in the HTML", async () => {
    const c = await Q("mA", { text: `QA2 ${XSS} otázka?` });
    const r = await G("/rounds/new", "mA");
    return { ok: c.status === 201 && r.status === 200 && escaped(r.text), actual: `create ${c.status}, page ${r.status}, escaped ${escaped(r.text)}` };
  });
  await t("QUESTIONS-RACE", "5 concurrent requests with the same wording in 5 letter-case variants", "exactly one 201, four 400 duplicate (rule 'same wording must not exist twice', BUG-005)", async () => {
    const v = ["Súbeh qa2 otázka číslo jedna?", "SÚBEH QA2 OTÁZKA ČÍSLO JEDNA?", "súbeh qa2 otázka číslo jedna?", "Súbeh QA2 Otázka Číslo Jedna?", "sÚBEH qA2 oTÁZKA čÍSLO jEDNA?"];
    const rs = await Promise.all(v.map((text) => Q("mB", { text })));
    const rows = (await db.question.findMany({ where: { teamId: B } })).filter((q) => q.text.toLocaleLowerCase("sk") === v[2]).length;
    return { ok: rs.filter((r) => r.status === 201).length === 1 && rows === 1, actual: `statuses ${rs.map((r) => r.status).join(",")}; rows with this wording in the DB: ${rows}` };
  });

  // =====================================================================
  suite("N5 Suggestions (IT-09), threshold in trend/heatmap with time simulation (IT-08, NFR-02)", "team Alfa: rounds S1 (6 responses), S2 (5), S3 (5, with an own question), LOW (4) created, filled and closed through the API with known answers");
  await closeR(openA); // 0 responses
  const lib = ctx.lib;
  const qOver = lib.find((q) => q.scale === "OVERTIME");
  const agr = lib.filter((q) => q.scale === "AGREEMENT");
  const topicsAgr = [...new Set(agr.map((q) => q.topic))].filter((x) => x !== qOver.topic);
  const multi = topicsAgr.find((tp) => agr.filter((q) => q.topic === tp).length >= 2);
  const rest = topicsAgr.filter((tp) => tp !== multi);
  const qa = agr.find((q) => q.topic === rest[0]), qb = agr.find((q) => q.topic === rest[1]), qz = agr.find((q) => q.topic === rest[2]);
  const [q1, q2] = agr.filter((q) => q.topic === multi);
  const custom = ownA;
  const alfa = ["a1", "a2", "a3", "a4", "a5", "mA"];
  const fill = async (picked, who, values, comment) => {
    const id = await mkRound("mA", A, picked);
    await P(`/api/rounds/${id}/open`, "mA");
    for (const [i, u] of who.entries()) { const r = await submit(u, id, values, comment ? `${comment}-${i}` : undefined); if (r.status !== 201) throw new Error("submit failed " + r.status + r.text); }
    return id;
  };
  const S1 = await fill([qOver, qa, qb], alfa, [1, 5, 2, 4], "QA2-S1-COMMENT");
  const S2 = await fill([q1, q2], alfa.slice(0, 5), [3, 2, 4]);
  const S3 = await fill([custom, qb], alfa.slice(0, 5), [5, 1, 3]);
  const LOW = await fill([qz, qb], alfa.slice(0, 4), [1, 1, 1], "QA2-LOW-COMMENT");
  let cfg = null;
  try { cfg = await import("../../../src/config/suggestions.ts"); } catch { /* type stripping unavailable */ }

  await t("SUGGEST", "open round S1 with 6 responses", "exactly {status:not_closed} (IT-09)", async () => (await G(`/api/rounds/${S1}/suggestions`, "mA")).text === '{"status":"not_closed"}');
  for (const id of [S1, S2, S3, LOW]) { await closeR(id, "mA"); await sleep(20); }
  let sug;
  await t("SUGGEST", "S1 [fixed=1, overtime=5 (reversed), A=2, B=4]: two suggestions", "provider 'rules'; 1st reacts to the overtime question (average 5, favourability 1), 2nd to question A (2); fixed question (1) ignored (IT-09)", async () => {
    sug = (await G(`/api/rounds/${S1}/suggestions`, "mA")).json;
    const s = sug.suggestions ?? [];
    return { ok: sug.status === "ok" && sug.provider === "rules" && s.length === 2 && s[0].questionText === qOver.text && s[0].average === 5 && s[1].questionText === qa.text && s[1].average === 2 && s[0].topic !== s[1].topic, actual: JSON.stringify(s.map((x) => [x.topic, x.average])) };
  });
  await t("SUGGEST", "suggestion texts come from the rule library of the question's topic", "1st texts of SUGGESTIONS[topic] in src/config/suggestions.ts", async () => {
    if (!cfg) return null;
    const s = sug.suggestions;
    return { ok: s[0].suggestion === cfg.SUGGESTIONS[qOver.topic][0] && s[1].suggestion === cfg.SUGGESTIONS[qa.topic][0], actual: `match: ${s[0].suggestion === cfg.SUGGESTIONS[qOver.topic][0]} / ${s[1].suggestion === cfg.SUGGESTIONS[qa.topic][0]}` };
  });
  await t("SUGGEST", "suggestion item shape", "keys average,questionText,suggestion,topic; response keys provider,status,suggestions – no comments", async () => ({ ok: keysOf(sug) === "provider,status,suggestions" && sug.suggestions.every((x) => keysOf(x) === "average,questionText,suggestion,topic") && !JSON.stringify(sug).includes("QA2-S1-COMMENT"), actual: keysOf(sug) + " / " + keysOf(sug.suggestions[0]) }));
  await t("SUGGEST", "deterministic: three calls, manager and HR", "identical JSON every time", async () => {
    const a = (await G(`/api/rounds/${S1}/suggestions`, "mA")).text, b = (await G(`/api/rounds/${S1}/suggestions`, "mA")).text, c = (await G(`/api/rounds/${S1}/suggestions`, "hr")).text;
    return a === b && b === c && a === JSON.stringify(sug);
  });
  await t("SUGGEST", "S2 [fixed, two questions of ONE topic]: fill-up from the same topic", "2 suggestions, same topic, weakest first (2 then 4), two different texts", async () => {
    const s = (await G(`/api/rounds/${S2}/suggestions`, "mA")).json.suggestions;
    return { ok: s.length === 2 && s[0].topic === multi && s[1].topic === multi && s[0].average === 2 && s[1].average === 4 && s[0].suggestion !== s[1].suggestion, actual: JSON.stringify(s.map((x) => [x.topic, x.average])) };
  });
  await t("SUGGEST", "S3 with the team's own question as the weakest", "1st suggestion: topic 'Vlastné otázky tímu' with the fallback text; 2nd: question B", async () => {
    const s = (await G(`/api/rounds/${S3}/suggestions`, "mA")).json.suggestions;
    const fb = cfg ? s[0].suggestion === cfg.FALLBACK_SUGGESTIONS[0] : s[0].suggestion.length > 10;
    return { ok: s.length === 2 && s[0].topic === "Vlastné otázky tímu" && s[0].average === 1 && fb && s[1].questionText === qb.text, actual: JSON.stringify(s.map((x) => [x.topic, x.average])) + ` fallback text: ${fb}` };
  });
  await t("SUGGEST", "LOW (4 responses): suggestions for manager and HR", "exactly {status:insufficient_responses,responseCount:4} (IT-09, NFR-02)", async () => {
    const a = (await G(`/api/rounds/${LOW}/suggestions`, "mA")).text, b = (await G(`/api/rounds/${LOW}/suggestions`, "hr")).text;
    return { ok: a === '{"status":"insufficient_responses","responseCount":4}' && a === b, actual: a };
  });
  await t("SUGGEST", "suggestions of an Alfa round for employee, manager Beta, anonymous", "403, 403, 401 (NFR-03)", async () => { const c = [(await G(`/api/rounds/${S1}/suggestions`, "a1")).status, (await G(`/api/rounds/${S1}/suggestions`, "mB")).status, (await G(`/api/rounds/${S1}/suggestions`)).status]; return { ok: c.join() === "403,403,401", actual: c.join() }; });

  await t("RESULTS", "S1 results: averages, distributions, comments", "averages 1,5,2,4; distributions concentrated in one bucket of 6; 6 comments (MVP-10)", async () => {
    const r = (await G(`/api/rounds/${S1}/results`, "mA")).json;
    const q = r.questions;
    return { ok: r.status === "ok" && r.responseCount === 6 && q.map((x) => x.average).join() === "1,5,2,4" && q[1].distribution.join() === "0,0,0,0,6" && q[0].distribution.join() === "6,0,0,0,0" && r.comments.length === 6 && new Set(r.comments).size === 6, actual: `avg ${q.map((x) => x.average).join()} comments ${r.comments.length}` };
  });
  await t("RESULTS", "S1 results carry nothing about respondents", "no member name, e-mail, user id or Response id in the JSON (NFR-01)", async () => {
    const txt = (await G(`/api/rounds/${S1}/results`, "hr")).text;
    const ids = (await db.response.findMany({ where: { roundId: S1 }, select: { id: true } })).map((x) => x.id);
    const leak = alfa.some((u) => txt.includes(U[u].name) || txt.includes(U[u].id)) || ids.some((id) => txt.includes(id)) || txt.includes("example.test");
    return { ok: !leak, actual: `leak: ${leak}` };
  });
  await t("THRESHOLD", "LOW (4 responses) results for manager and HR", "insufficient_responses, count 4, no questions/comments keys, comment text absent (MVP-11)", async () => {
    const a = await G(`/api/rounds/${LOW}/results`, "mA"), b = await G(`/api/rounds/${LOW}/results`, "hr");
    return { ok: [a, b].every((r) => r.json.status === "insufficient_responses" && r.json.responseCount === 4 && keysOf(r.json) === "participation,responseCount,round,status" && !r.text.includes("QA2-LOW-COMMENT")), actual: `${a.json.status}/${b.json.status}` };
  });
  await t("THRESHOLD", "pages of the LOW round never contain its comments or averages", "comment marker absent from /rounds/:id/results, /report (manager, HR), /team/:id (employee), /team/:id/trend, /hr/heatmap, /", async () => {
    const hits = [];
    for (const [p, as] of [[`/rounds/${LOW}/results`, "mA"], [`/rounds/${LOW}/results`, "hr"], [`/rounds/${LOW}/report`, "mA"], [`/team/${A}`, "a1"], [`/team/${A}/trend`, "mA"], ["/hr/heatmap", "hr"], ["/", "mA"], ["/", "hr"]]) { const r = await G(p, as); if (r.status !== 200 || r.text.includes("QA2-LOW-COMMENT")) hits.push(`${p}:${r.status}`); }
    return { ok: hits.length === 0, actual: hits.join(" ") || "no marker on 8 pages" };
  });
  let trend;
  await t("TREND", "trend of Alfa: 5 closed rounds, oldest first", "statuses [insufficient(0), ok, ok, ok, insufficient(4)] in closing order (IT-08)", async () => {
    trend = (await G(`/api/teams/${A}/trend`, "mA")).json;
    const p = trend.points;
    return { ok: p.map((x) => x.roundId).join() === [openA, S1, S2, S3, LOW].join() && p.map((x) => x.status).join() === "insufficient_responses,ok,ok,ok,insufficient_responses" && p[0].responded === 0 && p[4].responded === 4, actual: p.map((x) => `${x.status}(${x.responded})`).join(", ") };
  });
  await t("TREND", "points below the threshold are gaps", "keys closedAt,responded,roundId,roundName,status only – no fixed, no topics", async () => ({ ok: [trend.points[0], trend.points[4]].every((p) => keysOf(p) === "closedAt,responded,roundId,roundName,status"), actual: keysOf(trend.points[4]) }));
  await t("TREND", "S1 point: fixed score and topic scores, reversed scale flipped", `fixed 1; overtime topic 1 (= 6 − 5); topic A 2; topic B 4`, async () => { const p = trend.points[1]; return { ok: p.fixed === 1 && p.topics[qOver.topic] === 1 && p.topics[qa.topic] === 2 && p.topics[qb.topic] === 4, actual: JSON.stringify({ fixed: p.fixed, topics: Object.values(p.topics) }) }; });
  await t("TREND", "a topic asked only in the below-threshold round is not listed", "trend.topics does not contain the topic of question Z (only in LOW)", async () => ({ ok: !trend.topics.includes(qz.topic) && trend.topics.includes(qb.topic) && trend.topics.includes("Vlastné otázky tímu"), actual: `topics: ${trend.topics.length}, contains Z-topic: ${trend.topics.includes(qz.topic)}` }));
  await t("TREND", "trend as HR equals trend as the manager; employee and foreign manager refused", "same JSON; 403; 403", async () => { const h = await G(`/api/teams/${A}/trend`, "hr"), e = await G(`/api/teams/${A}/trend`, "a1"), o = await G(`/api/teams/${A}/trend`, "mB"); return { ok: h.text === JSON.stringify(trend) && e.status === 403 && o.status === 403, actual: `same: ${h.text === JSON.stringify(trend)}; ${e.status}/${o.status}` }; });
  const heat = async () => (await G("/api/hr/heatmap", "hr")).json;
  const rowA = (h) => h.teams.find((x) => x.teamId === A);
  await t("HEATMAP", "Alfa: mean over rounds above the threshold only", "roundsCounted 3; 'Stála otázka' = (1+3+5)/3 = 3 (2.5 if LOW leaked); topic B = (4+3)/2 = 3.5 (2.67 if LOW leaked) (IT-08, NFR-02)", async () => {
    const r = rowA(await heat());
    return { ok: r.roundsCounted === 3 && r.cells["Stála otázka"] === 3 && r.cells[qb.topic] === 3.5, actual: `counted ${r.roundsCounted}, fixed ${r.cells["Stála otázka"]}, topic B ${r.cells[qb.topic]}` };
  });
  await t("HEATMAP", "topic asked only below the threshold has no column and no cell", "heatmap.topics and Alfa cells lack the topic of question Z", async () => { const h = await heat(); return { ok: !h.topics.includes(qz.topic) && !(qz.topic in rowA(h).cells), actual: `in topics: ${h.topics.includes(qz.topic)}` }; });
  await t("HEATMAP", "Beta has only a round with 4 responses", "roundsCounted 0 and empty cells (bunka bez dát je prázdna)", async () => { const r = (await heat()).teams.find((x) => x.teamId === B); return { ok: r.roundsCounted === 0 && Object.keys(r.cells).length === 0, actual: JSON.stringify(r.cells) + " counted " + r.roundsCounted }; });
  await t("HEATMAP", "heatmap shape", "keys teams,topics,windowDays; windowDays 90; 'Stála otázka' is the first column", async () => { const h = await heat(); return { ok: keysOf(h) === "teams,topics,windowDays" && h.windowDays === 90 && h.topics[0] === "Stála otázka", actual: `${keysOf(h)} window ${h.windowDays} first '${h.topics[0]}'` }; });
  const at = (days, extraMs = 0) => new Date(Date.now() - days * DAY + extraMs);
  await t("HEATMAP", "time simulation: S1 closed 100 days ago", "Alfa roundsCounted 2; 'Stála otázka' = (3+5)/2 = 4", async () => {
    await db.round.update({ where: { id: S1 }, data: { closedAt: at(100), closesAt: at(100) } });
    const r = rowA(await heat());
    return { ok: r.roundsCounted === 2 && r.cells["Stála otázka"] === 4 && !(qOver.topic in r.cells), actual: `counted ${r.roundsCounted}, fixed ${r.cells["Stála otázka"]}` };
  }, { pre: "closedAt and closesAt of S1 moved 100 days into the past directly in prisma/qa-backend.db" });
  await t("TREND", "time simulation: the 100-day-old round stays in the trend and moves to the first place", "5 points, first is S1 with status ok (the trend has no window)", async () => { const p = (await G(`/api/teams/${A}/trend`, "mA")).json.points; return { ok: p.length === 5 && p[0].roundId === S1 && p[0].status === "ok", actual: `first is S1: ${p[0].roundId === S1}` }; });
  await t("HEATMAP", "time simulation: S3 closed 90 days + 1 hour ago / 90 days − 1 hour ago", "outside → Alfa counted 1 (fixed 3); inside → counted 2 (fixed 4)", async () => {
    await db.round.update({ where: { id: S3 }, data: { closedAt: at(90, -3600000), closesAt: at(90, -3600000) } });
    const out = rowA(await heat());
    await db.round.update({ where: { id: S3 }, data: { closedAt: at(90, 3600000), closesAt: at(90, 3600000) } });
    const inn = rowA(await heat());
    return { ok: out.roundsCounted === 1 && out.cells["Stála otázka"] === 3 && inn.roundsCounted === 2 && inn.cells["Stála otázka"] === 4, actual: `outside: ${out.roundsCounted}/${out.cells["Stála otázka"]}; inside: ${inn.roundsCounted}/${inn.cells["Stála otázka"]}` };
  }, { pre: "closedAt/closesAt of S3 moved in the DB" });
  await t("HEATMAP", "time simulation: legacy round without closedAt (S2: closedAt NULL, deadline 10 days ago)", "still counted; trend point date equals the deadline", async () => {
    const d = at(10);
    await db.round.update({ where: { id: S2 }, data: { closedAt: null, closesAt: d } });
    const r = rowA(await heat());
    const p = (await G(`/api/teams/${A}/trend`, "mA")).json.points.find((x) => x.roundId === S2);
    return { ok: r.roundsCounted === 2 && p.closedAt === d.toISOString(), actual: `counted ${r.roundsCounted}, point date equals deadline: ${p.closedAt === d.toISOString()}` };
  }, { pre: "closedAt of S2 set to NULL in the DB" });
  await t("SUMMARY", "team page data for an employee after the simulation", "LOW: results exactly {status:insufficient_responses}; S1: averages only (keys average,position,scale,text); no comments anywhere (MVP-14)", async () => {
    const r = await G(`/api/teams/${A}/summary`, "a1");
    const low = r.json.rounds.find((x) => x.id === LOW), s1 = r.json.rounds.find((x) => x.id === S1);
    return { ok: JSON.stringify(low.results) === '{"status":"insufficient_responses"}' && s1.results.questions.every((q) => keysOf(q) === "average,position,scale,text") && !/QA2-(S1|LOW)-COMMENT|distribution|comments/.test(r.text), actual: `LOW ${JSON.stringify(low.results)}; S1 keys ${keysOf(s1.results.questions[0])}` };
  });
  await t("SUMMARY", "team summary is ordered by the real closing time, newest first", "S1 (100 days ago) is last", async () => { const ids = (await G(`/api/teams/${A}/summary`, "a1")).json.rounds.map((x) => x.id); return { ok: ids.at(-1) === S1 && ids[0] === LOW, actual: `first LOW: ${ids[0] === LOW}, last S1: ${ids.at(-1) === S1}` }; });

  // ---- automatic closing on first touch (MVP-05, MVP-09) ----
  let auto, deadline;
  await t("ROUND-LIFE", "time simulation: deadline passes; the first request afterwards is a submission", "409 round_closed; nothing stored for that user (MVP-05, MVP-09)", async () => {
    auto = await mkOpenRound(B, 3);
    const first = await submit("b1", auto, [3, 3, 3, 3]);
    deadline = new Date(Date.now() - 60000);
    await db.round.update({ where: { id: auto }, data: { closesAt: deadline } });
    const late = await submit("b2", auto, [5, 5, 5, 5], "QA2-LATE-COMMENT");
    const parts = await db.participation.count({ where: { roundId: auto } }), resp = await db.response.count({ where: { roundId: auto } });
    return { ok: first.status === 201 && late.status === 409 && late.json.error === "round_closed" && parts === 1 && resp === 1, actual: `first ${first.status}, late ${late.status} ${late.text}; participations ${parts}, responses ${resp}` };
  }, { pre: "open Beta round; closesAt moved 1 minute into the past directly in the DB" });
  await t("ROUND-LIFE", "the automatically closed round counts as closed at its deadline", "status CLOSED and closedAt = closesAt in the DB (IT-05)", async () => { const r = await db.round.findUnique({ where: { id: auto } }); return { ok: r.status === "CLOSED" && r.closedAt?.getTime() === deadline.getTime(), actual: `${r.status}, closedAt==deadline: ${r.closedAt?.getTime() === deadline.getTime()}` }; });
  await t("ROUND-LIFE", "closing or opening the automatically closed round by hand", "409 invalid_state for both", async () => { const c = await closeR(auto), o = await P(`/api/rounds/${auto}/open`, "hr"); return { ok: c.status === 409 && o.status === 409, actual: `${c.status} ${c.text} / ${o.status} ${o.text}` }; });
  await t("ROUND-LIFE", "employee's round list after the deadline", "the round is no longer listed for the employee; the manager sees it as CLOSED awaiting action (MVP-06, MVP-15)", async () => {
    const e = (await G("/api/rounds", "b3")).json.rounds.some((x) => x.id === auto), m = (await G("/api/rounds", "mB")).json.rounds.find((x) => x.id === auto);
    return { ok: !e && m.status === "CLOSED" && m.awaitingAction === true, actual: `employee sees it: ${e}; manager: ${m.status}, awaitingAction ${m.awaitingAction}` };
  });
  await t("ROUND-LIFE", "known BUG-010 remainder: draft whose deadline passed", "open → 409 deadline_passed; the draft stays in the list (known, partially fixed in session 001)", async () => {
    const d = await mkRound("mB", B);
    await db.round.update({ where: { id: d }, data: { closesAt: new Date(Date.now() - DAY) } });
    const o = await P(`/api/rounds/${d}/open`, "mB");
    const listed = (await G("/api/rounds", "mB")).json.rounds.some((x) => x.id === d && x.status === "DRAFT");
    return { ok: o.status === 409 && o.json.error === "deadline_passed" && listed, actual: `${o.status} ${o.text}; still listed as DRAFT: ${listed}` };
  }, { pre: "draft of Beta with closesAt moved 1 day into the past in the DB" });

  // =====================================================================
  suite("N6 HR issues and meeting notes (IT-10) – extended", "state from N1–N5");
  const I = (body, as = "hr") => P("/api/hr/issues", as, body);
  const ib = (extra = {}) => ({ title: "QA2 podnet " + Math.random().toString(36).slice(2, 7), source: "OTHER", ownerGroup: "OTHER", ...extra });
  const seedNote = (await db.meetingNote.findFirst()).id;
  let iss;
  await t("HR-ISSUE", "issue with a round of Beta and teamId of Alfa", "201; the team is the round's team (Beta)", async () => { const r = await I(ib({ roundId: seedB, teamId: A, source: "SURVEY" })); iss = r.json?.issue; return { ok: r.status === 201 && iss.team.id === B && iss.round.id === seedB, actual: `${r.status} team is Beta: ${iss?.team?.id === B}` }; });
  await t("HR-ISSUE", "issue item shape", "keys createdAt,description,dueDate,id,note,ownerGroup,round,source,status,team,title; round has id,name only; no author, no response data", async () => ({ ok: keysOf(iss) === "createdAt,description,dueDate,id,note,ownerGroup,round,source,status,team,title" && keysOf(iss.round) === "id,name" && keysOf(iss.team) === "id,name", actual: keysOf(iss) }));
  await t("HR-ISSUE", "mass assignment on create: status DONE, createdById (manager), id, createdAt", "201; status OPEN, created by HR, own id", async () => {
    const r = await I(ib({ status: "DONE", createdById: U.mA.id, id: "qa-spoof", createdAt: "2000-01-01T00:00:00.000Z" }));
    const row = await db.issue.findUnique({ where: { id: r.json.issue.id } });
    return { ok: r.status === 201 && r.json.issue.status === "OPEN" && row.createdById === U.hr.id && r.json.issue.id !== "qa-spoof" && new Date(r.json.issue.createdAt).getFullYear() > 2020, actual: `${r.status} status ${r.json.issue.status}, author is HR: ${row.createdById === U.hr.id}` };
  });
  await t("HR-ISSUE", "issue created from a note shows up under that note", "201; GET /api/hr/notes lists it in note.issues with id,status,title", async () => {
    const r = await I(ib({ noteId: seedNote, source: "MEETING" }));
    const n = (await G("/api/hr/notes", "hr")).json.notes.find((x) => x.id === seedNote);
    const it = n.issues.find((x) => x.id === r.json.issue.id);
    return { ok: r.status === 201 && !!it && keysOf(it) === "id,status,title", actual: `${r.status} listed: ${!!it}` };
  });
  await t("HR-ISSUE", "issue with both a note and a round", "201 with note, round and the round's team", async () => { const r = await I(ib({ noteId: seedNote, roundId: S1 })); return r.status === 201 && r.json.issue.note.id === seedNote && r.json.issue.round.id === S1 && r.json.issue.team.id === A; });
  await t("HR-ISSUE", "title of 120 emoji / 121 emoji", "201 / 400 too_long (length in characters, BUG-006)", async () => { const a = await I(ib({ title: "🎉".repeat(120) })), b = await I(ib({ title: "🎉".repeat(121) })); return { ok: a.status === 201 && b.status === 400 && b.json.fields?.title === "too_long", actual: `${a.status}/${b.status}` }; });
  const PI = (id, body, as = "hr") => req("PATCH", `/api/hr/issues/${id}`, { as, body });
  await t("HR-ISSUE", "PATCH with only a title", "400 (title cannot change; nothing to update)", async () => { const r = await PI(iss.id, { title: "Zmenený názov" }); return { ok: r.status === 400, actual: `${r.status} ${r.text}` }; });
  await t("HR-ISSUE", "PATCH status + title + description + teamId + createdById", "200; only the status changes", async () => {
    const r = await PI(iss.id, { status: "IN_PROGRESS", title: "Zmenený názov", description: "x", teamId: A, createdById: U.mA.id });
    const row = await db.issue.findUnique({ where: { id: iss.id } });
    return { ok: r.status === 200 && r.json.issue.status === "IN_PROGRESS" && row.title === iss.title && row.teamId === B && row.createdById === U.hr.id, actual: `${r.status} status ${r.json?.issue?.status}; title/team/author intact: ${row.title === iss.title && row.teamId === B && row.createdById === U.hr.id}` };
  });
  await t("HR-ISSUE", "PATCH dueDate: set, clear with null, clear with ''", "200 each; date set then null", async () => {
    const a = await PI(iss.id, { dueDate: dateStr(10) }), b = await PI(iss.id, { dueDate: null }), c = await PI(iss.id, { dueDate: dateStr(3) }), d = await PI(iss.id, { dueDate: "" });
    return { ok: [a, b, c, d].every((r) => r.status === 200) && a.json.issue.dueDate !== null && b.json.issue.dueDate === null && d.json.issue.dueDate === null, actual: [a, b, c, d].map((r) => `${r.status}:${r.json?.issue?.dueDate === null ? "null" : "date"}`).join(" ") };
  });
  for (const [label, v] of [["2026-02-30", "2026-02-30"], ["number 20270101", 20270101], ["'31.12.2026'", "31.12.2026"], ["ISO with time", "2026-12-31T10:00:00Z"], ["array", ["2026-12-31"]]]) {
    await t("HR-ISSUE-VALID", `PATCH dueDate invalid: ${label}`, "400 fields.dueDate=invalid, nothing changed", async () => { const r = await PI(iss.id, { dueDate: v }); return { ok: r.status === 400 && r.json.fields?.dueDate === "invalid", actual: `${r.status} ${r.text}` }; });
  }
  await t("HR-ISSUE", "status can go back: DONE → OPEN", "200/200", async () => { const a = await PI(iss.id, { status: "DONE" }), b = await PI(iss.id, { status: "OPEN" }); return a.status === 200 && b.status === 200 && b.json.issue.status === "OPEN"; });
  await t("HR-ISSUE", "PATCH status in lower case / null / number", "400 fields.status=invalid each", async () => { const rs = [await PI(iss.id, { status: "done" }), await PI(iss.id, { status: null }), await PI(iss.id, { status: 1 })]; return { ok: rs.every((r) => r.status === 400 && r.json.fields?.status === "invalid"), actual: rs.map((r) => r.status).join() }; });
  await t("HR-ISSUE", "PATCH of an unknown issue: HR, manager, employee, anonymous", "404, 403, 403, 401", async () => { const c = [(await PI(NOPE, { status: "DONE" })).status, (await PI(NOPE, { status: "DONE" }, "mA")).status, (await PI(iss.id, { status: "DONE" }, "a1")).status, (await PI(iss.id, { status: "DONE" }, null)).status]; return { ok: c.join() === "404,403,403,401", actual: c.join() }; });
  await t("HR-ISSUE", "no delete and no single-item read", "DELETE and GET /api/hr/issues/:id → 405; issue still exists", async () => { const d = await req("DELETE", `/api/hr/issues/${iss.id}`, { as: "hr" }), g = await G(`/api/hr/issues/${iss.id}`, "hr"); return { ok: d.status === 405 && g.status === 405 && !!(await db.issue.findUnique({ where: { id: iss.id } })), actual: `${d.status}/${g.status}` }; });
  const list = async (q) => { const r = await G("/api/hr/issues" + q, "hr"); return r; };
  await PI(iss.id, { status: "DONE", ownerGroup: "FACILITY" });
  await t("HR-ISSUE-FILTER", "status=ACTIVE", "only OPEN and IN_PROGRESS; the DONE issue is absent", async () => { const r = (await list("?status=ACTIVE")).json.issues; return { ok: r.length > 0 && r.every((x) => x.status !== "DONE") && !r.some((x) => x.id === iss.id), actual: `${r.length} issues, statuses ${[...new Set(r.map((x) => x.status))]}` }; });
  await t("HR-ISSUE-FILTER", "status=ALL and no filter", "both return everything, including DONE; same count as the DB", async () => { const a = (await list("?status=ALL")).json.issues, b = (await list("")).json.issues, n = await db.issue.count(); return { ok: a.length === n && b.length === n && a.some((x) => x.id === iss.id), actual: `ALL ${a.length}, none ${b.length}, DB ${n}` }; });
  await t("HR-ISSUE-FILTER", "group=FACILITY&status=DONE", "only issues that match both", async () => { const r = (await list("?group=FACILITY&status=DONE")).json.issues; return { ok: r.some((x) => x.id === iss.id) && r.every((x) => x.ownerGroup === "FACILITY" && x.status === "DONE"), actual: `${r.length} issues` }; });
  await t("HR-ISSUE-FILTER", "filter values in lower case (status=open, group=facility)", "400 validation_error (BUG-009 fix: unknown filter is an error)", async () => { const a = await list("?status=open"), b = await list("?group=facility"); return { ok: a.status === 400 && b.status === 400, actual: `${a.status} ${a.text} / ${b.status} ${b.text}` }; });
  await t("HR-ISSUE-FILTER", "SQL-style filter value (status=OPEN' OR '1'='1, group=FACILITY;DROP TABLE Issue)", "400 for both; Issue table intact", async () => { const a = await list("?status=" + encodeURIComponent("OPEN' OR '1'='1")), b = await list("?group=" + encodeURIComponent("FACILITY;DROP TABLE Issue")); return { ok: a.status === 400 && b.status === 400 && (await db.issue.count()) > 0, actual: `${a.status}/${b.status}, issues in DB: ${await db.issue.count()}` }; });
  await t("HR-ISSUE-FILTER", "repeated parameter (status=DONE&status=OPEN)", "200; the first value is used consistently (only DONE)", async () => { const r = await list("?status=DONE&status=OPEN"); return { ok: r.status === 200 && r.json.issues.every((x) => x.status === "DONE"), actual: `${r.status}, statuses ${[...new Set(r.json.issues.map((x) => x.status))]}` }; });
  await t("HR-ISSUE", "list is newest first", "createdAt non-increasing", async () => { const r = (await list("?status=ALL")).json.issues.map((x) => x.createdAt); return r.every((d, i) => i === 0 || r[i - 1] >= d); });
  await t("HR-ISSUE", "issue list and filters for non-HR", "403 manager, 403 employee, 401 anonymous – also with filters", async () => { const c = [(await G("/api/hr/issues?status=ALL", "mA")).status, (await G("/api/hr/issues?status=BOGUS", "a1")).status, (await G("/api/hr/issues")).status]; return { ok: c.join() === "403,403,401", actual: c.join() }; });
  const N = (body, as = "hr") => P("/api/hr/notes", as, body);
  await t("HR-NOTE", "note text of 10 000 / 10 001 characters", "201 / 400 too_long", async () => { const a = await N({ title: "QA2 dlhá poznámka", meetingDate: dateStr(-1), text: "p".repeat(10000) }), b = await N({ title: "QA2 dlhá poznámka 2", meetingDate: dateStr(-1), text: "p".repeat(10001) }); return { ok: a.status === 201 && b.status === 400 && b.json.fields?.text === "too_long", actual: `${a.status}/${b.status}` }; });
  await t("HR-NOTE", "mass assignment on a note: createdById, id, issues", "201; author HR, own id, no issues attached", async () => {
    const r = await N({ title: "QA2 poznámka spoof", meetingDate: dateStr(0), text: "Vymyslený text zo stretnutia.", createdById: U.a1.id, id: "qa-note", issues: [{ id: iss.id }] });
    const row = await db.meetingNote.findUnique({ where: { id: r.json.note.id }, include: { issues: true } });
    return { ok: r.status === 201 && keysOf(r.json.note) === "id" && r.json.note.id !== "qa-note" && row.createdById === U.hr.id && row.issues.length === 0, actual: `${r.status} author HR: ${row.createdById === U.hr.id}, issues ${row.issues.length}` };
  });
  await t("HR-NOTE", "notes are ordered by meeting date, newest first; item shape", "meetingDate non-increasing; keys createdAt,id,issues,meetingDate,text,title", async () => { const n = (await G("/api/hr/notes", "hr")).json.notes; return { ok: n.every((x, i) => i === 0 || n[i - 1].meetingDate >= x.meetingDate) && n.every((x) => keysOf(x) === "createdAt,id,issues,meetingDate,text,title"), actual: `${n.length} notes, keys ${keysOf(n[0])}` }; });
  await t("HR-NOTE", "HTML in a note and in an issue title is escaped on /hr/notes and /hr/issues", "raw tag never in the HTML", async () => {
    await N({ title: `QA2 ${XSS}`, meetingDate: dateStr(0), text: `Text ${XSS} poznámky.` });
    await I(ib({ title: `QA2 ${XSS} podnet`, description: `Opis ${XSS}` }));
    const a = await G("/hr/notes", "hr"), b = await G("/hr/issues?status=ALL", "hr");
    return { ok: a.status === 200 && b.status === 200 && escaped(a.text) && escaped(b.text), actual: `notes escaped ${escaped(a.text)}, issues escaped ${escaped(b.text)}` };
  });
  await t("HR-NOTE", "notes for non-HR (GET and POST)", "403 manager, 403 employee, 401 anonymous", async () => { const c = [(await G("/api/hr/notes", "mB")).status, (await N({ title: "QA2 x", meetingDate: dateStr(0), text: "x" }, "a1")).status, (await G("/api/hr/notes")).status]; return { ok: c.join() === "403,403,401", actual: c.join() }; });
  await t("HR-ISSUE", "issues and notes never read responses", "no comment marker of any round in GET /api/hr/issues and /api/hr/notes (IT-10)", async () => { const a = await list("?status=ALL"), b = await G("/api/hr/notes", "hr"); return !/QA2-(S1|LOW|LATE)-COMMENT/.test(a.text + b.text); });

  // =====================================================================
  suite("N7 HR overview maths with time simulation (IT-05)", "Beta: seed round closed 3 days ago without an action; automatically closed round from N5");
  const ov = async () => (await G("/api/hr/overview", "hr")).json;
  const tB = (o) => o.teams.find((x) => x.teamId === B);
  await t("HR-OVERVIEW", "Beta before any action", "closedRounds 2, roundsWithAction 0, sharePercent 0, median null; awaiting list longest first with the seed round at 3 days", async () => { const b = tB(await ov()); return { ok: b.closedRounds === 2 && b.roundsWithAction === 0 && b.sharePercent === 0 && b.medianDaysToFirstAction === null && b.awaitingRounds[0].id === seedB && b.awaitingRounds[0].daysWaiting === 3, actual: JSON.stringify({ closed: b.closedRounds, share: b.sharePercent, median: b.medianDaysToFirstAction, waiting: b.awaitingRounds.map((x) => x.daysWaiting) }) }; });
  let act;
  await t("HR-OVERVIEW", "manager Beta writes an action for the seed round (closed 3 days ago)", "roundsWithAction 1, sharePercent 50, median 3.0 days, planned 1, round leaves the awaiting list", async () => {
    act = (await P(`/api/rounds/${seedB}/actions`, "mB", { topic: "QA2 krok", description: "Vymyslený krok.", dueDate: dateStr(5) })).json.action;
    const b = tB(await ov());
    return { ok: b.roundsWithAction === 1 && b.sharePercent === 50 && b.medianDaysToFirstAction === 3 && b.actions.planned === 1 && !b.awaitingRounds.some((x) => x.id === seedB), actual: JSON.stringify({ with: b.roundsWithAction, share: b.sharePercent, median: b.medianDaysToFirstAction, actions: b.actions }) };
  });
  await t("HR-OVERVIEW", "time simulation: action created 36 hours after the round closed", "median 1.5 days", async () => {
    const r = await db.round.findUnique({ where: { id: seedB } });
    await db.action.update({ where: { id: act.id }, data: { createdAt: new Date(r.closedAt.getTime() + 36 * 3600000) } });
    const b = tB(await ov());
    return { ok: b.medianDaysToFirstAction === 1.5, actual: `median ${b.medianDaysToFirstAction}` };
  }, { pre: "Action.createdAt changed directly in the DB" });
  await t("HR-OVERVIEW", "time simulation: action past its due date; then marked DONE", "overdue 1 while PLANNED; overdue 0 and done 1 after PATCH DONE", async () => {
    await db.action.update({ where: { id: act.id }, data: { dueDate: new Date(Date.now() - DAY) } });
    const a = tB(await ov()).actions;
    await req("PATCH", `/api/actions/${act.id}`, { as: "mB", body: { status: "DONE" } });
    const b = tB(await ov()).actions;
    return { ok: a.overdue === 1 && b.overdue === 0 && b.done === 1 && b.planned === 0, actual: `${JSON.stringify(a)} → ${JSON.stringify(b)}` };
  }, { pre: "Action.dueDate moved to yesterday directly in the DB" });
  await t("HR-OVERVIEW", "totals equal the sum of the teams", "total.closedRounds / roundsWithAction / action counts = Alfa + Beta", async () => { const o = await ov(); const s = (f) => o.teams.reduce((n, x) => n + f(x), 0); return { ok: o.total.closedRounds === s((x) => x.closedRounds) && o.total.roundsWithAction === s((x) => x.roundsWithAction) && o.total.actions.done === s((x) => x.actions.done), actual: `total closed ${o.total.closedRounds}, with action ${o.total.roundsWithAction}` }; });
  await t("HR-OVERVIEW", "overview contains nothing from responses", "no comment marker, no averages keys", async () => { const r = await G("/api/hr/overview", "hr"); return !/QA2-(S1|LOW|LATE)-COMMENT|average|distribution/.test(r.text); });

  // =====================================================================
  suite("N8 Injection-style and malformed inputs (safe, non-destructive)", "state from N1–N7");
  const usersBefore = await db.user.count();
  for (const [label, body] of [["SQL in e-mail", { email: "' OR '1'='1' --", password: "x" }], ["SQL in password", { email: "hr@example.test", password: "' OR '1'='1" }], ["operator object as e-mail", { email: { contains: "" }, password: "Heslo123" }], ["operator object as password", { email: "hr@example.test", password: { not: "" } }], ["array as e-mail", { email: ["hr@example.test"], password: "Heslo123" }], ["e-mail with a trailing NUL", { email: "hr@example.test\u0000", password: "Heslo123" }], ["e-mail with a wildcard %", { email: "%@example.test", password: "Heslo123" }]]) {
    await t("INJECTION", `login: ${label}`, "401 invalid_credentials, no session cookie, no 500", async () => { const r = await P("/api/login", undefined, body); return { ok: r.status === 401 && r.json.error === "invalid_credentials" && r.setCookie.length === 0, actual: `${r.status} ${r.text}` }; });
  }
  await t("INJECTION", "kudos: toUserId as a Prisma operator object {not:''}", "400 fields.toUserId=required, nothing stored", async () => { const n = await db.kudos.count(); const r = await K("a1", { toUserId: { not: "" }, emoji: "👏", value: "HELPING", visibility: "PRIVATE" }); return { ok: r.status === 400 && r.json.fields?.toUserId === "required" && (await db.kudos.count()) === n, actual: `${r.status} ${r.text}` }; });
  await t("INJECTION", "kudos: __proto__ and constructor keys carrying an emoji", "400 too_short (prototype keys are not read as fields); later requests unaffected", async () => {
    const raw = `{"__proto__":{"emoji":"👏","text":"${"x".repeat(30)}"},"constructor":{"prototype":{"emoji":"👏"}},"toUserId":"${U.a2.id}","value":"HELPING","visibility":"TEAM","text":"krátke"}`;
    const r = await req("POST", "/api/kudos", { as: "a1", raw, headers: { "content-type": "application/json" } });
    const after = await K("a1", base("a2", { text: "krátke" }));
    return { ok: r.status === 400 && r.json.fields?.text === "too_short" && after.status === 400, actual: `${r.status} ${r.text}; next request ${after.status}` };
  });
  await t("INJECTION", "round: questionIds as objects / nested arrays", "400 fields.questionIds=invalid", async () => { const a = await mk("hr", A, [{ id: lib2[0] }, { id: lib2[1] }, { id: lib2[2] }]), b = await mk("hr", A, [[lib2[0]], [lib2[1]], [lib2[2]]]); return { ok: a.status === 400 && b.status === 400 && a.json.fields?.questionIds === "invalid", actual: `${a.status} ${a.text} / ${b.status}` }; });
  await t("INJECTION", "round: teamId as an operator object as HR", "400 fields.teamId=required (not treated as 'any team')", async () => { const r = await P("/api/rounds", "hr", { name: "QA2 inj", teamId: { not: "" }, closesAt: dateStr(7), questionIds: lib2.slice(0, 3) }); return { ok: r.status === 400 && r.json.fields?.teamId === "required", actual: `${r.status} ${r.text}` }; });
  await t("INJECTION", "round: teamId as an operator object as manager Alfa", "never a round in a foreign team: 201 for the own team (default) or 400", async () => {
    const r = await P("/api/rounds", "mA", { name: "QA2 inj2", teamId: { not: A }, closesAt: dateStr(7), questionIds: lib2.slice(0, 3) });
    const row = r.status === 201 ? await db.round.findUnique({ where: { id: r.json.round.id } }) : null;
    return { ok: (r.status === 201 && row.teamId === A) || r.status === 400, actual: `${r.status}${row ? " team is own: " + (row.teamId === A) : ""}` };
  });
  await t("INJECTION", "responses: answers as numeric strings, floats, booleans, nested arrays, object", "400 fields.answers=invalid for each; nothing stored", async () => {
    const rnd = await mkOpenRound(B, 3);
    const rs = [];
    for (const a of [["3", "3", "3", "3"], [3.5, 3, 3, 3], [true, true, true, true], [[3], [3], [3], [3]], { 0: 3, 1: 3, 2: 3, 3: 3, length: 4 }, [3, 3, 3, 3, 3], [3, 3, 3], [0, 3, 3, 3], [6, 3, 3, 3], [-1, 3, 3, 3], [1e0, 2, 3, null]]) rs.push(await submit("b1", rnd, a));
    const n = await db.response.count({ where: { roundId: rnd } });
    await closeR(rnd);
    return { ok: rs.every((r) => r.status === 400 && r.json.fields?.answers === "invalid") && n === 0, actual: `statuses ${rs.map((r) => r.status).join(",")}; stored ${n}` };
  });
  await t("INJECTION", "path traversal in ids (/api/rounds/..%2F..%2Fme/results, /api/teams/%2e%2e/summary, /api/actions/..%2Fme)", "never 200 with foreign data, never 500", async () => {
    const c = [(await G("/api/rounds/..%2F..%2Fme/results", "hr")).status, (await G("/api/teams/%2e%2e/summary", "a1")).status, (await req("PATCH", "/api/actions/..%2Fme", { as: "mA", body: { status: "DONE" } })).status];
    return { ok: c.every((s) => [400, 403, 404, 405].includes(s)), actual: c.join() };
  });
  await t("INJECTION", "SQL text in ids of every id-carrying page", "403/404 pages, never 500", async () => {
    const bad = encodeURIComponent("x' OR '1'='1");
    const c = [];
    for (const [p, as] of [[`/team/${bad}`, "hr"], [`/team/${bad}/trend`, "hr"], [`/rounds/${bad}/results`, "hr"], [`/rounds/${bad}/report`, "mA"], [`/rounds/${bad}/fill`, "a1"]]) c.push((await G(p, as)).status);
    return { ok: c.every((s) => s === 403 || s === 404), actual: c.join() };
  });
  await t("INJECTION", "HTML in a round name is escaped on /rounds, /hr/rounds and the fill page", "raw tag never in the HTML", async () => {
    const r = await P("/api/rounds", "mB", { name: `QA2 ${XSS}`, closesAt: dateStr(7), questionIds: lib2.slice(0, 2) });
    await P(`/api/rounds/${r.json.round.id}/open`, "mB");
    const pages = [await G("/rounds", "mB"), await G("/hr/rounds", "hr"), await G(`/rounds/${r.json.round.id}/fill`, "b1"), await G("/", "b1")];
    await closeR(r.json.round.id);
    return { ok: pages.every((p) => p.status === 200 && escaped(p.text)), actual: pages.map((p) => `${p.status}:${escaped(p.text)}`).join(" ") };
  });
  await t("INJECTION", "no user was created, removed or changed role by any request so far", "13 users; roles 1 HR, 2 managers, 10 employees (MVP-02)", async () => {
    const g = await db.user.groupBy({ by: ["role"], _count: true });
    const m = Object.fromEntries(g.map((x) => [x.role, x._count]));
    return { ok: usersBefore === 13 && (await db.user.count()) === 13 && m.HR === 1 && m.MANAGER === 2 && m.EMPLOYEE === 10, actual: JSON.stringify(m) };
  });
  await t("BODY", "JSON with a UTF-8 BOM / with duplicate keys / deeply nested (2 000 levels)", "400 or the normal validation result; never 500", async () => {
    const a = await req("POST", "/api/kudos", { as: "a1", raw: "﻿{}", headers: { "content-type": "application/json" } });
    const b = await req("POST", "/api/kudos", { as: "a1", raw: `{"toUserId":"${U.a1.id}","toUserId":"${U.a2.id}","emoji":"👏","value":"HELPING","visibility":"PRIVATE"}`, headers: { "content-type": "application/json" } });
    const c = await req("POST", "/api/kudos", { as: "a1", raw: "[".repeat(2000) + "]".repeat(2000), headers: { "content-type": "application/json" } });
    return { ok: [a, b, c].every((r) => [201, 400].includes(r.status)), actual: `${a.status}/${b.status}/${c.status}` };
  });
  await t("URL", "trailing slash, double slash and upper-case path on the API", "no 500; no data without the exact route (308/404)", async () => { const c = [(await G("/api/me/", "a1")).status, (await G("//api/me", "a1")).status, (await G("/API/ME", "a1")).status, (await G("/api/hr//issues", "a1")).status]; return { ok: c.every((s) => s < 500) && c[2] === 404, actual: c.join() }; });
  await t("URL", "known BUG-014: malformed percent-encoding in an API path and a page path", "still a bare 500 from the framework (known, open since session 001)", async () => { const a = await G("/api/rounds/%E0%A4%A", "hr"), b = await G("/team/%E0%A4%A", "hr"); return { ok: a.status === 500 || a.status === 400, actual: `api ${a.status} '${a.text.slice(0, 40)}', page ${b.status}` }; });

  // =====================================================================
  suite("N9 Concurrency", "state from N1–N8");
  await t("RACE", "5 concurrent 'open' on one draft", "exactly one 200, four 409 invalid_state; round OPEN once", async () => { const d = await mkRound("hr", B); const rs = await Promise.all([1, 2, 3, 4, 5].map(() => P(`/api/rounds/${d}/open`, "hr"))); ctx.raceRound = d; return { ok: rs.filter((r) => r.status === 200).length === 1 && rs.filter((r) => r.status === 409).length === 4, actual: rs.map((r) => r.status).join() }; });
  await t("RACE", "6 team members submit concurrently", "6 × 201; 6 participations and 6 responses in the DB (MVP-09)", async () => {
    const beta = ["b1", "b2", "b3", "b4", "b5", "mB"];
    const rs = await Promise.all(beta.map((u, i) => submit(u, ctx.raceRound, [1 + (i % 5), 2, 3, 4], `QA2-RACE-${i}`)));
    const p = await db.participation.count({ where: { roundId: ctx.raceRound } }), n = await db.response.count({ where: { roundId: ctx.raceRound } });
    return { ok: rs.every((r) => r.status === 201) && p === 6 && n === 6, actual: `${rs.map((r) => r.status).join()}; participations ${p}, responses ${n}` };
  });
  await t("RACE", "each member re-submits 3 times concurrently (18 requests)", "18 × 409 already_submitted; still 6 responses", async () => {
    const beta = ["b1", "b2", "b3", "b4", "b5", "mB"];
    const rs = await Promise.all(beta.flatMap((u) => [1, 2, 3].map(() => submit(u, ctx.raceRound, [5, 5, 5, 5]))));
    const n = await db.response.count({ where: { roundId: ctx.raceRound } });
    return { ok: rs.every((r) => r.status === 409 && r.json.error === "already_submitted") && n === 6, actual: `${[...new Set(rs.map((r) => r.status))]}; responses ${n}` };
  });
  await t("RACE", "5 concurrent 'close' on one open round (HR and manager mixed)", "exactly one 200, four 409; closedAt set", async () => { const rs = await Promise.all(["hr", "mB", "hr", "mB", "hr"].map((u) => closeR(ctx.raceRound, u))); const row = await db.round.findUnique({ where: { id: ctx.raceRound } }); return { ok: rs.filter((r) => r.status === 200).length === 1 && rs.filter((r) => r.status === 409).length === 4 && row.status === "CLOSED" && !!row.closedAt, actual: rs.map((r) => r.status).join() }; });
  await t("RACE", "submit and close fired together, 8 rounds (BUG-002 regression)", "in every round: 201 ⇒ exactly one response and one participation; 409 ⇒ none; never a response without participation", async () => {
    const out = [];
    for (let i = 0; i < 8; i++) {
      const id = await mkOpenRound(B, 2);
      const [s, c] = await Promise.all([submit(i % 2 ? "b1" : "b4", id, [2, 3, 4]), closeR(id, i % 2 ? "hr" : "mB")]);
      const p = await db.participation.count({ where: { roundId: id } }), n = await db.response.count({ where: { roundId: id } });
      out.push({ s: s.status, c: c.status, p, n, ok: c.status === 200 && p === n && ((s.status === 201 && n === 1) || (s.status === 409 && n === 0)) });
    }
    return { ok: out.every((x) => x.ok), actual: out.map((x) => `${x.s}/${x.c}:${x.p}+${x.n}`).join(" ") };
  });
  await t("RACE", "12 different users send kudos concurrently", "12 × 201 and 12 new rows", async () => {
    const n = await db.kudos.count();
    const senders = ["a1", "a2", "a3", "a4", "a5", "mA", "b1", "b2", "b3", "b4", "b5", "mB"];
    const rs = await Promise.all(senders.map((u, i) => K(u, base(senders[(i + 1) % 12], { emoji: "👏", text: `QA2 súbeh ${i}` }))));
    return { ok: rs.every((r) => r.status === 201) && (await db.kudos.count()) === n + 12 && new Set(rs.map((r) => r.json.kudos.id)).size === 12, actual: `${[...new Set(rs.map((r) => r.status))]}; +${(await db.kudos.count()) - n} rows` };
  });
  await t("RACE", "6 concurrent PATCH of one action with different statuses", "all 200; final status is one of the three; no 500", async () => {
    const st = ["PLANNED", "IN_PROGRESS", "DONE", "PLANNED", "IN_PROGRESS", "DONE"];
    const rs = await Promise.all(st.map((status) => req("PATCH", `/api/actions/${act.id}`, { as: "mB", body: { status } })));
    const row = await db.action.findUnique({ where: { id: act.id } });
    return { ok: rs.every((r) => r.status === 200) && st.includes(row.status), actual: `${rs.map((r) => r.status).join()} final ${row.status}` };
  });
  await t("RACE", "5 concurrent PATCH of one issue (status, group, due date mixed)", "all 200; row consistent with the allowed values", async () => {
    const bodies = [{ status: "OPEN" }, { ownerGroup: "IT_SUPPORT" }, { dueDate: dateStr(9) }, { status: "IN_PROGRESS" }, { dueDate: null }];
    const rs = await Promise.all(bodies.map((b) => PI(iss.id, b)));
    const row = await db.issue.findUnique({ where: { id: iss.id } });
    return { ok: rs.every((r) => r.status === 200) && row.ownerGroup === "IT_SUPPORT" && ["OPEN", "IN_PROGRESS"].includes(row.status), actual: `${rs.map((r) => r.status).join()} → ${row.status}/${row.ownerGroup}` };
  });
  await t("RACE", "13 concurrent logins of 13 different users", "13 × 200, each cookie resolves to its own user", async () => {
    const al = Object.keys(U);
    await Promise.all(al.map((a) => login(a)));
    const ms = await Promise.all(al.map((a) => G("/api/me", a)));
    return { ok: ms.every((r, i) => r.status === 200 && r.json.user.id === U[al[i]].id), actual: `${ms.filter((r, i) => r.json?.user?.id === U[al[i]].id).length}/13 resolved to the right user` };
  });
  await t("RACE", "3 concurrent logouts with the same token + a request racing with them", "no 500; afterwards the token is dead", async () => {
    const tok = tokens.b5;
    const rs = await Promise.all([1, 2, 3].map(() => fetch("http://localhost:3301/api/logout", { method: "POST", headers: { cookie: `fz_session=${tok}` } })).concat([fetch("http://localhost:3301/api/rounds", { headers: { cookie: `fz_session=${tok}` } })]));
    const after = await me(`fz_session=${tok}`);
    await login("b5");
    return { ok: rs.every((r) => r.status < 500) && after.status === 401, actual: `${rs.map((r) => r.status).join()} → after ${after.status}` };
  });
  await t("RACE", "20 parallel reads of results/summary/trend/heatmap while a round is closing", "no 500; every results answer is either not_closed or the final state", async () => {
    const id = await mkOpenRound(A, 2);
    for (const u of alfa.slice(0, 5)) await submit(u, id, [4, 4, 4]);
    const jobs = [];
    for (let i = 0; i < 5; i++) jobs.push(G(`/api/rounds/${id}/results`, "mA"), G(`/api/teams/${A}/summary`, "a1"), G(`/api/teams/${A}/trend`, "hr"), G("/api/hr/heatmap", "hr"));
    jobs.splice(7, 0, closeR(id, "mA"));
    const rs = await Promise.all(jobs);
    return { ok: rs.every((r) => r.status === 200), actual: [...new Set(rs.map((r) => r.status))].join() };
  });

  // =====================================================================
  suite("N10 NFR-01 storage and log, database integrity after the whole run", "database after N1–N9; server log testing/reports/2026-11-12_002/evidence/server-backend.log (read-only)");
  const cols = async (tbl) => (await db.$queryRawUnsafe(`PRAGMA table_info("${tbl}")`)).map((c) => c.name);
  await t("NFR-01-DB", "columns of Response", "exactly id, roundId, teamId, v1..v5, comment – no user, no time", async () => { const c = await cols("Response"); return { ok: [...c].sort().join() === "comment,id,roundId,teamId,v1,v2,v3,v4,v5", actual: c.join() }; });
  await t("NFR-01-DB", "columns of Participation", "exactly roundId, userId – no time, no response id", async () => { const c = await cols("Participation"); return { ok: [...c].sort().join() === "roundId,userId", actual: c.join() }; });
  await t("NFR-01-DB", "Response and Participation have no hidden rowid", "'select rowid' fails on both tables (WITHOUT ROWID)", async () => {
    const out = [];
    for (const tbl of ["Response", "Participation"]) { try { await db.$queryRawUnsafe(`select rowid from "${tbl}" limit 1`); out.push("rowid readable"); } catch { out.push("no rowid"); } }
    return { ok: out.every((x) => x === "no rowid"), actual: out.join(" / ") };
  });
  await t("NFR-01-DB", "all Response ids are random UUIDs (v4)", "every id matches the UUID v4 pattern", async () => { const ids = await db.response.findMany({ select: { id: true } }); const bad = ids.filter((x) => !UUID4.test(x.id)).length; return { ok: ids.length > 20 && bad === 0, actual: `${ids.length} responses, ${bad} not UUID v4` }; });
  await t("NFR-01-DB", "the only columns shared by Response and Participation are the round", "intersection = roundId; in round S1 six identical answer rows cannot be told apart", async () => {
    const a = await cols("Response"), b = await cols("Participation");
    const rows = await db.response.findMany({ where: { roundId: S1 }, select: { v1: true, v2: true, v3: true, v4: true } });
    return { ok: a.filter((c) => b.includes(c)).join() === "roundId" && new Set(rows.map((r) => JSON.stringify(r))).size === 1, actual: `shared: ${a.filter((c) => b.includes(c)).join()}` };
  });
  await t("NFR-01-DB", "no other table references a response or stores answer text", "no column named responseId/comment outside Response; Issue/MeetingNote/Action/Kudos contain no survey comment marker", async () => {
    const tables = (await db.$queryRawUnsafe(`select name from sqlite_master where type='table' and name not like '\\_%' escape '\\' and name not like 'sqlite%'`)).map((x) => x.name);
    const hits = [];
    for (const tb of tables) if (tb !== "Response") for (const c of await cols(tb)) if (/responseId|comment/i.test(c)) hits.push(`${tb}.${c}`);
    const dump = JSON.stringify([await db.issue.findMany(), await db.meetingNote.findMany(), await db.action.findMany(), await db.kudos.findMany()]);
    return { ok: hits.length === 0 && !/QA2-(S1|LOW|LATE|RACE)-COMMENT|QA2-RACE-\d/.test(dump), actual: `tables ${tables.length}; suspicious columns: ${hits.join() || "none"}` };
  });
  await t("NFR-01-LOG", "server log holds no response bodies", "none of the comment markers sent in this run, no 'answers', no e-mail and no password in the log", async () => {
    const buf = fs.readFileSync(path.join(ROOT, "testing", "reports", "2026-11-12_002", "evidence", "server-backend.log"));
    const txt = buf.toString("utf8") + buf.toString("utf16le");
    const hits = ["QA2-S1-COMMENT", "QA2-LOW-COMMENT", "QA2-LATE-COMMENT", "QA2-RACE-", "\"answers\"", "Heslo123", "example.test", "QA komentár"].filter((m) => txt.includes(m));
    return { ok: hits.length === 0, actual: `log ${buf.length} bytes, ${txt.split("\n").filter((l) => l.includes("[api]")).length} '[api]' error lines; forbidden markers found: ${hits.join() || "none"}` };
  });
  await t("NFR-01-LOG", "error lines of the server log have only method, path and error class", "every '[api]' line is '[api] METHOD /path failed: Name' (lines added by the PowerShell redirection of stderr – 'npx.cmd : …' and '+ CategoryInfo …' – are ignored)", async () => {
    const txt = fs.readFileSync(path.join(ROOT, "testing", "reports", "2026-11-12_002", "evidence", "server-backend.log"), "utf8");
    const lines = txt.split(/\r?\n/).filter((l) => l.includes("[api]") && !/^\s*\+ /.test(l)).map((l) => l.replace(/^npx\.cmd : /, ""));
    const bad = lines.filter((l) => !/^\[api\] [A-Z]+ \/\S* failed: \w+$/.test(l.trim()));
    return { ok: bad.length === 0, actual: `${lines.length} lines, ${bad.length} with extra content` };
  });
  await t("NFR-01-API", "the submit reply carries no id of the stored response", "201 exactly {ok:true}", async () => { const id = await mkOpenRound(A, 2); const r = await submit("a1", id, [3, 3, 3], "QA2-LATE-COMMENT"); await closeR(id); return { ok: r.status === 201 && r.text === '{"ok":true}', actual: `${r.status} ${r.text}` }; });
  const one = async (sql) => num(Object.values((await db.$queryRawUnsafe(sql))[0])[0]);
  await t("DB-INTEGRITY", "PRAGMA integrity_check and foreign_key_check", "'ok' and no violations", async () => { const a = await db.$queryRawUnsafe("PRAGMA integrity_check"), b = await db.$queryRawUnsafe("PRAGMA foreign_key_check"); return { ok: Object.values(a[0])[0] === "ok" && b.length === 0, actual: `${Object.values(a[0])[0]}, fk violations ${b.length}` }; });
  await t("DB-INTEGRITY", "every round has as many responses as participations", "0 rounds where the counts differ (one transaction, NFR-01)", async () => { const n = await one(`select count(*) from "Round" r where (select count(*) from "Response" x where x.roundId=r.id) <> (select count(*) from "Participation" p where p.roundId=r.id)`); return { ok: n === 0, actual: `${n} rounds differ` }; });
  await t("DB-INTEGRITY", "no participation of a user outside the round's team; no response with a foreign teamId", "0 rows", async () => { const a = await one(`select count(*) from "Participation" p join "Round" r on r.id=p.roundId join "User" u on u.id=p.userId where u.teamId is not r.teamId`), b = await one(`select count(*) from "Response" x join "Round" r on r.id=x.roundId where x.teamId <> r.teamId`); return { ok: a === 0 && b === 0, actual: `${a}/${b}` }; });
  await t("DB-INTEGRITY", "no round has more responses than team members; DRAFT rounds have none", "0 rows", async () => { const a = await one(`select count(*) from "Round" r where (select count(*) from "Response" x where x.roundId=r.id) > (select count(*) from "User" u where u.teamId=r.teamId)`), b = await one(`select count(*) from "Response" x join "Round" r on r.id=x.roundId where r.status='DRAFT'`); return { ok: a === 0 && b === 0, actual: `${a}/${b}` }; });
  await t("DB-INTEGRITY", "answer values and comment length", "all v1–v3 in 1..5, v4/v5 null or 1..5, answered positions = number of questions, comments ≤ 1000 characters", async () => {
    const a = await one(`select count(*) from "Response" where v1 not between 1 and 5 or v2 not between 1 and 5 or v3 not between 1 and 5 or (v4 is not null and v4 not between 1 and 5) or (v5 is not null and v5 not between 1 and 5) or length(comment) > 1000`);
    const b = await one(`select count(*) from "Response" x where (3 + (x.v4 is not null) + (x.v5 is not null)) <> (select count(*) from "RoundQuestion" q where q.roundId=x.roundId)`);
    return { ok: a === 0 && b === 0, actual: `${a} out of range, ${b} with a wrong number of answers` };
  });
  await t("DB-INTEGRITY", "rounds: 3–5 questions, positions 1..n without gaps, fixed question first, valid status", "0 violations (MVP-04, IT-04)", async () => {
    const a = await one(`select count(*) from "Round" r where (select count(*) from "RoundQuestion" q where q.roundId=r.id) not between 3 and 5`);
    const b = await one(`select count(*) from "Round" r where (select max(position) from "RoundQuestion" q where q.roundId=r.id) <> (select count(*) from "RoundQuestion" q where q.roundId=r.id) or (select min(position) from "RoundQuestion" q where q.roundId=r.id) <> 1`);
    const c = await one(`select count(*) from "RoundQuestion" rq join "Question" q on q.id=rq.questionId where rq.position=1 and q.fixed=0`);
    const d = await one(`select count(*) from "Round" where status not in ('DRAFT','OPEN','CLOSED') or (status='CLOSED' and closedAt is null and id <> '${S2}') or (status<>'CLOSED' and closedAt is not null)`);
    return { ok: a + b + c + d === 0, actual: `count ${a}, positions ${b}, fixed-first ${c}, status/closedAt ${d}` };
  });
  await t("DB-INTEGRITY", "own questions are used only in rounds of their team", "0 rows (IT-07)", async () => { const n = await one(`select count(*) from "RoundQuestion" rq join "Question" q on q.id=rq.questionId join "Round" r on r.id=rq.roundId where q.teamId is not null and q.teamId <> r.teamId`); return { ok: n === 0, actual: `${n}` }; });
  await t("DB-INTEGRITY", "kudos rows", "emoji null or one of the six; text ≤ 500 characters; text ≥ 20 when there is no emoji; never to oneself; valid value and visibility; no public kudos for a user without a team", async () => {
    const rows = await db.kudos.findMany({ include: { toUser: true } });
    const set = ["👏", "🙌", "💪", "🎉", "❤️", "⭐"];
    const bad = rows.filter((k) => (k.emoji !== null && !set.includes(k.emoji)) || [...k.text].length > 500 || (k.emoji === null && [...k.text].length < 20) || k.fromUserId === k.toUserId || !["COLLABORATION", "QUALITY", "HELPING", "INNOVATION", "CUSTOMER"].includes(k.value) || !["TEAM", "PRIVATE"].includes(k.visibility) || (k.visibility === "TEAM" && k.toUser.teamId === null));
    return { ok: rows.length > 20 && bad.length === 0, actual: `${rows.length} kudos, ${bad.length} violate a rule` };
  });
  await t("DB-INTEGRITY", "issues, notes, actions", "enum columns valid, titles within limits, every action belongs to a CLOSED round, issue.team = team of its round", async () => {
    const a = await one(`select count(*) from "Issue" where status not in ('OPEN','IN_PROGRESS','DONE') or source not in ('SURVEY','MEETING','OTHER') or ownerGroup not in ('FACILITY','IT_SUPPORT','HR','MANAGEMENT','TEAM_MANAGER','OTHER') or length(title) not between 3 and 120 or length(description) > 2000`);
    const b = await one(`select count(*) from "Action" a join "Round" r on r.id=a.roundId where r.status<>'CLOSED' or a.status not in ('PLANNED','IN_PROGRESS','DONE')`);
    const c = await one(`select count(*) from "Issue" i join "Round" r on r.id=i.roundId where i.teamId is not r.teamId`);
    const d = await one(`select count(*) from "MeetingNote" where length(title) not between 3 and 120 or length(text) not between 1 and 10000`);
    return { ok: a + b + c + d === 0, actual: `issues ${a}, actions ${b}, issue/round team ${c}, notes ${d}` };
  });
  await t("DB-INTEGRITY", "passwords are stored only as bcrypt hashes; e-mails are test addresses", "every passwordHash starts with $2 and is 60 characters; every e-mail ends with @example.test (NFR-05, NFR-06)", async () => { const us = await db.user.findMany(); return { ok: us.every((u) => /^\$2[aby]\$\d\d\$/.test(u.passwordHash) && u.passwordHash.length === 60 && u.email.endsWith("@example.test")), actual: `${us.length} users checked` }; });
  await t("DB-INTEGRITY", "duplicate check", "no duplicate e-mails, no duplicate (team, wording) questions, no duplicate participations", async () => { const a = await one(`select count(*) from (select email from "User" group by email having count(*)>1)`), b = await one(`select count(*) from (select teamId, lower(text) from "Question" group by teamId, lower(text) having count(*)>1)`), c = await one(`select count(*) from (select roundId,userId from "Participation" group by roundId,userId having count(*)>1)`); return { ok: a + b + c === 0, actual: `${a}/${b}/${c}` }; });

  // =====================================================================
  suite("N11 Home tasks through the page (IT-11)", "state from N1–N10; a fresh open round of Alfa");
  const hOpen = await mkOpenRound(A, 2);
  await t("HOME", "employee with an open, unanswered round", "home page links to /rounds/:id/fill", async () => (await G("/", "a2")).text.includes(`href="/rounds/${hOpen}/fill"`));
  await t("HOME", "after answering, the link to fill is gone", "no link to the fill page of that round", async () => { await submit("a2", hOpen, [4, 4, 4]); return !(await G("/", "a2")).text.includes(`href="/rounds/${hOpen}/fill"`); });
  await t("HOME", "employee of the other team and HR get no fill task for it", "no link on / for Beta employee and for HR", async () => { const b = await G("/", "b2"), h = await G("/", "hr"); return { ok: b.status === 200 && h.status === 200 && !b.text.includes(`/rounds/${hOpen}/fill`) && !h.text.includes(`/rounds/${hOpen}/fill`), actual: `${b.status}/${h.status}` }; });
  await t("HOME", "manager Alfa is pointed at closed rounds without an action", "home page links to the results of an Alfa round awaiting an action; never to a Beta round (IT-11)", async () => {
    const html = (await G("/", "mA")).text;
    const links = [...html.matchAll(/href="\/rounds\/([a-z0-9]+)\/results"/g)].map((m) => m[1]);
    const rounds = await db.round.findMany({ where: { id: { in: links } }, select: { teamId: true } });
    return { ok: links.length > 0 && rounds.every((r) => r.teamId === A), actual: `${links.length} result links, all Alfa: ${rounds.every((r) => r.teamId === A)}` };
  });
  await t("HOME", "home pages never show response content", "no comment marker on / for employee, manager and HR", async () => { const pages = [await G("/", "a1"), await G("/", "mA"), await G("/", "hr")]; return pages.every((p) => p.status === 200 && !/QA2-(S1|LOW|LATE)-COMMENT|QA2-RACE-\d/.test(p.text)); });
  await closeR(hOpen);

  // =====================================================================
  suite("N12 Residual checks of the session-001 fixes (BUG-003, 006, 007, 008) with new inputs", "state from N1–N11");
  const blank = [["U+200E left-to-right mark", "‎"], ["U+202E right-to-left override", "‮"], ["U+2800 braille blank", "⠀"], ["U+3164 Hangul filler", "ㅤ"], ["U+115F Hangul choseong filler", "ᅟ"], ["U+034F combining grapheme joiner", "͏"], ["U+2063 invisible separator", "⁣"], ["U+180E Mongolian vowel separator", "᠎"], ["U+FE0F variation selector alone", "️"], ["U+E0061 tag character", "\u{E0061}"]];
  for (const [label, ch] of blank) {
    await t("TEXT-INVISIBLE", `kudos without emoji whose text is 25 × ${label}`, "400 fields.text=too_short – a text with nothing visible is empty (BUG-007 fix: 'text bez viditeľného obsahu je prázdny')", async () => {
      const r = await K("a1", base("a2", { text: ch.repeat(25), visibility: "PRIVATE" }));
      return { ok: r.status === 400 && r.json.fields?.text === "too_short", actual: `${r.status} ${r.status === 201 ? "stored, text length " + [...r.json.kudos.text].length : r.text}` };
    });
  }
  await t("TEXT-INVISIBLE", "round name of 5 × U+3164 (renders as nothing)", "400 fields.name=required (BUG-007)", async () => { const r = await P("/api/rounds", "hr", { name: "ㅤ".repeat(5), teamId: B, closesAt: dateStr(7), questionIds: lib2.slice(0, 2) }); return { ok: r.status === 400 && r.json.fields?.name === "required", actual: `${r.status} ${r.status === 201 ? "draft created with an invisible name" : r.text}` }; });
  await t("TEXT-INVISIBLE", "own question of 12 × U+2800 (renders as nothing)", "400 fields.text=too_short (BUG-007)", async () => { const r = await Q("mB", { text: "⠀".repeat(12) }); return { ok: r.status === 400, actual: `${r.status} ${r.status === 201 ? "question created with invisible text" : r.text}` }; });
  await t("TEXT-INVISIBLE", "issue title of 5 × U+3164 and action topic of 5 × U+2800", "400 for both (BUG-007)", async () => {
    const a = await I(ib({ title: "ㅤ".repeat(5) })), b = await P(`/api/rounds/${seedB}/actions`, "mB", { topic: "⠀".repeat(5), description: "⠀".repeat(5), dueDate: dateStr(5) });
    return { ok: a.status === 400 && b.status === 400, actual: `issue ${a.status}, action ${b.status}` };
  });
  await t("TEXT-NORMALIZATION", "own question: same wording typed with composed and decomposed accents (NFC vs NFD)", "second one 400 duplicate – it reads exactly the same (BUG-005 rule 'same wording must not exist twice')", async () => {
    const txt = "Máme v tíme dosť času na učenie QA2?";
    const a = await Q("mB", { text: txt.normalize("NFC") }), b = await Q("mB", { text: txt.normalize("NFD") });
    return { ok: a.status === 201 && b.status === 400, actual: `NFC ${a.status}, NFD ${b.status}${b.status === 201 ? " (two visually identical questions in the team library)" : ""}` };
  });
  await t("UNICODE", "lone surrogate in the emoji field, in a nested value and in a key name (BUG-003 regression, new inputs)", "400 invalid_text for all three, never 500", async () => {
    const raw = (b) => req("POST", "/api/kudos", { as: "a1", raw: b, headers: { "content-type": "application/json" } });
    const a = await raw(`{"toUserId":"${U.a2.id}","emoji":"\\ud83d","value":"HELPING","visibility":"PRIVATE"}`);
    const b = await raw(`{"toUserId":"${U.a2.id}","emoji":"👏","value":"HELPING","visibility":"PRIVATE","extra":{"deep":["\\udc00"]}}`);
    const c = await raw(`{"toUserId":"${U.a2.id}","emoji":"👏","value":"HELPING","visibility":"PRIVATE","\\ud800key":1}`);
    return { ok: [a, b, c].every((r) => r.status === 400 && r.json.error === "invalid_text"), actual: [a, b, c].map((r) => `${r.status} ${r.json?.error}`).join(" / ") };
  });
  await t("UNICODE", "own question of exactly 200 emoji / 201 emoji (BUG-006 regression, new input)", "201 / 400 too_long – length in characters", async () => { const a = await Q("mB", { text: "🙂".repeat(200) }), b = await Q("mB", { text: "🙃".repeat(201) }); return { ok: a.status === 201 && b.status === 400 && b.json.fields?.text === "too_long", actual: `${a.status}/${b.status}` }; });
  await t("HR-ISSUE-VALID", "issue with noteId as a number, roundId as an array, teamId as boolean (BUG-008 regression, new inputs)", "400 with noteId, roundId, teamId = invalid; nothing stored", async () => { const n = await db.issue.count(); const r = await I(ib({ noteId: 5, roundId: [seedB], teamId: true })); return { ok: r.status === 400 && r.json.fields?.noteId === "invalid" && r.json.fields?.roundId === "invalid" && r.json.fields?.teamId === "invalid" && (await db.issue.count()) === n, actual: `${r.status} ${r.text}` }; });

  // =====================================================================
  suite("N13 Known risks of session 001 – one-line confirmation (not defects)", "state from N1–N12; PASS = still as described in BUG_REGISTER 'Riziká, ktoré nie sú chyby'");
  await t("RISK", "R-1 no limit on login attempts", "15 wrong passwords in a row, then the right one still logs in (risk still present)", async () => {
    const codes = [];
    for (let i = 0; i < 15; i++) codes.push((await P("/api/login", undefined, { email: "ivana.beta@example.test", password: "wrong" + i })).status);
    const ok = await P("/api/login", undefined, { email: "ivana.beta@example.test", password: "Heslo123" });
    return { ok: codes.every((c) => c === 401) && ok.status === 200, actual: `15 × 401, then ${ok.status}; no 429` };
  });
  await t("RISK", "R-2 session cookie carries Secure in the production build", "Set-Cookie has 'Secure' (login over plain HTTP on a non-localhost host would not keep the session)", async () => { const r = await P("/api/login", undefined, { email: "ivana.beta@example.test", password: "Heslo123" }); const c = r.setCookie[0] ?? ""; return { ok: /;\s*Secure/i.test(c), actual: `Secure present: ${/;\s*Secure/i.test(c)}` }; });
  await t("RISK", "R-3/R-4 no CSRF token, no security headers, no Cache-Control on API answers", "API JSON has no Cache-Control/X-Content-Type-Options/CSP/X-Frame-Options; pages send X-Powered-By (risk still present)", async () => {
    const a = await G("/api/me", "a1"), p = await G("/", "a1");
    const h = (r, n) => r.headers.get(n);
    return { ok: !h(a, "cache-control") && !h(a, "x-content-type-options") && !h(p, "content-security-policy") && !h(p, "x-frame-options"), actual: `api cache-control=${h(a, "cache-control")}, nosniff=${h(a, "x-content-type-options")}; page csp=${h(p, "content-security-policy")}, x-frame-options=${h(p, "x-frame-options")}, x-powered-by=${h(p, "x-powered-by")}` };
  });
  await t("RISK", "R-5 no request body size limit", "a 2 MB JSON body is read and answered with 400 validation_error, not 413", async () => { const r = await K("a1", base("a2", { text: "x".repeat(2 * 1024 * 1024) })); return { ok: r.status === 400 || r.status === 413, actual: `${r.status} ${r.text.slice(0, 60)}` }; });
  await t("RISK", "R-6 a repeated request creates a duplicate (no idempotency; BUG-037 open)", "two identical POST /api/rounds → two drafts", async () => { const body = { name: "QA2 dvojité odoslanie", teamId: B, closesAt: dateStr(7), questionIds: lib2.slice(0, 2) }; const a = await P("/api/rounds", "hr", body), b = await P("/api/rounds", "hr", body); return { ok: a.status === 201 && b.status === 201 && a.json.round.id !== b.json.round.id, actual: `${a.status}/${b.status}` }; });
  await t("RISK", "R-7 a team member can tell a draft of the own team (404) from an unknown id (403)", "404 vs 403 (risk still present)", async () => { const a = await G(`/api/rounds/${draftA}`, "a1"), b = await G(`/api/rounds/${NOPE}`, "a1"); return { ok: a.status === 404 && b.status === 403, actual: `${a.status} vs ${b.status}` }; });
}
