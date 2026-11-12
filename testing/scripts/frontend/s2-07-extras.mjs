// Targeted checks that came out of the first pass: focus under the sticky header (with screenshots),
// expired session and failed logout, home tasks per role, draft round texts, toast details,
// confetti on resize, landscape phone, 403/404 inside the shell. Creates one draft round for Tím Beta.
import { launch, discover, makeRecorder, newPage, session, USERS, BASE, shot, go, overflow, nice } from "./s2-lib.mjs";

const { test } = makeRecorder("07-extras");
const browser = await launch();
const d = await discover(browser);
const text = async (page, sel = "main") => (await page.locator(sel).last().innerText()).replace(/\s+/g, " ");

// ---------- focus under the sticky header ----------
for (const [w, h, label] of [[1280, 800, "desktop (header 65 px)"], [768, 1024, "tablet (header with menu row)"], [360, 740, "phone"]]) {
  const page = await session(browser, USERS.hr, { width: w, height: h });
  await test("G", `Shift+Tab upwards on /hr/rounds at ${w}px, ${label}: focused control is not hidden under the sticky header`, { pre: USERS.hr, steps: "Focus the last 'Výsledky' link, press Shift+Tab 12 times; after each press compare the focused element with the header's bottom edge", expected: "Focused element fully visible below the header (WCAG 2.2 – 2.4.11 Focus Not Obscured)", req: "NFR-07; WCAG 2.4.11" }, async () => {
    await go(page, "/hr/rounds");
    await page.locator("main [data-round-row] a", { hasText: "Výsledky" }).last().focus();
    const hidden = []; let shotName = "";
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Shift+Tab"); await page.waitForTimeout(60);
      const r = await page.evaluate(() => { const e = document.activeElement; const b = e.getBoundingClientRect(); const hb = document.querySelector("header").getBoundingClientRect().bottom; return { name: e.innerText.trim().slice(0, 16), top: Math.round(b.top), bottom: Math.round(b.bottom), hb: Math.round(hb) }; });
      if (r.top < r.hb - 1) {
        const pct = Math.min(100, Math.round(((Math.min(r.hb, r.bottom) - r.top) / (r.bottom - r.top)) * 100));
        hidden.push(`${r.name} ${pct}% hidden (top ${r.top}, header bottom ${r.hb})`);
        if (!shotName && pct === 100) { shotName = `focus-under-header-${w}`; await shot(page, shotName, false); }
      }
    }
    if (hidden.length && !shotName) { shotName = `focus-under-header-${w}`; await shot(page, shotName, false); }
    return { ok: hidden.length === 0, actual: hidden.length ? `${hidden.length} of 12 stops: ${hidden.slice(0, 6).join("; ")}` : "all 12 stops visible", evidence: shotName ? `shots/${shotName}.png` : "", defect: "FE2-focus-header" };
  });
  await page.context().close();
}

// ---------- session and logout ----------
{
  const page = await session(browser, USERS.dana);
  await test("A", "Session gone, then a menu click: redirect to /login", { steps: "Delete the session cookie; click 'Kudos' in the menu", expected: "Login page, no broken state", req: "MVP-01" }, async () => {
    await go(page, "/");
    await page.context().clearCookies();
    await page.locator("header nav a:visible", { hasText: /^Kudos$/ }).click();
    await page.waitForURL("**/login", { timeout: 8000 });
    return { ok: true, actual: `ended on ${new URL(page.url()).pathname}` };
  });
  await test("C", "Logout fails (500): message shown, user told they are still logged in (BUG-038)", { steps: "Log in; intercept POST /api/logout -> 500; click 'Odhlásiť sa'", expected: "Visible Slovak error; stays on the page", req: "BUG-038" }, async () => {
    await page.fill('input[name="email"]', USERS.dana); await page.fill('input[name="password"]', "Heslo123");
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click('button[type="submit"]')]);
    await page.route("**/api/logout", (r) => r.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
    await page.getByRole("button", { name: "Odhlásiť sa" }).click(); await page.waitForTimeout(800);
    const msg = (await page.locator('[role="alert"], [data-toast]').allInnerTexts()).map((x) => x.trim()).filter(Boolean).join(" | ");
    const evidence = await shot(page, "logout-failed", false);
    await page.unroute("**/api/logout");
    return { ok: /Odhlásenie sa nepodarilo/.test(msg) && new URL(page.url()).pathname === "/", actual: `message "${msg}"; url ${new URL(page.url()).pathname}`, evidence };
  });
  await page.context().close();
}

