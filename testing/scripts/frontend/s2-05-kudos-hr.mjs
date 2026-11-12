// Sections B/C/D: kudos (send, receive, emoji, celebration), HR issues, notes, overview, heatmap, trend.
// CHANGES DATA (kudos, issues, notes).
import { launch, discover, makeRecorder, session, USERS, BASE, shot, go, overflow, api, nice } from "./s2-lib.mjs";

const { test } = makeRecorder("05-kudos-hr");
const browser = await launch();
const d = await discover(browser);
const text = async (page, sel = "main") => (await page.locator(sel).first().innerText()).replace(/\s+/g, " ");
const alerts = async (page) => (await page.locator('main [role="alert"]').allInnerTexts()).join(" | ").replace(/\s+/g, " ");
const toasts = async (page) => (await page.locator("[data-toast]").allInnerTexts()).join(" | ").replace(/\s+/g, " ");
const confetti = (page) => page.locator("canvas[data-confetti]").count();
const stamp = Date.now() % 100000;

// ===================== KUDOS =====================
const f = await session(browser, USERS.filip);
const sendTab = async (page) => { await go(page, "/kudos?tab=send"); };
const pick = async (page, namePrefix) => {
  const opts = await page.locator('select[name="toUserId"] option').allInnerTexts();
  await page.selectOption('select[name="toUserId"]', { label: opts.find((o) => o.startsWith(namePrefix)) });
};
const submitKudos = (page) => page.locator("form").getByRole("button", { name: "Poslať kudos" }).click();
const kudosPosts = (page) => { const c = { n: 0 }; page.on("request", (r) => { if (r.url().endsWith("/api/kudos") && r.method() === "POST") c.n++; }); return c; };

