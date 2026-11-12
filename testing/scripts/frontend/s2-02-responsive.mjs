// Section E/F: every screen for every role at six viewports (page overflow, elements sticking out of the
// viewport, console errors, HTTP status), plus touch targets on an emulated touch device (360 px).
// Read-only. Needs demo data (seed + scripts/demo-data.ts).
import { launch, discover, makeRecorder, newPage, login, USERS, BASE, shot, smallTargets, nice } from "./s2-lib.mjs";

const { test } = makeRecorder("02-responsive");
const browser = await launch();
const d = await discover(browser);

const VIEWPORTS = [
  { width: 320, height: 640, touch: true },
  { width: 360, height: 740, touch: true },
  { width: 768, height: 1024, touch: true },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

const startFill = async (page) => {
  const start = page.getByRole("button", { name: "Začať" });
  if (await start.count()) {
    await start.click();
    await page.waitForTimeout(500);
  }
};

const SCREENS = {
  hr: [
    ["home", "/"],
    ["hr-rounds", "/hr/rounds"],
    ["new-round", "/rounds/new"],
    ["results-ok", `/rounds/${d.okA}/results`],
    ["results-ok-open", `/rounds/${d.doneA}/results`, async (p) => {
      for (const s of await p.locator("main summary").all()) await s.click().catch(() => {});
      await p.waitForTimeout(400);
    }],
    ["results-low", `/rounds/${d.lowA}/results`],
    ["results-open", `/rounds/${d.openA}/results`],
    ["report", `/rounds/${d.doneA}/report`],
    ["team", `/team/${d.teamA}`],
    ["trend", `/team/${d.teamA}/trend`],
    ["overview", "/hr/overview"],
    ["heatmap", "/hr/heatmap"],
    ["issues", "/hr/issues"],
    ["issues-all", "/hr/issues?filter=all"],
    ["notes", "/hr/notes"],
    ["kudos", "/kudos"],
    ["kudos-send", "/kudos?tab=send"],
    ["404", "/nic-take"],
  ],
  mgrA: [
    ["home", "/"],
    ["rounds", "/rounds"],
    ["new-round", "/rounds/new"],
    ["results-ok", `/rounds/${d.okA}/results`],
    ["team", `/team/${d.teamA}`],
    ["trend", `/team/${d.teamA}/trend`],
    ["kudos", "/kudos"],
    ["kudos-send", "/kudos?tab=send"],
    ["fill-intro", `/rounds/${d.openA}/fill`],
    ["403", "/hr/overview"],
  ],
  adam: [
    ["home", "/"],
    ["team", `/team/${d.teamA}`],
    ["kudos", "/kudos"],
    ["kudos-send", "/kudos?tab=send"],
    ["fill-intro", `/rounds/${d.openA}/fill`],
    ["fill-question", `/rounds/${d.openA}/fill`, startFill],
    ["403", "/rounds/new"],
    ["403-unknown-team", "/team/neexistuje"],
  ],
};

const measure = (page) =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    // Elements whose box leaves the viewport on the right without being inside a horizontal scroller.
    const inScroller = (el) => {
      for (let n = el.parentElement; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (/(auto|scroll|hidden|clip)/.test(cs.overflowX) && n !== document.documentElement && n !== document.body) return true;
      }
      return false;
    };
    for (const el of document.querySelectorAll("main *, header *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.closest(".sr-only") || el.classList.contains("sr-only")) continue;
      if ((r.right > vw + 1 || r.left < -1) && !inScroller(el)) {
        out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} ${Math.round(r.left)}..${Math.round(r.right)}`);
      }
    }
    // Text clipped by its own box (single-line truncation without title).
    const clipped = [];
    for (const el of document.querySelectorAll("main button, main a, main h1, main h2, main h3, main th, main td, main label, main summary, header a, header button")) {
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== "visible" && el.clientWidth > 0) {
        clipped.push(`${el.tagName.toLowerCase()}"${el.textContent.trim().slice(0, 30)}" ${el.clientWidth}<${el.scrollWidth}`);
      }
    }
    return {
      overflow: document.documentElement.scrollWidth - vw,
      outside: out.slice(0, 5),
      clipped: clipped.slice(0, 5),
      title: document.title,
      h1: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()).join(" | "),
    };
  });

for (const vp of VIEWPORTS) {
  for (const [who, screens] of Object.entries(SCREENS)) {
    const page = await newPage(browser, vp);
    await login(page, USERS[who]);
    for (const [name, url, prepare] of screens) {
      const tag = `${who}-${name}-${vp.width}`;
      await test("E", `Layout ${nice(url)} (${name}) as ${who} at ${vp.width}px${vp.touch ? " touch" : ""}`, {
        pre: `Demo data; logged in as ${USERS[who]}`,
        steps: `Open ${nice(url)} at ${vp.width}x${vp.height}; measure page overflow, elements outside the viewport, clipped labels, console errors`,
        expected: "No horizontal page scroll, nothing sticks out of the viewport, no clipped control labels, no console errors (NFR-07)",
        req: "NFR-07",
      }, async () => {
        page.errors.length = 0;
        const res = await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
        if (prepare) await prepare(page);
        await page.waitForTimeout(500);
        const m = await measure(page);
        const evidence = await shot(page, `resp-${tag}`);
        const expectedStatus = name.startsWith("403") ? 403 : name.startsWith("404") ? 404 : 200;
        const errs = page.errors.filter((e) => !/status of 40[34]/.test(e));
        const ok = m.overflow <= 1 && m.outside.length === 0 && m.clipped.length === 0 && errs.length === 0 && res.status() === expectedStatus;
        return {
          ok,
          actual: `HTTP ${res.status()}; overflow ${m.overflow}px; outside: ${m.outside.join("; ") || "none"}; clipped: ${m.clipped.join("; ") || "none"}; errors: ${errs.join("; ").slice(0, 200) || "none"}; h1 "${m.h1}"`,
          evidence,
        };
      });
      if (vp.width === 360) {
        await test("E", `Touch targets on ${nice(url)} (${name}) as ${who}, 360px touch device`, {
          pre: `Emulated touch device (hasTouch, isMobile), ${USERS[who]}`,
          steps: "Measure every visible link, button, select, input, summary",
          expected: "Controls are at least 44 px high and wide on a touch device (kit uses pointer-coarse variants); at minimum 24 px (WCAG 2.5.8)",
          req: "NFR-07, BUG-026",
        }, async () => {
          // The header is the same on every page and is measured once per role below.
          const small = await smallTargets(page, 44, "main");
          const tiny = await smallTargets(page, 24, "main");
          return {
            ok: small.length === 0,
            actual: small.length ? `${small.length} below 44px (${tiny.length} below 24px): ${small.slice(0, 12).join(" | ")}` : "all targets >= 44px",
            evidence: `shots/resp-${tag}.png`,
          };
        });
      }
    }
    if (vp.width === 360) {
      await test("E", `Touch targets in the header as ${who}, 360px touch device`, {
        pre: `Emulated touch device, ${USERS[who]}`, steps: "Open /; measure the logo link, menu items, animation button, logout button",
        expected: "Each at least 44x44 px on a touch device", req: "NFR-07, BUG-026",
      }, async () => {
        await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
        const small = await smallTargets(page, 44, "header");
        return { ok: small.length === 0, actual: small.length ? small.join(" | ") : "all header targets >= 44x44", evidence: `shots/resp-${who}-home-360.png` };
      });
    }
    await page.context().close();
  }
}

// Login page (logged out) at all viewports.
for (const vp of VIEWPORTS) {
  const page = await newPage(browser, vp);
  await test("E", `Layout /login (logged out) at ${vp.width}px`, {
    steps: `Open /login at ${vp.width}px`, expected: "No horizontal scroll, form visible", req: "NFR-07, MVP-01",
  }, async () => {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    const m = await measure(page);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const evidence = await shot(page, `resp-login-${vp.width}`);
    const small = vp.touch ? await smallTargets(page, 44) : [];
    return { ok: o <= 1 && small.length === 0, actual: `overflow ${o}px; small targets: ${small.join(" | ") || "none"}; title "${m.title}"`, evidence };
  });
  await page.context().close();
}

await browser.close();
