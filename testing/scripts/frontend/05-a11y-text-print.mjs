// Areas G (accessibility), D (animations / reduced motion), text quality, print view and
// read-only component checks. Read-only: run it on freshly seeded demo data.
import fs from "node:fs";
import path from "node:path";
import { BASE, EVID, USERS, launch, makeRecorder, newPage, session, shot, discover, nice } from "./lib.mjs";

const { test } = makeRecorder("05-a11y-text-print");
const browser = await launch();
const ids = await discover(browser);
const G = "G-Accessibility";
const D = "D-Animations";
const T = "T-Text";
const P = "P-Print";
const B = "B-Components";
const F = "F-Visual";
const flat = (text) => text.replace(/\s+/g, " ").trim();

const pages = {
  anon: await newPage(browser),
  employee: await session(browser, USERS.adam),
  manager: await session(browser, USERS.mgrA),
  managerB: await session(browser, USERS.mgrB),
  hr: await session(browser, USERS.hr),
};
const openDetails = (page) => page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
const toQuestion = async (page) => { await page.getByRole("button", { name: "Začať" }).click(); };
const toComment = async (page) => {
  await page.getByRole("button", { name: "Začať" }).click();
  for (let i = 0; i < 4; i++) {
    await page.locator("fieldset button[aria-pressed]").nth(2).click();
    await page.getByRole("button", { name: "Ďalej" }).click();
  }
  await page.getByLabel("Komentár").waitFor();
};
const SCREENS = [
  ["login", "anon", "/login"],
  ["home-employee", "employee", "/"],
  ["fill-intro", "employee", `/rounds/${ids.openA}/fill`],
  ["fill-question", "employee", `/rounds/${ids.openA}/fill`, toQuestion],
  ["fill-comment", "employee", `/rounds/${ids.openA}/fill`, toComment],
  ["team", "employee", `/team/${ids.teamA}`],
  ["kudos-new", "employee", "/kudos/new"],
  ["kudos-me", "employee", "/kudos/me"],
  ["forbidden", "employee", "/hr/rounds"],
  ["not-found", "employee", "/does-not-exist"],
  ["home-manager", "manager", "/"],
  ["rounds", "manager", "/rounds"],
  ["round-new", "manager", "/rounds/new", openDetails],
  ["results-ok", "manager", `/rounds/${ids.okA}/results`, openDetails],
  ["results-with-actions", "manager", `/rounds/${ids.doneA}/results`, openDetails],
  ["results-insufficient", "manager", `/rounds/${ids.lowA}/results`],
  ["report", "manager", `/rounds/${ids.okA}/report`],
  ["trend", "manager", `/team/${ids.teamA}/trend`],
  ["home-hr", "hr", "/"],
  ["hr-rounds", "hr", "/hr/rounds"],
  ["hr-overview", "hr", "/hr/overview", openDetails],
  ["hr-heatmap", "hr", "/hr/heatmap"],
  ["hr-issues", "hr", "/hr/issues?status=ALL", openDetails],
  ["hr-notes", "hr", "/hr/notes"],
];
const open = async ([, role, route, prepare]) => {
  const page = pages[role];
  await page.goto(BASE + route);
  if (prepare) await prepare(page);
  return page;
};

// ---------- document basics
await test(G, "Document language is Slovak on every screen", { pre: "All roles", steps: "Read <html lang> on every screen", expected: 'lang="sk"', req: "NFR-07 / WCAG 3.1.1" }, async () => {
  const langs = [];
  for (const screen of SCREENS) langs.push(await (await open(screen)).evaluate(() => document.documentElement.lang));
  return { ok: langs.every((lang) => lang === "sk"), actual: `values: ${[...new Set(langs)].join(", ")} on ${langs.length} screens` };
});
await test(G, "Every screen has its own descriptive <title>", { pre: "All roles", steps: "Read document.title on every screen", expected: "A title that names the screen (WCAG 2.4.2), not the same text everywhere", req: "WCAG 2.4.2" }, async () => {
  const titles = {};
  for (const screen of SCREENS) titles[screen[0]] = await (await open(screen)).title();
  const unique = [...new Set(Object.values(titles))];
  return { ok: unique.length >= SCREENS.length - 4, actual: `${unique.length} distinct title(s) on ${SCREENS.length} screens: ${unique.map((title) => `"${title}"`).join(", ")}` };
});
await test(G, "Landmarks: header, main and labelled navigation", { pre: "Manager on the team page (main menu + tabs)", steps: "Inspect landmarks", expected: "One <main>, a <header>, and every <nav> has its own accessible name when there is more than one", req: "WCAG 1.3.1, 2.4.1" }, async () => {
  const page = pages.manager;
  await page.goto(`${BASE}/team/${ids.teamA}`);
  const info = await page.evaluate(() => ({
    main: document.querySelectorAll("main").length,
    header: document.querySelectorAll("header").length,
    navs: [...document.querySelectorAll("nav")].map((nav) => nav.getAttribute("aria-label") || "(no name)"),
    skip: [...document.querySelectorAll("a")].some((a) => /preskoč|obsah/i.test(a.textContent) && a.getAttribute("href")?.startsWith("#")),
  }));
  return { ok: info.main === 1 && info.header === 1 && !info.navs.includes("(no name)"), actual: `main: ${info.main}, header: ${info.header}, nav names: ${info.navs.join(" | ")}; skip link to the content: ${info.skip}` };
});

