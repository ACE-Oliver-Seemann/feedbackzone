// Suite 1: login, logout, me, session cookie handling (MVP-01, NFR-05).
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ACCOUNTS, PASSWORD, ROOT, ctx, is, keysOf, login, req, reset, suite, t, tokens } from "./lib.mjs";

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");

/** Reads SESSION_SECRET from .env WITHOUT printing it; used only to build expired / odd tokens. */
function secret() {
  try {
    const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
    const m = /^SESSION_SECRET\s*=\s*"?([^"\r\n]+)"?/m.exec(env);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
const signWith = (s, payload) => createHmac("sha256", s).update(payload).digest("base64url");

export default async function run() {
  suite("S1 Authentication & session", "fresh seed + demo data; no session unless stated");
  await reset(true);
  const L = (body, o = {}) => req("POST", "/api/login", { body, ...o });
  const cookieOf = (r) => r.setCookie.find((c) => c.startsWith("fz_session=")) ?? "";

  for (const [alias, role] of [["hr", "HR"], ["mA", "MANAGER"], ["a1", "EMPLOYEE"]]) {
    await t("AUTH", `login valid ${role} (${ACCOUNTS[alias]})`, `200, user.role=${role}, keys id,name,role,teamId, home="/" (MVP-01)`, async () => {
      const r = await L({ email: ACCOUNTS[alias], password: PASSWORD });
      return r.status === 200 && r.json.user.role === role && keysOf(r.json.user) === "id,name,role,teamId" && r.json.home === "/";
    });
  }
  await t("AUTH", "login cookie flags", "Set-Cookie fz_session with HttpOnly, SameSite=lax, Path=/, Max-Age=28800 (NFR-05)", async () => {
    const r = await L({ email: ACCOUNTS.hr, password: PASSWORD });
    const c = cookieOf(r);
    const ok = /HttpOnly/i.test(c) && /SameSite=lax/i.test(c) && /Path=\//.test(c) && /Max-Age=28800/.test(c);
    return { ok, actual: c.replace(/fz_session=[^;]+/, "fz_session=<token>") };
  });
  await t("AUTH", "login response does not expose passwordHash or email", "body has no passwordHash/email keys", async () => {
    const r = await L({ email: ACCOUNTS.hr, password: PASSWORD });
    return !/passwordHash|\$2[aby]\$|example\.test/.test(r.text);
  });
  await t("AUTH", "login e-mail in upper case", "200 (e-mail is case-insensitive)", async () => is(await L({ email: ACCOUNTS.hr.toUpperCase(), password: PASSWORD }), 200));
  await t("AUTH", "login e-mail padded with spaces", "200 (trimmed)", async () => is(await L({ email: `  ${ACCOUNTS.hr}  `, password: PASSWORD }), 200));
  const wrong = await t("AUTH", "login wrong password", "401 invalid_credentials, no Set-Cookie (MVP-01)", async () => {
    const r = await L({ email: ACCOUNTS.hr, password: "Heslo124" });
    return is(r, 401, "invalid_credentials") && r.setCookie.length === 0;
  });
  await t("AUTH", "login unknown e-mail gives the same answer as wrong password", "401 with body identical to wrong-password case (MVP-01)", async () => {
    const a = await L({ email: "nikto@example.test", password: PASSWORD });
    const b = await L({ email: ACCOUNTS.hr, password: "zle" });
    return { ok: a.status === 401 && a.text === b.text, actual: `${a.status} ${a.text} vs ${b.status} ${b.text}` };
  });
  await t("AUTH", "login password with trailing space", "401", async () => is(await L({ email: ACCOUNTS.hr, password: PASSWORD + " " }), 401));
  await t("AUTH", "login password in different case", "401", async () => is(await L({ email: ACCOUNTS.hr, password: "heslo123" }), 401));
  await t("AUTH", "login missing password", "401 or 400, never 200/500", async () => [400, 401].includes((await L({ email: ACCOUNTS.hr })).status));
  await t("AUTH", "login missing e-mail", "401 or 400", async () => [400, 401].includes((await L({ password: PASSWORD })).status));
  await t("AUTH", "login empty object", "401 or 400", async () => [400, 401].includes((await L({})).status));
  await t("AUTH", "login empty strings", "401 or 400", async () => [400, 401].includes((await L({ email: "", password: "" })).status));
  for (const [label, raw] of [["JSON null", "null"], ["JSON array", "[]"], ["JSON string", '"x"'], ["JSON number", "42"], ["empty body", ""], ["malformed JSON", '{"email":'], ["plain text", "hello"], ["form-urlencoded", "email=hr%40example.test&password=Heslo123"], ["XML", "<a/>"]]) {
    await t("AUTH", `login body: ${label}`, "400 invalid_json", async () => is(await req("POST", "/api/login", { raw, headers: { "content-type": "application/json" } }), 400, "invalid_json"));
  }
  for (const [label, body] of [
    ["email number", { email: 123, password: PASSWORD }],
    ["email object {contains}", { email: { contains: "@" }, password: PASSWORD }],
    ["email array", { email: [ACCOUNTS.hr], password: PASSWORD }],
    ["password object {$ne:null}", { email: ACCOUNTS.hr, password: { $ne: null } }],
    ["password array", { email: ACCOUNTS.hr, password: [PASSWORD] }],
    ["password true", { email: ACCOUNTS.hr, password: true }],
    ["SQLi e-mail ' OR '1'='1", { email: "' OR '1'='1", password: "' OR '1'='1" }],
    ["SQLi e-mail hr@example.test'--", { email: "hr@example.test'--", password: "x" }],
    ["e-mail with NUL byte", { email: "hr@example.test\u0000", password: PASSWORD }],
    ["e-mail with % wildcard", { email: "%@example.test", password: PASSWORD }],
  ]) {
    await t("AUTH", `login wrong type / injection: ${label}`, "401 invalid_credentials (no 200, no 500)", async () => is(await L(body), 401, "invalid_credentials"));
  }
  await t("AUTH", "login with 100 000-character password", "401, answered in reasonable time (<3 s)", async () => {
    const r = await L({ email: ACCOUNTS.hr, password: "x".repeat(100000) });
    return { ok: r.status === 401 && r.ms < 3000, actual: `${r.status} in ${r.ms} ms` };
  });
  await t("AUTH", "login with 1 MB e-mail", "401/400/413, no 500", async () => {
    const r = await L({ email: "a".repeat(1024 * 1024) + "@example.test", password: PASSWORD });
    return { ok: [400, 401, 413].includes(r.status), actual: `${r.status} in ${r.ms} ms` };
  });
  await t("AUTH", "login with Content-Type text/plain (CSRF-style simple request)", "informational: server accepts JSON regardless of Content-Type; protection relies on SameSite=Lax", async () => {
    const r = await req("POST", "/api/login", { raw: JSON.stringify({ email: ACCOUNTS.hr, password: PASSWORD }), headers: { "content-type": "text/plain" } });
    return { ok: [200, 400, 415].includes(r.status), actual: `${r.status} (accepted without application/json: ${r.status === 200})` };
  });
  for (const m of ["GET", "PUT", "DELETE", "PATCH"]) {
    await t("AUTH", `${m} /api/login (unsupported method)`, "405", async () => is(await req(m, "/api/login"), 405));
  }
  await t("AUTH", "bcrypt 72-byte truncation: password = correct + 64 extra chars", "401 (extra characters must not be ignored)", async () => is(await L({ email: ACCOUNTS.hr, password: PASSWORD + "x".repeat(64) }), 401));

  // ---- /api/me and cookie handling ----
  await t("SESSION", "GET /api/me without cookie", "401 unauthorized", async () => is(await req("GET", "/api/me"), 401, "unauthorized"));
  await t("SESSION", "GET /api/me with valid cookie", "200 {user:{id,name,role,teamId}} only", async () => {
    const r = await req("GET", "/api/me", { as: "a1" });
    return r.status === 200 && keysOf(r.json) === "user" && keysOf(r.json.user) === "id,name,role,teamId" && r.json.user.teamId === ctx.teamA;
  });
  const tok = tokens.hr;
  const [payload, sig] = tok.split(".");
  const flip = (s) => s.slice(0, -1) + (s.at(-1) === "A" ? "B" : "A");
  const cases = [
    ["signature last char flipped", `${payload}.${flip(sig)}`],
    ["payload last char flipped", `${flip(payload)}.${sig}`],
    ["payload only (no signature)", payload],
    ["empty value", ""],
    ["three segments", `${payload}.${sig}.x`],
    ["signature 'none'", `${payload}.none`],
    ["empty signature", `${payload}.`],
    ["forged payload (HR uid, exp 2099) with old signature", `${b64({ uid: ctx.users.hr.id, exp: 4070908800 })}.${sig}`],
    ["forged payload for another user with another user's signature", `${b64({ uid: ctx.users.hr.id, exp: 4070908800 })}.${tokens.a1.split(".")[1]}`],
    ["payload of employee + signature of HR token", `${tokens.a1.split(".")[0]}.${sig}`],
    ["signature in standard base64 with padding", `${payload}.${Buffer.from(sig, "base64url").toString("base64")}`],
    ["random garbage", "AAAA.BBBB"],
    ["SQL injection string", "' OR 1=1 --"],
    ["very long cookie (6 kB)", "A".repeat(3000) + "." + "B".repeat(3000)],
    ["URL-encoded valid token with trailing %00", tok + "%00"],
  ];
  for (const [label, value] of cases) {
    await t("SESSION", `tampered cookie: ${label}`, "401 unauthorized (never 200/500)", async () => is(await req("GET", "/api/me", { cookie: `fz_session=${value}` }), 401, "unauthorized"));
  }
  await t("SESSION", "token sent as Authorization: Bearer instead of cookie", "401", async () => is(await req("GET", "/api/me", { headers: { authorization: `Bearer ${tok}` } }), 401));
  await t("SESSION", "token under a different cookie name", "401", async () => is(await req("GET", "/api/me", { cookie: `session=${tok}` }), 401));
  await t("SESSION", "two fz_session cookies: forged first, valid second", "must not grant more than the valid one; 200 as HR or 401", async () => {
    const r = await req("GET", "/api/me", { cookie: `fz_session=AAAA.BBBB; fz_session=${tok}` });
    return { ok: r.status === 401 || r.json?.user?.id === ctx.users.hr.id, actual: `${r.status} ${r.text.slice(0, 80)}` };
  });

  const s = secret();
  const real = s && signWith(s, payload) === sig;
  const forge = (obj) => {
    const p = b64(obj);
    return `${p}.${signWith(s, p)}`;
  };
  const now = Math.floor(Date.now() / 1000);
  const forged = [
    ["expired 1 s ago", () => forge({ uid: ctx.users.hr.id, exp: now - 1 }), 401],
    ["expired 8 h ago", () => forge({ uid: ctx.users.hr.id, exp: now - 28800 }), 401],
    ["exp as string", () => forge({ uid: ctx.users.hr.id, exp: String(now + 1000) }), 401],
    ["exp missing", () => forge({ uid: ctx.users.hr.id }), 401],
    ["uid of a user that does not exist", () => forge({ uid: "cmnonexistent000000000000", exp: now + 1000 }), 401],
    ["uid as number", () => forge({ uid: 1, exp: now + 1000 }), 401],
    ["uid as object", () => forge({ uid: { not: "" }, exp: now + 1000 }), 401],
    ["payload is not JSON", () => `${b64("not json")}.${signWith(s, b64("not json"))}`, 401],
    ["extra claim role=HR on employee token", () => forge({ uid: ctx.users.a1.id, exp: now + 1000, role: "HR", teamId: ctx.teamB }), 200],
  ];
  for (const [label, make, want] of forged) {
    await t("SESSION", `correctly signed token: ${label}`, want === 401 ? "401 unauthorized" : "200 but role/team still taken from the database (EMPLOYEE, own team)", async () => {
      if (!real) return { ok: null, actual: "BLOCKED: SESSION_SECRET of the QA server not available to the test" };
      const r = await req("GET", "/api/me", { cookie: `fz_session=${make()}` });
      if (want === 401) return is(r, 401, "unauthorized");
      return r.status === 200 && r.json.user.role === "EMPLOYEE" && r.json.user.teamId === ctx.teamA;
    }, { pre: "white-box: token signed in the test with the server's SESSION_SECRET (value never printed)" });
  }

  // ---- logout ----
  await t("SESSION", "POST /api/logout without session", "401", async () => is(await req("POST", "/api/logout"), 401));
  await t("SESSION", "GET /api/logout", "405", async () => is(await req("GET", "/api/logout", { as: "hr" }), 405));
  const fresh = await login("b5");
  await t("SESSION", "POST /api/logout clears the cookie", "200 {ok:true}, Set-Cookie fz_session=; Max-Age=0; HttpOnly", async () => {
    const r = await req("POST", "/api/logout", { cookie: `fz_session=${fresh}` });
    const c = cookieOf(r);
    return { ok: r.status === 200 && r.json.ok === true && /^fz_session=;/.test(c) && /Max-Age=0/.test(c) && /HttpOnly/i.test(c), actual: `${r.status} ${c}` };
  });
  await t("SESSION", "token is rejected after logout (replay of the old cookie)", "401 – MVP-01: 'Odhlásenie zruší reláciu'", async () => {
    const r = await req("GET", "/api/me", { cookie: `fz_session=${fresh}` });
    return { ok: r.status === 401, actual: `${r.status} ${r.text.slice(0, 120)} (old token still accepted: ${r.status === 200})` };
  });
  await t("SESSION", "old token can still perform a write after logout", "401", async () => {
    const r = await req("POST", "/api/kudos", { cookie: `fz_session=${fresh}`, body: { toUserId: ctx.users.b1.id, emoji: "👏", value: "QUALITY", visibility: "PRIVATE" } });
    return { ok: r.status === 401, actual: `${r.status} ${r.text.slice(0, 100)}` };
  });
  await login("b5");
  await t("SESSION", "two logins of the same user give independent valid sessions", "both tokens valid (stateless session)", async () => {
    const t1 = tokens.b5;
    await new Promise((r) => setTimeout(r, 1100));
    const t2 = await login("b5");
    const r1 = await req("GET", "/api/me", { cookie: `fz_session=${t1}` });
    const r2 = await req("GET", "/api/me", { cookie: `fz_session=${t2}` });
    return { ok: r1.status === 200 && r2.status === 200, actual: `${r1.status}/${r2.status}, tokens differ: ${t1 !== t2}` };
  });

  // ---- timing & brute force ----
  await t("AUTH-SEC", "timing: unknown e-mail vs wrong password (30 samples each, interleaved)", "medians within 25 % of each other (no user enumeration by timing)", async () => {
    const a = [], b = [];
    const med = (x) => [...x].sort((p, q) => p - q)[Math.floor(x.length / 2)];
    for (let i = 0; i < 30; i++) {
      a.push((await L({ email: `nobody${i}@example.test`, password: "zleheslo" })).ms);
      b.push((await L({ email: ACCOUNTS.a2, password: "zleheslo" })).ms);
    }
    const ma = med(a), mb = med(b);
    return { ok: Math.abs(ma - mb) / Math.max(ma, mb) < 0.25, actual: `median unknown e-mail ${ma} ms, wrong password ${mb} ms, diff ${(Math.abs(ma - mb)).toFixed(1)} ms` };
  });
  await t("AUTH-SEC", "timing: empty e-mail vs wrong password (20 samples each)", "informational: similar medians", async () => {
    const a = [], b = [];
    const med = (x) => [...x].sort((p, q) => p - q)[Math.floor(x.length / 2)];
    for (let i = 0; i < 20; i++) {
      a.push((await L({ email: "", password: "zleheslo" })).ms);
      b.push((await L({ email: ACCOUNTS.a2, password: "zleheslo" })).ms);
    }
    const ma = med(a), mb = med(b);
    return { ok: Math.abs(ma - mb) / Math.max(ma, mb) < 0.25, actual: `median empty e-mail ${ma} ms, wrong password ${mb} ms` };
  });
  await t("AUTH-SEC", "40 consecutive failed logins for one account, then a correct login", "requirements demand no lockout: record whether any 429/lockout appears", async () => {
    const codes = new Set();
    for (let i = 0; i < 40; i++) codes.add((await L({ email: ACCOUNTS.a3, password: "zle" + i })).status);
    const ok = await L({ email: ACCOUNTS.a3, password: PASSWORD });
    return { ok: ok.status === 200, actual: `failed attempts returned {${[...codes]}}; correct login afterwards ${ok.status}; no rate limit / lockout observed: ${!codes.has(429)}` };
  });
  await t("SESSION", "session of a user deleted by a reseed", "401 (user is looked up in the DB on every request)", async () => {
    const old = tokens.a4;
    await reset(true);
    const r = await req("GET", "/api/me", { cookie: `fz_session=${old}` });
    return is(r, 401, "unauthorized");
  }, { pre: "database reseeded after the token was issued, so the user id no longer exists" });
}