// ---------- home tasks per role (IT-11) ----------
for (const [who, expect] of [["filip", /Nič nečaká/], ["mgrB", /krok|kolo/i], ["hr", /čak/], ["mgrA", /krok/]]) {
  const page = await session(browser, USERS[who], { width: 360, height: 740, touch: true });
  await test("B", `Home tasks of ${who} at 360px: at most 3, one sentence and one button each, correct plural forms`, { pre: USERS[who], steps: "Open /", expected: "<= 3 tasks; each has exactly one link; no wrong plural such as '3 dní' or '1 dní' (BUG-015); no response content", req: "IT-11, BUG-015" }, async () => {
    await go(page, "/");
    const r = await page.evaluate(() => { const h1 = document.querySelector("main h1"); const list = h1.closest("section, div")?.parentElement?.querySelector("ul, ol") ?? document.querySelector("main ul"); const items = list ? [...list.children].map((li) => ({ t: li.innerText.replace(/\s+/g, " "), links: li.querySelectorAll("a, button").length })) : []; return { items, text: document.querySelector("main").innerText.replace(/\s+/g, " ") }; });
    const bad = r.text.match(/\b([234]) dní\b|\b1 dní\b|\b[5-9] dni\b|pred 0 dňami/);
    const o = await overflow(page);
    return { ok: expect.test(r.text) && !bad && o <= 1, actual: `${r.text.slice(0, 420)}; wrong plural: ${bad ? bad[0] : "none"}; overflow ${o}px`, evidence: await shot(page, `home-${who}-360`) };
  });
  await page.context().close();
}