// ---------- headings
for (const screen of SCREENS) {
  await test(G, `Heading structure on ${screen[0]}`, { pre: screen[1], steps: `Open ${nice(screen[2])}; list h1–h6`, expected: "Exactly one h1 and no skipped level (h1 → h2 → h3)", req: "WCAG 1.3.1, 2.4.6" }, async () => {
    const page = await open(screen);
    const levels = await page.$$eval("h1, h2, h3, h4, h5, h6", (els) => els.filter((el) => el.getClientRects().length > 0).map((el) => Number(el.tagName[1])));
    const h1 = levels.filter((level) => level === 1).length;
    let skipped = false;
    levels.forEach((level, index) => { if (index > 0 && level > levels[index - 1] + 1) skipped = true; });
    if (levels.length && levels[0] !== 1) skipped = true;
    return { ok: h1 === 1 && !skipped, actual: `h1 count ${h1}; order: ${levels.join(" ") || "(no headings)"}` };
  });
}

// ---------- form labels
const FORMS = SCREENS.filter(([name]) => ["login", "fill-question", "fill-comment", "kudos-new", "round-new", "results-ok", "hr-issues", "hr-notes"].includes(name));
for (const screen of FORMS) {
  await test(G, `Every form control has an accessible name on ${screen[0]}`, { pre: screen[1], steps: `Open ${nice(screen[2])}; compute the accessible name of each input, select, textarea and button`, expected: "No control without a label / aria-label", req: "WCAG 1.3.1, 3.3.2, 4.1.2" }, async () => {
    const page = await open(screen);
    const result = await page.evaluate(() => {
      const controls = [...document.querySelectorAll("main input, main select, main textarea, main button, main summary")].filter((el) => el.getClientRects().length > 0 && el.type !== "hidden");
      const name = (el) =>
        el.getAttribute("aria-label") ||
        (el.getAttribute("aria-labelledby") && document.getElementById(el.getAttribute("aria-labelledby"))?.textContent) ||
        (el.labels && [...el.labels].map((label) => label.textContent).join(" ")) ||
        (["BUTTON", "SUMMARY"].includes(el.tagName) ? el.textContent : "") ||
        "";
      const missing = controls.filter((el) => !name(el).trim()).map((el) => `${el.tagName.toLowerCase()}[name=${el.getAttribute("name")}]`);
      return { total: controls.length, missing };
    });
    return { ok: result.missing.length === 0, actual: `${result.total} controls; without a name: ${result.missing.length ? result.missing.join(", ") : "none"}` };
  });
}
await test(G, "Validation errors are tied to their fields (kudos form)", { pre: "Employee, /kudos/new", steps: "Submit the empty form; inspect aria-invalid / aria-describedby and where the focus goes", expected: "Invalid fields carry aria-invalid and reference their message; focus moves to the first invalid field", req: "WCAG 3.3.1, 4.1.3" }, async () => {
  const page = pages.employee;
  await page.goto(`${BASE}/kudos/new`);
  await page.locator('form button[type="submit"]').click();
  await page.locator('form [role="alert"]').first().waitFor();
  const info = await page.evaluate(() => ({
    invalid: document.querySelectorAll('form [aria-invalid="true"]').length,
    described: document.querySelectorAll("form [aria-describedby]").length,
    alerts: document.querySelectorAll('form [role="alert"]').length,
    focus: document.activeElement.tagName + (document.activeElement.getAttribute("name") ? `[${document.activeElement.getAttribute("name")}]` : ` "${document.activeElement.textContent.slice(0, 20)}"`),
  }));
  return { ok: info.invalid > 0 && info.described > 0, actual: `role=alert messages: ${info.alerts}; fields with aria-invalid: ${info.invalid}; with aria-describedby: ${info.described}; focus stays on: ${info.focus}` };
});
await test(G, "Required fields are announced as required", { pre: "Kudos, new round, action, issue and note forms", steps: "Count required / aria-required attributes on mandatory fields", expected: "Mandatory fields are marked (required or aria-required) or the label says so", req: "WCAG 3.3.2" }, async () => {
  const counts = [];
  for (const [role, route, prepare] of [["employee", "/kudos/new"], ["manager", "/rounds/new"], ["manager", `/rounds/${ids.okA}/results`], ["hr", "/hr/issues", openDetails], ["hr", "/hr/notes"]]) {
    const page = pages[role];
    await page.goto(BASE + route);
    if (prepare) await prepare(page);
    counts.push(`${nice(route)}: ${await page.locator("main [required], main [aria-required='true']").count()}`);
  }
  return { ok: counts.every((item) => !item.endsWith(": 0")), actual: `marked fields – ${counts.join("; ")} (the login form marks both of its fields)` };
});

