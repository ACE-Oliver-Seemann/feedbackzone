// Suite 8: HTTP-level and security checks (safe, non-destructive).
import fs from "node:fs";
import path from "node:path";
import { ROOT, ctx, db, is, req, reset, suite, t } from "./lib.mjs";

export default async function run() {
  suite("S8 HTTP methods, headers, injection, error handling", "fresh seed + demo data");
  await reset(true);
  const closedA = ctx.round(ctx.teamA, "46. týždeň");

  // ---- unsupported methods ----
  for (const [m, p] of [["POST", "/api/me"], ["DELETE", "/api/me"], ["PUT", "/api/rounds"], ["DELETE", "/api/rounds"], ["POST", `/api/rounds/${closedA.id}/results`], ["GET", `/api/rounds/${closedA.id}/responses`], ["DELETE", `/api/rounds/${closedA.id}/responses`], ["GET", `/api/rounds/${closedA.id}/open`], ["GET", `/api/rounds/${closedA.id}/actions`], ["POST", `/api/teams/${ctx.teamA}/summary`], ["POST", "/api/hr/overview"], ["POST", "/api/hr/heatmap"], ["DELETE", "/api/hr/notes"], ["PATCH", "/api/kudos"]]) {
    await t("HTTP-METHOD", `${m} ${p.replace(/c[a-z0-9]{20,}/, ":id")}`, "405 Method Not Allowed", async () => is(await req(m, p, { as: "hr" }), 405));
  }
  await t("HTTP-METHOD", "GET /api/rounds/:id/responses must never list responses", "405 and no response data in the body (NFR-01)", async () => { const r = await req("GET", `/api/rounds/${closedA.id}/responses`, { as: "mA" }); return r.status === 405 && !/v1|comment/.test(r.text); });
  await t("HTTP-METHOD", "HEAD /api/me", "200 with empty body", async () => { const r = await req("HEAD", "/api/me", { as: "hr" }); return r.status === 200 && r.text === ""; });
  await t("HTTP-METHOD", "OPTIONS /api/rounds from a foreign origin (CORS preflight)", "no Access-Control-Allow-Origin header (API is same-origin only)", async () => {
    const r = await req("OPTIONS", "/api/rounds", { headers: { origin: "https://evil.example", "access-control-request-method": "POST", "access-control-request-headers": "content-type" } });
    return { ok: !r.headers.get("access-control-allow-origin"), actual: `${r.status}; ACAO=${r.headers.get("access-control-allow-origin")}; allow=${r.headers.get("allow")}` };
  });
  await t("HTTP-METHOD", "X-HTTP-Method-Override: DELETE on GET /api/rounds", "ignored: 200 list", async () => is(await req("GET", "/api/rounds", { as: "hr", headers: { "x-http-method-override": "DELETE" } }), 200));
  await t("HTTP-METHOD", "unknown API path", "404, no stack trace", async () => { const r = await req("GET", "/api/admin/users", { as: "hr" }); return r.status === 404 && !/at .*\.js|node_modules/.test(r.text); });
  await t("HTTP-METHOD", "no user-listing endpoint is exposed", "GET /api/users, /api/teams, /api/teams/:id → 404/405", async () => {
    const codes = [];
    for (const p of ["/api/users", "/api/teams", `/api/teams/${ctx.teamA}`, "/api/responses", "/api/participations"]) codes.push((await req("GET", p, { as: "hr" })).status);
    return { ok: codes.every((c) => c === 404 || c === 405), actual: `statuses ${codes}` };
  });

  // ---- header tricks ----
  await t("HEADER", "x-middleware-subrequest header (Next.js middleware bypass trick) without a session", "401", async () => is(await req("GET", "/api/hr/overview", { headers: { "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware" } }), 401));
  await t("HEADER", "spoofed identity headers (X-User-Id, X-Role, X-Forwarded-User) without a session", "401", async () => is(await req("GET", "/api/me", { headers: { "x-user-id": ctx.users.hr.id, "x-role": "HR", "x-forwarded-user": "hr@example.test" } }), 401));
  await t("HEADER", "spoofed role headers with an employee session", "still EMPLOYEE; HR endpoint 403", async () => {
    const h = { "x-role": "HR", "x-user-role": "HR", "x-forwarded-for": "127.0.0.1", "x-original-url": "/api/hr/overview", "x-rewrite-url": "/api/hr/overview" };
    const a = await req("GET", "/api/hr/overview", { as: "a1", headers: h }), b = await req("GET", "/api/me", { as: "a1", headers: h });
    return a.status === 403 && b.json.user.role === "EMPLOYEE";
  });
  await t("HEADER", "Host header spoofed", "request still served normally or rejected; no 500", async () => { const r = await req("GET", "/api/me", { as: "hr", headers: { "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" } }); return r.status === 200; });
  await t("HEADER", "session cookie flags again on every login: Secure present in production build", "Secure; HttpOnly; SameSite=lax", async () => {
    const r = await req("POST", "/api/login", { body: { email: "hr@example.test", password: "Heslo123" } });
    const c = r.setCookie[0] ?? "";
    return { ok: /Secure/i.test(c) && /HttpOnly/i.test(c) && /SameSite=lax/i.test(c), actual: c.replace(/=[^;]+/, "=<token>") };
  });
  await t("HEADER", "API responses and caching", "informational: record Cache-Control of an authenticated JSON response", async () => {
    const r = await req("GET", `/api/rounds/${closedA.id}/results`, { as: "mA" });
    const cc = r.headers.get("cache-control");
    return { ok: true, actual: `cache-control: ${cc ?? "(absent)"}; vary: ${r.headers.get("vary")}` };
  });
  await t("HEADER", "security response headers on API and pages", "informational: record X-Content-Type-Options, X-Frame-Options, CSP, Referrer-Policy, X-Powered-By", async () => {
    const a = await req("GET", "/api/me", { as: "hr" }), p = await req("GET", "/login");
    const pick = (r) => ["x-content-type-options", "x-frame-options", "content-security-policy", "referrer-policy", "strict-transport-security", "x-powered-by"].map((h) => `${h}=${r.headers.get(h) ?? "absent"}`).join(", ");
    return { ok: true, actual: `API: ${pick(a)} | /login: ${pick(p)}` };
  });
  await t("CSRF", "state-changing request with a session cookie, text/plain body and a foreign Origin", "informational: server has no Origin/Content-Type check; relies on SameSite=Lax (browser would not send the cookie cross-site)", async () => {
    const r = await req("POST", "/api/kudos", { as: "a1", raw: JSON.stringify({ toUserId: ctx.users.a2.id, emoji: "⭐", value: "QUALITY", visibility: "PRIVATE" }), headers: { "content-type": "text/plain", origin: "https://evil.example", referer: "https://evil.example/x" } });
    return { ok: true, actual: `${r.status} – accepted with foreign Origin and text/plain: ${r.status === 201}` };
  });
  await t("CSRF", "state-changing GET does not exist: GET on open/close/logout", "405 for all (SameSite=Lax sends cookies on top-level GET)", async () => {
    const codes = [];
    for (const p of [`/api/rounds/${closedA.id}/open`, `/api/rounds/${closedA.id}/close`, "/api/logout", "/api/kudos"]) codes.push((await req("GET", p, { as: "hr" })).status);
    return { ok: codes.every((c) => c === 405), actual: `statuses ${codes}` };
  });

  // ---- ids: traversal, injection, odd encodings ----
  const ids = [["path traversal ..%2F..%2Fetc%2Fpasswd", "..%2F..%2Fetc%2Fpasswd"], ["SQL injection ' OR '1'='1", encodeURIComponent("' OR '1'='1")], ["SQL injection 1; DROP TABLE Round;--", encodeURIComponent('1; DROP TABLE "Round";--')], ["NUL byte %00", "abc%00def"], ["unicode / emoji", encodeURIComponent("🚀ľščť")], ["4 000-character id", "a".repeat(4000)], ["percent-encoded slash id%2Fresults", closedA.id + "%2Fresults"], ["wildcard %25", "%25"], ["malformed percent-encoding %E0%A4%A", "%E0%A4%A"], ["NoSQL-style object [$ne]", "[$ne]="], ["upper-cased real id", closedA.id.toUpperCase()], ["real id with trailing space", closedA.id + "%20"]];
  for (const [label, id] of ids) {
    await t("ID-INJECTION", `GET /api/rounds/<${label}>/results as HR`, "404 (or 400) – never 200 with data, never 500", async () => {
      const r = await req("GET", `/api/rounds/${id}/results`, { as: "hr" });
      return { ok: [400, 404].includes(r.status), actual: `${r.status} ${r.text.slice(0, 80).replace(/\s+/g, " ")}` };
    });
  }
  for (const [label, id] of ids.slice(0, 6)) {
    await t("ID-INJECTION", `GET /api/teams/<${label}>/summary as employee`, "403 (or 400/404) – never 200, never 500", async () => {
      const r = await req("GET", `/api/teams/${id}/summary`, { as: "a1" });
      return { ok: [400, 403, 404].includes(r.status), actual: `${r.status} ${r.text.slice(0, 80).replace(/\s+/g, " ")}` };
    });
  }
  for (const [label, id] of ids.slice(0, 4)) {
    await t("ID-INJECTION", `PATCH /api/actions/<${label}> as manager`, "403 (or 400/404) – never 200, never 500", async () => {
      const r = await req("PATCH", `/api/actions/${id}`, { as: "mA", body: { status: "DONE" } });
      return { ok: [400, 403, 404].includes(r.status), actual: `${r.status} ${r.text.slice(0, 80).replace(/\s+/g, " ")}` };
    });
  }
  await t("ID-INJECTION", "database is intact after the injection attempts", "tables still present with rows", async () => {
    const c = { rounds: await db.round.count(), users: await db.user.count(), responses: await db.response.count() };
    return { ok: c.rounds >= 9 && c.users === 13 && c.responses > 0, actual: JSON.stringify(c) };
  });
  await t("ID-INJECTION", "API path in different case /API/ME and with trailing slash /api/me/", "404 or redirect – never bypasses authentication", async () => {
    const a = await req("GET", "/API/ME"), b = await req("GET", "/api/me/"), c = await req("GET", "/api//me"), d = await req("GET", "/api/hr/../hr/overview");
    return { ok: [a, b, c, d].every((r) => r.status !== 200), actual: `statuses ${[a, b, c, d].map((r) => r.status)}` };
  });

  // ---- body edge cases ----
  await t("BODY", "deeply nested JSON (10 000 levels) to POST /api/kudos", "400, no crash", async () => {
    const r = await req("POST", "/api/kudos", { as: "a1", raw: "[".repeat(10000) + "]".repeat(10000), headers: { "content-type": "application/json" } });
    const alive = await req("GET", "/api/me", { as: "a1" });
    return { ok: r.status === 400 && alive.status === 200, actual: `${r.status}; server alive afterwards: ${alive.status === 200}` };
  });
  await t("BODY", "20 MB JSON body to POST /api/kudos", "400/413, no 500, server stays responsive", async () => {
    const r = await req("POST", "/api/kudos", { as: "a1", raw: JSON.stringify({ toUserId: ctx.users.a2.id, text: "x".repeat(20 * 1024 * 1024), value: "QUALITY", visibility: "TEAM" }), headers: { "content-type": "application/json" } });
    const alive = await req("GET", "/api/me", { as: "a1" });
    return { ok: [400, 413].includes(r.status) && alive.status === 200, actual: `${r.status} in ${r.ms} ms (no body-size limit before parsing: ${r.status === 400}); server alive: ${alive.status === 200}` };
  });
  await t("BODY", "JSON with UTF-8 BOM", "400 invalid_json or accepted – no 500", async () => { const r = await req("POST", "/api/login", { raw: "﻿" + JSON.stringify({ email: "hr@example.test", password: "Heslo123" }), headers: { "content-type": "application/json" } }); return [200, 400].includes(r.status); });
  await t("BODY", "UTF-16 encoded JSON body", "400 invalid_json – no 500", async () => { const r = await req("POST", "/api/login", { raw: Buffer.from('{"email":"hr@example.test","password":"Heslo123"}', "utf16le"), headers: { "content-type": "application/json; charset=utf-16" } }); return [400, 401].includes(r.status); });
  await t("BODY", "Content-Type multipart/form-data with JSON text", "400 or handled – no 500", async () => { const r = await req("POST", "/api/kudos", { as: "a1", raw: "--x\r\nContent-Disposition: form-data; name=\"a\"\r\n\r\n1\r\n--x--", headers: { "content-type": "multipart/form-data; boundary=x" } }); return r.status === 400; });
  await t("BODY", "prototype pollution attempt through POST /api/kudos", "400/201; afterwards a fresh object on the server is not affected (employee still gets 403 on HR endpoint)", async () => {
    await req("POST", "/api/kudos", { as: "a1", raw: '{"__proto__":{"role":"HR","teamId":null},"constructor":{"prototype":{"role":"HR"}},"toUserId":"x"}', headers: { "content-type": "application/json" } });
    return is(await req("GET", "/api/hr/overview", { as: "a1" }), 403);
  });

  // ---- error handling / information leakage ----
  await t("ERROR", "error bodies have a uniform shape and leak no internals", "every 4xx body is {error[,fields]} without stack, SQL, file paths or Prisma text", async () => {
    const rs = [await req("GET", "/api/me"), await req("GET", "/api/hr/overview", { as: "a1" }), await req("POST", "/api/rounds", { as: "hr", body: {} }), await req("POST", "/api/kudos", { as: "a1", raw: "{" }), await req("GET", "/api/rounds/x/results", { as: "hr" }), await req("POST", "/api/rounds/x/responses", { as: "a1", body: { answers: [1] } })];
    const bad = rs.filter((r) => !r.json || !("error" in r.json) || Object.keys(r.json).some((k) => !["error", "fields"].includes(k)) || /prisma|sqlite|\.ts|\.js|stack|node_modules|SELECT/i.test(r.text));
    return { ok: bad.length === 0, actual: rs.map((r) => `${r.status}:${r.text.slice(0, 40)}`).join(" | ") };
  });
  await t("ERROR", "server log: only method, path and error class on failures; no bodies, passwords or tokens", "log contains no 'Heslo123', no 'fz_session=', no comment/kudos text", async () => {
    const log = fs.readFileSync(path.join(ROOT, "testing/reports/2026-11-12_001/evidence/server-backend.log"), "utf8");
    const hits = ["Heslo123", "fz_session=", "QA komentár", "QA-MARKER", "passwordHash", "Ďakujem za pomoc"].filter((s) => log.includes(s));
    const apiLines = log.split(/\r?\n/).filter((l) => l.includes("[api]"));
    return { ok: hits.length === 0, actual: `log ${log.length} bytes; sensitive strings found: ${hits.join(",") || "none"}; [api] failure lines: ${apiLines.length}${apiLines.length ? " e.g. " + apiLines.slice(0, 3).join(" / ") : ""}` };
  }, { steps: "read evidence/server-backend.log (stdout+stderr of the QA server on port 3301)" });
  await t("ERROR", "no API response in this run contained a password hash", "no '$2a$'/'$2b$' in any recorded response body", async () => {
    const r = await req("GET", "/api/me", { as: "hr" });
    const k = await req("GET", "/api/kudos/me", { as: "a2" });
    const s = await req("GET", `/api/teams/${ctx.teamA}/summary`, { as: "a2" });
    return ![r, k, s].some((x) => /\$2[aby]\$/.test(x.text) || /passwordHash/.test(x.text));
  });

  // ---- data hygiene (NFR-06) ----
  await t("NFR-06", "all accounts use the reserved example.test domain", "13 users, every e-mail ends with @example.test", async () => {
    const us = await db.user.findMany({ select: { email: true } });
    return { ok: us.length === 13 && us.every((u) => u.email.endsWith("@example.test")), actual: `${us.length} users; non-test domains: ${us.filter((u) => !u.email.endsWith("@example.test")).length}` };
  });
  await t("MVP-02", "seed: 2 teams of 6 (1 manager + 5 employees) and 1 HR", "teams=2, each 6 members with exactly 1 MANAGER; 1 HR without a team", async () => {
    const teams = await db.team.findMany({ include: { members: true } });
    const hr = await db.user.findMany({ where: { role: "HR" } });
    return teams.length === 2 && teams.every((x) => x.members.length === 6 && x.members.filter((m) => m.role === "MANAGER").length === 1 && x.members.some((m) => m.id === x.managerId)) && hr.length === 1 && hr[0].teamId === null;
  });
  await t("MVP-02", "no registration / password reset / user management endpoints", "POST /api/register, /api/signup, /api/password-reset, /api/users → 404", async () => {
    const codes = [];
    for (const p of ["/api/register", "/api/signup", "/api/password-reset", "/api/users"]) codes.push((await req("POST", p, { body: { email: "x@example.test", password: "x" } })).status);
    return { ok: codes.every((c) => c === 404 || c === 405), actual: `statuses ${codes}` };
  });
}
