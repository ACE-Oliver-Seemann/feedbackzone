// Shared helpers for the Level 3 (end-to-end) QA scripts.
// Runs against the isolated QA server (http://localhost:3303) and prisma/qa-e2e.db only.
import { createRequire as _cr } from "node:module";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const BASE = process.env.QA_BASE ?? "http://localhost:3303";
export const PROJECT = process.env.QA_PROJECT ?? ".";
export const EVIDENCE = path.join(PROJECT, "testing/reports/2026-11-12_002/evidence/integration");
export const SCREENS = path.join(EVIDENCE, "screens");
export const PASSWORD = "Heslo123";
fs.mkdirSync(SCREENS, { recursive: true });

const require = createRequire(path.resolve(PROJECT, "package.json"));
// playwright-core lives outside the repo; QA_PW points at a folder that has it in node_modules.
const { chromium } = _cr(path.resolve(process.env.QA_PW ?? PROJECT, "package.json"))("playwright-core");
const { PrismaClient } = require("@prisma/client");
export const db = new PrismaClient({
  datasources: { db: { url: `file:${path.resolve(PROJECT, "prisma/qa-e2e.db").split(path.sep).join("/")}` } },
});

export const U = {
  hr: "hr@example.test",
  mgrA: "manazer.alfa@example.test",
  mgrB: "manazer.beta@example.test",
  alfa: ["adam", "barbora", "cyril", "dana", "emil"].map((n) => `${n}.alfa@example.test`),
  beta: ["filip", "gabriela", "hugo", "ivana", "jakub"].map((n) => `${n}.beta@example.test`),
};

export function resetDb(demo = false) {
  const env = { ...process.env, DATABASE_URL: "file:./qa-e2e.db" };
  execSync("npx tsx prisma/seed.ts", { cwd: PROJECT, env, stdio: "pipe" });
  if (demo) execSync("npx tsx scripts/demo-data.ts", { cwd: PROJECT, env, stdio: "pipe" });
}

/** Test recorder: one row per executed test attempt, saved as JSON evidence. */
export function recorder(suite) {
  const rows = [];
  const file = path.join(EVIDENCE, `results-${suite}.json`);
  const save = () => fs.writeFileSync(file, JSON.stringify(rows, null, 1));
  return {
    rows,
    /** status: true | false | "BLOCKED" */
    check(meta, status, actual = "", evidence = "") {
      const st = status === "BLOCKED" ? "BLOCKED" : status ? "PASS" : "FAIL";
      rows.push({ suite, ...meta, actual: String(actual).replace(/\s+/g, " ").slice(0, 600), status: st, evidence });
      console.log(`${st}  [${meta.j}] ${meta.d}  => ${String(actual).replace(/\s+/g, " ").slice(0, 200)}`);
      save();
      return st === "PASS";
    },
    save,
  };
}

let browser;
export async function getBrowser() {
  if (!browser) browser = await chromium.launch({ channel: "msedge", headless: true });
  return browser;
}
export async function closeBrowser() {
  if (browser) await browser.close();
  await db.$disconnect();
}