// ---------- colour contrast from the colours actually rendered
const contrastScan = (page) =>
  page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const rgba = (color) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const over = (top, bottom) => top.slice(0, 3).map((value, i) => value * top[3] + bottom[i] * (1 - top[3]));
    const luminance = (rgb) => {
      const [r, g, b] = rgb.map((value) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const background = (el) => {
      const layers = [];
      for (let node = el; node; node = node.parentElement) {
        const color = rgba(getComputedStyle(node).backgroundColor);
        if (color[3] > 0) layers.push(color);
        if (color[3] === 1) break;
      }
      let result = [255, 255, 255];
      for (const layer of layers.reverse()) result = over(layer, result);
      return result;
    };
    const failures = new Map();
    let checked = 0;
    for (const el of document.querySelectorAll("body *")) {
      if (["SCRIPT", "STYLE", "OPTION", "NOSCRIPT"].includes(el.tagName)) continue;
      const own = [...el.childNodes].filter((node) => node.nodeType === 3 && node.textContent.trim()).map((node) => node.textContent.trim()).join(" ");
      if (!own) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || el.closest("[disabled]")) continue;
      const svg = el instanceof SVGElement;
      const fg = rgba(svg ? style.fill : style.color);
      const bg = background(svg ? el.closest("figure") || el.parentElement : el);
      const color = over(fg, bg);
      const l1 = luminance(color);
      const l2 = luminance(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(style.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      checked++;
      if (ratio < (large ? 3 : 4.5)) {
        const hex = (rgb) => "#" + rgb.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("");
        const key = `${hex(color)} on ${hex(bg)}`;
        if (!failures.has(key)) failures.set(key, `"${own.slice(0, 28)}" ${hex(color)} on ${hex(bg)} = ${ratio.toFixed(2)}:1 (${Math.round(size)}px)`);
      }
    }
    return { checked, failures: [...failures.values()] };
  });
for (const screen of SCREENS) {
  await test(G, `Colour contrast of text on ${screen[0]}`, { pre: screen[1], steps: `Open ${nice(screen[2])}; compute the contrast of every visible text against its real background`, expected: "At least 4.5:1 for normal text and 3:1 for large text (WCAG AA)", req: "WCAG 1.4.3" }, async () => {
    const page = await open(screen);
    const result = await contrastScan(page);
    return { ok: result.failures.length === 0, actual: `${result.checked} text elements; below AA: ${result.failures.length ? result.failures.slice(0, 6).join("; ") : "none"}` };
  });
}
await test(G, "Colour contrast of placeholder text", { pre: "Manager, /rounds/new", steps: "Read the computed ::placeholder colour of the own-question field against white", expected: "At least 4.5:1", req: "WCAG 1.4.3" }, async () => {
  const page = pages.manager;
  await page.goto(`${BASE}/rounds/new`);
  const result = await page.evaluate(() => {
    const input = [...document.querySelectorAll("input[placeholder]")].find((el) => !el.value);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = getComputedStyle(input, "::placeholder").color;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = 1.05 / (lum([d[0], d[1], d[2]]) + 0.05);
    return { placeholder: input.placeholder, ratio, rgb: `rgb(${d[0]}, ${d[1]}, ${d[2]})` };
  });
  return { ok: result.ratio >= 4.5, actual: `placeholder "${result.placeholder}" ${result.rgb} on white = ${result.ratio.toFixed(2)}:1` };
});
await test(G, "Non-text contrast: borders of inputs and of the scale buttons", { pre: "Employee on a question", steps: "Compute the contrast of the control border against the page background", expected: "At least 3:1 so the control can be seen (WCAG 1.4.11)", req: "WCAG 1.4.11" }, async () => {
  const page = await open(SCREENS.find(([name]) => name === "fill-question"));
  const result = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    const rgb = (color) => { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const lum = (c) => { const [r, g, b] = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const button = document.querySelector("fieldset button[aria-pressed]");
    const border = rgb(getComputedStyle(button).borderColor);
    const page = rgb(getComputedStyle(document.body).backgroundColor);
    const fill = rgb(getComputedStyle(button).backgroundColor);
    return { border: ratio(border, page), fill: ratio(fill, page) };
  });
  return { ok: result.border >= 3, actual: `scale button border against the page: ${result.border.toFixed(2)}:1; its white fill against the page: ${result.fill.toFixed(2)}:1` };
});

// ---------- focus
for (const name of ["home-manager", "rounds", "results-ok", "round-new", "hr-issues", "kudos-new", "fill-question"]) {
  const screen = SCREENS.find((item) => item[0] === name);
  await test(G, `Visible focus on every Tab stop: ${name}`, { pre: screen[1], steps: `Open ${nice(screen[2])}; press Tab through the page`, expected: "Every focused control shows an outline or a ring", req: "WCAG 2.4.7" }, async () => {
    const page = await open(screen);
    const missing = [];
    let stops = 0;
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        return { label: `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.innerText || el.getAttribute("name") || "").trim().slice(0, 24)}"`, ring: (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none" };
      });
      if (!info) { if (stops > 0) break; continue; }
      stops++;
      if (!info.ring) missing.push(info.label);
    }
    return { ok: missing.length === 0 && stops > 0, actual: `${stops} stops; without a visible indicator: ${missing.length ? [...new Set(missing)].slice(0, 6).join(", ") : "none"}`, evidence: name === "rounds" ? await shot(page, "focus-rounds-1280", false) : "" };
  });
}
await test(G, "<details> blocks open from the keyboard", { pre: "Manager, results above the threshold", steps: "Focus „Komentáre (2)“, press Enter; focus „Rozdelenie odpovedí“, press Space", expected: "Both open", req: "WCAG 2.1.1" }, async () => {
  const page = pages.manager;
  await page.goto(`${BASE}/rounds/${ids.okA}/results`);
  const comments = page.locator("summary", { hasText: "Komentáre" });
  await comments.focus();
  await page.keyboard.press("Enter");
  const a = await comments.evaluate((el) => el.parentElement.open);
  const dist = page.locator("summary", { hasText: "Rozdelenie odpovedí" }).first();
  await dist.focus();
  await page.keyboard.press("Space");
  const b = await dist.evaluate((el) => el.parentElement.open);
  return { ok: a && b, actual: `comments opened: ${a}; distribution opened: ${b}` };
});
await test(G, "Scale buttons expose their meaning and state to assistive technology", { pre: "Employee on question 1", steps: "Read role, name and aria-pressed of the five buttons and the group label", expected: "Buttons named „1 – Veľmi zlé“ … with aria-pressed, inside a group labelled by the question", req: "WCAG 4.1.2" }, async () => {
  const page = await open(SCREENS.find(([name]) => name === "fill-question"));
  const names = await page.locator("fieldset button[aria-pressed]").evaluateAll((els) => els.map((el) => `${el.getAttribute("aria-label")}[${el.getAttribute("aria-pressed")}]`));
  const legend = await page.locator("fieldset legend").innerText();
  return { ok: names.length === 5 && names.every((name) => /^\d – .+\[false\]$/.test(name)) && legend.length > 5, actual: `group: "${legend}"; buttons: ${names.join(", ")}` };
});
await test(G, "The new question is announced when the step changes", { pre: "Employee on question 1", steps: "Answer and click „Ďalej“; inspect live regions and focus", expected: "The new question text is in a live region or receives focus, so a screen-reader user hears it", req: "WCAG 4.1.3, 2.4.3" }, async () => {
  const page = await open(SCREENS.find(([name]) => name === "fill-question"));
  await page.locator("fieldset button[aria-pressed]").nth(2).click();
  await page.getByRole("button", { name: "Ďalej" }).click();
  const info = await page.evaluate(() => ({
    legendLive: Boolean(document.querySelector("fieldset legend").closest("[aria-live]")),
    live: [...document.querySelectorAll("main [aria-live]")].map((el) => el.textContent.trim()).filter(Boolean),
    focus: document.activeElement.tagName + (document.activeElement.disabled ? " (disabled)" : ""),
  }));
  return { ok: info.legendLive, actual: `question inside a live region: ${info.legendLive}; live regions say: ${info.live.join(" | ")}; focus: ${info.focus}` };
});
await test(G, "Chart has a text alternative", { pre: "Manager, trend page", steps: "Inspect the SVG and the page", expected: "role=img with a name, and the same numbers in a table", req: "WCAG 1.1.1" }, async () => {
  const page = pages.manager;
  await page.goto(`${BASE}/team/${ids.teamA}/trend`);
  const svg = await page.locator("figure svg").evaluate((el) => ({ role: el.getAttribute("role"), label: el.getAttribute("aria-label"), titles: el.querySelectorAll("title").length }));
  const rows = await page.locator("table tbody tr").count();
  return { ok: svg.role === "img" && Boolean(svg.label) && rows === 5, actual: `role=${svg.role}, aria-label="${svg.label}" (does not say the values or the trend), ${svg.titles} point tooltips; table rows: ${rows}` };
});
await test(G, "Emoji in kudos have a text alternative", { pre: "Employee, „Moje kudos“ and the kudos form", steps: "Inspect the emoji elements", expected: "Emoji buttons have an accessible name; the emoji shown on a card is exposed as an image with a name (role=img + aria-label)", req: "WCAG 1.1.1" }, async () => {
  const page = pages.employee;
  await page.goto(`${BASE}/kudos/me`);
  const card = await page.locator("main li p.text-3xl").first().evaluate((el) => ({ role: el.getAttribute("role"), label: el.getAttribute("aria-label"), text: el.textContent }));
  await page.goto(`${BASE}/kudos/new`);
  const buttons = await page.locator("form fieldset button[aria-pressed]").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  return { ok: buttons.every(Boolean) && card.role === "img", actual: `form buttons named: ${buttons.join(" ")} (the emoji itself, no Slovak word); card emoji: <p role=${card.role} aria-label="${card.label}">` };
});
await test(G, "Tables have header cells with scope", { pre: "HR heatmap, manager trend and report", steps: "Inspect th elements", expected: "Column and row headers use <th scope>", req: "WCAG 1.3.1" }, async () => {
  const out = [];
  for (const [role, route] of [["hr", "/hr/heatmap"], ["manager", `/team/${ids.teamA}/trend`], ["manager", `/rounds/${ids.okA}/report`]]) {
    await pages[role].goto(BASE + route);
    const info = await pages[role].evaluate(() => ({ th: document.querySelectorAll("table th").length, scoped: document.querySelectorAll("table th[scope]").length, caption: document.querySelectorAll("table caption").length }));
    out.push(`${nice(route)}: ${info.scoped}/${info.th} th with scope, caption: ${info.caption}`);
  }
  return { ok: out.every((item) => { const m = item.match(/(\d+)\/(\d+) th/); return m[1] === m[2] && m[2] !== "0"; }), actual: out.join("; ") };
});
await test(G, "Horizontally scrolling tables can be scrolled from the keyboard", { pre: "Manager, trend page at 1280 px", steps: "Inspect the scroll container of the table", expected: "The container is focusable (tabindex=0) with a name, or the table fits", req: "WCAG 2.1.1" }, async () => {
  const page = pages.manager;
  await page.goto(`${BASE}/team/${ids.teamA}/trend`);
  const info = await page.locator("div.overflow-x-auto").evaluate((el) => ({ scrolls: el.scrollWidth > el.clientWidth, tabindex: el.getAttribute("tabindex"), label: el.getAttribute("aria-label"), role: el.getAttribute("role") }));
  await page.keyboard.press("Tab");
  let reached = false;
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => document.activeElement.classList.contains("overflow-x-auto"))) { reached = true; break; }
    await page.keyboard.press("Tab");
  }
  return { ok: !info.scrolls || reached, actual: `table scrolls horizontally: ${info.scrolls}; tabindex: ${info.tabindex}; name: ${info.label}; reachable with Tab in this browser: ${reached}` };
});
await test(G, "Text can be enlarged to 200 % without loss (questionnaire, 360 px)", { pre: "Employee on a question, 360 px, root font size doubled", steps: "Set html font-size to 200 %, measure", expected: "No horizontal page scroll, buttons still reachable", req: "WCAG 1.4.4, 1.4.10" }, async () => {
  const page = pages.employee;
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`${BASE}/rounds/${ids.openA}/fill`);
  await toQuestion(page);
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  const size = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  const evidence = await shot(page, "fill-question-200pct-360");
  await page.setViewportSize({ width: 1280, height: 800 });
  return { ok: size.scrollWidth <= size.clientWidth, actual: `page ${size.scrollWidth}/${size.clientWidth} px`, evidence };
});

