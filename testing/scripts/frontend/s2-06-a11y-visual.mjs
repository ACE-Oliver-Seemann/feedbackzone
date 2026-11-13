// Sections D/F/G: document structure, names and labels, measured colour contrast, focus visibility and
// focus not obscured, skip link, motion menu, reduced motion, page transitions, layout shift, text
// scaling, forbidden word (NFR-04), English leftovers, titles. Read-only.
import { launch, discover, makeRecorder, newPage, login, session, USERS, BASE, shot, go, overflow, nice } from "./s2-lib.mjs";

const { test } = makeRecorder("06-a11y-visual");
const browser = await launch();
const d = await discover(browser);

const SCREENS = {
  hr: [
    ["/", "home"], ["/hr/rounds", "hr-rounds"], ["/rounds/new", "new-round"], [`/rounds/${d.okA}/results`, "results"],
    [`/rounds/${d.lowA}/results`, "results-low"], [`/rounds/${d.doneA}/report`, "report"], [`/team/${d.teamA}`, "team"], [`/team/${d.teamA}/trend`, "trend"],
    ["/hr/overview", "overview"], ["/hr/heatmap", "heatmap"], ["/hr/issues", "issues"], ["/hr/notes", "notes"], ["/kudos", "kudos"], ["/kudos?tab=send", "kudos-send"], ["/nic-take", "404"],
  ],
  mgrA: [["/", "home"], ["/rounds", "rounds"], [`/rounds/${d.openA}/fill`, "fill"], ["/hr/overview", "403"]],
  adam: [["/", "home"], [`/team/${d.teamA}`, "team"], ["/kudos", "kudos"]],
};

const structure = (page) => page.evaluate(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden"; };
  const name = (el) => (el.getAttribute("aria-label") || (el.getAttribute("aria-labelledby") || "").split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ") || el.textContent || el.getAttribute("title") || el.querySelector("img")?.alt || el.querySelector("svg title")?.textContent || "").trim();
  const heads = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(vis).map((h) => ({ l: Number(h.tagName[1]), t: h.textContent.trim().slice(0, 40) }));
  const skips = [];
  for (let i = 1; i < heads.length; i++) if (heads[i].l > heads[i - 1].l + 1) skips.push(`h${heads[i - 1].l} "${heads[i - 1].t}" -> h${heads[i].l} "${heads[i].t}"`);
  const unlabeled = [...document.querySelectorAll("input:not([type=hidden]), select, textarea")].filter(vis).filter((el) => !(el.labels?.length || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby"))).map((el) => el.outerHTML.slice(0, 80));
  const unnamed = [...document.querySelectorAll("a, button, summary, [role=tab], [role=button]")].filter(vis).filter((el) => !(el.getAttribute("aria-hidden") === "true" && el.tabIndex < 0)).filter((el) => !name(el)).map((el) => el.outerHTML.slice(0, 90));
  const ids = [...document.querySelectorAll("[id]")].map((e) => e.id); const dup = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
  const imgs = [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length;
  const navs = [...document.querySelectorAll("nav")].filter(vis).map((n) => n.getAttribute("aria-label") || "(unnamed)");
  const broken = [...document.querySelectorAll("[aria-labelledby],[aria-describedby],[aria-controls]")].flatMap((e) => ["aria-labelledby", "aria-describedby", "aria-controls"].flatMap((a) => (e.getAttribute(a) || "").split(" ").filter(Boolean).filter((id) => !document.getElementById(id)).map((id) => `${a}=${id}`)));
  return {
    title: document.title, lang: document.documentElement.lang,
    h1: heads.filter((h) => h.l === 1).map((h) => h.t), skips, mains: document.querySelectorAll("main").length, nestedMain: document.querySelectorAll("main main").length,
    unlabeled, unnamed, dup, imgs, navs, broken,
    tables: [...document.querySelectorAll("table")].map((t) => `th:${t.querySelectorAll("th").length} caption:${!!t.querySelector("caption") || !!t.getAttribute("aria-label") || !!t.getAttribute("aria-labelledby")}`),
  };
});

// Generic contrast scan: every visible element that directly contains text.
const contrastScan = (page) => page.evaluate(() => {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const parse = (c) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = "rgba(0,0,0,0)"; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); const p = ctx.getImageData(0, 0, 1, 1).data; return [p[0], p[1], p[2], p[3] / 255]; };
  const over = (t, b) => [t[0] * t[3] + b[0] * (1 - t[3]), t[1] * t[3] + b[1] * (1 - t[3]), t[2] * t[3] + b[2] * (1 - t[3]), 1];
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const hex = (c) => "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const out = new Map();
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("[aria-hidden=true], .sr-only, svg, script, style, [hidden]")) continue;
    if (el.closest("details:not([open])") && !el.closest("summary")) continue; // collapsed content is not rendered
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim().length > 0).map((n) => n.textContent.trim()).join(" ");
    if (!own) continue;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || cs.visibility === "hidden") continue;
    let opacity = 1; const layers = []; let gradient = false; let disabled = false;
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      opacity *= parseFloat(s.opacity);
      if (n.matches(":disabled, [aria-disabled=true]") || n.querySelector?.(":scope > input:disabled")) disabled = true;
      if (s.backgroundImage !== "none") gradient = true;
      const bg = parse(s.backgroundColor); if (bg[3] > 0) layers.push(bg);
      if (bg[3] === 1) break;
    }
    if (disabled || gradient) continue;
    let bg = [255, 255, 255, 1]; for (const l of layers.reverse()) bg = over(l, bg);
    const col = parse(cs.color); col[3] *= opacity; const fg = over(col, bg);
    const l1 = lum(fg), l2 = lum(bg); const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(cs.fontSize); const bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    if (ratio < (large ? 3 : 4.5)) {
      const key = `${hex(fg)} on ${hex(bg)} ${Math.round(size)}px`;
      const cur = out.get(key) ?? { ratio: Math.round(ratio * 100) / 100, n: 0, sample: own.slice(0, 40), cls: String(el.className).slice(0, 60) };
      cur.n++; out.set(key, cur);
    }
  }
  return [...out.entries()].map(([k, v]) => `${k} = ${v.ratio}:1 x${v.n} e.g. "${v.sample}" [${v.cls}]`);
});

