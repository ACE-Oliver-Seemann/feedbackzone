// Area E/F – responsive layout and visual checks at 1440, 1280, 768, 360 and 320 px.
// Read-only: the questionnaire is walked up to the comment step but never submitted.
import { BASE, USERS, launch, makeRecorder, newPage, session, shot, discover, nice } from "./lib.mjs";

const { test } = makeRecorder("02-responsive");
const browser = await launch();
const ids = await discover(browser);

const VIEWPORTS = [
  ["desktop", 1440, 900],
  ["laptop", 1280, 800],
  ["tablet", 768, 1024],
  ["mobile", 360, 740],
  ["small", 320, 640],
];

/** Layout facts of the current page, measured in the browser. */
const measure = (page) =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const describe = (el) =>
      `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ").slice(0, 2).join(".") : ""} "${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`;
    const inScroller = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return true;
      }
      return false;
    };
    const outside = [];
    const clipped = [];
    const scrollers = [];
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.position === "absolute" && rect.width <= 1) continue; // sr-only
      if ((rect.right > vw + 1 || rect.left < -1) && !inScroller(el)) outside.push(`${describe(el)} right=${Math.round(rect.right)}`);
      if (/(hidden|clip)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1) clipped.push(describe(el));
      if (/(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1)
        scrollers.push(`${describe(el).slice(0, 40)} ${el.scrollWidth}>${el.clientWidth}`);
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: vw,
      outside: outside.slice(0, 5),
      outsideCount: outside.length,
      clipped: clipped.slice(0, 5),
      scrollers,
    };
  });

// name, role key, route, optional preparation of the page state
const fillTo = (step) => async (page) => {
  await page.getByRole("button", { name: "Začať" }).click();
  if (step === "question") return;
  for (let i = 0; i < 4; i++) {
    // answer every question with the middle option, whatever the scale looks like
    const buttons = page.locator("fieldset button[aria-pressed]");
    await buttons.nth(2).click();
    await page.getByRole("button", { name: "Ďalej" }).click();
  }
  await page.getByLabel("Komentár").waitFor();
};
const openDetails = async (page) => {
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
};
const SCREENS = [
  ["login", "anon", "/login"],
  ["home-employee", "employee", "/"],
  ["fill-intro", "employee", `/rounds/${ids.openA}/fill`],
  ["fill-question", "employee", `/rounds/${ids.openA}/fill`, fillTo("question")],
  ["fill-comment", "employee", `/rounds/${ids.openA}/fill`, fillTo("comment")],
  ["team-employee", "employee", `/team/${ids.teamA}`],
  ["kudos-new", "employee", "/kudos/new"],
  ["kudos-me", "employee", "/kudos/me"],
  ["forbidden", "employee", "/hr/rounds"],
  ["home-manager", "manager", "/"],
  ["rounds-manager", "manager", "/rounds"],
  ["round-new-manager", "manager", "/rounds/new", openDetails],
  ["results-ok", "manager", `/rounds/${ids.okA}/results`, openDetails],
  ["results-insufficient", "manager", `/rounds/${ids.lowA}/results`],
  ["results-with-actions", "manager", `/rounds/${ids.doneA}/results`],
  ["report", "manager", `/rounds/${ids.okA}/report`],
  ["trend-manager", "manager", `/team/${ids.teamA}/trend`],
  ["home-hr", "hr", "/"],
  ["hr-rounds", "hr", "/hr/rounds"],
  ["hr-overview", "hr", "/hr/overview", openDetails],
  ["hr-heatmap", "hr", "/hr/heatmap"],
  ["hr-issues", "hr", "/hr/issues?status=ALL", openDetails],
  ["hr-notes", "hr", "/hr/notes"],
  ["round-new-hr", "hr", "/rounds/new"],
];

const pages = {
  anon: await newPage(browser),
  employee: await session(browser, USERS.adam),
  manager: await session(browser, USERS.mgrA),
  hr: await session(browser, USERS.hr),
};

for (const [name, role, route, prepare] of SCREENS) {
  for (const [device, width, height] of VIEWPORTS) {
    const page = pages[role];
    await test("E-Responsive", `${name} at ${width} px (${device}) – no horizontal scroll, nothing outside the viewport, nothing clipped`, { pre: `${role}; viewport ${width}×${height}`, steps: `Open ${nice(route)}${prepare ? " and bring it to the tested state" : ""}; measure the layout; take a full-page screenshot`, expected: "Page width = viewport width; no element sticks out; no clipped text (NFR-07 from 360 px)", req: width >= 360 ? "NFR-07" : "below the supported 360 px (informational)" }, async () => {
      await page.setViewportSize({ width, height });
      await page.goto(BASE + route);
      if (prepare) await prepare(page);
      const facts = await measure(page);
      const evidence = await shot(page, `resp-${name}-${width}`);
      const ok = facts.scrollWidth <= facts.clientWidth && facts.outsideCount === 0 && facts.clipped.length === 0;
      return {
        ok,
        actual: `page ${facts.scrollWidth}/${facts.clientWidth} px; outside: ${facts.outsideCount ? facts.outside.join("; ") : "none"}; clipped: ${facts.clipped.length ? facts.clipped.join("; ") : "none"}; inner horizontal scrollers: ${facts.scrollers.length ? facts.scrollers.join("; ") : "none"}`,
        evidence,
      };
    });
  }
}

