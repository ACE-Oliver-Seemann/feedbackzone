// Shared harness for the backend QA session (Agent 1).
// Talks ONLY to http://localhost:3301 and prisma/qa-backend.db.
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const BASE = "http://localhost:3301";
const DBFILE = path.join(ROOT, "prisma", "qa-backend.db").replace(/\\/g, "/");
export const SESSION = process.env.QA_SESSION || "2026-11-12_002";
export const EVID = path.join(ROOT, "testing", "reports", SESSION, "evidence", "backend");
fs.mkdirSync(EVID, { recursive: true });

export const db = new PrismaClient({ datasources: { db: { url: "file:" + DBFILE } } });

export const PASSWORD = "Heslo123";
export const ACCOUNTS = {
  hr: "hr@example.test",
  mA: "manazer.alfa@example.test",
  mB: "manazer.beta@example.test",
  a1: "adam.alfa@example.test",
  a2: "barbora.alfa@example.test",
  a3: "cyril.alfa@example.test",
  a4: "dana.alfa@example.test",
  a5: "emil.alfa@example.test",
  b1: "filip.beta@example.test",
  b2: "gabriela.beta@example.test",
  b3: "hugo.beta@example.test",
  b4: "ivana.beta@example.test",
  b5: "jakub.beta@example.test",
};

export const tokens = {};
export const ctx = {};
export const results = [];
const requestLog = [];
let counter = 0;
let idPrefix = "BE-T";
/** Session 002: the new suite numbers its tests separately (BE2-T…). */
export const setIdPrefix = (p) => { idPrefix = p; counter = 0; };
let cur = null;
let suiteName = "";
let suitePre = "";

const excerpt = (v, n = 600) => {
  if (v === undefined || v === null) return "";
  const s = typeof v === "string" ? v : String(v);
  return s.length > n ? s.slice(0, n) + `…(+${s.length - n} chars)` : s;
};

export function suite(name, pre) {
  suiteName = name;
  suitePre = pre;
  console.log(`\n===== ${name} =====`);
}

/** HTTP request against the QA server. `as` = account alias, `cookie` = raw cookie header. */
export async function req(method, p, o = {}) {
  const headers = { ...(o.headers || {}) };
  if (o.as) headers.cookie = `fz_session=${tokens[o.as]}`;
  if (o.cookie !== undefined) headers.cookie = o.cookie;
  let body;
  if (o.raw !== undefined) body = o.raw;
  else if (o.body !== undefined) {
    body = JSON.stringify(o.body);
    if (!headers["content-type"]) headers["content-type"] = "application/json";
  }
  const t0 = performance.now();
  let res, text;
  try {
    res = await fetch(BASE + p, { method, headers, body, redirect: "manual" });
    text = await res.text();
  } catch (e) {
    const rec = { test: cur?.id, method, path: excerpt(p, 200), as: o.as ?? "anon", status: 0, resBody: "FETCH ERROR " + (e.cause?.code || e.message) };
    cur?.reqs.push(rec);
    requestLog.push(rec);
    return { status: 0, json: null, text: "", headers: new Headers(), ms: 0, setCookie: [], error: e };
  }
  const ms = Math.round((performance.now() - t0) * 10) / 10;
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  const rec = {
    test: cur?.id,
    method,
    path: excerpt(p, 200),
    as: o.as ?? (o.cookie !== undefined ? "custom-cookie" : "anon"),
    reqBody: excerpt(body, 400),
    status: res.status,
    resBody: excerpt(text, 1500),
    ms,
  };
  cur?.reqs.push(rec);
  requestLog.push(rec);
  // Retest adaptation (coordinator, after the BE-001 fix): logout now ends the
  // session on the server, so the cached token of that account is dead. Log
  // the account in again, otherwise every later test using it would get 401.
  if (o.as && method === "POST" && p === "/api/logout" && res.status === 200) await login(o.as);
  return { status: res.status, json, text, headers: res.headers, ms, setCookie: res.headers.getSetCookie() };
}

export async function login(alias, attempt = 0) {
  let res;
  try {
    res = await rawLogin(alias);
  } catch (e) {
    // stale keep-alive socket after a long server pause: retry (login is idempotent)
    if (attempt < 3) { await new Promise((r) => setTimeout(r, 1500)); return login(alias, attempt + 1); }
    throw e;
  }
  if (res.status !== 200) throw new Error(`login failed for ${alias}: ${res.status}`);
  const sc = res.headers.getSetCookie().find((c) => c.startsWith("fz_session="));
  tokens[alias] = sc.split(";")[0].slice("fz_session=".length);
  return tokens[alias];
}
function rawLogin(alias) {
  return fetch(BASE + "/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ACCOUNTS[alias], password: PASSWORD }),
  });
}