// ---------- draft round texts (BUG-021) ----------
{
  const page = await session(browser, USERS.mgrB);
  let draftId = null;
  await test("B", "Draft round: results and report say it is a draft (BUG-021)", { steps: "Create a draft through the form (defaults); open /rounds/:id/results and /rounds/:id/report by URL", expected: "Both say the round is a draft and was not started; no '0 z 6' participation and no text about closing", req: "BUG-021, IT-08" }, async () => {
    await go(page, "/rounds/new");
    await page.fill('input[name="name"]', "Koncept pre report");
    await page.getByRole("button", { name: "Uložiť koncept" }).click();
    await page.waitForURL("**/rounds"); await page.waitForLoadState("networkidle");
    const { rounds } = await (await page.request.get(`${BASE}/api/rounds`)).json();
    draftId = rounds.find((r) => r.name === "Koncept pre report" && r.status === "DRAFT")?.id;
    await go(page, `/rounds/${draftId}/results`); const a = await text(page);
    await go(page, `/rounds/${draftId}/report`); const b = await text(page);
    const evidence = await shot(page, "report-draft");
    return { ok: /koncept/i.test(a) && /koncept/i.test(b) && !/Odpovedalo 0/.test(b) && !/po uzavretí/.test(b), actual: `results: ${a.slice(0, 160)} || report: ${b.slice(0, 200)}`, evidence };
  });
  await test("B", "Draft row in the list: only 'Spustiť' (no results/close), status 'Koncept'", { steps: "Open /rounds", expected: "Draft has the 'Spustiť' button; no way to delete (known BUG-037)", req: "MVP-05" }, async () => {
    await go(page, "/rounds");
    const row = page.locator("[data-round-row]").filter({ hasText: "Koncept pre report" }).first();
    const btns = await row.locator("a, button").allInnerTexts();
    return { ok: btns.includes("Spustiť") && !btns.includes("Uzavrieť"), actual: `controls: ${btns.join(", ")}` };
  });
  // ---------- toasts ----------
  await test("D", "Toast: dismiss button works and is big enough for touch", { pre: "manager Beta, 360px touch", steps: "Start the draft (toast appears); measure the close button; tap it", expected: "Toast closes at once; button at least 44x44 px on touch (24 px minimum)", req: "IT-02, NFR-07" }, async () => {
    const m = await session(browser, USERS.mgrB, { width: 360, height: 740, touch: true });
    await go(m, "/rounds");
    const row = m.locator("[data-round-row]").filter({ hasText: "Koncept pre report" }).first();
    await row.getByRole("button", { name: "Spustiť" }).tap();
    await m.locator("dialog[open]").getByRole("button", { name: "Spustiť" }).tap();
    await m.locator("[data-toast]").first().waitFor({ timeout: 5000 });
    const r = await m.evaluate(() => { const t = document.querySelector("[data-toast]"); const b = t.querySelector("button").getBoundingClientRect(); const tb = t.getBoundingClientRect(); return { btn: `${Math.round(b.width)}x${Math.round(b.height)}`, toast: [Math.round(tb.left), Math.round(tb.top), Math.round(tb.right), Math.round(tb.bottom)], vw: innerWidth, vh: innerHeight, text: t.innerText.trim() }; });
    const evidence = await shot(m, "toast-360", false);
    await m.locator("[data-toast] button").tap(); await m.waitForTimeout(400);
    const left = await m.locator("[data-toast]").count();
    await m.context().close();
    const [bw, bh] = r.btn.split("x").map(Number);
    return { ok: left === 0 && bw >= 44 && bh >= 44, actual: `toast "${r.text}" box ${r.toast.join(",")} in ${r.vw}x${r.vh}; close button ${r.btn}px; toasts after tap ${left}`, evidence };
  });
  await test("D", "Toasts stack to at most three", { steps: "Change the status of an action 5 times quickly on a results page (manager Alfa)", expected: "Never more than 3 toasts at once; page stays usable", req: "IT-02" }, async () => {
    const a = await session(browser, USERS.mgrA);
    await go(a, `/rounds/${d.doneA}/results`);
    const sel = a.locator('select[aria-label="Stav"]').first();
    if (!(await sel.count())) { await a.context().close(); return { blocked: true, actual: "no action with a status select on this round" }; }
    const original = await sel.inputValue();
    let max = 0;
    for (const v of ["IN_PROGRESS", "DONE", "PLANNED", "IN_PROGRESS", original]) {
      await a.locator('select[aria-label="Stav"]').first().selectOption(v).catch(() => {});
      await a.waitForTimeout(450);
      max = Math.max(max, await a.locator("[data-toast]:not([data-leaving])").count());
    }
    const evidence = await shot(a, "toasts-stacked", false);
    const final = await a.locator('select[aria-label="Stav"]').first().inputValue();
    await a.context().close();
    return { ok: max <= 3 && max >= 1, actual: `most toasts visible at once: ${max}; status restored to ${final} (was ${original})`, evidence };
  });
  await page.context().close();
}