/** New browser context + page, logged in through the real login form. */
export async function session(email, viewport = { width: 1280, height: 800 }, opts = {}) {
  const b = await getBrowser();
  const context = await b.newContext({ viewport, locale: "sk-SK", ...opts });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  if (email) await uiLogin(page, email);
  return page;
}
export async function uiLogin(page, email, password = PASSWORD) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Prihlásiť sa" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
}
export const shot = async (page, name) => {
  await page.screenshot({ path: path.join(SCREENS, `${name}.png`), fullPage: true });
  return `screens/${name}.png`;
};
export const mainText = async (page) =>
  (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();

/** HTTP client with a session cookie obtained through POST /api/login. */
export async function api(email, password = PASSWORD) {
  const response = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`login failed for ${email}: ${response.status}`);
  const setCookie = response.headers.get("set-cookie");
  const cookie = setCookie.split(";")[0];
  const call = async (p, method = "GET", body, extraHeaders = {}) => {
    const res = await fetch(`${BASE}${p}`, {
      method,
      redirect: "manual",
      headers: { cookie, ...(body !== undefined ? { "content-type": "application/json" } : {}), ...extraHeaders },
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, headers: res.headers };
  };
  call.cookie = cookie;
  call.setCookie = setCookie;
  return call;
}
export const rawCall = async (p, { method = "GET", cookie, body } = {}) => {
  const res = await fetch(`${BASE}${p}`, {
    method,
    redirect: "manual",
    headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers };
};

export const sk = (value) =>
  value.toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
export const fmtDate = (d) => new Intl.DateTimeFormat("sk-SK", { dateStyle: "medium" }).format(new Date(d));
export const round2 = (v) => Math.round(v * 100) / 100;
export const ymd = (date) => {
  const p = (v) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
};

/** Fills the wizard through the UI. answers: array of 1..5. Returns after pressing Odoslať (unless stopBeforeSubmit). */
export async function fillWizard(page, roundId, answers, comment = "", { stopBeforeSubmit = false } = {}) {
  await page.goto(`${BASE}/rounds/${roundId}/fill`);
  await page.getByRole("button", { name: "Začať" }).click();
  for (let i = 0; i < answers.length; i++) {
    // Buttons are either numeric (aria-label "N – label") or labelled lists.
    const fieldset = page.locator("fieldset");
    const buttons = fieldset.locator("button[aria-pressed]");
    await buttons.nth(answers[i] - 1).click();
    await page.getByRole("button", { name: "Ďalej" }).click();
  }
  if (comment) await page.locator("textarea").fill(comment);
  if (!stopBeforeSubmit) await page.getByRole("button", { name: "Odoslať" }).click();
}

// ───────────────────────── Session 2026-11-12_002 additions (redesigned markup)
export const DAY = 864e5;
/** step(meta, fn): fn returns [ok, actual, evidence?] or "BLOCKED:<reason>". Never throws. */
export function stepper(R, defaults = {}) {
  return async (meta, fn) => {
    try {
      const out = await fn();
      if (typeof out === "string" && out.startsWith("BLOCKED")) return R.check({ ...defaults, ...meta }, "BLOCKED", out);
      const [ok, actual, evidence] = out;
      return R.check({ ...defaults, ...meta }, ok, actual, evidence ?? "");
    } catch (error) {
      return R.check({ ...defaults, ...meta }, false, `SCRIPT/RUNTIME ERROR: ${String(error.message).slice(0, 300)}`);
    }
  };
}
export const toastRegion = (page) => page.locator('[role="status"][aria-label="Oznámenia"]');
export const toast = (page, text) => toastRegion(page).getByText(text);
export const row = (page, name) => page.locator("[data-round-row]").filter({ has: page.getByRole("heading", { name, exact: true }) }).first();
export const rowById = (page, id) => page.locator(`[data-round-row="${id}"]`);
/** Clicks a transition button in a round row and answers the confirm dialog. */
export async function transition(page, rowLocator, label, confirm = true) {
  await rowLocator.getByRole("button", { name: label }).click();
  const dialog = page.locator("dialog[open]");
  await dialog.waitFor({ timeout: 5000 });
  await dialog.getByRole("button", { name: confirm ? label : "Zrušiť" }).click();
}
export async function libraryIds(teamId = null, count = 3) {
  const fixed = await db.question.findFirst({ where: { fixed: true } });
  const qs = await db.question.findMany({ where: { fixed: false, teamId: null, starter: true }, orderBy: { id: "asc" } });
  // different topics
  const seen = new Set(); const pick = [];
  for (const q of qs) { if (!seen.has(q.topic)) { seen.add(q.topic); pick.push(q.id); } if (pick.length === count) break; }
  return { fixedId: fixed.id, ids: pick };
}
/** Creates (and optionally opens) a round through the API. Returns the round id. */
export async function apiRound(call, { teamId, name, days = 7, count = 3, open = true }) {
  const { ids } = await libraryIds(teamId, count);
  const r = await call("/api/rounds", "POST", { name, teamId, closesAt: ymd(new Date(Date.now() + days * DAY)), questionIds: ids });
  if (r.status !== 201) throw new Error(`create round failed: ${r.status} ${r.text}`);
  const id = r.json.round?.id ?? r.json.id;
  if (open) {
    const o = await call(`/api/rounds/${id}/open`, "POST");
    if (o.status !== 200) throw new Error(`open failed: ${o.status} ${o.text}`);
  }
  return id;
}
export async function apiRespond(email, roundId, answers, comment) {
  const call = await api(email);
  return call(`/api/rounds/${roundId}/responses`, "POST", { answers, ...(comment ? { comment } : {}) });
}
/** New wizard walk for the redesigned markup; waits for each transition. */
export async function wizard(page, roundId, answers, comment = "", { submit = true } = {}) {
  await page.goto(`${BASE}/rounds/${roundId}/fill`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Začať" }).click();
  for (let i = 0; i < answers.length; i++) {
    await page.getByText(`Otázka ${i + 1} z ${answers.length}`).waitFor({ state: "attached", timeout: 8000 });
    await page.locator("fieldset button[aria-pressed]").nth(answers[i] - 1).click();
    await page.getByRole("button", { name: "Ďalej" }).click();
  }
  await page.locator("textarea").waitFor({ timeout: 8000 });
  if (comment) await page.locator("textarea").fill(comment);
  if (submit) {
    await page.getByRole("button", { name: "Odoslať" }).click();
    await page.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 10000 });
  }
}
export const mainOnly = async (page) => (await page.locator("main#main").innerText()).replace(/\s+/g, " ").trim();
export const pathOf = (page) => new URL(page.url()).pathname;
export const teams = async () => ({
  A: await db.team.findFirstOrThrow({ where: { name: "Tím Alfa" } }),
  B: await db.team.findFirstOrThrow({ where: { name: "Tím Beta" } }),
});
export const isoWeek = (date) => {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  return Math.ceil(((day.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
};