// ---------- animations and reduced motion
await test(D, "Reduced motion: the progress bar of the questionnaire does not animate", { pre: "Employee, prefers-reduced-motion: reduce", steps: "Open a question; read the transition of the progress bar", expected: "transition-duration 0 s under reduced motion (IT-02: animations switch off)", req: "IT-02 / WCAG 2.3.3" }, async () => {
  const page = await session(browser, USERS.adam, { reducedMotion: "reduce" });
  await page.goto(`${BASE}/rounds/${ids.openA}/fill`);
  await toQuestion(page);
  const reduced = await page.locator('div[aria-hidden="true"] > div').evaluate((el) => `${getComputedStyle(el).transitionProperty} ${getComputedStyle(el).transitionDuration}`);
  const matches = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  await page.context().close();
  return { ok: /\b0s$/.test(reduced), actual: `media query matches: ${matches}; progress bar transition: ${reduced}` };
});
await test(D, "Progress bar transition is short and causes no layout shift", { pre: "Employee, default motion", steps: "Read the transition; click „Ďalej“ and compare the position of the question before and after", expected: "Duration ≤ 1.5 s; the content below does not jump", req: "IT-02" }, async () => {
  const page = pages.employee;
  await page.goto(`${BASE}/rounds/${ids.openA}/fill`);
  await toQuestion(page);
  const duration = await page.locator('div[aria-hidden="true"] > div').evaluate((el) => getComputedStyle(el).transitionDuration);
  const before = await page.locator("fieldset").evaluate((el) => el.getBoundingClientRect().top);
  await page.locator("fieldset button[aria-pressed]").nth(1).click();
  const afterSelect = await page.getByRole("button", { name: "Ďalej" }).evaluate((el) => el.getBoundingClientRect().top);
  await page.locator("fieldset button[aria-pressed]").nth(3).click();
  const afterChange = await page.getByRole("button", { name: "Ďalej" }).evaluate((el) => el.getBoundingClientRect().top);
  await page.getByRole("button", { name: "Ďalej" }).click();
  const after = await page.locator("fieldset").evaluate((el) => el.getBoundingClientRect().top);
  return { ok: parseFloat(duration) <= 1.5 && before === after && afterSelect === afterChange, actual: `duration ${duration}; fieldset top ${before} → ${after}; „Ďalej“ top stays ${afterSelect} → ${afterChange} when the answer changes` };
});
await test(D, "Hover effect on a primary button", { pre: "Employee home", steps: "Hover „Vyplniť“", expected: "Background darkens, nothing moves", req: "—" }, async () => {
  const page = pages.employee;
  await page.goto(BASE + "/");
  const link = page.getByRole("link", { name: "Vyplniť" });
  const before = await link.evaluate((el) => `${getComputedStyle(el).backgroundColor}|${Math.round(el.getBoundingClientRect().top)}`);
  await link.hover();
  await page.waitForTimeout(250);
  const after = await link.evaluate((el) => `${getComputedStyle(el).backgroundColor}|${Math.round(el.getBoundingClientRect().top)}`);
  return { ok: before.split("|")[0] !== after.split("|")[0] && before.split("|")[1] === after.split("|")[1], actual: `${before} → ${after}` };
});
await test(D, "Hover effect on menu links and on an outlined button", { pre: "Manager, /rounds", steps: "Hover „Môj tím“ and „Výsledky“", expected: "A visible change of the background", req: "—" }, async () => {
  const page = pages.manager;
  await page.goto(`${BASE}/rounds`);
  const out = [];
  for (const locator of [page.locator("header nav").getByRole("link", { name: "Môj tím" }), page.getByRole("link", { name: "Výsledky" }).first()]) {
    const before = await locator.evaluate((el) => getComputedStyle(el).backgroundColor);
    await locator.hover();
    await page.waitForTimeout(200);
    const after = await locator.evaluate((el) => getComputedStyle(el).backgroundColor);
    out.push(before !== after);
  }
  return { ok: out.every(Boolean), actual: `menu link changes: ${out[0]}; outlined button changes: ${out[1]}` };
});
for (const [what, reason] of [
  ["Page transitions between screens", "IT-02 is paused; verified below that no CSS animation or view transition runs after a navigation"],
  ["Modal and dropdown transitions", "The application has no custom modal or dropdown; it uses the native confirm() dialog and native <select>, which cannot be animated or inspected"],
  ["Loading animations (spinner / skeleton)", "None is implemented (no loading.tsx, no spinner); pending states are text only („Odosielam…“)"],
]) {
  await test(D, what, { pre: "HR", steps: "Navigate Domov → Prieskumy → Prehľady and count running animations (document.getAnimations) and animated elements", expected: "Policy asks to test the animation", req: "IT-02 (paused)" }, async () => {
    const page = pages.hr;
    await page.goto(BASE + "/");
    await page.locator("header nav").getByRole("link", { name: "Prieskumy" }).click();
    const running = await page.evaluate(() => document.getAnimations().length);
    await page.waitForURL("**/hr/rounds");
    const animated = await page.locator('[class*="animate-"], dialog, [role="dialog"]').count();
    return { blocked: true, actual: `NOT IMPLEMENTED – ${reason}. Measured: ${running} running animations during the navigation, ${animated} animated/dialog elements.` };
  });
}

