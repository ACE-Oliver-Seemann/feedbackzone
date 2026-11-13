// Sections B/C/D: new round form, own question, start/close dialogs, toasts, results, suggestions,
// actions, report (screen + print). CHANGES DATA (Tím Beta rounds, actions on Alfa rounds).
import { launch, discover, makeRecorder, session, USERS, BASE, shot, go, overflow, api, nice } from "./s2-lib.mjs";

const { test } = makeRecorder("04-rounds-results");
const browser = await launch();
const d = await discover(browser);
const text = async (page, sel = "main") => (await page.locator(sel).first().innerText()).replace(/\s+/g, " ");
const alerts = async (page) => (await page.locator('main [role="alert"]').allInnerTexts()).join(" | ").replace(/\s+/g, " ");
const toasts = async (page) => (await page.locator("[data-toast]").allInnerTexts()).join(" | ").replace(/\s+/g, " ");
const inViewport = (page, locator) => locator.evaluate((el) => {
  const r = el.getBoundingClientRect();
  const header = document.querySelector("header")?.getBoundingClientRect();
  const top = header && getComputedStyle(document.querySelector("header")).position === "sticky" ? header.bottom : 0;
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), headerBottom: Math.round(top), vh: innerHeight, visible: r.top >= top - 1 && r.top < innerHeight };
});
const roundCount = async (page, teamId) => (await api(page, "/api/rounds")).rounds.filter((r) => r.teamId === teamId).length;

// ===================== NEW ROUND (manager Beta) =====================
const mgr = await session(browser, USERS.mgrB);
const openNew = async () => { await go(mgr, "/rounds/new"); };