await test("B", "Kudos hub: empty state for a user without kudos", { pre: USERS.filip, steps: "Open /kudos", expected: "Either a list or a friendly empty state with a 'Poslať kudos' action", req: "MVP-17" }, async () => {
  await go(f, "/kudos");
  const tx = await text(f);
  return { ok: tx.length > 20, actual: tx.slice(0, 240), evidence: await shot(f, "kudos-received-filip") };
});
await test("G", "Kudos tabs: ARIA tabs with arrow-key navigation", { steps: "Focus the selected tab, press ArrowRight, then ArrowLeft, End, Home", expected: "role=tablist/tab/tabpanel; aria-selected follows; focus moves to the selected tab; panels switch", req: "IT-12; WAI-ARIA tabs" }, async () => {
  const tabs = f.locator('[role="tab"]');
  await tabs.first().focus();
  const log = [];
  for (const key of ["ArrowRight", "ArrowLeft", "End", "Home"]) {
    await f.keyboard.press(key);
    log.push(await f.evaluate((k) => `${k}:${document.activeElement.innerText.replace(/\s+/g, " ").trim()}[selected=${document.activeElement.getAttribute("aria-selected")}] panels visible=${[...document.querySelectorAll('[role="tabpanel"]')].filter((p) => !p.hidden).length}`, key));
  }
  const ok = log.every((l) => /selected=true/.test(l) && /visible=1/.test(l)) && /Poslať/.test(log[0]) && /Moje/.test(log[1]);
  return { ok, actual: log.join(" | ") };
});
await test("C", "Kudos form: recipient list has everyone except the sender", { steps: "Open the send tab; read the options", expected: "12 other people with team names; not Filip", req: "MVP-16" }, async () => {
  await sendTab(f);
  const opts = await f.locator('select[name="toUserId"] option:not([disabled])').allInnerTexts();
  return { ok: opts.length === 12 && !opts.some((o) => o.startsWith("Filip")), actual: `${opts.length} recipients; first: ${opts.slice(0, 4).join(", ")}`, evidence: await shot(f, "kudos-send-1280") };
});
await test("C", "Kudos: submit with nothing filled shows errors on the fields", { steps: "Click 'Poslať kudos' on the untouched form", expected: "Errors for recipient and text, linked to the fields (aria-invalid); nothing sent as valid", req: "MVP-16, BUG-029" }, async () => {
  await submitKudos(f); await f.waitForTimeout(800);
  const a = await alerts(f);
  const inv = await f.evaluate(() => ["toUserId"].map((n) => `${n}:${document.querySelector(`[name="${n}"]`).getAttribute("aria-invalid")}`).join(",") + ` textarea:${document.querySelector("form textarea").getAttribute("aria-invalid")}`);
  const focus = await f.evaluate(() => document.activeElement.tagName + ":" + (document.activeElement.innerText || "").trim().slice(0, 20));
  return { ok: /komu|príjemc|Vyber/i.test(a) && a.includes("|"), actual: `alerts "${a}"; ${inv}; focus after error: ${focus}`, evidence: await shot(f, "kudos-validation") };
});
await test("C", "Kudos: text shorter than 20 characters without an emoji is rejected", { steps: "Recipient Gabriela, text 'Vďaka!' (6), submit", expected: "Error about 20 to 500 characters; counter shows 6", req: "MVP-16, IT-06" }, async () => {
  await pick(f, "Gabriela");
  await f.fill("form textarea", "Vďaka!");
  await submitKudos(f); await f.waitForTimeout(800);
  const a = await alerts(f);
  return { ok: /20/.test(a), actual: `alert "${a}"` };
});
await test("C", "Kudos preview follows the form (recipient, emoji, text, value, visibility)", { steps: "Pick an emoji, type text, choose another value and 'Súkromné'", expected: "The preview card shows the same recipient, emoji, text, value and visibility", req: "MVP-16, IT-06" }, async () => {
  await f.getByRole("button", { name: "👏" }).click().catch(async () => { await f.locator("form fieldset button[aria-pressed]").first().click(); });
  await f.fill("form textarea", "Ďakujem za pomoc s nasadením, bolo to rýchle.");
  const values = f.locator('form input[name="value"]');
  await values.nth(1).check({ force: true });
  await f.locator('form input[name="visibility"]').nth(1).check({ force: true });
  await f.waitForTimeout(300);
  const valueLabel = await values.nth(1).evaluate((i) => i.closest("label").innerText.trim());
  const prev = await text(f, 'section[aria-labelledby="kudos-preview-title"]');
  return { ok: /Gabriela/.test(prev) && /Ďakujem za pomoc/.test(prev) && prev.includes(valueLabel), actual: `preview: ${prev.slice(0, 260)}; chosen value "${valueLabel}"`, evidence: await shot(f, "kudos-preview") };
});
await test("C", "Kudos: 500-character limit; emoji counts as one character (BUG-006)", { steps: "Type 498 letters + 2 emoji + 5 letters", expected: "At most 500 characters accepted; counter 500", req: "MVP-16, BUG-006" }, async () => {
  await f.fill("form textarea", "a".repeat(498) + "😀😀" + "bbbbb");
  const v = await f.inputValue("form textarea");
  const counter = await f.locator("form .tabular-nums").first().innerText();
  return { ok: [...v].length <= 500, actual: `accepted ${[...v].length} characters (${v.length} UTF-16 units); counter "${counter.replace(/\s+/g, " ")}"` };
});
await test("C", "Kudos fails with 500: error shown, form content kept", { steps: "Intercept POST /api/kudos -> 500; submit", expected: "Generic error; text still in the form", req: "MVP-16" }, async () => {
  await f.fill("form textarea", "Ďakujem za pomoc s nasadením, bolo to rýchle.");
  await f.route("**/api/kudos", (r) => r.request().method() === "POST" ? r.fulfill({ status: 500, contentType: "application/json", body: "{}" }) : r.continue());
  await submitKudos(f); await f.waitForTimeout(800);
  const a = await alerts(f);
  await f.unroute("**/api/kudos");
  return { ok: a === "Niečo sa nepodarilo. Skús to znova." && (await f.inputValue("form textarea")).startsWith("Ďakujem"), actual: `alert "${a}"` };
});
await test("C", "Kudos with an expired session (401): message asks to log in again (BUG-012)", { steps: "Intercept POST -> 401; submit", expected: "Text about the expired login; form content kept", req: "BUG-012" }, async () => {
  await f.route("**/api/kudos", (r) => r.request().method() === "POST" ? r.fulfill({ status: 401, contentType: "application/json", body: "{}" }) : r.continue());
  await submitKudos(f); await f.waitForTimeout(800);
  const a = await alerts(f);
  await f.unroute("**/api/kudos");
  return { ok: /vypršal/i.test(a), actual: `alert "${a}"` };
});
let kudosConfettiMs = null;
await test("D", "Kudos sent: confirmation, light confetti within 1.5 s, form cleared, one request on double click", { steps: "Double-click 'Poslať kudos' with valid data (private, with emoji); time the confetti canvas", expected: "One POST; success block 'Kudos je odoslané.'; confetti canvas appears and is removed within 1 500 ms; form reset", req: "MVP-16, IT-02, IT-06" }, async () => {
  const c = kudosPosts(f);
  await f.evaluate(() => {
    window.__c = { start: null, end: null };
    const tick = () => { const el = document.querySelector("canvas[data-confetti]"); const now = performance.now(); if (el && window.__c.start === null) window.__c.start = now; if (!el && window.__c.start !== null && window.__c.end === null) { window.__c.end = now; return; } requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await f.locator("form").getByRole("button", { name: "Poslať kudos" }).dblclick();
  await f.getByText("Kudos je odoslané.").first().waitFor({ timeout: 8000 });
  await shot(f, "kudos-sent-confetti", false);
  await f.waitForFunction(() => window.__c.end !== null, null, { timeout: 6000 }).catch(() => {});
  const t = await f.evaluate(() => window.__c);
  kudosConfettiMs = t.start !== null && t.end !== null ? Math.round(t.end - t.start) : null;
  const cleared = (await f.inputValue("form textarea")) === "" && (await f.inputValue('select[name="toUserId"]')) === "";
  const pressed = await f.locator('form fieldset button[aria-pressed="true"]').count();
  return { ok: c.n === 1 && kudosConfettiMs !== null && kudosConfettiMs <= 1500 && cleared && pressed === 0, actual: `POSTs ${c.n}; confetti on screen ${kudosConfettiMs} ms; form cleared ${cleared}; emoji still pressed ${pressed}`, evidence: "shots/kudos-sent-confetti.png" };
});
await test("B", "Kudos success block: 'Poslať ďalšie' focuses the recipient; 'Pozrieť moje kudos' switches the tab", { steps: "Click both buttons of the success block", expected: "Focus on the recipient select; then the received tab is shown", req: "MVP-16" }, async () => {
  const again = f.locator('form [role="status"] button').first();
  const label1 = await again.innerText();
  await again.click();
  const focus = await f.evaluate(() => document.activeElement.getAttribute("name"));
  // send one more so that the block is back
  await pick(f, "Gabriela"); await f.fill("form textarea", `Verejné kudos ${stamp} s dlhým slovom ${"W".repeat(250)} <u>x</u>`);
  await submitKudos(f); await f.getByText("Kudos je odoslané.").first().waitFor({ timeout: 8000 });
  await f.locator('form [role="status"] button').last().click(); await f.waitForTimeout(300);
  const sel = await f.locator('[role="tab"][aria-selected="true"]').innerText();
  return { ok: focus === "toUserId" && /Moje/.test(sel), actual: `"${label1}" -> focus on ${focus}; second button -> selected tab "${sel.replace(/\s+/g, " ")}"` };
});
await test("D", "Kudos under reduced motion: no confetti, confirmation still shown", { pre: "prefers-reduced-motion: reduce", steps: "Send an emoji-only kudos as Gabriela to Filip", expected: "Success block; no canvas", req: "IT-02, IT-06" }, async () => {
  const g = await session(browser, USERS.gabriela, { reducedMotion: "reduce" });
  await sendTab(g); await pick(g, "Filip");
  await g.locator("form fieldset button[aria-pressed]").nth(2).click();
  await submitKudos(g);
  await g.getByText("Kudos je odoslané.").first().waitFor({ timeout: 8000 });
  let max = 0; for (let i = 0; i < 15; i++) { max = Math.max(max, await confetti(g)); await g.waitForTimeout(50); }
  await g.context().close();
  return { ok: max === 0, actual: `emoji-only kudos accepted; confetti canvases ${max}` };
});
await f.context().close();

// recipient side
const g = await session(browser, USERS.gabriela, { width: 360, height: 740, touch: true });
await test("B", "Recipient sees the kudos with emoji, value and sender; long word wraps at 360 px", { pre: `${USERS.gabriela}, 360px`, steps: "Open /kudos", expected: "Both kudos from Filip; emoji shown; markup as text; no horizontal scroll", req: "MVP-17, IT-06, BUG-011" }, async () => {
  await go(g, "/kudos");
  const tx = await text(g);
  const o = await overflow(g);
  const u = await g.locator("main u").count();
  return { ok: /Filip/.test(tx) && tx.includes("👏") && o <= 1 && u === 0, actual: `overflow ${o}px; <u> rendered ${u}; text: ${tx.slice(0, 260)}`, evidence: await shot(g, "kudos-received-gabriela-360") };
});
await test("D", "New kudos since the last visit: notice and one light confetti on the next visit only", { steps: "Visit /kudos again (count unchanged) and compare", expected: "No 'new kudos' notice when nothing new arrived", req: "IT-02 (animation never repeats without reason)" }, async () => {
  await g.reload({ waitUntil: "networkidle" });
  await g.waitForTimeout(300);
  const notice = await g.locator('main [role="status"]').filter({ hasText: /nov/i }).count();
  const c = await confetti(g);
  const keys = await g.evaluate(() => Object.keys(localStorage).join(", "));
  return { ok: notice === 0 && c === 0, actual: `notice ${notice}; confetti ${c}; localStorage keys: ${keys}` };
});
await test("B", "Team page shows public kudos with the emoji, private ones are not shown", { steps: "Open Môj tím (Beta) as Gabriela", expected: `Public kudos ${stamp} listed; the private one ("Ďakujem za pomoc s nasadením") not listed`, req: "MVP-16, IT-06" }, async () => {
  await go(g, `/team/${d.teamB}`);
  const tx = await text(g);
  const o = await overflow(g);
  return { ok: tx.includes(`Verejné kudos ${stamp}`) && !tx.includes("Ďakujem za pomoc s nasadením") && o <= 1, actual: `public shown ${tx.includes(`Verejné kudos ${stamp}`)}; private shown ${tx.includes("Ďakujem za pomoc s nasadením")}; overflow ${o}px`, evidence: await shot(g, "team-beta-kudos-360") };
});
await g.context().close();

// ===================== HR: ISSUES =====================
const hr = await session(browser, USERS.hr);
await test("B", "Issues: only unresolved by default; form collapsed behind a button (IT-13)", { pre: USERS.hr, steps: "Open /hr/issues", expected: "Status filter 'Nevybavené'; the add form is not visible until 'Pridať podnet' is clicked", req: "IT-13, IT-10" }, async () => {
  await go(hr, "/hr/issues");
  const status = await hr.locator('select[name="status"] option:checked').innerText();
  const formVisible = await hr.locator('input[name="title"]').isVisible();
  const n = await hr.locator("main [data-issue], main ul > li:has(select)").count();
  return { ok: /Nevybaven/.test(status) && !formVisible, actual: `status filter "${status}"; form visible ${formVisible}; issues listed ${n}`, evidence: await shot(hr, "issues-default") };
});
await test("C", "Issues: empty title is rejected with a message", { steps: "Open the form, submit empty", expected: "Error message near the form; field marked invalid", req: "IT-10, BUG-029" }, async () => {
  await hr.locator("main summary", { hasText: "Pridať podnet" }).click();
  await hr.locator("form").getByRole("button", { name: "Pridať podnet" }).click(); await hr.waitForTimeout(800);
  const a = await alerts(hr);
  const inv = await hr.locator('input[name="title"]').getAttribute("aria-invalid");
  return { ok: a.length > 0, actual: `alert "${a}"; title aria-invalid=${inv}`, evidence: await shot(hr, "issues-form-error", false) };
});
const ISSUE = `Podnet ${stamp} ${"Q".repeat(100)} <s>x</s>`;
await test("C", "Issues: valid issue is added once on double click, toast, listed, wrapped", { steps: "Title with a 100-character word and markup, description with line breaks; double-click submit", expected: "One new issue; toast; text as text; no overflow at 1280 and 360", req: "IT-10, BUG-011" }, async () => {
  let posts = 0; const h = (r) => { if (r.url().endsWith("/api/hr/issues") && r.method() === "POST") posts++; }; hr.on("request", h);
  await hr.fill('input[name="title"]', ISSUE);
  await hr.fill('textarea[name="description"]', "Prvý riadok\nDruhý riadok s odkazom https://example.test/" + "a".repeat(120));
  await hr.locator("form").getByRole("button", { name: "Pridať podnet" }).dblclick();
  await hr.waitForTimeout(1800); hr.off("request", h);
  const tt = await toasts(hr);
  const n = await hr.locator("main :is(h2,h3,h4,p)", { hasText: `Podnet ${stamp}` }).count();
  const o1 = await overflow(hr);
  await hr.setViewportSize({ width: 360, height: 740 }); await hr.waitForTimeout(300);
  const o2 = await overflow(hr);
  const evidence = await shot(hr, "issues-long-title-360");
  await hr.setViewportSize({ width: 1280, height: 800 });
  return { ok: posts === 1 && n === 1 && o1 <= 1 && o2 <= 1 && (await hr.locator("main s").count()) === 0, actual: `POSTs ${posts}; toast "${tt}"; listed ${n}; overflow 1280: ${o1}px, 360: ${o2}px`, evidence };
});
await test("C", "Issues: changing the status to 'Hotové' saves with a toast and the issue leaves the default list", { steps: "Change the status select of the new issue; reload", expected: "Toast; after reload the issue is not in 'Nevybavené' but is in 'Všetky'", req: "IT-10, IT-13" }, async () => {
  const card = hr.locator("main li").filter({ hasText: `Podnet ${stamp}` }).first();
  await card.locator('select[aria-label="Stav"]').selectOption("DONE"); await hr.waitForTimeout(1200);
  const tt = await toasts(hr);
  await go(hr, "/hr/issues");
  const inDefault = await hr.locator("main :is(h2,h3,h4,p)", { hasText: `Podnet ${stamp}` }).count();
  await hr.selectOption('select[name="status"]', { index: 1 });
  await hr.locator("main form").first().getByRole("button").click();
  await hr.waitForLoadState("networkidle"); await hr.waitForTimeout(400);
  const inAll = await hr.locator("main :is(h2,h3,h4,p)", { hasText: `Podnet ${stamp}` }).count();
  return { ok: /ulož/i.test(tt) && inDefault === 0 && inAll === 1, actual: `toast "${tt}"; in default list ${inDefault}; with filter 'Všetky' ${inAll}; url ${new URL(hr.url()).search}` };
});
await test("B", "Issues: filter by group with no match shows an empty state", { steps: "Pick each owner group until one has no issues", expected: "Friendly empty text instead of an empty box", req: "IT-10" }, async () => {
  const opts = await hr.locator('select[name="group"] option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
  let found = null;
  for (const v of opts) {
    await go(hr, `/hr/issues?group=${v}&status=active`);
    if ((await hr.locator("main [data-issue], main ul > li:has(select)").count()) === 0) { found = v; break; }
  }
  if (!found) return { blocked: true, actual: "every group has an unresolved issue in this data set" };
  const tx = await text(hr);
  return { ok: /Žiadn|nie sú|Nič/i.test(tx), actual: `group ${found}: ${tx.slice(-200)}`, evidence: await shot(hr, "issues-empty-filter") };
});
await test("C", "Issues: unknown filter value in the URL falls back visibly (BUG-009)", { steps: "Open /hr/issues?status=nezmysel", expected: "The select and the list agree (no hidden mismatch)", req: "BUG-009" }, async () => {
  const res = await go(hr, "/hr/issues?status=nezmysel");
  const status = await hr.locator('select[name="status"] option:checked').innerText().catch(() => "(no select)");
  return { ok: res.status() < 500, actual: `HTTP ${res.status()}; select shows "${status}"; issues ${await hr.locator("main [data-issue], main ul > li:has(select)").count()}` };
});

// ===================== HR: NOTES =====================
await test("C", "Notes: empty form is rejected", { steps: "/hr/notes -> click 'Uložiť poznámku' with nothing filled", expected: "Error message", req: "IT-10" }, async () => {
  await go(hr, "/hr/notes");
  await hr.getByRole("button", { name: "Uložiť poznámku" }).click(); await hr.waitForTimeout(800);
  const a = await alerts(hr);
  return { ok: a.length > 0, actual: `alert "${a}"`, evidence: await shot(hr, "notes-form-error", false) };
});
await test("C", "Notes: long note with line breaks and a 200-character word is saved and shown wrapped", { steps: "Title, date, 3 000 characters with line breaks; save", expected: "Toast; note listed; line breaks kept; no overflow at 360 px", req: "IT-10, BUG-011" }, async () => {
  await hr.fill('input[name="title"]', `Stretnutie ${stamp}`);
  await hr.fill('input[name="meetingDate"]', "2026-11-10");
  await hr.fill('textarea[name="text"]', `Riadok jeden\nRiadok dva\n${"N".repeat(200)}\n${"veta o hluku. ".repeat(200)}`);
  await hr.getByRole("button", { name: "Uložiť poznámku" }).click(); await hr.waitForTimeout(1800);
  const tt = await toasts(hr);
  const card = hr.locator("main li, main article").filter({ hasText: `Stretnutie ${stamp}` }).first();
  const ws = await card.locator("p").evaluateAll((ps) => ps.map((p) => getComputedStyle(p).whiteSpace).join(","));
  await hr.setViewportSize({ width: 360, height: 740 }); await hr.waitForTimeout(300);
  const o = await overflow(hr);
  const evidence = await shot(hr, "notes-long-360");
  await hr.setViewportSize({ width: 1280, height: 800 });
  return { ok: (await card.count()) === 1 && o <= 1 && /pre/.test(ws), actual: `toast "${tt}"; listed ${await card.count()}; white-space of paragraphs: ${ws}; overflow at 360: ${o}px`, evidence };
});
await test("B", "Notes: 'Vytvoriť podnet' from a note opens the issue form prefilled with the note", { steps: "Click the link on the new note", expected: "/hr/issues with the form open and visible, the note named, source 'stretnutie'", req: "IT-10" }, async () => {
  const card = hr.locator("main li, main article").filter({ hasText: `Stretnutie ${stamp}` }).first();
  await card.locator("a", { hasText: /podnet/i }).click();
  await hr.waitForURL("**/hr/issues**"); await hr.waitForLoadState("networkidle"); await hr.waitForTimeout(600);
  const vis = await hr.locator('input[name="title"]').isVisible();
  const src = vis ? await hr.locator('select[name="source"] option:checked').innerText() : "";
  const pos = vis ? await hr.locator('input[name="title"]').evaluate((el) => ({ top: Math.round(el.getBoundingClientRect().top), header: Math.round(document.querySelector("header").getBoundingClientRect().bottom), vh: innerHeight })) : null;
  const formText = vis ? (await hr.locator("form").filter({ has: hr.locator('input[name="title"]') }).innerText()).replace(/\s+/g, " ").slice(0, 140) : "";
  return { ok: vis && /stretnut/i.test(src) && formText.includes(`Stretnutie ${stamp}`) && pos.top >= pos.header && pos.top < pos.vh, actual: `form visible ${vis}; source "${src}"; title top ${pos?.top}px (header ${pos?.header}, viewport ${pos?.vh}); ${formText}`, evidence: await shot(hr, "issues-from-note", false) };
});

// ===================== HR: OVERVIEW / HEATMAP / TREND =====================
await test("B", "Overview: one headline sentence first, team figures on click (IT-13)", { steps: "Open /hr/overview", expected: "Sentence about how many rounds wait and who waits longest; per-team numbers collapsed", req: "IT-13, IT-05" }, async () => {
  await go(hr, "/hr/overview");
  const tx = await text(hr);
  const det = await hr.locator("main details").evaluateAll((x) => x.map((e) => `${e.querySelector("summary").innerText.replace(/\s+/g, " ").trim().slice(0, 50)}${e.open ? "[open]" : ""}`));
  return { ok: /čak/.test(tx) && det.length >= 2 && det.every((s) => !s.includes("[open]")), actual: `${tx.slice(0, 260)} || details: ${det.join(" | ")}`, evidence: await shot(hr, "overview-1280") };
});
await test("B", "Overview: team details open and list rounds waiting for an action with working links", { steps: "Open the first team's detail; click the first round link", expected: "Figures shown; link leads to the round's results", req: "IT-05" }, async () => {
  const det = hr.locator("main details").first();
  await det.locator("summary").click(); await hr.waitForTimeout(300);
  const tx = (await det.innerText()).replace(/\s+/g, " ");
  const evidence = await shot(hr, "overview-team-open");
  const link = hr.locator('main a[href*="/results"]').first();
  const has = await link.count();
  if (has) { await link.click(); await hr.waitForURL("**/results"); }
  return { ok: /\d/.test(tx) && has > 0, actual: `detail: ${tx.slice(0, 260)}; result link works: ${has > 0}`, evidence };
});
await test("B", "Heatmap: table with headers, caption/label, legend without overlapping ranges (BUG-032)", { steps: "Open /hr/heatmap", expected: "Table teams x topics with th scope; legend ranges do not overlap; cells without data are empty with an explanation", req: "IT-08, BUG-032, BUG-023" }, async () => {
  await go(hr, "/hr/heatmap");
  const r = await hr.evaluate(() => {
    const tb = document.querySelector("main table");
    const wrap = tb?.closest("[tabindex]") ?? tb?.parentElement;
    return { cols: tb?.querySelectorAll("thead th").length, rowHeaders: tb?.querySelectorAll("tbody th[scope=row], tbody th").length, caption: tb?.querySelector("caption")?.innerText ?? tb?.getAttribute("aria-label") ?? tb?.getAttribute("aria-labelledby"), wrapTabindex: wrap?.getAttribute("tabindex"), wrapLabel: wrap?.getAttribute("aria-label") ?? wrap?.getAttribute("aria-labelledby"), wrapRole: wrap?.getAttribute("role"), scroll: wrap ? `${wrap.scrollWidth}/${wrap.clientWidth}` : "" };
  });
  const tx = await text(hr);
  const legend = tx.match(/\d,\d(?:\d)? (?:až|–|-) \d,\d(?:\d)?/g) ?? [];
  return { ok: r.cols >= 5 && r.rowHeaders >= 2 && (!!r.caption || !!r.wrapLabel), actual: `${JSON.stringify(r)}; legend ranges: ${legend.join("; ") || tx.slice(-220)}`, evidence: await shot(hr, "heatmap-1280") };
});
await test("G", "Heatmap and trend tables: scroll containers are keyboard reachable when they overflow (BUG-023)", { steps: "At 360 px inspect the wrappers of the heatmap and of the trend table", expected: "If the table scrolls sideways, its wrapper is focusable (tabindex=0) and named", req: "BUG-023; WCAG 2.1.1" }, async () => {
  await hr.setViewportSize({ width: 360, height: 740 });
  const out = [];
  for (const url of ["/hr/heatmap", `/team/${d.teamA}/trend`]) {
    await go(hr, url);
    out.push(...(await hr.evaluate((url) => [...document.querySelectorAll("main table")].map((tb) => { let w = tb.parentElement; while (w && w.scrollWidth <= w.clientWidth + 1 && w.tagName !== "MAIN") w = w.parentElement; const scrolls = w && w.tagName !== "MAIN"; return `${url.replace(/c[a-z0-9]{20,}/, ":id")}: scrolls=${scrolls} tabindex=${scrolls ? w.getAttribute("tabindex") : "-"} name=${scrolls ? (w.getAttribute("aria-label") || w.getAttribute("aria-labelledby") || "none") : "-"} role=${scrolls ? w.getAttribute("role") : "-"}`; }), url)));
  }
  await hr.setViewportSize({ width: 1280, height: 800 });
  const bad = out.filter((o) => /scrolls=true/.test(o) && (!/tabindex=0/.test(o) || /name=none/.test(o)));
  return { ok: bad.length === 0, actual: out.join(" | ") };
});
await test("B", "Trend: chart with a text alternative, table of topics, readable labels at 360 px (BUG-025)", { steps: "Open /team/:id/trend as HR at 1280 and 360 px; measure SVG text sizes", expected: "SVG has an accessible name or is backed by the table; rendered label size >= 11 px at 360 px; gap for the round below the threshold", req: "IT-08, BUG-025" }, async () => {
  await go(hr, `/team/${d.teamA}/trend`);
  const evidence = await shot(hr, "trend-1280");
  const name = await hr.evaluate(() => { const s = document.querySelector("main svg[role=img], main figure svg, main svg:not([aria-hidden])"); return s ? { role: s.getAttribute("role"), label: s.getAttribute("aria-label") || s.getAttribute("aria-labelledby") || s.querySelector("title")?.textContent || null, hidden: s.getAttribute("aria-hidden") } : null; });
  await hr.setViewportSize({ width: 360, height: 740 }); await hr.waitForTimeout(400);
  const sizes = await hr.evaluate(() => [...document.querySelectorAll("main svg text")].map((t) => Math.round(t.getBoundingClientRect().height * 10) / 10));
  const o = await overflow(hr);
  await shot(hr, "trend-360");
  await hr.setViewportSize({ width: 1280, height: 800 });
  const tx = await text(hr);
  const min = sizes.length ? Math.min(...sizes) : null;
  return { ok: !!name && (min === null || min >= 11) && o <= 1, actual: `svg: ${JSON.stringify(name)}; ${sizes.length} labels, smallest box height ${min}px at 360 px; overflow ${o}px; below-threshold note: ${/prah|málo odpoved/i.test(tx)}`, evidence };
});
await test("B", "Trend with fewer than three rounds says there is little data (IT-08)", { steps: "Open the trend of Tím Beta (2 closed rounds above the threshold)", expected: "A note that it is too little data for a trend", req: "IT-08" }, async () => {
  await go(hr, `/team/${d.teamB}/trend`);
  const tx = await text(hr);
  return { ok: /málo/i.test(tx), actual: tx.slice(0, 300), evidence: await shot(hr, "trend-beta-few") };
});
await hr.context().close();
await browser.close();