// ---------- text quality
for (const role of ["anon", "employee", "manager", "hr"]) {
  await test(T, `Forbidden word „anonym…“ is nowhere in the pages of ${role}`, { pre: role, steps: "Open every screen of the role; search the HTML (text and attributes) for „anonym“", expected: "No occurrence", req: "NFR-04" }, async () => {
    const hits = [];
    let count = 0;
    for (const screen of SCREENS.filter((item) => item[1] === role)) {
      const page = await open(screen);
      count++;
      if (/anonym/i.test(await page.content())) hits.push(screen[0]);
    }
    return { ok: hits.length === 0, actual: `${count} screens searched; occurrences on: ${hits.length ? hits.join(", ") : "none"}` };
  });
}
for (const role of ["anon", "employee", "manager", "hr"]) {
  await test(T, `No leftover English in the visible text of ${role}`, { pre: role, steps: "Open every screen of the role; search the visible text for common English words", expected: "Slovak only (product names such as Pulse, Kudos, Feedback, HR excepted)", req: "NFR-07" }, async () => {
    const hits = [];
    for (const screen of SCREENS.filter((item) => item[1] === role)) {
      const page = await open(screen);
      const text = await page.locator("body").innerText();
      const found = text.match(/\b(the|this|page|could|not found|error|loading|submit|cancel|please|you|and|with|your|login|sign in|password|undefined|null|NaN|Invalid Date)\b/gi);
      if (found) hits.push(`${screen[0]}: ${[...new Set(found)].join(", ")}`);
    }
    return { ok: hits.length === 0, actual: hits.length ? hits.join("; ") : "none found" };
  });
}
await test(T, "Home sentence for a round closed 3 days ago (manager of Tím Beta)", { pre: "Demo data: „Pulse – záťaž a sústredenie“ closed 3 days ago, no action", steps: "Manager of Tím Beta opens /", expected: "„… je uzavreté 3 dni …“ (Slovak: 2–4 dni, 5+ dní)", req: "IT-11, NFR-07" }, async () => {
  const page = pages.managerB;
  await page.goto(BASE + "/");
  const body = flat(await page.locator("main").innerText());
  const sentence = body.match(/Kolo „Pulse – záťaž a sústredenie“ je uzavreté [^.]+\./)?.[0] ?? "(sentence not found)";
  return { ok: /uzavreté 3 dni /.test(sentence), actual: sentence, evidence: await shot(page, "text-home-managerB-3-dni-1280") };
});
await test(T, "HR headline and home sentence on the demo data (4 of 8, 28 days)", { pre: "HR", steps: "Open / and /hr/overview", expected: "„4 uzavreté kolá čakajú na krok manažéra. Najdlhšie Tím Alfa, 28 dní.“ and „4 z 8 uzavretých kôl čakajú na krok. Najdlhšie Tím Alfa, 28 dní.“", req: "IT-11, IT-13" }, async () => {
  const page = pages.hr;
  await page.goto(BASE + "/");
  const home = flat(await page.locator("main ol").innerText());
  await page.goto(`${BASE}/hr/overview`);
  const headline = flat(await page.locator("main p.font-medium").first().innerText());
  return { ok: home.startsWith("4 uzavreté kolá čakajú na krok manažéra. Najdlhšie Tím Alfa, 28 dní.") && headline === "4 z 8 uzavretých kôl čakajú na krok. Najdlhšie Tím Alfa, 28 dní.", actual: `home: "${home.slice(0, 80)}"; overview: "${headline}"` };
});
await test(T, "Numbers and dates use the Slovak format", { pre: "Manager, results and trend", steps: "Read averages and dates", expected: "Decimal comma (3,6) and dates like 11. 11. 2026", req: "NFR-07" }, async () => {
  const page = pages.manager;
  await page.goto(`${BASE}/rounds/${ids.okA}/results`);
  const body = await page.locator("main").innerText();
  const decimals = body.match(/\d[.,]\d+/g) ?? [];
  const dates = body.match(/\d{1,2}\. \d{1,2}\. \d{4}/g) ?? [];
  return { ok: decimals.length > 0 && decimals.every((value) => value.includes(",")) && dates.length > 0, actual: `decimals: ${[...new Set(decimals)].slice(0, 6).join(" ")}; dates: ${[...new Set(dates)].join(" ")}` };
});
await test(T, "Consistent terms: the menu item „Prieskumy“ and the page it opens", { pre: "Manager and HR", steps: "Click „Prieskumy“; compare the menu label with the page heading and the main button", expected: "The heading of the page uses the word of the menu item (prieskum), so the user recognises where the click led", req: "NFR-07, IT-12" }, async () => {
  const out = [];
  const headings = [];
  await pages.manager.goto(`${BASE}/rounds`);
  headings.push(await pages.manager.locator("h1").innerText());
  out.push(`manager menu „Prieskumy“ → h1 „${headings[0]}“, button „${await pages.manager.locator("main a").first().innerText()}“`);
  await pages.hr.goto(`${BASE}/hr/rounds`);
  headings.push(await pages.hr.locator("h1").innerText());
  out.push(`HR menu „Prieskumy“ → h1 „${headings[1]}“`);
  await pages.hr.goto(`${BASE}/hr/overview`);
  out.push(`HR menu „Prehľady“ → h1 „${await pages.hr.locator("h1").innerText()}“`);
  await pages.employee.goto(`${BASE}/team/${ids.teamA}`);
  out.push(`employee menu „Môj tím“ → h1 „${await pages.employee.locator("h1").innerText()}“`);
  await pages.employee.goto(`${BASE}/`);
  out.push(`home: h2 „${await pages.employee.locator("h2").first().innerText()}“ lists rounds („prieskum“ in the task sentence, „kolo“ elsewhere)`);
  return { ok: headings.every((heading) => /prieskum/i.test(heading)), actual: out.join("; ") };
});