await test("B", "Rounds list (manager): 'Vytvoriť kolo' leads to the form", { pre: USERS.mgrB, steps: "/rounds -> click 'Vytvoriť kolo'", expected: "/rounds/new with h1 'Nové kolo'", req: "MVP-04, IT-12" }, async () => {
  await go(mgr, "/rounds");
  const evidence = await shot(mgr, "rounds-manager-beta");
  await mgr.locator("main a", { hasText: "Vytvoriť kolo" }).first().click();
  await mgr.waitForURL("**/rounds/new");
  return { ok: (await mgr.locator("main h1").innerText()) === "Nové kolo", actual: `h1 "${await mgr.locator("main h1").innerText()}"`, evidence };
});
await test("C", "New round: name and deadline (+7 days) are prefilled, 3 questions preselected, notice shown (IT-13)", { steps: "Open /rounds/new", expected: "Name not empty; deadline = today + 7 days; 3 ticked questions from 3 different topics + the fixed one; an info notice says so", req: "IT-13, IT-04" }, async () => {
  await openNew();
  const name = await mgr.inputValue('input[name="name"]');
  const date = await mgr.inputValue('input[name="closesAt"]');
  const days = Math.round((new Date(date) - new Date(new Date().toISOString().slice(0, 10))) / 86400000);
  const checked = await mgr.locator('main details input[type="checkbox"]:checked').count();
  const openTopics = await mgr.locator("main details[open] summary").allInnerTexts();
  const fixed = await mgr.getByText("Stála otázka").count();
  const bar = await text(mgr, "form p[aria-live]");
  return { ok: name.length > 0 && days === 7 && checked === 3 && openTopics.length === 3 && fixed > 0, actual: `name "${name}"; deadline in ${days} days; ticked ${checked}; open topics: ${openTopics.map((x) => x.replace(/\s+/g, " ")).join(" / ")}; fixed block ${fixed}; counter "${bar}"`, evidence: await shot(mgr, "newround-default-1280") };
});
await test("B", "New round: topics are collapsed with a count of selected questions (IT-13)", { steps: "Read all topic headers", expected: "Each topic shows 'n z m'; topics without a selection are collapsed", req: "IT-13" }, async () => {
  const all = await mgr.locator("main details").evaluateAll((ds) => ds.map((x) => `${x.querySelector("summary").innerText.replace(/\s+/g, " ").trim()}${x.open ? " [open]" : ""}`));
  const bad = all.filter((s) => !/\d/.test(s));
  return { ok: all.length >= 8 && bad.length === 0, actual: all.join(" | ") };
});
await test("B", "New round: topic opens and closes by click and by keyboard", { steps: "Click a collapsed topic; press Enter on its summary", expected: "Opens, then closes", req: "IT-13" }, async () => {
  const closed = await mgr.locator("main details:not([open])").first().elementHandle();
  const s = await closed.$("summary");
  await s.click(); const a = await closed.evaluate((x) => x.open);
  await s.focus(); await mgr.keyboard.press("Enter"); const b = await closed.evaluate((x) => x.open);
  return { ok: a === true && b === false, actual: `after click open=${a}; after Enter open=${b}` };
});
await test("C", "New round: at 5 questions the remaining checkboxes are disabled", { steps: "Tick one more question (fixed + 4)", expected: "Counter shows 5; unticked questions disabled", req: "MVP-04, IT-04" }, async () => {
  const label = mgr.locator("main details[open] label:has(input:not(:checked))").first();
  await label.click();
  const enabled = await mgr.locator('main details input[type="checkbox"]:not(:checked):not(:disabled)').count();
  const bar = await text(mgr, "form p[aria-live]");
  return { ok: enabled === 0 && /5/.test(bar), actual: `enabled unticked checkboxes ${enabled}; counter "${bar}"` };
});
await test("C", "New round: fewer than 3 questions is rejected in the form", { steps: "Untick until fixed + 1 remain; click 'Uložiť koncept'", expected: "Error text; no request; stays on the form", req: "MVP-04" }, async () => {
  let posts = 0; const h = (r) => { if (r.url().endsWith("/api/rounds") && r.method() === "POST") posts++; }; mgr.on("request", h);
  for (let i = 0; i < 3; i++) await mgr.locator("main details label:has(input:checked)").first().click();
  const bar = await text(mgr, "form p[aria-live]");
  await mgr.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgr.waitForTimeout(400); mgr.off("request", h);
  const a = await alerts(mgr);
  return { ok: posts === 0 && a.length > 0, actual: `POSTs ${posts}; counter "${bar}"; alert "${a}"`, evidence: await shot(mgr, "newround-too-few") };
});
await test("C", "New round: empty name — is the error visible where the user is?", { steps: "Reload the form, clear the name, scroll to the bottom of the page, click 'Uložiť koncept' in the sticky bar", expected: "The error is visible without scrolling, or focus/scroll moves to the invalid field", req: "MVP-04; WCAG 3.3.1" }, async () => {
  await openNew();
  await mgr.fill('input[name="name"]', "");
  await mgr.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await mgr.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgr.locator('main [role="alert"]').first().waitFor({ timeout: 5000 });
  await mgr.waitForTimeout(500);
  const a = await alerts(mgr);
  const pos = await inViewport(mgr, mgr.locator('main [role="alert"]').first());
  const focus = await mgr.evaluate(() => document.activeElement?.getAttribute("name") ?? document.activeElement?.tagName);
  const inv = await mgr.locator('input[name="name"]').getAttribute("aria-invalid");
  return { ok: pos.visible || focus === "name", actual: `alert "${a}"; alert position top=${pos.top}px (viewport 0..${pos.vh}) -> visible: ${pos.visible}; focus on: ${focus}; aria-invalid=${inv}; scrollY=${await mgr.evaluate(() => Math.round(scrollY))}`, evidence: await shot(mgr, "newround-name-error-offscreen", false), defect: "FE2-error-offscreen" };
});
await test("C", "New round: deadline in the past is rejected", { steps: "Set the deadline to 2020-01-01; submit", expected: "Field error for the deadline; stays on the form", req: "MVP-04" }, async () => {
  await openNew();
  await mgr.fill('input[name="closesAt"]', "2020-01-01");
  await mgr.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgr.waitForTimeout(800);
  const a = await alerts(mgr);
  const inv = await mgr.locator('input[name="closesAt"]').getAttribute("aria-invalid");
  const desc = await mgr.locator('input[name="closesAt"]').getAttribute("aria-describedby");
  return { ok: a.length > 0 && new URL(mgr.url()).pathname === "/rounds/new", actual: `alert "${a}"; aria-invalid=${inv}; aria-describedby=${desc ? "set" : "missing"}` };
});
await test("C", "New round: empty deadline is rejected", { steps: "Clear the deadline; submit", expected: "Field error", req: "MVP-04" }, async () => {
  await openNew();
  await mgr.fill('input[name="closesAt"]', "");
  await mgr.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgr.waitForTimeout(800);
  const a = await alerts(mgr);
  return { ok: a.length > 0, actual: `alert "${a}"` };
});
await test("C", "Own question: too short is rejected with a message", { steps: "Type 'Krátka?' in 'Pridať vlastnú otázku', click 'Pridať otázku'", expected: "Error about 10 to 200 characters, linked to the field", req: "IT-07" }, async () => {
  await openNew();
  const input = mgr.locator('main input[placeholder]').last();
  await input.fill("Krátka?");
  await mgr.getByRole("button", { name: /Pridať otázku/ }).click();
  await mgr.waitForTimeout(800);
  const a = await alerts(mgr);
  const inv = await input.getAttribute("aria-invalid");
  return { ok: /10/.test(a), actual: `alert "${a}"; aria-invalid=${inv}` };
});
const stamp = Date.now() % 100000;
const Q1 = `Mám dosť času na sústredenú prácu? (${stamp})`;
await test("C", "Own question: valid one is added, ticked and visible (BUG-018); Enter does not submit the round", { steps: "Type a valid question, press Enter", expected: "Toast; the question appears ticked in the opened topic 'Vlastné otázky tímu'; still on the form", req: "IT-07, BUG-018" }, async () => {
  const input = mgr.locator('main input[placeholder]').last();
  await input.fill(Q1);
  await input.press("Enter");
  await mgr.waitForTimeout(1000);
  const tt = await toasts(mgr);
  const vis = await mgr.locator("main details[open] label", { hasText: Q1 }).isVisible().catch(() => false);
  const checked = await mgr.locator("main details[open] label", { hasText: Q1 }).locator("input").isChecked().catch(() => false);
  return { ok: vis && checked && new URL(mgr.url()).pathname === "/rounds/new" && tt.length > 0, actual: `toast "${tt}"; visible ${vis}; ticked ${checked}; cleared input "${await input.inputValue()}"`, evidence: await shot(mgr, "newround-own-question") };
});
await test("C", "Own question: duplicate is rejected", { steps: "Add the same text again", expected: "Message that the question already exists", req: "IT-07, BUG-005" }, async () => {
  const input = mgr.locator('main input[placeholder]').last();
  await input.fill(Q1); await input.press("Enter");
  await mgr.waitForTimeout(800);
  const a = await alerts(mgr);
  return { ok: a.length > 0, actual: `alert "${a}"` };
});
await test("C", "Own question when the round is full: saved with a notice (BUG-018)", { steps: "With 5 questions selected add another own question", expected: "Notice that it was saved but is not part of this round", req: "IT-07, BUG-018" }, async () => {
  // currently fixed + 3 + own = 5
  const bar = await text(mgr, "form p[aria-live]");
  const input = mgr.locator('main input[placeholder]').last();
  await input.fill(`Viem, na koho sa obrátiť s otázkou? (${stamp})`); await input.press("Enter");
  await mgr.waitForTimeout(1000);
  const notice = await mgr.locator('main [role="status"]').allInnerTexts();
  return { ok: notice.join(" ").length > 0, actual: `counter before "${bar}"; notice "${notice.join(" | ").replace(/\s+/g, " ")}"` };
});
await test("G", "Sticky save bar does not hide the focused element while tabbing through the form", { steps: "Tab through every control of the form at 1280x800; after each Tab compare the focused element's box with the sticky bar", expected: "The focused control is never covered by the sticky bar or the sticky header (WCAG 2.4.11)", req: "NFR-07; WCAG 2.4.11" }, async () => {
  await openNew();
  await mgr.locator('input[name="name"]').focus();
  const covered = [];
  let total = 0;
  for (let i = 0; i < 60; i++) {
    await mgr.keyboard.press("Tab");
    await mgr.waitForTimeout(40);
    const r = await mgr.evaluate(() => {
      const e = document.activeElement;
      if (!e || !e.closest("main")) return null;
      const target = e.matches("input.sr-only") ? e.closest("label") : e;
      const b = target.getBoundingClientRect();
      const bar = [...document.querySelectorAll("form > div")].find((x) => getComputedStyle(x).position === "sticky");
      const br = bar.getBoundingClientRect();
      const hb = document.querySelector("header").getBoundingClientRect().bottom;
      const inBar = bar.contains(e);
      const overlapBar = !inBar && b.bottom > br.top + 2 && b.top < br.bottom - 2;
      const overlapHeader = b.top < hb - 2;
      const below = b.top > innerHeight - 2;
      return { name: (e.getAttribute("name") || target.innerText || "").trim().slice(0, 30), overlapBar, overlapHeader, below, hiddenPx: overlapBar ? Math.round(Math.min(b.bottom, br.bottom) - Math.max(b.top, br.top)) : 0, h: Math.round(b.height) };
    });
    if (!r) break;
    total++;
    if (r.overlapBar || r.overlapHeader || r.below) covered.push(`${r.name} (${r.overlapBar ? `bar covers ${r.hiddenPx}/${r.h}px` : r.overlapHeader ? "under header" : "below viewport"})`);
  }
  if (covered.length) await shot(mgr, "newround-focus-under-sticky-bar", false);
  return { ok: covered.length === 0, actual: `${total} focus stops; covered: ${covered.join("; ") || "none"}`, evidence: covered.length ? "shots/newround-focus-under-sticky-bar.png" : "", defect: "FE2-sticky-focus" };
});
await test("C", "New round: server error 500 shows the generic message, input kept, message visible", { steps: "Intercept POST /api/rounds -> 500; with the page scrolled to the top click 'Uložiť koncept' in the sticky bar", expected: "Generic error visible in the viewport; name kept; button usable", req: "MVP-04; WCAG 3.3.1" }, async () => {
  await openNew();
  await mgr.fill('input[name="name"]', "Kolo s chybou servera");
  await mgr.route("**/api/rounds", (r) => r.request().method() === "POST" ? r.fulfill({ status: 500, contentType: "application/json", body: "{}" }) : r.continue());
  await mgr.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgr.locator('main [role="alert"]').first().waitFor();
  const a = await alerts(mgr);
  await mgr.waitForTimeout(400);
  const pos = await inViewport(mgr, mgr.locator('main [role="alert"]').first());
  const evidence = await shot(mgr, "newround-500-error-offscreen", false);
  await mgr.unroute("**/api/rounds");
  return { ok: a === "Niečo sa nepodarilo. Skús to znova." && (await mgr.inputValue('input[name="name"]')) === "Kolo s chybou servera" && pos.top < pos.vh, actual: `alert "${a}"; alert top ${pos.top}px, viewport height ${pos.vh}px -> visible: ${pos.top < pos.vh}; scrollY ${await mgr.evaluate(() => Math.round(scrollY))}`, evidence, defect: "FE2-error-offscreen" };
});
await test("C", "New round: expired session (401) asks to log in again (BUG-012)", { steps: "Intercept POST /api/rounds -> 401; submit", expected: "Message about the expired login", req: "BUG-012" }, async () => {
  await mgr.route("**/api/rounds", (r) => r.request().method() === "POST" ? r.fulfill({ status: 401, contentType: "application/json", body: "{}" }) : r.continue());
  await mgr.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgr.waitForTimeout(800);
  const a = await alerts(mgr);
  await mgr.unroute("**/api/rounds");
  return { ok: /vypršal/i.test(a), actual: `alert "${a}"` };
});
const LONG = `Kolo-${"X".repeat(60)}-<b>tučné</b>-„úvodzovky“-&-😀`;
await test("C", "New round: double click on save creates one draft; toast after the redirect", { steps: "Name with markup, quotes, emoji and a 60-character word; double-click 'Uložiť koncept'", expected: "One new round; redirect to /rounds; toast 'Koncept kola je uložený.'; name shown as text", req: "MVP-04, BUG-037 (known: retry duplicates)" }, async () => {
  await openNew();
  const before = await roundCount(mgr, d.teamB);
  await mgr.fill('input[name="name"]', LONG);
  await mgr.getByRole("button", { name: "Uložiť koncept" }).dblclick();
  await mgr.waitForURL("**/rounds");
  await mgr.waitForTimeout(600);
  const tt = await toasts(mgr);
  const evidence = await shot(mgr, "rounds-after-save-toast", false);
  const after = await roundCount(mgr, d.teamB);
  const bold = await mgr.locator("main [data-round-row] b").count();
  return { ok: after - before === 1 && /Koncept kola je uložený/.test(tt) && bold === 0, actual: `rounds ${before} -> ${after}; toast "${tt}"; <b> elements rendered ${bold}`, evidence };
});
await test("F", "Rounds list: long round name wraps at 1280 and 360 px (BUG-011)", { steps: "Open /rounds with the long name at both widths", expected: "No horizontal page scroll", req: "BUG-011, NFR-07" }, async () => {
  const o1 = await overflow(mgr);
  await mgr.setViewportSize({ width: 360, height: 740 }); await mgr.waitForTimeout(300);
  const o2 = await overflow(mgr);
  const evidence = await shot(mgr, "rounds-long-name-360");
  await mgr.setViewportSize({ width: 1280, height: 800 });
  return { ok: o1 <= 1 && o2 <= 1, actual: `overflow 1280: ${o1}px, 360: ${o2}px`, evidence };
});
await test("D", "Toast: polite live region, disappears by itself within about 4 s", { steps: "After saving, watch the toast", expected: "role=status / aria-live=polite region; toast gone after 3.5 s + fade", req: "IT-02" }, async () => {
  const region = await mgr.locator('[role="status"][aria-live="polite"]').last().evaluate((r) => ({ label: r.getAttribute("aria-label"), pe: getComputedStyle(r).pointerEvents }));
  await mgr.waitForTimeout(3600);
  const left = await mgr.locator("[data-toast]").count();
  return { ok: left === 0 && !!region.label, actual: `region label "${region.label}", pointer-events ${region.pe}; toasts left after ~4.5 s: ${left}` };
});