// ---------- tap targets at 360 px
const sizes = (page, selector) =>
  page.$$eval(selector, (els) =>
    els
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return { text: (el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 24), w: Math.round(rect.width), h: Math.round(rect.height) };
      })
      .filter((item) => item.w > 0 && item.h > 0),
  );
const TAPS = [
  ["main menu links", "employee", "/", "header nav a"],
  ["logout button", "employee", "/", "header button"],
  ["login inputs and submit", "anon", "/login", "form input, form button"],
  ["home task button", "employee", "/", "main ol a"],
  ["questionnaire: Začať", "employee", `/rounds/${ids.openA}/fill`, "main button"],
  ["questionnaire: scale buttons, Späť, Ďalej", "employee", `/rounds/${ids.openA}/fill`, "main button", fillTo("question")],
  ["questionnaire: comment, Späť, Odoslať", "employee", `/rounds/${ids.openA}/fill`, "main button, main textarea", fillTo("comment")],
  ["kudos form: selects, emoji buttons, submit", "employee", "/kudos/new", "form select, form button, form textarea"],
  ["kudos form: visibility radio rows", "employee", "/kudos/new", "form fieldset label"],
  ["tabs (sub navigation)", "employee", "/kudos/new", "main nav a"],
  ["round list: Výsledky, Uzavrieť, Vytvoriť kolo", "manager", "/rounds", "main a, main button"],
  ["results: Report na tlač, Použiť ako krok, Pridať krok", "manager", `/rounds/${ids.okA}/results`, "main a.rounded-md, main button"],
  ["results: summary toggles (Rozdelenie odpovedí, Komentáre)", "manager", `/rounds/${ids.okA}/results`, "main summary"],
  ["new round: question check rows", "manager", "/rounds/new", "form li label", openDetails],
  ["issues: filter selects and button, status selects, Pridať podnet", "hr", "/hr/issues?status=ALL", "main select, main button, main summary"],
];
for (const [what, role, route, selector, prepare] of TAPS) {
  await test("E-Responsive", `Tap targets at 360 px: ${what}`, { pre: `${role}; viewport 360×740`, steps: `Open ${nice(route)}; measure ${selector}`, expected: "Controls are at least 44 px high (and wide) so they can be hit with a thumb; 24 px is the WCAG 2.2 AA minimum", req: "NFR-07 / WCAG 2.5.8 (AA 24 px), 2.5.5 (AAA 44 px)" }, async () => {
    const page = pages[role];
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(BASE + route);
    if (prepare) await prepare(page);
    const all = await sizes(page, selector);
    const small = all.filter((item) => item.h < 44 || item.w < 44);
    const tiny = all.filter((item) => item.h < 24 || item.w < 24);
    const unique = [...new Map(small.map((item) => [`${item.text}|${item.h}`, item])).values()];
    return {
      ok: small.length === 0,
      actual: `${all.length} controls measured; below 44 px: ${small.length}${unique.length ? ` (${unique.slice(0, 8).map((item) => `"${item.text}" ${item.w}×${item.h}`).join(", ")})` : ""}; below 24 px: ${tiny.length}`,
    };
  });
}

// ---------- menu wrapping on small screens
for (const [role, width] of [["hr", 360], ["hr", 320], ["manager", 360], ["manager", 320], ["employee", 320]]) {
  await test("E-Responsive", `Main menu of ${role} at ${width} px stays on one row and inside the header`, { pre: `${role}; viewport ${width} px`, steps: "Open /; measure the menu", expected: "All menu items visible without horizontal scroll; ideally one row", req: "IT-12" }, async () => {
    const page = pages[role];
    await page.setViewportSize({ width, height: 700 });
    await page.goto(BASE + "/");
    const boxes = await page.$$eval("header nav a", (els) => els.map((el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), right: Math.round(r.right) }; }));
    const rows = new Set(boxes.map((box) => box.top)).size;
    const maxRight = Math.max(...boxes.map((box) => box.right));
    const headerHeight = await page.locator("header").evaluate((el) => Math.round(el.getBoundingClientRect().height));
    return { ok: rows === 1 && maxRight <= width, actual: `${boxes.length} items in ${rows} row(s); rightmost edge ${maxRight}/${width} px; header height ${headerHeight} px` };
  });
}

// ---------- layout shift while the page loads and hydrates
for (const [name, role, route] of [["home-manager", "manager", "/"], ["results-ok", "manager", `/rounds/${ids.okA}/results`], ["kudos-new", "employee", "/kudos/new"], ["hr-overview", "hr", "/hr/overview"]]) {
  await test("D-Animations", `No layout shift or flicker while ${name} loads (CLS)`, { pre: `${role}; viewport 360×740`, steps: `Open ${nice(route)} with a layout-shift PerformanceObserver`, expected: "Cumulative layout shift 0 (below 0.1 at worst)" }, async () => {
    const page = pages[role];
    await page.setViewportSize({ width: 360, height: 740 });
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(BASE + route);
    await page.waitForTimeout(1200);
    const cls = await page.evaluate(() => window.__cls);
    return { ok: cls < 0.1, actual: `CLS = ${cls.toFixed(4)}` };
  });
}

await browser.close();