// ---------- read-only components
await test(B, "HR overview: „Podrobné čísla“ are collapsed and open on click", { pre: "HR", steps: "Open /hr/overview; click „Podrobné čísla“ of Tím Alfa", expected: "Hidden at first; after the click the five figures of the team", req: "IT-13, IT-05" }, async () => {
  const page = pages.hr;
  await page.goto(`${BASE}/hr/overview`);
  const card = page.locator("main ul > li").filter({ hasText: "Tím Alfa" }).first();
  const before = await card.locator("dl").isVisible();
  await card.locator("summary").click();
  const text = flat(await card.locator("dl").innerText());
  return { ok: !before && /Uzavreté kolá 5/.test(text) && /So zapísaným krokom 3 \(60 %\)/.test(text), actual: `visible before: ${before}; after: ${text}`, evidence: await shot(page, "hr-overview-details-1280") };
});
await test(B, "HR rounds: „Čaká na krok“ marks exactly the closed rounds without an action", { pre: "HR, demo data", steps: "Open /hr/rounds; count the badges", expected: "4 badges, the same four rounds as on /hr/overview", req: "MVP-12, MVP-15" }, async () => {
  const page = pages.hr;
  await page.goto(`${BASE}/hr/rounds`);
  const badges = await page.locator("main ul > li").filter({ hasText: "Čaká na krok" }).locator("h3").allInnerTexts();
  return { ok: badges.length === 4, actual: `${badges.length}: ${badges.join(" | ")}` };
});
await test(B, "Heatmap: cells, the empty cell and the legend", { pre: "HR", steps: "Open /hr/heatmap", expected: "2 teams × 7 topics; the cell without data shows „–“ with the tooltip „Bez dát“; legend with 5 steps", req: "IT-08" }, async () => {
  const page = pages.hr;
  await page.goto(`${BASE}/hr/heatmap`);
  const cells = await page.locator("tbody td").count();
  const empty = await page.locator('tbody td[title="Bez dát"]').allInnerTexts();
  const legend = await page.locator("div.text-xs span.inline-flex").count();
  return { ok: cells === 14 && empty.join() === "–" && legend === 5, actual: `cells ${cells}; empty cells: ${empty.length} („${empty.join()}“); legend steps ${legend}` };
});
await test(F, "Heatmap legend ranges do not overlap", { pre: "HR", steps: "Read the legend", expected: "Each score belongs to exactly one range (e.g. 1,0–2,9 / 3,0–3,4 …)", req: "IT-08" }, async () => {
  const page = pages.hr;
  const legend = await page.locator("div.text-xs span.inline-flex").allInnerTexts();
  const overlap = legend.some((item, index) => index > 0 && legend[index - 1].split(" až ")[1] === item.split(" až ")[0].split(" a ")[0]);
  return { ok: !overlap, actual: legend.map(flat).join(" | ") };
});
await test(B, "Trend chart: one point per measured round, a gap for the round below the threshold", { pre: "Manager, Tím Alfa (5 closed rounds, one with 4 answers)", steps: "Open the trend page; inspect the SVG", expected: "4 markers, 1 dashed gap line, the line is split into 2 segments, the last value is labelled", req: "IT-08" }, async () => {
  const page = pages.manager;
  await page.goto(`${BASE}/team/${ids.teamA}/trend`);
  const info = await page.locator("figure svg").evaluate((svg) => ({ markers: svg.querySelectorAll("circle.fill-teal-700").length, gaps: svg.querySelectorAll("line[stroke-dasharray]").length, segments: svg.querySelectorAll("polyline").length, label: svg.querySelector("text.font-semibold")?.textContent, tooltips: [...svg.querySelectorAll("title")].map((title) => title.textContent) }));
  return { ok: info.markers === 4 && info.gaps === 1 && info.segments === 2 && info.label === "3,6", actual: `markers ${info.markers}, gaps ${info.gaps}, segments ${info.segments}, label ${info.label}; tooltips: ${info.tooltips.join(" | ")}`, evidence: await shot(page, "trend-chart-1280") };
});
for (const width of [360, 320]) {
  await test(F, `Trend chart: axis text stays readable at ${width} px`, { pre: `Manager, ${width} px`, steps: "Measure the rendered height of the SVG axis labels", expected: "Rendered text at least about 11 px", req: "NFR-07" }, async () => {
    const page = pages.manager;
    await page.setViewportSize({ width, height: 740 });
    await page.goto(`${BASE}/team/${ids.teamA}/trend`);
    const size = await page.locator("figure svg").evaluate((svg) => { const scale = svg.getBoundingClientRect().width / 360; return { axis: 12 * scale, value: 14 * scale }; });
    const evidence = await shot(page, `trend-chart-${width}`);
    await page.setViewportSize({ width: 1280, height: 800 });
    return { ok: size.axis >= 11, actual: `axis and date labels render at ${size.axis.toFixed(1)} px, the value label at ${size.value.toFixed(1)} px`, evidence };
  });
}
await test(B, "Team page: averages only above the threshold, note for „lower is better“", { pre: "Employee of Tím Alfa", steps: "Open „Môj tím“", expected: "5 closed rounds, newest first; „Pulse – 42. týždeň“ shows „Nedostatok odpovedí – priemery sa zobrazujú až od 5 odpovedí.“; no comments anywhere", req: "MVP-14, MVP-11" }, async () => {
  const page = pages.employee;
  await page.goto(`${BASE}/team/${ids.teamA}`);
  const rounds = await page.locator("main > div > ul > li > h2").allInnerTexts();
  const low = flat(await page.locator("main > div > ul > li").filter({ hasText: "Pulse – 42. týždeň" }).innerText());
  return { ok: rounds.length === 5 && rounds[0] === "Pulse – 46. týždeň" && low.includes("Nedostatok odpovedí – priemery sa zobrazujú až od 5 odpovedí.") && !/Priemer/.test(low), actual: `rounds: ${rounds.join(" | ")}; 42. týždeň: ${low.slice(0, 150)}`, evidence: await shot(page, "team-employee-1280") };
});
await test(B, "Empty states: employee without an open round, team without kudos", { pre: "Filip (Tím Beta)", steps: "Open / and the team page", expected: "„Nič nečaká.“ with the explanation; the kudos feed of Tím Beta has an empty state or cards", req: "IT-11, MVP-17" }, async () => {
  const page = await session(browser, USERS.filip);
  const home = flat(await page.locator("main").innerText());
  await page.locator("header nav").getByRole("link", { name: "Môj tím" }).click();
  await page.getByRole("heading", { name: "Kudos v tíme" }).waitFor();
  const feed = flat(await page.locator("main section").last().innerText());
  await page.context().close();
  return { ok: home.startsWith("Čo treba urobiť teraz Nič nečaká. Momentálne nemáš žiadny prieskum na vyplnenie."), actual: `home: ${home}; feed: ${feed.slice(0, 90)}` };
});