// ---------- start / close dialogs ----------
const row = () => mgr.locator("[data-round-row]").filter({ hasText: "Koncept" }).first();
await test("B", "Start dialog: opens as a modal with a title, focus on 'Zrušiť'", { steps: "On the draft click 'Spustiť'", expected: "Native modal dialog labelled by its title; focus inside (on the safe button); background inert", req: "MVP-05" }, async () => {
  await row().getByRole("button", { name: "Spustiť" }).click();
  await mgr.waitForTimeout(350);
  const r = await mgr.evaluate(() => { const dlg = document.querySelector("dialog[open]"); return { modal: dlg?.matches(":modal"), label: document.getElementById(dlg?.getAttribute("aria-labelledby"))?.innerText, focus: document.activeElement?.innerText, inDialog: dlg?.contains(document.activeElement), text: dlg?.innerText.replace(/\s+/g, " ") }; });
  return { ok: r.modal && !!r.label && r.inDialog && r.focus === "Zrušiť", actual: JSON.stringify(r), evidence: await shot(mgr, "dialog-start-1280", false) };
});
await test("G", "Start dialog: Tab stays inside the dialog (focus trap)", { steps: "Press Tab 6 times, record where focus is", expected: "Focus never leaves the dialog to the page behind", req: "WCAG 2.4.3" }, async () => {
  const seen = [];
  for (let i = 0; i < 6; i++) { await mgr.keyboard.press("Tab"); seen.push(await mgr.evaluate(() => { const dlg = document.querySelector("dialog[open]"); const a = document.activeElement; return dlg.contains(a) ? a.innerText.trim() : a === document.body ? "(body/browser UI)" : `OUTSIDE:${a.tagName}`; })); }
  return { ok: !seen.some((s) => s.startsWith("OUTSIDE")), actual: seen.join(" -> ") };
});
await test("B", "Start dialog: Esc closes it and focus returns to 'Spustiť'", { steps: "Press Esc", expected: "Dialog closed; nothing changed; focus on the trigger", req: "MVP-05" }, async () => {
  await mgr.keyboard.press("Escape"); await mgr.waitForTimeout(400);
  const open = await mgr.locator("dialog[open]").count();
  const focus = await mgr.evaluate(() => document.activeElement?.innerText);
  return { ok: open === 0 && focus === "Spustiť" && (await row().count()) === 1, actual: `open dialogs ${open}; focus "${focus}"; still draft: ${(await row().count()) === 1}` };
});
await test("B", "Start dialog: click on the backdrop closes it", { steps: "Open again; click outside the dialog box", expected: "Dialog closed without starting the round", req: "MVP-05" }, async () => {
  await row().getByRole("button", { name: "Spustiť" }).click(); await mgr.waitForTimeout(300);
  await mgr.mouse.click(20, 20); await mgr.waitForTimeout(400);
  return { ok: (await mgr.locator("dialog[open]").count()) === 0 && (await row().count()) === 1, actual: `open dialogs ${await mgr.locator("dialog[open]").count()}; still draft ${(await row().count()) === 1}` };
});
await test("D", "Dialog open/close animation is short and reduced under 'reduce'", { steps: "Read the transition of dialog.ui-dialog (full) and with data-motion=reduce", expected: "<= 1.5 s; under reduce only opacity changes", req: "IT-02" }, async () => {
  await row().getByRole("button", { name: "Spustiť" }).click(); await mgr.waitForTimeout(300);
  const full = await mgr.evaluate(() => { const cs = getComputedStyle(document.querySelector("dialog[open]")); return `${cs.transitionProperty} / ${cs.transitionDuration}`; });
  await mgr.evaluate(() => document.documentElement.setAttribute("data-motion", "reduce"));
  const red = await mgr.evaluate(() => getComputedStyle(document.querySelector("dialog[open]")).transitionProperty);
  await mgr.evaluate(() => document.documentElement.setAttribute("data-motion", "full"));
  await mgr.keyboard.press("Escape"); await mgr.waitForTimeout(300);
  return { ok: !/transform/.test(red) && !/[2-9]s|1\.[6-9]s/.test(full.replace(/0\.\d+s/g, "")), actual: `full: ${full}; reduce: ${red}` };
});
await test("C", "Start fails with 409 (deadline passed): inline message, dialog closed", { steps: "Intercept POST open -> 409 {error:'deadline_passed'}; confirm", expected: "Slovak message next to the button (role=alert); round stays a draft", req: "MVP-05" }, async () => {
  await mgr.route("**/api/rounds/*/open", (r) => r.fulfill({ status: 409, contentType: "application/json", body: '{"error":"deadline_passed"}' }));
  await row().getByRole("button", { name: "Spustiť" }).click();
  await mgr.locator("dialog[open]").getByRole("button", { name: "Spustiť" }).click();
  await mgr.waitForTimeout(700);
  const a = await alerts(mgr);
  await mgr.unroute("**/api/rounds/*/open");
  return { ok: a.length > 0, actual: `alert "${a}"`, evidence: await shot(mgr, "round-open-409", false) };
});
await test("C", "Start: double click on confirm starts the round once; toast; row updates; focus stays in the row", { steps: "Open the dialog, double-click 'Spustiť' in it", expected: "One POST; status 'Otvorené'; toast; focus on a control of the same row (not <body>)", req: "MVP-05" }, async () => {
  let posts = 0; const h = (r) => { if (/\/open$/.test(r.url()) && r.method() === "POST") posts++; }; mgr.on("request", h);
  await row().getByRole("button", { name: "Spustiť" }).click();
  await mgr.locator("dialog[open]").getByRole("button", { name: "Spustiť" }).dblclick().catch(() => {});
  await mgr.waitForTimeout(1500); mgr.off("request", h);
  const tt = await toasts(mgr);
  const focus = await mgr.evaluate(() => { const a = document.activeElement; return a === document.body ? "BODY" : `${a.tagName}:${a.innerText.trim().slice(0, 20)}:inRow=${!!a.closest("[data-round-row]")}`; });
  const status = await mgr.locator("[data-round-row]").filter({ hasText: "Kolo-XXXX" }).first().innerText();
  return { ok: posts === 1 && /Otvorené/.test(status) && focus !== "BODY", actual: `POSTs ${posts}; toast "${tt}"; focus ${focus}; row: ${status.replace(/\s+/g, " ").slice(0, 120)}`, evidence: await shot(mgr, "rounds-after-open") };
});
await test("B", "Open round: results page shows participation only", { steps: "Click 'Výsledky' of the open round", expected: "Participation count; text that results appear after closing; no averages, no comments", req: "MVP-10" }, async () => {
  await mgr.locator("[data-round-row]").filter({ hasText: "Kolo-XXXX" }).first().locator("a", { hasText: "Výsledky" }).click();
  await mgr.waitForURL("**/results"); await mgr.waitForLoadState("networkidle");
  const tx = await text(mgr);
  const o = await overflow(mgr);
  return { ok: /0 z \d/.test(tx) && !/Priemer/.test(tx) && o <= 1, actual: `overflow ${o}px; ${tx.slice(0, 260)}`, evidence: await shot(mgr, "results-open-long-name") };
});
await test("B", "Close dialog: confirm closes the round; toast", { steps: "/rounds -> 'Uzavrieť' on the open round -> confirm", expected: "Dialog with a warning text; status 'Uzavreté'; toast", req: "MVP-05" }, async () => {
  await go(mgr, "/rounds");
  const r = mgr.locator("[data-round-row]").filter({ hasText: "Kolo-XXXX" }).first();
  await r.getByRole("button", { name: "Uzavrieť" }).click(); await mgr.waitForTimeout(300);
  const dlg = await text(mgr, "dialog[open]");
  const evidence = await shot(mgr, "dialog-close-1280", false);
  await mgr.locator("dialog[open]").getByRole("button", { name: "Uzavrieť" }).click();
  await mgr.waitForTimeout(1500);
  const tt = await toasts(mgr);
  const status = (await r.innerText()).replace(/\s+/g, " ");
  return { ok: /Uzavreté/.test(status), actual: `dialog: "${dlg}"; toast "${tt}"; row: ${status.slice(0, 120)}`, evidence };
});
await test("B", "Closed round with 0 responses: below-threshold message only (NFR-02)", { steps: "Open its results", expected: "Only the insufficient-responses message and the count; no questions' averages", req: "NFR-02, MVP-11" }, async () => {
  await mgr.locator("[data-round-row]").filter({ hasText: "Kolo-XXXX" }).first().locator("a", { hasText: "Výsledky" }).click();
  await mgr.waitForURL("**/results"); await mgr.waitForLoadState("networkidle");
  const tx = await text(mgr);
  return { ok: !/Priemer/.test(tx) && !/Komentáre \(/.test(tx) && !/Návrhy krokov/.test(tx), actual: tx.slice(0, 300), evidence: await shot(mgr, "results-below-threshold-new") };
});
await test("E", "Confirm dialog on a 360 px touch screen", { pre: "manager Beta, 360x740 touch", steps: "Create a draft through the UI state left by the previous tests is not needed: open 'Spustiť' on any draft or 'Uzavrieť' on an open round", expected: "Dialog fits the screen; buttons >= 44 px; no page overflow", req: "NFR-07" }, async () => {
  const m = await session(browser, USERS.mgrA, { width: 360, height: 740, touch: true });
  await go(m, "/rounds");
  const btn = m.locator("[data-round-row] button", { hasText: /Uzavrieť|Spustiť/ }).first();
  if (!(await btn.count())) { await m.context().close(); return { blocked: true, actual: "no draft or open round for this manager" }; }
  await btn.click(); await m.waitForTimeout(400);
  const r = await m.evaluate(() => { const dlg = document.querySelector("dialog[open]"); const b = dlg.getBoundingClientRect(); return { left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top), bottom: Math.round(b.bottom), vw: innerWidth, vh: innerHeight, btns: [...dlg.querySelectorAll("button")].map((x) => `${x.innerText}:${Math.round(x.getBoundingClientRect().height)}`) }; });
  const evidence = await shot(m, "dialog-360", false);
  await m.keyboard.press("Escape");
  await m.context().close();
  return { ok: r.left >= 0 && r.right <= r.vw && r.bottom <= r.vh && r.btns.every((b) => Number(b.split(":")[1]) >= 44), actual: JSON.stringify(r), evidence };
});
await mgr.context().close();