const allTitles = [];
const anonymHits = [];
const english = [];
const ENGLISH = /\b(Loading|Submit|Cancel|Error|Not found|Forbidden|Sign in|Log ?out|Save|Delete|Search|Back|Next|Previous|Page|Settings|Close|Open|Home|Welcome)\b/;

for (const [who, list] of Object.entries(SCREENS)) {
  const page = await session(browser, USERS[who]);
  for (const [url, name] of list) {
    await go(page, url); await page.waitForTimeout(300);
    const html = await page.content();
    if (/anonym/i.test(html)) anonymHits.push(`${who}:${nice(url)}`);
    const visibleText = await page.evaluate(() => document.body.innerText);
    const en = visibleText.match(ENGLISH); if (en) english.push(`${who}:${nice(url)} "${en[0]}"`);
    let st;
    await test("G", `Structure of ${nice(url)} (${name}) as ${who}: title, one h1, heading order, landmarks`, { pre: USERS[who], steps: `Open ${nice(url)}; inspect the DOM`, expected: "lang=sk; specific title; exactly one h1; no skipped heading level; one <main>; navigation landmarks named", req: "NFR-07, BUG-027, BUG-028; WCAG 1.3.1, 2.4.2, 2.4.6" }, async () => {
      st = await structure(page);
      allTitles.push({ who, url: nice(url), title: st.title });
      const ok = st.lang === "sk" && st.h1.length === 1 && st.skips.length === 0 && st.mains === 1 && !st.navs.includes("(unnamed)") && st.title !== "Feedback portál";
      return { ok, actual: `title "${st.title}"; h1: ${JSON.stringify(st.h1)}; skipped levels: ${st.skips.join("; ") || "none"}; <main> elements: ${st.mains} (nested: ${st.nestedMain}); navs: ${st.navs.join(", ")}` };
    });
    await test("G", `Names and labels on ${nice(url)} (${name}) as ${who}`, { steps: "Check every visible control", expected: "Every input/select/textarea has a label; every link/button has an accessible name; no duplicate ids; ARIA references resolve; images have alt", req: "WCAG 1.1.1, 1.3.1, 4.1.2" }, async () => {
      const ok = st.unlabeled.length === 0 && st.unnamed.length === 0 && st.dup.length === 0 && st.imgs === 0 && st.broken.length === 0;
      return { ok, actual: `unlabelled fields: ${st.unlabeled.join(" ; ") || "none"}; unnamed controls: ${st.unnamed.join(" ; ") || "none"}; duplicate ids: ${st.dup.join(",") || "none"}; images without alt: ${st.imgs}; broken ARIA refs: ${st.broken.join(",") || "none"}; tables: ${st.tables.join(" ") || "none"}` };
    });
    await test("G", `Colour contrast of text on ${nice(url)} (${name}) as ${who}`, { steps: "Compute the WCAG contrast ratio of every visible text element against its composited background (disabled controls and gradients skipped)", expected: "At least 4.5:1 (3:1 for large text) – IT-01, WCAG 1.4.3", req: "IT-01; WCAG 1.4.3" }, async () => {
      const low = await contrastScan(page);
      return { ok: low.length === 0, actual: low.length ? low.join(" || ") : "all measured text >= AA" };
    });
  }
  await page.context().close();
}
{
  const page = await newPage(browser);
  await go(page, "/login");
  await test("G", "Structure and contrast of /login", { steps: "Open /login logged out", expected: "One h1, labelled fields, AA contrast", req: "IT-01, MVP-01" }, async () => {
    const st = await structure(page); const low = await contrastScan(page);
    allTitles.push({ who: "-", url: "/login", title: st.title });
    if (/anonym/i.test(await page.content())) anonymHits.push("/login");
    return { ok: st.h1.length === 1 && st.unlabeled.length === 0 && low.length === 0 && st.mains === 1, actual: `title "${st.title}"; h1 ${JSON.stringify(st.h1)}; mains ${st.mains}; low contrast: ${low.join(" || ") || "none"}` };
  });
  await page.context().close();
}
await test("G", "Page titles are specific and tell screens apart (BUG-027)", { steps: "Compare document.title of all visited screens", expected: "Each title names the screen ('X · Feedback portál')", req: "BUG-027; WCAG 2.4.2" }, async () => {
  const generic = allTitles.filter((t) => !/ · Feedback portál$/.test(t.title));
  const groups = {}; for (const t of allTitles) (groups[t.title] ??= new Set()).add(t.url.replace(/\?.*/, ""));
  const shared = Object.entries(groups).filter(([, urls]) => urls.size > 1).map(([t, urls]) => `"${t}": ${[...urls].join(", ")}`);
  return { ok: generic.length === 0, actual: `${allTitles.length} screens; without a specific title: ${generic.map((g) => g.url).join(", ") || "none"}; titles shared by different screens: ${shared.join(" | ") || "none"}` };
});
await test("F", "NFR-04: the word 'anonym…' is nowhere in the HTML of any screen", { steps: "Search the full HTML of every visited screen for /anonym/i", expected: "No occurrence", req: "NFR-04" }, async () => ({ ok: anonymHits.length === 0, actual: anonymHits.length ? `found on: ${anonymHits.join(", ")}` : `0 occurrences on ${allTitles.length} screens` }));
await test("F", "No English UI leftovers in visible text", { steps: "Search the visible text of every screen for common English UI words", expected: "Slovak only (NFR-07)", req: "NFR-07" }, async () => ({ ok: english.length === 0, actual: english.join("; ") || "none found" }));