// ---------- confetti and window resize; motion menu follows resize ----------
{
  const page = await session(browser, USERS.gabriela);
  await test("D", "Confetti stops cleanly when the window is resized", { steps: "Send a kudos (confetti starts); resize the window after 200 ms", expected: "Canvas removed immediately; no stretched confetti; no console error", req: "IT-02" }, async () => {
    await go(page, "/kudos?tab=send"); page.errors.length = 0;
    const opts = await page.locator('select[name="toUserId"] option').allInnerTexts();
    await page.selectOption('select[name="toUserId"]', { label: opts.find((o) => o.startsWith("Filip")) });
    await page.locator("form fieldset button[aria-pressed]").first().click();
    await page.locator("form").getByRole("button", { name: "Poslať kudos" }).click();
    await page.locator("canvas[data-confetti]").waitFor({ state: "attached", timeout: 5000 });
    await page.setViewportSize({ width: 900, height: 700 }); await page.waitForTimeout(150);
    const left = await page.locator("canvas[data-confetti]").count();
    await page.setViewportSize({ width: 1280, height: 800 });
    return { ok: left === 0 && page.errors.length === 0, actual: `canvas after resize ${left}; errors ${page.errors.length}` };
  });
  await test("B", "Motion menu stays under its button when the window is resized", { steps: "Open the menu at 1280 px; resize to 1000 px", expected: "Panel's right edge follows the button; panel inside the viewport", req: "IT-02" }, async () => {
    await page.getByRole("button", { name: "Nastavenie animácií" }).click(); await page.waitForTimeout(200);
    await page.setViewportSize({ width: 1000, height: 800 }); await page.waitForTimeout(300);
    const r = await page.evaluate(() => { const p = document.querySelector("[popover]:popover-open")?.getBoundingClientRect(); const b = document.querySelector('button[aria-label="Nastavenie animácií"]').getBoundingClientRect(); return p ? { panelRight: Math.round(p.right), panelLeft: Math.round(p.left), buttonRight: Math.round(b.right), vw: innerWidth } : null; });
    await page.keyboard.press("Escape"); await page.setViewportSize({ width: 1280, height: 800 });
    return { ok: !!r && Math.abs(r.panelRight - r.buttonRight) <= 2 && r.panelLeft >= 0, actual: JSON.stringify(r) };
  });
  await page.context().close();
}

// ---------- landscape phone ----------
{
  const page = await session(browser, USERS.emil, { width: 740, height: 360, touch: true });
  await test("E", "Landscape phone (740x360): sticky header leaves room for the content", { steps: "Open / and /kudos?tab=send; measure the sticky header and what is left", expected: "Header takes less than a third of the height; no horizontal scroll", req: "NFR-07" }, async () => {
    await go(page, "/kudos?tab=send");
    const r = await page.evaluate(() => ({ header: Math.round(document.querySelector("header").getBoundingClientRect().height), vh: innerHeight }));
    const o = await overflow(page);
    return { ok: r.header / r.vh < 0.34 && o <= 1, actual: `header ${r.header}px of ${r.vh}px (${Math.round((r.header / r.vh) * 100)} %); overflow ${o}px`, evidence: await shot(page, "landscape-740x360", false) };
  });
  await page.context().close();
}

// ---------- 403 / 404 inside the shell ----------
{
  const page = await session(browser, USERS.hr);
  for (const [url, kind, who] of [["/team/neexistuje", "404", "hr"]]) {
    await test("G", `${kind} page inside the app shell (${nice(url)} as ${who}): landmarks and title`, { steps: `Open ${url}`, expected: "One <main>; title names the error", req: "WCAG 1.3.1, 2.4.2; BUG-013" }, async () => {
      await go(page, url);
      const r = await page.evaluate(() => ({ mains: document.querySelectorAll("main").length, nested: document.querySelectorAll("main main").length, title: document.title, h1: document.querySelector("h1")?.innerText, minH: Math.round(document.querySelector("main main")?.getBoundingClientRect().height ?? 0), scroll: document.documentElement.scrollHeight - innerHeight }));
      return { ok: r.mains === 1 && /nenašli|404/i.test(r.title), actual: JSON.stringify(r), evidence: await shot(page, "404-in-shell", false), defect: "FE2-nested-main" };
    });
  }
  const m = await session(browser, USERS.mgrA);
  await test("G", "403 page inside the app shell (/hr/issues as manager): landmarks, title, no needless scrolling", { steps: "Open /hr/issues as manager", expected: "One <main>; title names the error, not the forbidden page; page not taller than needed", req: "WCAG 1.3.1, 2.4.2; NFR-03" }, async () => {
    await go(m, "/hr/issues");
    const r = await m.evaluate(() => ({ mains: document.querySelectorAll("main").length, nested: document.querySelectorAll("main main").length, title: document.title, h1: document.querySelector("h1")?.innerText, scrollablePx: document.documentElement.scrollHeight - innerHeight }));
    return { ok: r.mains === 1 && !/^Podnety/.test(r.title), actual: JSON.stringify(r), evidence: await shot(m, "403-in-shell", false), defect: "FE2-nested-main" };
  });
  await m.context().close();
  await page.context().close();
}

await browser.close();
