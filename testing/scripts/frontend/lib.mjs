// Shared helpers for the Level 2 (frontend) QA scripts.
// Run from a folder where `playwright-core` resolves (copy the scripts next to a node_modules
// that has it). Microsoft Edge is used through `channel: "msedge"`; nothing is downloaded.
//   QA_BASE  base URL of the isolated QA server (default http://localhost:3302)
//   QA_EVID  folder for evidence (screenshots, result JSON)
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

export const BASE = process.env.QA_BASE ?? "http://localhost:3302";
export const EVID =
  process.env.QA_EVID ??
  "./testing/reports/2026-11-12_001/evidence/frontend";
export const SHOTS = path.join(EVID, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

export const PASSWORD = "Heslo123";
export const USERS = {
  hr: "hr@example.test",
  mgrA: "manazer.alfa@example.test",
  mgrB: "manazer.beta@example.test",
  adam: "adam.alfa@example.test",
  barbora: "barbora.alfa@example.test",
  cyril: "cyril.alfa@example.test",
  dana: "dana.alfa@example.test",
  emil: "emil.alfa@example.test",
  filip: "filip.beta@example.test",
  gabriela: "gabriela.beta@example.test",
};

export async function launch() {
  return chromium.launch({ channel: "msedge", headless: true });
}

/** Replaces generated ids in a path so that reports stay readable. */
export const nice = (value) => String(value).replace(/c[a-z0-9]{20,}/g, ":id");

export function makeRecorder(scriptName) {
  const results = [];
  const file = path.join(EVID, `results-${scriptName}.json`);
  const save = () => fs.writeFileSync(file, JSON.stringify(results, null, 1));
  /**
   * Runs one test. `fn` returns { ok, actual, evidence? } or { blocked: true, actual }.
   * A thrown error is recorded as ERROR (a script problem), never as a product failure.
   */
  async function test(area, desc, meta, fn) {
    const entry = {
      area,
      desc,
      pre: meta.pre ?? "",
      steps: meta.steps ?? "",
      expected: meta.expected ?? "",
      req: meta.req ?? "",
    };
    try {
      const out = await fn();
      entry.status = out.blocked ? "BLOCKED" : out.ok ? "PASS" : "FAIL";
      entry.actual = String(out.actual ?? "");
      entry.evidence = out.evidence ?? "";
    } catch (error) {
      entry.status = "ERROR";
      entry.actual = `script error: ${String(error.message).split("\n")[0]}`;
      entry.evidence = "";
    }
    results.push(entry);
    save();
    console.log(
      `${entry.status.padEnd(7)} [${area}] ${desc} => ${entry.actual.replace(/\s+/g, " ").slice(0, 260)}`,
    );
    return entry;
  }
  return { test, results, save };
}

export async function newPage(browser, { width = 1280, height = 800, reducedMotion, extra = {} } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    locale: "sk-SK",
    reducedMotion,
    ...extra,
  });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (error) => page.errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") page.errors.push(`console: ${message.text()}`);
  });
  return page;
}

export async function login(page, email, password = PASSWORD) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Prihlásiť sa" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export async function session(browser, email, options) {
  const page = await newPage(browser, options);
  await login(page, email);
  return page;
}

export const shot = async (page, name, fullPage = true) => {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage });
  return `shots/${name}.png`;
};

export const overflow = (page) =>
  page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

/** Ids that change with every seed: teams and rounds, read from the UI as HR. */
export async function discover(browser) {
  const page = await session(browser, USERS.hr);
  await page.goto(`${BASE}/hr/rounds`);
  const rounds = await page.$$eval("main ul > li", (items) =>
    items.map((li) => ({
      name: li.querySelector("h3")?.textContent ?? "",
      text: li.innerText,
      team: li.querySelector('a[href^="/team/"]')?.textContent ?? "",
      teamId: li.querySelector('a[href^="/team/"]')?.getAttribute("href")?.split("/")[2] ?? "",
      id: li.querySelector('a[href$="/results"]')?.getAttribute("href")?.split("/")[2] ?? "",
    })),
  );
  await page.context().close();
  const teamA = rounds.find((r) => r.team === "Tím Alfa").teamId;
  const teamB = rounds.find((r) => r.team === "Tím Beta").teamId;
  const find = (team, name) => rounds.find((r) => r.team === team && r.name === name)?.id;
  return {
    rounds,
    teamA,
    teamB,
    openA: rounds.find((r) => r.team === "Tím Alfa" && /Otvorené/.test(r.text))?.id,
    okA: find("Tím Alfa", "Pulse – 46. týždeň"), // closed, 5 of 6, awaiting an action
    lowA: find("Tím Alfa", "Pulse – 42. týždeň"), // closed, 4 of 6 (below the threshold)
    doneA: find("Tím Alfa", "Pulse – 44. týždeň"), // closed, has actions
    okB: find("Tím Beta", "Pulse – 44. týždeň"),
    lowB: find("Tím Beta", "Pulse – záťaž a sústredenie"),
  };
}