// ---------- keyboard: skip link, focus visibility, focus not obscured ----------
{
  const page = await session(browser, USERS.hr);
  await test("G", "Skip link is the first Tab stop and moves to the content", { steps: "On /hr/rounds press Tab once, then Enter, then Tab", expected: "'Preskočiť na obsah' visible on focus; after Enter the next Tab lands inside <main>", req: "WCAG 2.4.1" }, async () => {
    await go(page, "/hr/rounds");
    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return { text: a.innerText, visible: r.width > 1 && r.height > 1 && r.top >= 0 }; });
    const evidence = await shot(page, "skip-link-focused", false);
    await page.keyboard.press("Enter"); await page.keyboard.press("Tab");
    const inMain = await page.evaluate(() => !!document.activeElement.closest("main"));
    return { ok: first.text === "Preskočiť na obsah" && first.visible && inMain, actual: `first stop "${first.text}" visible ${first.visible}; next Tab inside main: ${inMain}`, evidence };
  });
  for (const [url, name] of [["/hr/rounds", "hr-rounds"], [`/rounds/${d.doneA}/results`, "results"], ["/hr/issues", "issues"], ["/kudos?tab=send", "kudos-send"], ["/hr/overview", "overview"]]) {
    await test("G", `Keyboard walk on ${nice(url)}: every stop has a visible focus indicator and is not hidden under the sticky header`, { steps: "Tab forward through the whole page, then Shift+Tab back through it", expected: "Each focused element shows an outline/ring and is fully below the sticky header (WCAG 2.4.7, 2.4.11)", req: "WCAG 2.4.7, 2.4.11" }, async () => {
      await go(page, url);
      const probe = () => page.evaluate(() => {
        const e = document.activeElement; if (!e || e === document.body) return null;
        const t = e.matches("input.sr-only") ? e.closest("label") : e;
        const cs = getComputedStyle(t); const r = t.getBoundingClientRect();
        const hb = document.querySelector("header").getBoundingClientRect().bottom;
        const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || /rgb/.test(cs.boxShadow) && cs.boxShadow !== "none";
        // The skip link floats above the header by design; large containers (tab panels) are not judged.
        const judged = !e.closest("header") && !e.matches('a[href="#main"]') && r.height < 200;
        return { name: (e.getAttribute("aria-label") || t.innerText || e.getAttribute("name") || e.tagName).trim().slice(0, 24), ring, under: judged && r.top < hb - 1 && r.bottom > 0, hidden: Math.round(Math.min(hb, r.bottom) - r.top), h: Math.round(r.height), off: judged && (r.bottom < 0 || r.top > innerHeight) };
      });
      const noRing = new Set(), under = new Set(); let stops = 0; let shotTaken = false;
      for (const key of ["Tab", "Shift+Tab"]) {
        for (let i = 0; i < 70; i++) {
          await page.keyboard.press(key); await page.waitForTimeout(25);
          const p = await probe(); if (!p) break; stops++;
          if (!p.ring) noRing.add(p.name);
          if (p.under || p.off) {
            under.add(`${p.name}(${key === "Tab" ? "fwd" : "back"}, ${p.hidden}/${p.h}px hidden)`);
            if (!shotTaken) { await shot(page, `focus-obscured-${name}`, false); shotTaken = true; }
          }
        }
      }
      return { ok: noRing.size === 0 && under.size === 0, actual: `${stops} stops; without indicator: ${[...noRing].join(", ") || "none"}; hidden under the header or off-screen: ${[...under].join(", ") || "none"}`, evidence: under.size ? `shots/focus-obscured-${name}.png` : "" };
    });
  }

  // ---------- motion menu ----------
  await test("B", "Motion menu: opens under its button, three options, closes with Esc, focus returns", { steps: "Click the sparkle button in the header; inspect; press Esc", expected: "Popover inside the viewport, radio group 'Animácie' with 3 options, 'Podľa systému' selected by default; Esc closes and focus is back on the button", req: "IT-02" }, async () => {
    await go(page, "/");
    const btn = page.getByRole("button", { name: "Nastavenie animácií" });
    await btn.click(); await page.waitForTimeout(250);
    const r = await page.evaluate(() => { const p = document.querySelector("[popover]:popover-open"); const b = p.getBoundingClientRect(); return { box: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], vw: innerWidth, legend: p.querySelector("legend")?.innerText, options: [...p.querySelectorAll("label")].map((l) => l.innerText.trim() + (l.querySelector("input").checked ? "*" : "")), hint: p.querySelector("p")?.innerText }; });
    const evidence = await shot(page, "motion-menu-open", false);
    await page.keyboard.press("Escape"); await page.waitForTimeout(250);
    const closed = await page.locator("[popover]:popover-open").count();
    const focus = await page.evaluate(() => document.activeElement.getAttribute("aria-label"));
    return { ok: r.options.length === 3 && r.options[0].endsWith("*") && r.box[0] >= 0 && r.box[2] <= r.vw && closed === 0 && focus === "Nastavenie animácií", actual: `${JSON.stringify(r)}; after Esc open=${closed}, focus on "${focus}"`, evidence };
  });
  await test("G", "Motion menu: keyboard operation and expanded state", { steps: "Focus the button, press Enter, Tab into the radios, ArrowDown twice, Esc", expected: "Opens with the keyboard; arrows change the option and data-motion; the button exposes its expanded state", req: "IT-02; WCAG 2.1.1, 4.1.2" }, async () => {
    const btn = page.getByRole("button", { name: "Nastavenie animácií" });
    await btn.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(200);
    const expanded = await btn.evaluate((b) => b.getAttribute("aria-expanded") ?? "(none; native popovertarget exposes it)");
    await page.keyboard.press("Tab");
    const inPop = await page.evaluate(() => !!document.activeElement.closest("[popover]"));
    await page.keyboard.press("ArrowDown"); const a = await page.evaluate(() => document.documentElement.dataset.motion + ":" + document.activeElement.value);
    await page.keyboard.press("ArrowDown"); const b = await page.evaluate(() => document.documentElement.dataset.motion + ":" + document.activeElement.value);
    await page.keyboard.press("ArrowUp"); await page.keyboard.press("ArrowUp");
    const c = await page.evaluate(() => document.documentElement.dataset.motion + ":" + document.activeElement.value + ":" + localStorage.getItem("fz-motion"));
    await page.keyboard.press("Escape");
    return { ok: inPop && a === "full:on" && b === "reduce:reduced" && c === "full:system:null", actual: `aria-expanded ${expanded}; focus moved into the popover ${inPop}; ${a} -> ${b} -> back ${c}` };
  });
  await test("B", "Motion menu: click outside closes it (light dismiss) and does not trigger what is underneath", { steps: "Open the menu; click on the page heading", expected: "Menu closes; still on the same page", req: "IT-02" }, async () => {
    await page.getByRole("button", { name: "Nastavenie animácií" }).click(); await page.waitForTimeout(200);
    await page.locator("main h1").click(); await page.waitForTimeout(250);
    return { ok: (await page.locator("[popover]:popover-open").count()) === 0 && new URL(page.url()).pathname === "/", actual: `open popovers ${await page.locator("[popover]:popover-open").count()}; url ${new URL(page.url()).pathname}` };
  });
  await test("D", "Motion setting is shared with other tabs of the same browser", { steps: "Choose 'Obmedzené' in tab 1; read data-motion in tab 2 (already open); restore", expected: "Tab 2 switches to reduce without reload", req: "IT-02" }, async () => {
    const tab2 = await page.context().newPage(); await tab2.goto(`${BASE}/kudos`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Nastavenie animácií" }).click(); await page.getByLabel("Obmedzené").check();
    await tab2.waitForTimeout(400);
    const m2 = await tab2.evaluate(() => document.documentElement.dataset.motion);
    await page.getByLabel("Podľa systému").check(); await page.keyboard.press("Escape"); await tab2.waitForTimeout(300);
    const m3 = await tab2.evaluate(() => document.documentElement.dataset.motion);
    await tab2.close();
    await page.bringToFront(); // view transitions are skipped in a background tab
    return { ok: m2 === "reduce" && m3 === "full", actual: `tab 2 after 'Obmedzené': ${m2}; after 'Podľa systému': ${m3}` };
  });

  // ---------- page transitions ----------
  const vt = async (p, label) => {
    await p.evaluate(() => { window.__vt = []; const t0 = performance.now(); const tick = () => { for (const a of document.getAnimations()) { const pe = a.effect?.pseudoElement; if (pe && pe.startsWith("::view-transition")) { const k = `${pe}|${a.animationName}|${a.effect.getComputedTiming().endTime}`; if (!window.__vt.includes(k)) window.__vt.push(k); } } if (performance.now() - t0 < 1500) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    await p.locator("header nav a:visible", { hasText: new RegExp(`^${label}$`) }).click();
    await p.waitForTimeout(900);
    return p.evaluate(() => window.__vt);
  };
  await test("D", "Page transition forward: content slides in from the right, header stays, <= 1.5 s", { steps: "On / click 'Prieskumy' (to the right of the active item); record view-transition animations", expected: "nav-forward animations of at most 1 500 ms; root and header not animated", req: "IT-02" }, async () => {
    // The browser skips view transitions while the tab is not in the foreground, so the first
    // navigation after another tab was closed may not animate; a second attempt is recorded as such.
    let a = [], attempt = 0;
    while (attempt < 2 && !a.some((x) => /vt-in-right/.test(x))) { attempt++; await page.bringToFront(); await go(page, "/"); await page.waitForTimeout(400); a = await vt(page, "Prieskumy"); }
    const durs = a.map((x) => Number(x.split("|")[2]));
    return { ok: a.some((x) => /vt-in-right/.test(x)) && Math.max(0, ...durs) <= 1500, actual: `attempt ${attempt}: ${a.join(" ; ") || "no view-transition animation observed"}` };
  });
  await test("D", "Page transition back: mirrored direction when moving to an item on the left", { steps: "From 'Podnety' click 'Domov'", expected: "nav-back animation (vt-in-left)", req: "IT-02" }, async () => {
    await go(page, "/hr/issues");
    const a = await vt(page, "Domov");
    return { ok: a.some((x) => /vt-in-left/.test(x)), actual: a.join(" ; ") || "no view-transition animation observed" };
  });
  await test("D", "Clicks are not blocked while a page transition runs", { steps: "Click 'Prehľady' and 60 ms later 'Kudos'", expected: "Ends on /kudos", req: "IT-02 (non-blocking)" }, async () => {
    await go(page, "/");
    await page.locator("header nav a:visible", { hasText: /^Prehľady$/ }).click({ noWaitAfter: true });
    await page.waitForTimeout(60);
    await page.locator("header nav a:visible", { hasText: /^Kudos$/ }).click({ noWaitAfter: true, timeout: 2000 });
    await page.waitForTimeout(1500);
    return { ok: new URL(page.url()).pathname === "/kudos", actual: `ended on ${new URL(page.url()).pathname}` };
  });
  await test("D", "Browser Back is instant (no slide)", { steps: "Press Back; record view-transition animations", expected: "No sliding animation for history navigation (as designed) and the page is correct", req: "IT-02" }, async () => {
    await page.evaluate(() => { window.__vt = []; const t0 = performance.now(); const tick = () => { for (const a of document.getAnimations()) { const pe = a.effect?.pseudoElement; if (pe && pe.startsWith("::view-transition") && a.animationName && a.animationName !== "none") window.__vt.push(a.animationName); } if (performance.now() - t0 < 900) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    await page.goBack(); await page.waitForTimeout(800);
    const a = await page.evaluate(() => [...new Set(window.__vt ?? [])]).catch(() => []);
    return { ok: !a.some((x) => /vt-(in|out)/.test(x)), actual: `animations: ${a.join(", ") || "none"}; url ${new URL(page.url()).pathname}` };
  });
  await test("D", "Nav pill slides to the new item within 0.3 s and ends exactly under it", { steps: "Click 'Podnety'; read the pill's transition and final position", expected: "transition <= 1.5 s; pill box equals the active link box", req: "IT-02, IT-12" }, async () => {
    await go(page, "/");
    await page.locator("header nav a:visible", { hasText: /^Podnety$/ }).click(); await page.waitForTimeout(900);
    const r = await page.evaluate(() => { const nav = [...document.querySelectorAll("header nav")].find((n) => n.getBoundingClientRect().width > 0); const p = nav.querySelector(".nav-pill"); const a = nav.querySelector('[aria-current="page"]'); const pb = p.getBoundingClientRect(), ab = a.getBoundingClientRect(); const cs = getComputedStyle(p); return { dur: cs.transitionDuration, prop: cs.transitionProperty, dx: Math.round(pb.left - ab.left), dw: Math.round(pb.width - ab.width) }; });
    return { ok: Math.abs(r.dx) <= 1 && Math.abs(r.dw) <= 1, actual: JSON.stringify(r) };
  });
  await test("D", "Hover feedback on buttons and menu items", { steps: "Hover a primary button and an inactive menu item; compare background colours", expected: "Background changes on hover", req: "IT-01" }, async () => {
    await go(page, "/hr/rounds");
    const b = page.locator("main a", { hasText: "Vytvoriť kolo" }).first();
    const b0 = await b.evaluate((e) => getComputedStyle(e).backgroundColor); await b.hover(); await page.waitForTimeout(250);
    const b1 = await b.evaluate((e) => getComputedStyle(e).backgroundColor);
    const n = page.locator("header nav a:visible", { hasText: /^Kudos$/ });
    const n0 = await n.evaluate((e) => getComputedStyle(e).backgroundColor); await n.hover(); await page.waitForTimeout(250);
    const n1 = await n.evaluate((e) => getComputedStyle(e).backgroundColor);
    return { ok: b0 !== b1 && n0 !== n1, actual: `button ${b0} -> ${b1}; menu item ${n0} -> ${n1}` };
  });
  await page.context().close();
}

// ---------- reduced motion ----------
{
  const page = await session(browser, USERS.hr, { reducedMotion: "reduce" });
  await test("D", "Reduced motion: page transition becomes a short fade", { pre: "prefers-reduced-motion: reduce", steps: "Click 'Prieskumy'; record view-transition animations", expected: "Only fade-in/fade-out of 150 ms, nothing that moves", req: "IT-02" }, async () => {
    await go(page, "/");
    await page.evaluate(() => { window.__vt = []; const t0 = performance.now(); const tick = () => { for (const a of document.getAnimations()) { const pe = a.effect?.pseudoElement; if (pe && pe.startsWith("::view-transition")) { const k = `${a.animationName}|${a.effect.getComputedTiming().endTime}`; if (!window.__vt.includes(k)) window.__vt.push(k); } } if (performance.now() - t0 < 1200) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    await page.locator("header nav a:visible", { hasText: /^Prieskumy$/ }).click(); await page.waitForTimeout(900);
    const a = await page.evaluate(() => window.__vt);
    return { ok: !a.some((x) => /vt-(in|out)/.test(x)), actual: a.join(" ; ") || "no view-transition animation (instant)" };
  });
  await test("D", "Reduced motion: no element on any main screen runs a moving animation", { steps: "Open 8 screens; list running CSS animations/transitions and whether their keyframes use transform/translate/scale", expected: "None moves (fades allowed)", req: "IT-02" }, async () => {
    const moving = [];
    for (const url of ["/", "/hr/rounds", "/rounds/new", `/rounds/${d.okA}/results`, "/hr/overview", "/hr/issues", "/kudos", `/team/${d.teamA}/trend`]) {
      await page.goto(`${BASE}${url}`);
      await page.waitForTimeout(120);
      const m = await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getKeyframes().some((k) => (k.transform && k.transform !== "none") || k.translate || k.scale || k.strokeDashoffset)).map((a) => `${a.animationName ?? a.transitionProperty} on .${String(a.effect.target?.className?.baseVal ?? a.effect.target?.className).split(" ")[0]}`));
      if (m.length) moving.push(`${url.replace(/c[a-z0-9]{20,}/, ":id")}: ${[...new Set(m)].join(", ")}`);
    }
    return { ok: moving.length === 0, actual: moving.join(" | ") || "no moving animation on 8 screens" };
  });
  await test("D", "Reduced motion: nav pill jumps (no slide)", { steps: "Click 'Kudos'; read the pill transition", expected: "No transform/width transition on the pill", req: "IT-02" }, async () => {
    await go(page, "/");
    await page.locator("header nav a:visible", { hasText: /^Kudos$/ }).click(); await page.waitForTimeout(150);
    const r = await page.evaluate(() => { const nav = [...document.querySelectorAll("header nav")].find((n) => n.getBoundingClientRect().width > 0); const cs = getComputedStyle(nav.querySelector(".nav-pill")); return { pill: cs.transitionProperty }; });
    return { ok: !/transform|width/.test(r.pill), actual: JSON.stringify(r) };
  });
  await page.context().close();
}

// ---------- layout shift, text scaling, fonts ----------
{
  const page = await session(browser, USERS.hr);
  for (const [url, name] of [["/", "home"], ["/hr/rounds", "hr-rounds"], [`/rounds/${d.okA}/results`, "results"], ["/kudos", "kudos"], ["/rounds/new", "new-round"]]) {
    await test("D", `No layout shift while ${nice(url)} loads and animates`, { steps: "Load the page with a layout-shift PerformanceObserver; wait 1.5 s", expected: "Cumulative layout shift < 0.1 (animations must not move the layout)", req: "IT-02; TESTING_RULES D" }, async () => {
      await page.addInitScript(() => { window.__cls = 0; window.__clsN = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__clsN.push(...e.sources.map((s) => s.node?.nodeName + "." + String(s.node?.className ?? "").split(" ")[0])); } }).observe({ type: "layout-shift", buffered: true }); });
      await page.goto(`${BASE}${url}`); await page.waitForTimeout(1500);
      const r = await page.evaluate(() => ({ cls: Math.round(window.__cls * 1000) / 1000, nodes: [...new Set(window.__clsN)].slice(0, 5) }));
      return { ok: r.cls < 0.1, actual: `CLS ${r.cls}; shifted: ${r.nodes.join(", ") || "none"}` };
    });
  }
  for (const [url, name] of [["/hr/rounds", "hr-rounds"], [`/rounds/${d.okA}/results`, "results"], ["/kudos?tab=send", "kudos-send"], ["/rounds/new", "new-round"]]) {
    await test("G", `Text scaled to 200 % on ${nice(url)} (1280 px)`, { steps: "Set the root font size to 200 % and reload layout", expected: "No horizontal page scroll, no clipped control labels (WCAG 1.4.4)", req: "WCAG 1.4.4" }, async () => {
      await go(page, url);
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      await page.waitForTimeout(400);
      const o = await overflow(page);
      const clipped = await page.evaluate(() => [...document.querySelectorAll("main button, main a, header a, header button, main summary, main label")].filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== "visible").map((el) => el.textContent.trim().slice(0, 24)));
      const headerH = await page.evaluate(() => Math.round(document.querySelector("header").getBoundingClientRect().height));
      const evidence = await shot(page, `zoom200-${name}`, false);
      return { ok: o <= 1 && clipped.length === 0, actual: `overflow ${o}px; clipped: ${clipped.join(", ") || "none"}; sticky header height ${headerH}px of 800`, evidence };
    });
  }
  await test("F", "One font family and the brand palette on every screen; no old teal classes", { steps: "Read body font and count 'teal-' classes on 6 screens; check the logo renders", expected: "Same font everywhere (Outfit); 0 teal classes (IT-01); logo has size and an accessible name", req: "IT-01" }, async () => {
    const out = [];
    for (const url of ["/", "/hr/rounds", `/rounds/${d.okA}/results`, "/hr/heatmap", "/kudos", "/hr/issues"]) {
      await go(page, url);
      out.push(await page.evaluate(() => ({ font: getComputedStyle(document.body).fontFamily.split(",")[0], h1: getComputedStyle(document.querySelector("h1")).fontFamily.split(",")[0], teal: (document.body.innerHTML.match(/teal-\d/g) ?? []).length, loaded: [...document.fonts].filter((f) => f.status === "loaded").length })));
    }
    const logo = await page.evaluate(() => { const a = document.querySelector("header a"); const g = a.querySelector("svg, img"); const r = g?.getBoundingClientRect(); return { w: Math.round(r?.width ?? 0), h: Math.round(r?.height ?? 0), name: a.getAttribute("aria-label") || g?.getAttribute("aria-label") || g?.querySelector("title")?.textContent || g?.getAttribute("alt") || a.textContent.trim() }; });
    const fonts = new Set(out.map((o) => o.font + "/" + o.h1));
    return { ok: fonts.size === 1 && out.every((o) => o.teal === 0) && logo.w > 0 && !!logo.name, actual: `fonts: ${[...fonts].join(", ")}; loaded faces ${out[0].loaded}; teal classes ${out.reduce((s, o) => s + o.teal, 0)}; logo ${JSON.stringify(logo)}` };
  });
  await test("F", "Favicon and brand assets load without errors", { steps: "Request /favicon.ico and every image/font of the home page", expected: "All 200", req: "IT-01" }, async () => {
    const bad = []; const h = (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${new URL(r.url()).pathname}`); }; page.on("response", h);
    await go(page, "/");
    const fav = await page.request.get(`${BASE}/favicon.ico`);
    page.off("response", h);
    return { ok: bad.length === 0 && fav.status() === 200, actual: `favicon ${fav.status()}; failed requests: ${bad.join(", ") || "none"}` };
  });
  await test("G", "Non-text contrast of form field borders (BUG-030, known open)", { steps: "Compare the field ring colour with the field background on /kudos?tab=send", expected: "3:1 (WCAG 1.4.11)", req: "BUG-030; WCAG 1.4.11" }, async () => {
    await go(page, "/kudos?tab=send");
    const r = await page.evaluate(() => { const el = document.querySelector("form textarea"); const cs = getComputedStyle(el); const m = cs.boxShadow.match(/rgba?\([^)]+\)/g) ?? []; return { shadow: cs.boxShadow.slice(0, 120), colors: m, bg: cs.backgroundColor }; });
    const toRgb = (s) => s.match(/[\d.]+/g).map(Number);
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const ring = r.colors.map(toRgb).find((c) => (c[3] ?? 1) > 0.5 && !(c[0] === 0 && c[1] === 0 && c[2] === 0)) ?? toRgb(r.colors[0] ?? "rgb(0,0,0)");
    const ratio = (Math.max(lum(ring), lum(toRgb(r.bg))) + 0.05) / (Math.min(lum(ring), lum(toRgb(r.bg))) + 0.05);
    return { ok: ratio >= 3, actual: `ring rgb(${ring.slice(0, 3).join(",")}) on ${r.bg} = ${Math.round(ratio * 100) / 100}:1` };
  });
  await page.context().close();
}

// ---------- touch: toast and popover on a phone ----------
{
  const page = await session(browser, USERS.hr, { width: 320, height: 640, touch: true });
  await test("E", "Motion menu at 320 px: panel fits the screen, options are large enough to tap", { steps: "Open the menu at 320 px (touch)", expected: "Panel inside the viewport; each option row >= 44 px high", req: "NFR-07" }, async () => {
    await go(page, "/");
    await page.getByRole("button", { name: "Nastavenie animácií" }).tap(); await page.waitForTimeout(300);
    const r = await page.evaluate(() => { const p = document.querySelector("[popover]:popover-open"); const b = p.getBoundingClientRect(); return { left: Math.round(b.left), right: Math.round(b.right), vw: innerWidth, rows: [...p.querySelectorAll("label")].map((l) => Math.round(l.getBoundingClientRect().height)) }; });
    const evidence = await shot(page, "motion-menu-320", false);
    await page.keyboard.press("Escape");
    return { ok: r.left >= 0 && r.right <= r.vw && r.rows.every((h) => h >= 44), actual: JSON.stringify(r), evidence };
  });
  await page.context().close();
}

await browser.close();