// ---------- print view of the report
const report = pages.manager;
await test(P, "Report: screen view has a print button that calls the print dialog", { pre: "Manager, report of „Pulse – 46. týždeň“", steps: "Replace window.print with a counter, click „Vytlačiť alebo uložiť ako PDF“", expected: "window.print is called once", req: "IT-08" }, async () => {
  await report.goto(`${BASE}/rounds/${ids.okA}/report`);
  await report.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await report.getByRole("button", { name: "Vytlačiť alebo uložiť ako PDF" }).click();
  return { ok: (await report.evaluate(() => window.__printed)) === 1, actual: `window.print calls: ${await report.evaluate(() => window.__printed)}`, evidence: await shot(report, "report-screen-1280") };
});
await test(P, "Report in print media: navigation and buttons are hidden, the content uses the page width", { pre: "Same page, print media", steps: "emulateMedia({ media: 'print' }); inspect", expected: "Header, menu, „Späť na výsledky“ and the print button are not printed; the article is not limited to 672 px", req: "IT-08" }, async () => {
  await report.emulateMedia({ media: "print" });
  const info = await report.evaluate(() => ({
    header: getComputedStyle(document.querySelector("body > div > header")).display,
    button: [...document.querySelectorAll("main button")].filter((el) => el.getClientRects().length > 0).length,
    back: [...document.querySelectorAll("main a")].filter((el) => el.getClientRects().length > 0).map((el) => el.textContent),
    maxWidth: getComputedStyle(document.querySelector("article")).maxWidth,
    mainMax: getComputedStyle(document.querySelector("main")).maxWidth,
    bodyBg: getComputedStyle(document.body).backgroundColor,
  }));
  const evidence = await shot(report, "report-print-media");
  return { ok: info.header === "none" && info.button === 0 && info.back.length === 0 && info.maxWidth === "none", actual: `header display: ${info.header}; visible buttons: ${info.button}; visible links: ${info.back.length}; article max-width: ${info.maxWidth}; main max-width: ${info.mainMax}; page background: ${info.bodyBg}`, evidence };
});
await test(P, "Report content: results table, actions, suggestions, no comments", { pre: "Print media", steps: "Read the report", expected: "Participation, a table with the 4 questions (average + distribution 1–5), „Kroky po kole“, „Návrhy krokov“ marked as rule-based, the note that comments are left out; no comment text", req: "IT-08" }, async () => {
  const body = flat(await report.locator("main").innerText());
  const rows = await report.locator("table tbody tr").count();
  return { ok: rows === 4 && /Odpovedalo 5 z 6 členov tímu/.test(body) && /Kroky po kole/.test(body) && /Návrhy podľa pravidiel, nie AI/.test(body) && /Komentáre nie sú súčasťou reportu/.test(body), actual: `rows ${rows}; ${body.slice(0, 160)} … ${body.slice(-190)}` };
});
await test(P, "Report as PDF: fits on A4 and nothing is cut", { pre: "Print media", steps: "page.pdf({ format: 'A4' }); count the pages; check the width of the content at the A4 width", expected: "1 page; no horizontal overflow at 794 px", req: "IT-08" }, async () => {
  const file = path.join(EVID, "report-okA.pdf");
  await report.pdf({ path: file, format: "A4", printBackground: false });
  const pdf = fs.readFileSync(file).toString("latin1");
  const count = (pdf.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  await report.setViewportSize({ width: 794, height: 1123 });
  const size = await report.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  await report.setViewportSize({ width: 1280, height: 800 });
  return { ok: count === 1 && size.scrollWidth <= size.clientWidth, actual: `PDF pages: ${count}; content ${size.scrollWidth}/${size.clientWidth} px at A4 width`, evidence: "report-okA.pdf" };
});
await test(P, "Report below the threshold in print media", { pre: "Manager, „Pulse – 42. týždeň“ (4 answers)", steps: "Open its report in print media", expected: "„Nedostatok odpovedí“ and no table of averages", req: "IT-08, MVP-11" }, async () => {
  await report.goto(`${BASE}/rounds/${ids.lowA}/report`);
  const body = flat(await report.locator("main").innerText());
  const tables = await report.locator("table").count();
  return { ok: /Nedostatok odpovedí/.test(body) && tables === 0 && !/Návrhy krokov/.test(body), actual: body.slice(0, 260), evidence: await shot(report, "report-insufficient-print") };
});
await test(P, "Report as HR in print media", { pre: "HR, report of a Tím Beta round", steps: "Open /rounds/:id/report as HR in print media", expected: "Same layout; header hidden", req: "IT-08" }, async () => {
  const page = pages.hr;
  await page.emulateMedia({ media: "print" });
  await page.goto(`${BASE}/rounds/${ids.okB}/report`);
  const header = await page.evaluate(() => getComputedStyle(document.querySelector("body > div > header")).display);
  const rows = await page.locator("table tbody tr").count();
  await page.emulateMedia({ media: "screen" });
  return { ok: header === "none" && rows === 4, actual: `header display ${header}; table rows ${rows}` };
});
await test(P, "Printing the results screen itself (Ctrl+P instead of the report)", { pre: "Manager, results in print media", steps: "Open the results in print media", expected: "Menu hidden; collapsed blocks (comments, distribution) stay collapsed, so comments are not printed by accident", req: "IT-08" }, async () => {
  await report.goto(`${BASE}/rounds/${ids.okA}/results`);
  const info = await report.evaluate(() => ({ header: getComputedStyle(document.querySelector("body > div > header")).display, comments: document.querySelector("details ul li.whitespace-pre-line")?.checkVisibility() ? 1 : 0, form: document.querySelector('input[name="topic"]').getClientRects().length }));
  const evidence = await shot(report, "results-print-media");
  await report.emulateMedia({ media: "screen" });
  return { ok: info.header === "none" && info.comments === 0, actual: `header display ${info.header}; comment text printed: ${info.comments > 0}; the action form and its buttons are printed: ${info.form > 0}`, evidence };
});

await browser.close();