// ===================== HR: new round team switch =====================
const hr = await session(browser, USERS.hr);
await test("C", "New round as HR: switching the team opens that team's preselected topics (BUG-017)", { steps: "/rounds/new as HR -> select 'Tím Beta'", expected: "All ticked questions are inside expanded topics", req: "BUG-017, IT-13" }, async () => {
  await go(hr, "/rounds/new");
  const teams = await hr.locator('select[name="teamId"] option').allInnerTexts();
  await hr.selectOption('select[name="teamId"]', { label: "Tím Beta" });
  await hr.waitForTimeout(300);
  const hidden = await hr.locator('main details:not([open]) input[type="checkbox"]:checked').count();
  const shown = await hr.locator('main details[open] input[type="checkbox"]:checked').count();
  const emptyOpen = await hr.locator("main details[open]").evaluateAll((ds) => ds.filter((x) => !x.querySelector("input:checked")).length);
  return { ok: hidden === 0 && shown >= 1, actual: `teams: ${teams.join(", ")}; ticked in open topics ${shown}, ticked in collapsed topics ${hidden}; open topics without a tick ${emptyOpen}`, evidence: await shot(hr, "newround-hr-beta") };
});
await test("C", "New round as HR: no 'own question' block for HR? (IT-07: manager writes own questions)", { steps: "Look for 'Pridať vlastnú otázku' as HR", expected: "Recorded behaviour (IT-07 names the manager; HR sees own questions of all teams)", req: "IT-07" }, async () => {
  const n = await hr.getByText("Pridať vlastnú otázku").count();
  const custom = await hr.locator("main details summary", { hasText: "Vlastné otázky" }).count();
  return { ok: true, actual: `'Pridať vlastnú otázku' blocks: ${n}; 'Vlastné otázky tímu' topics visible for the chosen team: ${custom}` };
});