export async function loadCtx() {
  const users = await db.user.findMany();
  ctx.users = {};
  for (const [alias, email] of Object.entries(ACCOUNTS)) ctx.users[alias] = users.find((u) => u.email === email);
  ctx.teamA = ctx.users.mA.teamId;
  ctx.teamB = ctx.users.mB.teamId;
  const qs = await db.question.findMany({ orderBy: [{ topic: "asc" }, { text: "asc" }] });
  ctx.fixed = qs.find((q) => q.fixed);
  ctx.lib = qs.filter((q) => !q.fixed && q.teamId === null);
  ctx.byText = (frag) => ctx.lib.find((q) => q.text.includes(frag));
  const rounds = await db.round.findMany({ include: { actions: true } });
  ctx.round = (teamId, frag) => rounds.find((r) => r.teamId === teamId && r.name.includes(frag));
  ctx.rounds = rounds;
}

/** Seed (+ demo) into qa-backend.db, then log everybody in again. */
export async function reset(demo = true) {
  const env = { ...process.env, DATABASE_URL: "file:./qa-backend.db" };
  execSync("npx tsx prisma/seed.ts", { cwd: ROOT, env, stdio: "pipe" });
  if (demo) execSync("npx tsx scripts/demo-data.ts", { cwd: ROOT, env, stdio: "pipe" });
  for (const alias of Object.keys(ACCOUNTS)) await login(alias);
  await loadCtx();
}

/**
 * Runs one test. `fn` returns true/false, null (= BLOCKED) or {ok, actual}.
 * Steps and the actual result default to the recorded HTTP traffic.
 */
export async function t(area, desc, expected, fn, opts = {}) {
  const id = idPrefix + String(++counter).padStart(3, "0");
  cur = { id, reqs: [] };
  let status, actual;
  try {
    const out = await fn();
    const ok = out !== null && typeof out === "object" ? out.ok : out;
    actual = out !== null && typeof out === "object" ? out.actual : undefined;
    status = ok === null ? "BLOCKED" : ok ? "PASS" : "FAIL";
  } catch (e) {
    status = "FAIL";
    actual = "EXCEPTION in test: " + e.message;
  }
  const last = cur.reqs.at(-1);
  if (actual === undefined) actual = last ? `${last.status} ${excerpt(last.resBody, 180)}` : "(no request)";
  const shown = cur.reqs.slice(0, 3).map(
    (r) => `${r.method} ${r.path} as ${r.as}${r.reqBody ? " body=" + excerpt(r.reqBody, 140) : ""}`,
  );
  if (cur.reqs.length > 3) shown.push(`(+${cur.reqs.length - 3} more requests, see requests.jsonl)`);
  const rec = {
    id,
    suite: suiteName,
    area,
    desc,
    pre: opts.pre ?? suitePre,
    steps: opts.steps ?? (shown.join(" ; ") || "direct database check (Prisma / raw SQL)"),
    expected,
    actual: String(actual),
    status,
    evidence: `evidence/backend/results.json#${id}; requests.jsonl (test=${id})`,
  };
  results.push(rec);
  cur = null;
  console.log(`${id} ${status.padEnd(7)} [${area}] ${desc} => ${excerpt(rec.actual, 150)}`);
  return rec;
}

export function save(tag = "") {
  fs.writeFileSync(path.join(EVID, `results${tag}.json`), JSON.stringify(results, null, 1));
  fs.writeFileSync(path.join(EVID, `requests${tag}.jsonl`), requestLog.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const c = { PASS: 0, FAIL: 0, BLOCKED: 0 };
  for (const r of results) c[r.status]++;
  console.log(`\nTOTAL ${results.length}  PASS ${c.PASS}  FAIL ${c.FAIL}  BLOCKED ${c.BLOCKED}`);
  const bySuite = {};
  for (const r of results) {
    bySuite[r.suite] ??= { executed: 0, PASS: 0, FAIL: 0, BLOCKED: 0 };
    bySuite[r.suite].executed++;
    bySuite[r.suite][r.status]++;
  }
  console.table(bySuite);
  fs.writeFileSync(path.join(EVID, `summary${tag}.json`), JSON.stringify({ total: results.length, ...c, bySuite }, null, 1));
}

// ---------- helpers ----------
export const dateStr = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Creates a draft round through the API; returns its id. `picked` = rotating question objects or count. */
export async function mkRound(as, teamId, picked = 3, name = "QA kolo " + Math.random().toString(36).slice(2, 8)) {
  const ids = Array.isArray(picked) ? picked.map((q) => q.id ?? q) : ctx.lib.slice(0, picked).map((q) => q.id);
  const r = await req("POST", "/api/rounds", { as, body: { name, teamId, closesAt: dateStr(7), questionIds: ids } });
  if (r.status !== 201) throw new Error("mkRound failed: " + r.status + " " + r.text);
  return r.json.round.id;
}
export async function mkOpenRound(teamId, picked = 3) {
  const id = await mkRound("hr", teamId, picked);
  const r = await req("POST", `/api/rounds/${id}/open`, { as: "hr" });
  if (r.status !== 200) throw new Error("open failed " + r.status);
  return id;
}
export const submit = (as, roundId, answers, comment) =>
  req("POST", `/api/rounds/${roundId}/responses`, { as, body: comment === undefined ? { answers } : { answers, comment } });
export const closeR = (id, as = "hr") => req("POST", `/api/rounds/${id}/close`, { as });

export const is = (r, status, code) => r.status === status && (code === undefined || r.json?.error === code);
export const keysOf = (o) => Object.keys(o ?? {}).sort().join(",");
