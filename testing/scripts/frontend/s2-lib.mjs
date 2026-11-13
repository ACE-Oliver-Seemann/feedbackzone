// Shared helpers for the Level 2 (frontend) QA scripts of session 2026-11-12_002 (redesigned UI).
// Environment:
//   QA_PW_DIR  folder whose node_modules contains `playwright-core` (required; no path is hard-coded)
//   QA_BASE    base URL of the isolated QA server (default http://localhost:3302)
//   QA_EVID    evidence folder (default ./testing/reports/2026-11-12_002/evidence/frontend)
// Run from the repository root:  node testing/scripts/frontend/s2-01-navigation.mjs
// Microsoft Edge is used through `channel: "msedge"`; nothing is downloaded.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

if (!process.env.QA_PW_DIR) throw new Error("Set QA_PW_DIR to a folder that has node_modules/playwright-core");
const require = createRequire(path.join(path.resolve(process.env.QA_PW_DIR), "noop.js"));
export const { chromium } = require("playwright-core");

export const BASE = process.env.QA_BASE ?? "http://localhost:3302";
export const EVID = process.env.QA_EVID ?? "./testing/reports/2026-11-12_002/evidence/frontend";
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

export const launch = () => chromium.launch({ channel: "msedge", headless: true });

/** Replaces generated ids so that reports stay readable. */
export const nice = (value) => String(value).replace(/c[a-z0-9]{20,}/g, ":id");

export function makeRecorder(scriptName) {
  const results = [];
  const file = path.join(EVID, `results-${scriptName}.json`);
  const save = () => fs.writeFileSync(file, JSON.stringify(results, null, 1));
  /**
   * Runs one test. `section` is the policy section A–G. `fn` returns { ok, actual, evidence? },
   * { blocked: true, actual } or { info: true, actual } (observation, counted as passed execution
   * only when ok is true). A thrown error is recorded as ERROR (script problem), never as a failure.
   */
  async function test(section, desc, meta, fn) {
    const entry = {
      section,
      desc,
      pre: meta.pre ?? "",
      steps: meta.steps ?? "",
      expected: meta.expected ?? "",
      req: meta.req ?? "",
    };
    try {
      const out = await fn();
      entry.status = out.blocked ? "BLOCKED" : out.ok ? "PASS" : "FAIL";
      entry.actual = nice(String(out.actual ?? ""));
      entry.evidence = out.evidence ?? "";
      if (out.defect) entry.defect = out.defect;
    } catch (error) {
      entry.status = "ERROR";
      entry.actual = `script error: ${String(error.message).split("\n")[0]}`;
      entry.evidence = "";
    }
    results.push(entry);
    save();
    console.log(`${entry.status.padEnd(7)} [${section}] ${desc} => ${entry.actual.replace(/\s+/g, " ").slice(0, 300)}`);
    return entry;
  }
  return { test, results, save };
}

export async function newPage(browser, { width = 1280, height = 800, reducedMotion, touch = false, extra = {} } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    locale: "sk-SK",
    reducedMotion,
    hasTouch: touch,
    isMobile: touch,
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
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login")),
    page.click('button[type="submit"]'),
  ]);
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

export const go = (page, p, waitUntil = "networkidle") => page.goto(`${BASE}${p}`, { waitUntil });

export const overflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

export const api = async (page, p) => (await page.request.get(`${BASE}${p}`)).json();

/** Ids that change with every seed, read through the API as HR. */
export async function discover(browser) {
  const page = await session(browser, USERS.hr);
  const { rounds } = await api(page, "/api/rounds");
  const mgr = await session(browser, USERS.mgrA);
  const meA = (await api(mgr, "/api/me")).user;
  const mgrB = await session(browser, USERS.mgrB);
  const meB = (await api(mgrB, "/api/me")).user;
  await page.context().close();
  await mgr.context().close();
  await mgrB.context().close();
  const of = (teamId, status) => rounds.filter((r) => r.teamId === teamId && r.status === status);
  const find = (teamId, name) => rounds.find((r) => r.teamId === teamId && r.name === name)?.id;
  return {
    rounds,
    teamA: meA.teamId,
    teamB: meB.teamId,
    of,
    // demo data (scripts/demo-data.ts)
    openA: of(meA.teamId, "OPEN")[0]?.id,
    okA: find(meA.teamId, "Pulse – 46. týždeň"), // closed, 5 of 6, awaiting an action
    lowA: find(meA.teamId, "Pulse – 42. týždeň"), // closed, 4 of 6 (below the threshold)
    doneA: find(meA.teamId, "Pulse – 44. týždeň"), // closed, has actions
    okB: find(meB.teamId, "Pulse – 44. týždeň"),
    lowB: find(meB.teamId, "Pulse – záťaž a sústredenie"),
  };
}

/** Visible interactive elements lower or narrower than `min` px (touch targets). */
export const smallTargets = (page, min = 44, scope = "body") =>
  page.evaluate(([min, scope]) => {
    const out = [];
    const root = document.querySelector(scope) ?? document.body;
    for (const el of root.querySelectorAll("a, button, select, input:not([type=hidden]), summary, textarea, [role=button]")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      if (el.closest(".sr-only") || el.classList.contains("sr-only")) continue;
      // radio / checkbox inside a label: the label is the target
      let h = r.height, w = r.width;
      if (el.matches("input[type=radio], input[type=checkbox]")) {
        const label = el.closest("label") ?? (el.id ? document.querySelector(`label[for="${el.id}"]`) : null);
        if (label) { const lr = label.getBoundingClientRect(); h = lr.height; w = lr.width; }
      }
      // inline link inside a sentence is exempt (WCAG 2.5.8 inline exception)
      const inline = el.tagName === "A" && cs.display === "inline" && el.parentElement && el.parentElement.textContent.trim().length > el.textContent.trim().length + 10;
      if (inline) continue;
      if (h < min - 0.5 || w < min - 0.5) {
        out.push(`${el.tagName.toLowerCase()}"${(el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || "").trim().replace(/\s+/g, " ").slice(0, 28)}" ${Math.round(w)}x${Math.round(h)}`);
      }
    }
    return out;
  }, [min, scope]);

/** WCAG contrast of an element's text against the nearest opaque background (flat colours only). */
export const contrastOf = (page, selector, nth = 0) =>
  page.evaluate(
    ([selector, nth]) => {
      const el = document.querySelectorAll(selector)[nth];
      if (!el) return null;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const parse = (c) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "rgba(0,0,0,0)";
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2], d[3] / 255];
      };
      const over = (top, bottom) => {
        const a = top[3];
        return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
      };
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const bg = parse(getComputedStyle(n).backgroundColor);
        if (bg[3] > 0) layers.push(bg);
        if (bg[3] === 1) break;
      }
      let bg = [255, 255, 255, 1];
      for (const layer of layers.reverse()) bg = over(layer, bg);
      const cs = getComputedStyle(el);
      let fg = over(parse(cs.color), bg);
      const lum = (c) => {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
      };
      const l1 = lum(fg), l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const hex = (c) => "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
      return {
        ratio: Math.round(ratio * 100) / 100,
        fg: hex(fg),
        bg: hex(bg),
        size: parseFloat(cs.fontSize),
        weight: cs.fontWeight,
        opacity: cs.opacity,
        text: (el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 40),
      };
    },
    [selector, nth],
  );