// ===================== RESULTS (manager Alfa + HR) =====================
const ma = await session(browser, USERS.mgrA);
const RES = `/rounds/${d.okA}/results`;
await test("B", "Results above the threshold: summary first (IT-13)", { pre: `${USERS.mgrA}, closed round 5 of 6`, steps: "Open the results", expected: "'V skratke' with best and weakest question and the first suggested action, above the questions", req: "IT-13, MVP-10" }, async () => {
  await go(ma, RES);
  const tx = await text(ma);
  const order = tx.indexOf("V skratke") < tx.indexOf("Otázky");
  return { ok: /Najlepšie/.test(tx) && /Najslabšie/.test(tx) && /Navrhovaný krok/.test(tx) && order, actual: tx.slice(0, 420), evidence: await shot(ma, "results-okA-1280") };
});
await test("B", "Results: distributions and comments are collapsed; comments carry the count (IT-13)", { steps: "Read <details> states", expected: "No detail open by default; 'Komentáre (n)'", req: "IT-13" }, async () => {
  const ds = await ma.locator("main details").evaluateAll((x) => x.map((e) => `${e.querySelector("summary").innerText.replace(/\s+/g, " ").trim()}${e.open ? "[open]" : ""}`));
  return { ok: ds.every((s) => !s.includes("[open]")) && ds.some((s) => /Komentáre \(\d+\)/.test(s)), actual: ds.join(" | ") };
});
await test("B", "Results: opening a distribution shows five rows that add up to the number of responses", { steps: "Click the first 'Rozdelenie odpovedí'", expected: "5 rows; counts sum to 5", req: "MVP-10" }, async () => {
  const det = ma.locator("main details").filter({ hasText: "Rozdelenie odpovedí" }).first();
  await det.locator("summary").click(); await ma.waitForTimeout(300);
  const tx = (await det.innerText()).replace(/\s+/g, " ");
  const nums = tx.replace("Rozdelenie odpovedí", "").trim().split(" ").map(Number);
  let sum = 0; for (let i = 1; i < nums.length; i += 2) sum += nums[i];
  return { ok: nums.length === 10 && sum === 5, actual: `rows: ${tx}; sum ${sum}`, evidence: await shot(ma, "results-distribution-open") };
});
await test("B", "Results: comments open on click, shown without authors", { steps: "Click 'Komentáre (n)'", expected: "n comments; no names, e-mails or dates next to them", req: "MVP-10, NFR-01" }, async () => {
  const det = ma.locator("main details").filter({ hasText: /Komentáre \(/ }).first();
  await det.locator("summary").click(); await ma.waitForTimeout(300);
  const tx = (await det.innerText()).replace(/\s+/g, " ");
  return { ok: !/@|Alfa|\d{1,2}\. \d{1,2}\. \d{4}/.test(tx.replace(/Komentáre \(\d+\)/, "")), actual: tx.slice(0, 300) };
});
await test("B", "Results: scale where lower is better is labelled (IT-03)", { steps: "Open the round with the overtime question (44th week)", expected: "Note that a lower value is better", req: "IT-03" }, async () => {
  await go(ma, `/rounds/${d.doneA}/results`);
  const tx = await text(ma);
  return { ok: /nižšia hodnota lepšia/.test(tx), actual: tx.match(/.{60}nižšia hodnota lepšia.{10}/)?.[0] ?? "note not found" };
});
await test("A", "Results summary link 'Prejsť na kroky': target is not hidden under the sticky header", { steps: "Click the link in the summary; measure the target heading against the header", expected: "The target heading is visible below the sticky header", req: "IT-13; WCAG 2.4.11" }, async () => {
  await go(ma, RES);
  const link = ma.locator("main a", { hasText: "Prejsť na kroky" });
  const href = await link.getAttribute("href");
  await link.click(); await ma.waitForTimeout(700);
  const target = ma.locator(href.slice(href.indexOf("#")));
  const pos = await inViewport(ma, target);
  const firstHeading = await target.evaluate((el) => { const h = el.matches("h1,h2,h3") ? el : el.querySelector("h2,h3"); const r = h.getBoundingClientRect(); return { top: Math.round(r.top), text: h.innerText }; });
  return { ok: firstHeading.top >= pos.headerBottom, actual: `href ${href}; header bottom ${pos.headerBottom}px; target top ${pos.top}px; heading "${firstHeading.text}" top ${firstHeading.top}px`, evidence: await shot(ma, "results-anchor-steps", false), defect: "FE2-anchor" };
});
await test("B", "Suggestions: two, from different topics, labelled as rule-based, not AI (IT-09)", { steps: "Read 'Návrhy krokov'", expected: "Exactly 2 suggestions with 'Použiť ako krok'; text says they are rules, not AI", req: "IT-09" }, async () => {
  const n = await ma.getByRole("button", { name: "Použiť ako krok" }).count();
  const tx = await text(ma);
  return { ok: n === 2 && /nie AI/.test(tx), actual: `buttons ${n}; ${tx.match(/Návrhy podľa pravidiel[^.]*\./)?.[0] ?? ""}` };
});
await test("B", "'Použiť ako krok' prefills the form and the form is visible", { steps: "Click the first 'Použiť ako krok'", expected: "Topic and description filled; the form is in the viewport, not under the header", req: "IT-09" }, async () => {
  await ma.getByRole("button", { name: "Použiť ako krok" }).first().click(); await ma.waitForTimeout(500);
  const topic = await ma.inputValue('input[name="topic"]'); const desc = await ma.inputValue('textarea[name="description"]');
  const pos = await inViewport(ma, ma.locator('input[name="topic"]'));
  return { ok: topic.length > 0 && desc.length > 0 && pos.top >= pos.headerBottom && pos.bottom <= pos.vh, actual: `topic "${topic}"; description ${desc.length} chars; topic field top ${pos.top}px (header ${pos.headerBottom}, viewport ${pos.vh})`, evidence: await shot(ma, "results-suggestion-prefill", false) };
});
await test("C", "Action form: empty submit shows field errors linked to the fields (BUG-029)", { steps: "Clear topic and description; click 'Pridať krok'", expected: "Error messages; fields get aria-invalid and aria-describedby pointing at the message; required fields are marked", req: "MVP-12, BUG-029" }, async () => {
  await ma.fill('input[name="topic"]', ""); await ma.fill('textarea[name="description"]', "");
  await ma.getByRole("button", { name: "Pridať krok" }).click(); await ma.waitForTimeout(800);
  const a = await alerts(ma);
  const r = await ma.evaluate(() => ["topic", "description", "dueDate"].map((n) => { const e = document.querySelector(`[name="${n}"]`); const id = e.getAttribute("aria-describedby"); return `${n}: invalid=${e.getAttribute("aria-invalid")} describedby=${id && document.getElementById(id.split(" ").pop()) ? "ok" : "none"} required=${e.required || e.getAttribute("aria-required") || "no"}`; }));
  const linked = r.filter((x) => /invalid=true describedby=ok/.test(x)).length;
  return { ok: a.length > 0 && linked >= 2, actual: `alerts "${a}"; ${r.join("; ")}`, evidence: await shot(ma, "action-form-errors", false) };
});
const ACT = `Krok ${stamp} <i>kurzíva</i> ${"Ž".repeat(200)}`;
await test("C", "Action: valid action with markup and a 200-character word is added once on double click", { steps: "Fill topic, description (markup + long word), date; double-click 'Pridať krok'", expected: "Toast; exactly one new action in 'Kroky po kole'; text escaped and wrapped; form cleared", req: "MVP-12, BUG-011" }, async () => {
  await ma.fill('input[name="topic"]', `Téma ${stamp}`); await ma.fill('textarea[name="description"]', ACT); await ma.fill('input[name="dueDate"]', "2027-02-01");
  await ma.getByRole("button", { name: "Pridať krok" }).dblclick();
  await ma.waitForTimeout(1800);
  const tt = await toasts(ma);
  const n = await ma.getByText(`Téma ${stamp}`).count();
  const it = await ma.locator("main i").count();
  const o = await overflow(ma);
  return { ok: n === 1 && it === 0 && o <= 1 && (await ma.inputValue('input[name="topic"]')) === "", actual: `toast "${tt}"; actions with this topic ${n}; <i> rendered ${it}; overflow ${o}px`, evidence: await shot(ma, "results-action-added") };
});
await test("C", "Action status: change saves with a toast; failure restores the old value", { steps: "Change the status select of the new action to 'Hotové'; then intercept PATCH -> 500 and change again", expected: "Toast 'Stav kroku je uložený.'; on failure an error message and the select shows the stored value", req: "MVP-13" }, async () => {
  const sel = ma.locator('select[aria-label="Stav"]').last();
  await sel.selectOption("DONE"); await ma.waitForTimeout(1200);
  const tt = await toasts(ma);
  await ma.route("**/api/actions/*", (r) => r.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await ma.locator('select[aria-label="Stav"]').last().selectOption("IN_PROGRESS"); await ma.waitForTimeout(1000);
  const a = await alerts(ma); const t2 = await toasts(ma);
  const val = await ma.locator('select[aria-label="Stav"]').last().inputValue();
  await ma.unroute("**/api/actions/*");
  return { ok: /uložený/.test(tt) && (a.length > 0 || /nepodarilo/.test(t2)) && val === "DONE", actual: `toast "${tt}"; after failure: alert "${a}", toast "${t2}", select value ${val}`, evidence: await shot(ma, "action-status-failure", false) };
});
await test("B", "Team page shows the action for the team ('Povedali ste, urobili sme')", { steps: "Open Môj tím as manager", expected: "The new action with its status; long word wrapped at 360 px", req: "MVP-13, MVP-14, BUG-011" }, async () => {
  await ma.setViewportSize({ width: 360, height: 740 });
  await go(ma, `/team/${d.teamA}`);
  const n = await ma.getByText(`Téma ${stamp}`).count();
  const o = await overflow(ma);
  const evidence = await shot(ma, "team-long-action-360");
  await ma.setViewportSize({ width: 1280, height: 800 });
  return { ok: n >= 1 && o <= 1, actual: `action shown ${n}; overflow ${o}px`, evidence };
});
await test("B", "Results below the threshold (4 of 6): message and count only (NFR-02)", { steps: `Open the results of the 42nd week round as manager`, expected: "Insufficient-responses text with the count; no averages, comments, suggestions, action form allowed or not per requirements", req: "NFR-02, MVP-11" }, async () => {
  await go(ma, `/rounds/${d.lowA}/results`);
  const tx = await text(ma);
  return { ok: !/Priemer/.test(tx) && !/Komentáre \(/.test(tx) && !/Použiť ako krok/.test(tx) && /4/.test(tx), actual: tx.slice(0, 320), evidence: await shot(ma, "results-lowA") };
});

// ---------- report ----------
await test("B", "Report: results, actions and suggestions without comments (IT-08)", { steps: "Results -> 'Report na tlač'", expected: "Report page; no comment texts; print button; link back", req: "IT-08" }, async () => {
  await go(ma, `/rounds/${d.doneA}/results`);
  const comments = await ma.locator("main details").filter({ hasText: /Komentáre \(/ }).locator("li, p").allInnerTexts();
  await ma.locator("main a", { hasText: "Report na tlač" }).click();
  await ma.waitForURL("**/report"); await ma.waitForLoadState("networkidle");
  const tx = await text(ma);
  const leaked = comments.map((c) => c.trim()).filter((c) => c.length > 15 && tx.includes(c));
  return { ok: leaked.length === 0 && /Priemer|priemer/.test(tx), actual: `comment texts on the results page ${comments.length}; found in the report: ${leaked.length}; report starts: ${tx.slice(0, 200)}`, evidence: await shot(ma, "report-screen-1280") };
});
await test("F", "Report in print media: header, menu and buttons hidden, nothing cut", { steps: "Emulate print media on the report", expected: "No header/menu/buttons; content width fits; no element with overflow", req: "IT-08" }, async () => {
  await ma.emulateMedia({ media: "print" });
  const r = await ma.evaluate(() => {
    const vis = (el) => el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0;
    return { header: vis(document.querySelector("header")), buttons: [...document.querySelectorAll("main button, main a")].filter(vis).map((b) => b.innerText.trim()), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, bg: getComputedStyle(document.body).backgroundColor };
  });
  const evidence = await shot(ma, "report-print-media");
  await ma.pdf({ path: `${process.env.QA_EVID ?? "./testing/reports/2026-11-12_002/evidence/frontend"}/report-doneA.pdf`, format: "A4" }).catch(() => {});
  await ma.emulateMedia({ media: "screen" });
  return { ok: !r.header && r.buttons.length === 0 && r.overflow <= 1, actual: JSON.stringify(r), evidence };
});
await test("B", "Report: 'Tlačiť' calls the browser print dialog", { steps: "Stub window.print; click the print button", expected: "window.print called once", req: "IT-08" }, async () => {
  await ma.evaluate(() => { window.__p = 0; window.print = () => { window.__p++; }; });
  await ma.locator("main button").first().click();
  const n = await ma.evaluate(() => window.__p);
  const label = await ma.locator("main button").first().innerText();
  return { ok: n === 1, actual: `button "${label}"; print calls ${n}` };
});
await test("B", "Report of a round below the threshold shows no figures", { steps: "Open the report of the 42nd week round", expected: "Insufficient-responses message only", req: "NFR-02, IT-08" }, async () => {
  await go(ma, `/rounds/${d.lowA}/report`);
  const tx = await text(ma);
  return { ok: !/Priemer \d|priemer \d/.test(tx) && !/Rozdelenie/.test(tx), actual: tx.slice(0, 260), evidence: await shot(ma, "report-lowA") };
});
await ma.context().close();

// ---------- HR: issue from a round ----------
await test("B", "HR results: 'Vytvoriť podnet z tohto kola' opens the issue form prefilled and visible", { steps: "As HR open results of a closed round; click the link", expected: "/hr/issues with the form expanded, round and team named, the title field visible below the header; no comment text carried over", req: "IT-10" }, async () => {
  await go(hr, `/rounds/${d.doneA}/results`);
  await hr.locator("main a", { hasText: "Vytvoriť podnet z tohto kola" }).click();
  await hr.waitForURL("**/hr/issues**"); await hr.waitForLoadState("networkidle"); await hr.waitForTimeout(600);
  const title = hr.locator('input[name="title"]');
  const visible = await title.isVisible();
  const pos = visible ? await inViewport(hr, title) : null;
  const notice = await hr.locator("form").filter({ has: title }).innerText().then((x) => x.replace(/\s+/g, " ").slice(0, 160)).catch(() => "");
  const desc = visible ? await hr.inputValue('textarea[name="description"]') : "";
  return { ok: visible && pos.top >= pos.headerBottom && pos.top < pos.vh && desc === "", actual: `url ${nice(new URL(hr.url()).pathname + new URL(hr.url()).search + new URL(hr.url()).hash)}; title field visible ${visible}, top ${pos?.top}px (header ${pos?.headerBottom}, viewport ${pos?.vh}); form: ${notice}; description prefilled: "${desc}"`, evidence: await shot(hr, "issues-from-round", false) };
});
await hr.context().close();
await browser.close();
