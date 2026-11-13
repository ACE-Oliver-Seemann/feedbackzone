// Sections C/D: login form and the questionnaire (MVP-06..MVP-09, IT-02), including confetti, motion
// preference, failure modes through request interception, double submit, keyboard-only use.
// CHANGES DATA (submits responses of the Alfa team). Run on fresh seed + demo data.
import { launch, discover, makeRecorder, newPage, login, session, USERS, BASE, PASSWORD, shot, go, overflow, api } from "./s2-lib.mjs";

const { test } = makeRecorder("03-login-fill");
const browser = await launch();
const d = await discover(browser);
const FILL = `/rounds/${d.openA}/fill`;
const RESP = `**/api/rounds/${d.openA}/responses`;

// ===================== LOGIN =====================
{
  const page = await newPage(browser);
  const open = async () => { await go(page, "/login"); };
  const submit = async (email, password) => {
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
  };
  const alertText = async () => (await page.locator('form [role="alert"]').allInnerTexts()).map((x) => x.trim()).filter(Boolean).join(" | ");

  await test("C", "Login page: fields have labels, types and autocomplete", { steps: "Open /login, inspect the form", expected: "E-mail and Heslo labelled; password masked; autocomplete set; one h1; title set", req: "MVP-01, NFR-07" }, async () => {
    await open();
    const r = await page.evaluate(() => {
      const e = document.querySelector('input[name="email"]'), p = document.querySelector('input[name="password"]');
      return { eLabel: e.labels?.[0]?.innerText.trim(), pLabel: p.labels?.[0]?.innerText.trim(), eType: e.type, pType: p.type, eAuto: e.autocomplete, pAuto: p.autocomplete, h1: [...document.querySelectorAll("h1")].map((h) => h.innerText), title: document.title, lang: document.documentElement.lang, focused: document.activeElement?.getAttribute("name") };
    });
    return { ok: r.eLabel === "E-mail" && r.pLabel === "Heslo" && r.pType === "password" && r.h1.length === 1 && r.lang === "sk", actual: JSON.stringify(r), evidence: await shot(page, "login-1280") };
  });
  await test("C", "Login: wrong password shows one generic Slovak message", { steps: "adam.alfa@example.test + wrong password", expected: '"Nesprávny e-mail alebo heslo." as role=alert; stays on /login; e-mail kept', req: "MVP-01" }, async () => {
    await open(); await submit(USERS.adam, "zleHeslo1");
    await page.locator('form [role="alert"]').first().waitFor();
    const kept = await page.inputValue('input[name="email"]');
    const focus = await page.evaluate(() => document.activeElement?.tagName + ":" + (document.activeElement?.getAttribute("name") ?? document.activeElement?.textContent?.trim().slice(0, 20)));
    return { ok: (await alertText()) === "Nesprávny e-mail alebo heslo." && kept === USERS.adam, actual: `alert "${await alertText()}"; e-mail kept "${kept}"; focus after error: ${focus}`, evidence: await shot(page, "login-wrong-password") };
  });
  await test("C", "Login: unknown account gets the same message as a wrong password", { steps: "nikto@example.test + Heslo123", expected: "Same generic message (no account enumeration)", req: "MVP-01" }, async () => {
    await open(); await submit("nikto@example.test", PASSWORD);
    await page.locator('form [role="alert"]').first().waitFor();
    return { ok: (await alertText()) === "Nesprávny e-mail alebo heslo.", actual: `alert "${await alertText()}"` };
  });
  await test("C", "Login: empty form is not sent", { steps: "Click 'Prihlásiť sa' with empty fields", expected: "No request; the browser marks the required field", req: "MVP-01" }, async () => {
    await open();
    let sent = 0; const h = (r) => { if (r.url().includes("/api/login")) sent++; }; page.on("request", h);
    await page.click('button[type="submit"]'); await page.waitForTimeout(400); page.off("request", h);
    const invalid = await page.evaluate(() => document.querySelector('input[name="email"]').matches(":invalid"));
    return { ok: sent === 0 && invalid, actual: `requests sent ${sent}; e-mail :invalid ${invalid}` };
  });
  await test("C", "Login: e-mail without @ is not sent", { steps: "Type 'adam' + password, submit", expected: "No request; field invalid", req: "MVP-01" }, async () => {
    await open();
    let sent = 0; const h = (r) => { if (r.url().includes("/api/login")) sent++; }; page.on("request", h);
    await submit("adam", PASSWORD); await page.waitForTimeout(400); page.off("request", h);
    return { ok: sent === 0, actual: `requests sent ${sent}` };
  });
  await test("C", "Login: password only (e-mail empty) is not sent", { steps: "Fill only the password", expected: "No request", req: "MVP-01" }, async () => {
    await open();
    let sent = 0; const h = (r) => { if (r.url().includes("/api/login")) sent++; }; page.on("request", h);
    await page.fill('input[name="password"]', PASSWORD); await page.click('button[type="submit"]'); await page.waitForTimeout(400); page.off("request", h);
    return { ok: sent === 0, actual: `requests sent ${sent}` };
  });
  await test("C", "Login: upper-case e-mail and surrounding spaces", { steps: "'  ADAM.ALFA@EXAMPLE.TEST ' + Heslo123", expected: "Either logs in or shows the generic message; no crash", req: "MVP-01" }, async () => {
    await open(); await submit("  ADAM.ALFA@EXAMPLE.TEST ", PASSWORD);
    await page.waitForTimeout(1500);
    const path = new URL(page.url()).pathname;
    const out = path === "/" ? "logged in" : `stayed on /login, alert "${await alertText()}"`;
    if (path === "/") { await page.context().clearCookies(); }
    return { ok: path === "/" || (await alertText()).length > 0, actual: out };
  });
  await test("C", "Login: special characters and markup in both fields", { steps: `e-mail "<b>x</b>'--@example.test", password "' OR 1=1 --<script>"`, expected: "Generic message, nothing rendered as HTML, no console error", req: "MVP-01" }, async () => {
    await open(); page.errors.length = 0;
    await submit(`"<b>x</b>'--"@example.test`, `' OR 1=1 --<script>alert(1)</script>`);
    await page.waitForTimeout(1200);
    const injected = await page.locator("main b, form b, script:not([src]):text('alert(1)')").count();
    const a = await alertText();
    const sent = a.length > 0;
    return { ok: injected === 0 && new URL(page.url()).pathname === "/login", actual: `alert "${a}" (empty = blocked by the browser's e-mail validation); injected nodes ${injected}; errors ${page.errors.filter((e) => !/401/.test(e)).length}; request sent ${sent}` };
  });
  await test("C", "Login: 300-character e-mail does not break the layout at 360px", { steps: "At 360px type a 300-character address and a wrong password", expected: "No horizontal page scroll; message shown", req: "NFR-07" }, async () => {
    await page.setViewportSize({ width: 360, height: 740 });
    await open(); await submit("a".repeat(288) + "@example.test", "x");
    await page.waitForTimeout(1200);
    const o = await overflow(page);
    const evidence = await shot(page, "login-long-email-360");
    await page.setViewportSize({ width: 1280, height: 800 });
    return { ok: o <= 1, actual: `overflow ${o}px; alert "${await alertText()}"`, evidence };
  });
  await test("C", "Login: server error (500) shows the generic error", { steps: "Intercept POST /api/login -> 500; submit valid data", expected: '"Niečo sa nepodarilo. Skús to znova."; button usable again', req: "MVP-01" }, async () => {
    await open();
    await page.route("**/api/login", (r) => r.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
    await submit(USERS.adam, PASSWORD);
    await page.locator('form [role="alert"]').first().waitFor();
    const a = await alertText();
    const disabled = await page.locator('button[type="submit"]').isDisabled();
    await page.unroute("**/api/login");
    return { ok: a === "Niečo sa nepodarilo. Skús to znova." && !disabled, actual: `alert "${a}"; button disabled ${disabled}` };
  });
  await test("C", "Login: network failure shows the generic error", { steps: "Abort POST /api/login; submit", expected: "Generic error, form usable", req: "MVP-01" }, async () => {
    await open();
    await page.route("**/api/login", (r) => r.abort());
    await submit(USERS.adam, PASSWORD);
    await page.locator('form [role="alert"]').first().waitFor();
    const a = await alertText();
    await page.unroute("**/api/login");
    return { ok: a === "Niečo sa nepodarilo. Skús to znova.", actual: `alert "${a}"` };
  });
  await test("C", "Login: non-JSON 200 response (broken proxy) does not freeze the form", { steps: "Intercept POST /api/login -> 200 text/html; submit", expected: "An error message; the button becomes usable again", req: "MVP-01" }, async () => {
    await open();
    await page.route("**/api/login", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<html>gateway</html>" }));
    await submit(USERS.adam, PASSWORD);
    await page.waitForTimeout(1500);
    const a = await alertText();
    const disabled = await page.locator('button[type="submit"]').isDisabled();
    await page.unroute("**/api/login");
    return { ok: a.length > 0 && !disabled, actual: `alert "${a}"; button disabled ${disabled}; url ${new URL(page.url()).pathname}` };
  });
  await test("C", "Login: pending state while the request runs", { steps: "Delay POST /api/login by 1.5 s; submit; inspect the button after 400 ms", expected: "Button disabled, text 'Prihlasujem…', aria-busy, spinner", req: "MVP-01, IT-02" }, async () => {
    await open();
    await page.route("**/api/login", async (r) => { await new Promise((x) => setTimeout(x, 1500)); await r.continue().catch(() => {}); });
    await page.fill('input[name="email"]', USERS.adam); await page.fill('input[name="password"]', "zle");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(400);
    const b = await page.locator('button[type="submit"]').evaluate((x) => ({ text: x.innerText.trim(), disabled: x.disabled, busy: x.getAttribute("aria-busy"), spinner: !!x.querySelector(".animate-spin") }));
    const evidence = await shot(page, "login-pending", false);
    await page.locator('form [role="alert"]').first().waitFor({ timeout: 6000 });
    await page.unroute("**/api/login");
    return { ok: b.disabled && b.text === "Prihlasujem…" && b.busy === "true" && b.spinner, actual: JSON.stringify(b), evidence };
  });
  await test("C", "Login: double click on submit sends one request", { steps: "Double-click 'Prihlásiť sa' with valid data", expected: "One login request; lands on /", req: "MVP-01" }, async () => {
    await open();
    let sent = 0; const h = (r) => { if (r.url().includes("/api/login") && r.method() === "POST") sent++; }; page.on("request", h);
    await page.fill('input[name="email"]', USERS.adam); await page.fill('input[name="password"]', PASSWORD);
    await page.locator('button[type="submit"]').dblclick();
    await page.waitForURL(`${BASE}/`); page.off("request", h);
    return { ok: sent === 1, actual: `login requests ${sent}; ended on /` };
  });
  await test("C", "Login: Enter in the password field submits", { steps: "Log out; type credentials; press Enter", expected: "Lands on the home page", req: "MVP-01" }, async () => {
    await page.context().clearCookies(); await open();
    await page.fill('input[name="email"]', USERS.adam); await page.fill('input[name="password"]', PASSWORD);
    await page.press('input[name="password"]', "Enter");
    await page.waitForURL(`${BASE}/`);
    return { ok: true, actual: "landed on /" };
  });
  for (const [who, expectedH1] of [["hr", "Čo treba urobiť teraz"], ["mgrA", "Čo treba urobiť teraz"], ["adam", "Čo treba urobiť teraz"]]) {
    await test("C", `Login as ${who} lands on / with the task list`, { steps: `Log in as ${USERS[who]}`, expected: `Home page "${expectedH1}" with at most 3 tasks or "Nič nečaká"`, req: "IT-11, MVP-01" }, async () => {
      await page.context().clearCookies(); await login(page, USERS[who]);
      const h = await page.locator("main h1").first().innerText();
      const tasks = await page.locator("main h1 + * a, main section:first-of-type li").count();
      const text = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 260);
      return { ok: h === expectedH1 && new URL(page.url()).pathname === "/", actual: `h1 "${h}"; text: ${text}`, evidence: await shot(page, `home-${who}-1280`) };
    });
  }
  await page.context().close();
}

// ===================== QUESTIONNAIRE =====================
const start = async (page) => { await go(page, FILL); await page.getByRole("button", { name: "Začať" }).click(); await page.locator("main fieldset legend").waitFor(); };
const scaleBtns = (page) => page.locator("main fieldset button[aria-pressed]");
const nextBtn = (page) => page.getByRole("button", { name: "Ďalej" });
const backBtn = (page) => page.getByRole("button", { name: "Späť" });
const answerAll = async (page, pick = 3) => {
  let n = 0;
  while (await nextBtn(page).count()) {
    await scaleBtns(page).nth(pick).click();
    await nextBtn(page).click();
    await page.waitForTimeout(120);
    if (++n > 6) break;
  }
  return n;
};
const confettiCount = (page) => page.locator("canvas[data-confetti]").count();
const participation = async (page) => (await api(page, `/api/rounds`)).rounds.find((r) => r.id === d.openA)?.participation;

// ---------- adam: happy path on a 360 px touch device, default motion ----------
{
  const page = await session(browser, USERS.adam, { width: 360, height: 740, touch: true });
  await test("C", "Employee home: open round is offered with one button", { pre: "adam, 360px touch", steps: "Open /", expected: "Task with the round name and a 'Vyplniť' link to the questionnaire; 'Moje prieskumy' lists it as waiting", req: "IT-11, MVP-06" }, async () => {
    await go(page, "/");
    const link = page.locator("main a", { hasText: "Vyplniť" });
    const href = await link.first().getAttribute("href");
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    return { ok: href === FILL && /Čaká na vyplnenie/.test(text), actual: `links ${await link.count()}, href ok ${href === FILL}; text: ${text.slice(0, 220)}`, evidence: await shot(page, "home-adam-360") };
  });
  await test("C", "Questionnaire intro: confidentiality text, never 'anonym'", { steps: "Click 'Vyplniť'", expected: "Intro with the confidentiality notice using 'dôvern…' and a 'Začať' button", req: "MVP-07, NFR-04" }, async () => {
    await page.locator("main a", { hasText: "Vyplniť" }).first().click();
    await page.waitForURL(`**${FILL}`);
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    return { ok: /dôvern/i.test(text) && !/anonym/i.test(text) && (await page.getByRole("button", { name: "Začať" }).count()) === 1, actual: text.slice(0, 300), evidence: await shot(page, "fill-intro-360") };
  });
  await test("C", "Question 1: 'Ďalej' is disabled until an answer is chosen", { steps: "Click 'Začať'", expected: "Question text, five options, progress '1 z N', 'Ďalej' disabled", req: "MVP-08" }, async () => {
    await page.getByRole("button", { name: "Začať" }).click();
    await page.locator("main fieldset legend").waitFor();
    const n = await scaleBtns(page).count();
    const dis = await nextBtn(page).isDisabled();
    const prog = (await page.locator("main p[aria-live]").first().innerText()).trim();
    return { ok: n === 5 && dis && /1 z \d/.test(prog), actual: `options ${n}; next disabled ${dis}; progress "${prog.replace(/\s+/g, " ")}"`, evidence: await shot(page, "fill-q1-360") };
  });
  await test("D", "Focus moves into the question panel after 'Začať' (BUG-016)", { steps: "Read document.activeElement after the step change", expected: "Focus is on the questionnaire panel (not <body>)", req: "BUG-016" }, async () => {
    const f = await page.evaluate(() => ({ tag: document.activeElement.tagName, inMain: !!document.activeElement.closest("main"), tabindex: document.activeElement.getAttribute("tabindex") }));
    return { ok: f.tag !== "BODY" && f.inMain, actual: JSON.stringify(f) };
  });
  await test("E", "Scale buttons are large enough on a 360 px touch screen", { steps: "Measure the five answer buttons and Späť/Ďalej", expected: ">= 44 px in both directions", req: "NFR-07" }, async () => {
    const sizes = await page.locator("main button").evaluateAll((els) => els.map((b) => { const r = b.getBoundingClientRect(); return `${(b.getAttribute("aria-label") || b.innerText).trim().slice(0, 14)}:${Math.round(r.width)}x${Math.round(r.height)}`; }));
    const bad = sizes.filter((s) => { const [w, h] = s.split(":").pop().split("x").map(Number); return w < 44 || h < 44; });
    return { ok: bad.length === 0, actual: sizes.join(" | ") };
  });
  await test("C", "Choosing an answer marks it (aria-pressed) and shows its meaning", { steps: "Tap option 4, then option 2", expected: "Exactly one option pressed; the label of the chosen value is shown; 'Ďalej' enabled", req: "MVP-08, IT-03" }, async () => {
    await scaleBtns(page).nth(3).click(); await scaleBtns(page).nth(1).click();
    await page.waitForTimeout(300);
    const pressed = await scaleBtns(page).evaluateAll((b) => b.map((x) => x.getAttribute("aria-pressed")).join(","));
    const meaning = await page.locator("main fieldset p[aria-live]").innerText().catch(() => "(list scale)");
    return { ok: pressed === "false,true,false,false,false" && !(await nextBtn(page).isDisabled()), actual: `pressed: ${pressed}; meaning "${meaning}"`, evidence: await shot(page, "fill-q1-answered-360") };
  });
  await test("D", "Question transition is animated in the direction of movement (IT-02)", { steps: "Click 'Ďalej', read the running animation of the new question; click 'Späť', read it again", expected: "Forward and back use mirrored animations (new question arrives from the side it moves to)", req: "IT-02" }, async () => {
    const read = () => page.evaluate(() => {
      const fs = document.querySelector("main fieldset");
      const a = fs.getAnimations().map((x) => ({ name: x.animationName, dur: x.effect.getTiming().duration, kf: x.effect.getKeyframes().map((k) => k.transform ?? k.translate ?? "") }));
      return a;
    });
    await nextBtn(page).click();
    const fwd = await read();
    await page.waitForTimeout(400);
    await backBtn(page).click();
    const back = await read();
    await page.waitForTimeout(400);
    const same = JSON.stringify(fwd) === JSON.stringify(back);
    return { ok: fwd.length > 0 && !same, actual: `forward: ${JSON.stringify(fwd)}; back: ${JSON.stringify(back)}; identical: ${same}`, defect: "FE2-directional" };
  });
  await test("C", "'Späť' keeps the previous answer", { steps: "After going back to question 1", expected: "Option 2 still pressed", req: "MVP-08" }, async () => {
    const pressed = await scaleBtns(page).evaluateAll((b) => b.map((x) => x.getAttribute("aria-pressed")).join(","));
    return { ok: pressed === "false,true,false,false,false", actual: `pressed: ${pressed}` };
  });
  await test("C", "Walk through all questions; progress and question text change each step", { steps: "Answer and continue until the comment step", expected: "3 to 5 questions, each with a different text; progress i z N", req: "MVP-04, MVP-08" }, async () => {
    const seen = [];
    let guard = 0;
    while (await nextBtn(page).count()) {
      seen.push(`${(await page.locator("main p[aria-live]").first().innerText()).replace(/\s+/g, " ").trim().slice(0, 8)}: ${(await page.locator("main fieldset legend").innerText()).slice(0, 50)}`);
      if ((await scaleBtns(page).evaluateAll((b) => b.filter((x) => x.getAttribute("aria-pressed") === "true").length)) === 0) await scaleBtns(page).nth(3).click();
      await nextBtn(page).click(); await page.waitForTimeout(250);
      if (++guard > 6) break;
    }
    const uniq = new Set(seen.map((s) => s.split(": ")[1])).size;
    return { ok: seen.length >= 3 && seen.length <= 5 && uniq === seen.length, actual: seen.join(" || ") };
  });
  await test("C", "Comment step: optional, counter, 1000-character limit, emoji counts as one (BUG-006)", { steps: "Type 998 letters + 2 emoji, then 5 more letters", expected: "Counter shows 1000; nothing beyond the limit is accepted", req: "MVP-08, BUG-006" }, async () => {
    const ta = page.locator("main textarea");
    await ta.fill("a".repeat(998) + "😀😀" + "bbbbb");
    const val = await ta.inputValue();
    const counter = (await page.locator("main p.tabular-nums, main p:has-text('/ 1')").last().innerText()).trim();
    const label = await ta.evaluate((t) => t.labels?.[0]?.innerText.trim() || t.getAttribute("aria-label"));
    return { ok: [...val].length <= 1000 && /1\s?000|1000/.test(counter), actual: `value length ${[...val].length} characters (${val.length} UTF-16 units); counter "${counter}"; label "${label}"`, evidence: await shot(page, "fill-comment-limit-360") };
  });
  await test("F", "Comment with a 300-character word and markup does not widen the page", { steps: "Type '<img src=x onerror=alert(1)>' + 300 letters without a space", expected: "No horizontal scroll (BUG-011)", req: "BUG-011, NFR-07" }, async () => {
    await page.locator("main textarea").fill("<img src=x onerror=alert(1)> " + "W".repeat(300) + " Ďakujem — „úvodzovky“ & ľščťžýáíé");
    const o = await overflow(page);
    return { ok: o <= 1, actual: `overflow ${o}px` };
  });
  let t0 = 0;
  await test("C", "Submit: thank-you screen appears", { steps: "Click 'Odoslať'", expected: "'Ďakujeme za odpoveď' with the confidentiality sentence; no console error", req: "MVP-09, IT-02" }, async () => {
    page.errors.length = 0;
    const before = await participation(page);
    await page.getByRole("button", { name: "Odoslať" }).click();
    await page.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 8000 });
    t0 = Date.now();
    await shot(page, "fill-thanks-confetti-360", false);
    const after = await participation(page);
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    return { ok: page.errors.length === 0 && !/anonym/i.test(text), actual: `participation ${JSON.stringify(before)} -> ${JSON.stringify(after)}; text: ${text.slice(0, 200)}; errors ${page.errors.length}`, evidence: "shots/fill-thanks-confetti-360.png" };
  });
  await test("D", "Confetti appears after submitting and removes itself", { steps: "Watch for canvas[data-confetti] after the thank-you screen appears; poll every 50 ms", expected: "A confetti canvas exists, does not block clicks (pointer-events none), and is gone afterwards", req: "IT-02" }, async () => {
    const seen = await confettiCount(page);
    const pe = seen ? await page.locator("canvas[data-confetti]").first().evaluate((c) => getComputedStyle(c).pointerEvents) : "-";
    let goneAt = null;
    for (let i = 0; i < 80; i++) { if ((await confettiCount(page)) === 0) { goneAt = Date.now() - t0; break; } await page.waitForTimeout(50); }
    return { ok: seen === 1 && pe === "none" && goneAt !== null, actual: `canvas present ${seen}; pointer-events ${pe}; canvas removed about ${goneAt} ms after the thank-you screen appeared` };
  });
  await test("C", "Thank-you screen offers the way back; home shows the round as sent", { steps: "Click 'Späť na prieskumy' (or equivalent link)", expected: "Home page; the round is 'Odoslané'; no 'Vyplniť' for it", req: "MVP-09, MVP-06" }, async () => {
    await page.locator("main a[href='/']").last().click();
    await page.waitForURL(`${BASE}/`); await page.waitForLoadState("networkidle");
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    const links = await page.locator(`main a[href="${FILL}"]`).count();
    return { ok: /Odoslané/.test(text) && links === 0, actual: `fill links ${links}; text: ${text.slice(0, 220)}`, evidence: await shot(page, "home-adam-after-submit-360") };
  });
  await test("C", "Opening the questionnaire again shows 'already submitted'", { steps: "Open the fill URL directly", expected: "Notice that the answer was already sent; no form", req: "MVP-09" }, async () => {
    await go(page, FILL);
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    return { ok: (await page.getByRole("button", { name: "Začať" }).count()) === 0 && /vyplnen|odosla/i.test(text), actual: text.slice(0, 200), evidence: await shot(page, "fill-already-360") };
  });
  await test("A", "Browser Back after submitting does not allow a second submission", { steps: "From home press Back to the questionnaire", expected: "Already-submitted notice or thank-you; no editable form", req: "MVP-09" }, async () => {
    await go(page, "/"); await page.goBack(); await page.waitForTimeout(800);
    const startBtn = await page.getByRole("button", { name: "Začať" }).count();
    return { ok: startBtn === 0, actual: `url ${new URL(page.url()).pathname.replace(/c[a-z0-9]{20,}/, ":id")}; 'Začať' buttons ${startBtn}` };
  });
  await page.context().close();
}

// ---------- barbora: failure modes, desktop ----------
{
  const page = await session(browser, USERS.barbora);
  const toComment = async () => { await start(page); await answerAll(page, 4); await page.locator("main textarea").fill("Skúšobný komentár."); };
  const alerts = async () => (await page.locator('main [role="alert"]').allInnerTexts()).join(" | ").replace(/\s+/g, " ");

  await test("C", "Submit fails with 500: error shown, answers and comment kept", { steps: "Answer everything; intercept POST responses -> 500; click 'Odoslať'", expected: "Generic error as role=alert; comment still there; 'Odoslať' usable", req: "MVP-09" }, async () => {
    await toComment();
    await page.route(RESP, (r) => r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"internal"}' }));
    await page.getByRole("button", { name: "Odoslať" }).click();
    await page.locator('main [role="alert"]').first().waitFor();
    const a = await alerts(); const c = await page.locator("main textarea").inputValue();
    const dis = await page.getByRole("button", { name: "Odoslať" }).isDisabled();
    await page.unroute(RESP);
    return { ok: a === "Niečo sa nepodarilo. Skús to znova." && c === "Skúšobný komentár." && !dis, actual: `alert "${a}"; comment kept ${c === "Skúšobný komentár."}; button disabled ${dis}`, evidence: await shot(page, "fill-error-500") };
  });
  await test("C", "Submit fails with a network error: error shown, retry possible", { steps: "Abort the POST; click 'Odoslať'", expected: "Generic error; form still usable", req: "MVP-09" }, async () => {
    await page.route(RESP, (r) => r.abort());
    await page.getByRole("button", { name: "Odoslať" }).click();
    await page.waitForTimeout(800);
    const a = await alerts();
    await page.unroute(RESP);
    return { ok: a === "Niečo sa nepodarilo. Skús to znova.", actual: `alert "${a}"` };
  });
  await test("C", "After an error, 'Späť' returns to the last question with its answer and clears the error", { steps: "Click 'Späť', then 'Ďalej'", expected: "Answer still pressed; error gone on return", req: "MVP-08" }, async () => {
    await backBtn(page).click(); await page.waitForTimeout(250);
    const pressed = await scaleBtns(page).evaluateAll((b) => b.map((x) => x.getAttribute("aria-pressed")).join(","));
    await nextBtn(page).click(); await page.waitForTimeout(250);
    const a = await alerts();
    return { ok: pressed.includes("true") && a === "", actual: `pressed ${pressed}; alerts after return "${a}"; comment "${await page.locator("main textarea").inputValue()}"` };
  });
  await test("C", "Session expired while the form is open: clear message with a login link (BUG-012)", { steps: "Intercept POST -> 401; click 'Odoslať'", expected: "Message that the login expired, link to log in in a new tab, answers kept", req: "BUG-012, MVP-01" }, async () => {
    await page.route(RESP, (r) => r.fulfill({ status: 401, contentType: "application/json", body: '{"error":"unauthorized"}' }));
    await page.getByRole("button", { name: "Odoslať" }).click();
    await page.locator('main [role="alert"]').first().waitFor();
    const a = await alerts();
    const link = await page.locator('main [role="alert"] a').evaluate((x) => ({ href: x.getAttribute("href"), target: x.target, text: x.innerText })).catch(() => null);
    await page.unroute(RESP);
    return { ok: /vypršal|prihlás/i.test(a) && link?.href === "/login" && link.target === "_blank", actual: `alert "${a.slice(0, 200)}"; link ${JSON.stringify(link)}`, evidence: await shot(page, "fill-session-expired") };
  });
  await test("C", "Round closed meanwhile (409): closed notice replaces the form", { steps: "Intercept POST -> 409 {error:'round_closed'}; click 'Odoslať'", expected: "Slovak notice that the round is closed; link back", req: "MVP-09" }, async () => {
    await page.route(RESP, (r) => r.fulfill({ status: 409, contentType: "application/json", body: '{"error":"round_closed"}' }));
    await page.getByRole("button", { name: "Odoslať" }).click();
    await page.waitForTimeout(800);
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    await page.unroute(RESP);
    return { ok: /uzavret/i.test(text) && (await page.locator("main textarea").count()) === 0, actual: text.slice(0, 200), evidence: await shot(page, "fill-closed-409") };
  });
  await test("C", "Reload in the middle of the questionnaire", { steps: "Answer two questions, press F5", expected: "Recorded behaviour: the questionnaire restarts from the intro (drafts are not stored: FILL-06 is not in scope)", req: "MVP-08 (FILL-06 out of scope)" }, async () => {
    await start(page); await scaleBtns(page).nth(2).click(); await nextBtn(page).click(); await page.waitForTimeout(200);
    await page.reload({ waitUntil: "networkidle" });
    const intro = await page.getByRole("button", { name: "Začať" }).count();
    const dialogs = 0;
    return { ok: intro === 1, actual: `after reload: intro shown ${intro === 1}; answers are lost without a warning (no beforeunload prompt) — observation, not a requirement` };
  });
  await test("C", "Slow submit: pending state, then double click sends a single response", { steps: "Delay POST by 1.5 s; double-click 'Odoslať'; inspect the button", expected: "One POST; button disabled with 'Odosielam…' and aria-busy; then the thank-you screen", req: "MVP-09 (one response per user)" }, async () => {
    await toComment();
    let posts = 0;
    await page.route(RESP, async (r) => { posts++; await new Promise((x) => setTimeout(x, 1500)); await r.continue().catch(() => {}); });
    const before = await participation(page);
    await page.getByRole("button", { name: "Odoslať" }).dblclick();
    await page.waitForTimeout(300);
    const b = await page.locator("main button[aria-busy]").evaluate((x) => ({ text: x.innerText.trim(), disabled: x.disabled, busy: x.getAttribute("aria-busy") })).catch(() => null);
    const backDisabled = await backBtn(page).isDisabled().catch(() => null);
    const evidence = await shot(page, "fill-pending", false);
    await page.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 8000 });
    await page.unroute(RESP);
    const after = await participation(page);
    return { ok: posts === 1 && b?.disabled === true && b?.busy === "true", actual: `POSTs ${posts}; button ${JSON.stringify(b)}; 'Späť' disabled ${backDisabled}; participation ${JSON.stringify(before)} -> ${JSON.stringify(after)}`, evidence };
  });
  await test("D", "Confetti does not block the page: the back link is clickable while it runs", { steps: "Immediately after the thank-you screen appears click the link back", expected: "Navigation happens while the confetti is still on screen; canvas is removed", req: "IT-02 (non-blocking)" }, async () => {
    const had = await confettiCount(page);
    await page.locator("main a[href='/']").last().click();
    await page.waitForURL(`${BASE}/`, { timeout: 3000 });
    await page.waitForTimeout(300);
    const left = await confettiCount(page);
    return { ok: had === 1, actual: `confetti canvas at click time ${had}; navigated to /; canvas after navigation ${left}` };
  });
  await page.context().close();
}

// ---------- cyril: system reduced motion + keyboard only ----------
{
  const page = await session(browser, USERS.cyril, { reducedMotion: "reduce" });
  await test("D", "System 'reduce motion': html[data-motion] is 'reduce' before first paint", { pre: "Browser emulates prefers-reduced-motion: reduce", steps: "Open /", expected: "data-motion=reduce", req: "IT-02" }, async () => {
    await go(page, "/");
    const m = await page.evaluate(() => document.documentElement.getAttribute("data-motion"));
    return { ok: m === "reduce", actual: `data-motion="${m}"` };
  });
  await test("G", "Keyboard only: reach the questionnaire from the home page and answer it", { steps: "Tab to 'Vyplniť', Enter, Tab to 'Začať', Enter; for each question Tab to an option, Space, Tab to 'Ďalej', Enter", expected: "Completable; after each step the next Tab lands inside the question panel (BUG-016); every stop has a visible focus indicator", req: "BUG-016, NFR-07" }, async () => {
    await go(page, "/");
    const tabTo = async (pred, max = 40) => {
      for (let i = 1; i <= max; i++) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return { text: (e.getAttribute("aria-label") || e.innerText || "").trim().slice(0, 30), tag: e.tagName, pressed: e.getAttribute("aria-pressed"), outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0, shadow: cs.boxShadow !== "none", disabled: e.disabled }; });
        if (pred(info)) return { i, info };
      }
      return null;
    };
    const log = []; let noRing = 0;
    const note = (label, r) => { if (!r) throw new Error(`could not reach ${label}`); log.push(`${label}:${r.i}`); if (!r.info.outline && !r.info.shadow) noRing++; };
    note("Vyplniť", await tabTo((x) => x.text === "Vyplniť")); await page.keyboard.press("Enter"); await page.waitForURL(`**${FILL}`); await page.waitForLoadState("networkidle");
    note("Začať", await tabTo((x) => x.text === "Začať")); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
    let q = 0;
    while ((await nextBtn(page).count()) && q < 6) {
      q++;
      note(`q${q}-option`, await tabTo((x) => x.pressed !== null, 12)); await page.keyboard.press("Space");
      note(`q${q}-next`, await tabTo((x) => x.text === "Ďalej", 12)); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
    }
    note("comment", await tabTo((x) => x.tag === "TEXTAREA", 8)); await page.keyboard.type("Klávesnicou.");
    note("Odoslať", await tabTo((x) => x.text === "Odoslať", 6));
    const maxOpt = Math.max(...log.filter((l) => /option/.test(l)).map((l) => Number(l.split(":")[1])));
    return { ok: maxOpt <= 3 && noRing === 0, actual: `Tab presses per target: ${log.join(", ")}; stops without a visible focus indicator: ${noRing}`, evidence: await shot(page, "fill-keyboard-comment") };
  });
  await test("D", "Reduced motion: no confetti, thank-you is still shown", { steps: "Press Enter on 'Odoslať'; poll for a confetti canvas for 1 s", expected: "Thank-you screen; no canvas at any time; check mark shown in its final state", req: "IT-02" }, async () => {
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 8000 });
    let max = 0;
    for (let i = 0; i < 20; i++) { max = Math.max(max, await confettiCount(page)); await page.waitForTimeout(50); }
    const anims = await page.evaluate(() => document.getAnimations().map((a) => `${a.animationName ?? a.transitionProperty}:${a.effect.getTiming().duration}`));
    const dash = await page.evaluate(() => [...document.querySelectorAll("main svg [pathLength]")].map((e) => getComputedStyle(e).strokeDashoffset).join(","));
    return { ok: max === 0, actual: `confetti canvases seen: ${max}; running animations: ${anims.join(", ") || "none"}; stroke-dashoffset of the check mark: ${dash}`, evidence: await shot(page, "fill-thanks-reduced") };
  });
  await test("G", "Thank-you screen: focus and announcement", { steps: "Read activeElement and live regions after submitting", expected: "Focus not lost to <body>; the thank-you is in a live region or receives focus", req: "BUG-016, WCAG 4.1.3" }, async () => {
    const f = await page.evaluate(() => ({ active: document.activeElement.tagName, status: [...document.querySelectorAll("main [role=status]")].map((s) => s.innerText.replace(/\s+/g, " ").slice(0, 60)), h1: document.querySelector("main h1")?.innerText }));
    return { ok: f.active !== "BODY", actual: JSON.stringify(f), defect: "FE2-thanks-focus" };
  });
  await page.context().close();
}

// ---------- dana: motion menu "Obmedzené" ----------
{
  const page = await session(browser, USERS.dana);
  await test("D", "Motion menu: 'Obmedzené' switches data-motion to reduce and is remembered", { steps: "Open the animation menu in the header, choose 'Obmedzené', reload", expected: "data-motion=reduce immediately and after reload; radio stays selected", req: "IT-02" }, async () => {
    await go(page, "/");
    await page.getByRole("button", { name: "Nastavenie animácií" }).click();
    await page.getByLabel("Obmedzené").check();
    const now = await page.evaluate(() => document.documentElement.getAttribute("data-motion"));
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    const after = await page.evaluate(() => document.documentElement.getAttribute("data-motion"));
    await page.getByRole("button", { name: "Nastavenie animácií" }).click();
    const checked = await page.getByLabel("Obmedzené").isChecked();
    const evidence = await shot(page, "motion-menu-reduced", false);
    await page.keyboard.press("Escape");
    return { ok: now === "reduce" && after === "reduce" && checked, actual: `now ${now}; after reload ${after}; radio checked ${checked}`, evidence };
  });
  await test("D", "In-app 'Obmedzené': question transition does not move, no confetti", { steps: "Fill in and submit with the in-app setting 'Obmedzené' (system setting: animations on)", expected: "Question animation is a fade only; no confetti canvas", req: "IT-02" }, async () => {
    await start(page);
    const anim = await page.evaluate(() => document.querySelector("main fieldset").getAnimations().map((x) => `${x.animationName}:${x.effect.getTiming().duration}:${JSON.stringify(x.effect.getKeyframes().map((k) => k.transform ?? ""))}`));
    await answerAll(page, 2);
    await page.getByRole("button", { name: "Odoslať" }).click();
    await page.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 8000 });
    let max = 0;
    for (let i = 0; i < 20; i++) { max = Math.max(max, await confettiCount(page)); await page.waitForTimeout(50); }
    return { ok: max === 0 && anim.every((a) => a.startsWith("fade-in")), actual: `question animation: ${anim.join(" ")}; confetti canvases ${max}` };
  });
  await page.context().close();
}

// ---------- emil: in-app "Zapnuté" overrides the system setting; duration measurements ----------
{
  const page = await session(browser, USERS.emil, { reducedMotion: "reduce" });
  await test("D", "Motion menu under system reduce: hint explains the state; 'Zapnuté' enables animations for the app", { steps: "With prefers-reduced-motion: reduce open the menu; read the hint; choose 'Zapnuté'", expected: "Hint says the system has animations off; after 'Zapnuté' data-motion=full", req: "IT-02" }, async () => {
    await go(page, "/");
    await page.getByRole("button", { name: "Nastavenie animácií" }).click();
    const hint1 = await page.locator("[popover] p").innerText();
    await page.getByLabel("Zapnuté").check();
    const m = await page.evaluate(() => document.documentElement.getAttribute("data-motion"));
    const hint2 = await page.locator("[popover] p").innerText();
    await page.keyboard.press("Escape");
    return { ok: /vypnuté/.test(hint1) && m === "full", actual: `hint before "${hint1}"; data-motion after "${m}"; hint after "${hint2}"` };
  });
  await test("D", "Animations last at most 1.5 s: questionnaire confetti (IT-02)", { steps: "Submit the questionnaire with animations on; record when the confetti canvas appears and disappears (requestAnimationFrame timestamps in the page)", expected: "Whole celebration (confetti included) finishes within 1 500 ms", req: "IT-02" }, async () => {
    await start(page); await answerAll(page, 3);
    await page.evaluate(() => {
      window.__c = { start: null, end: null };
      const tick = () => {
        const c = document.querySelector("canvas[data-confetti]");
        const now = performance.now();
        if (c && window.__c.start === null) window.__c.start = now;
        if (!c && window.__c.start !== null && window.__c.end === null) { window.__c.end = now; return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.getByRole("button", { name: "Odoslať" }).click();
    await page.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 8000 });
    await page.waitForFunction(() => window.__c.end !== null, null, { timeout: 6000 });
    const c = await page.evaluate(() => window.__c);
    const ms = Math.round(c.end - c.start);
    const css = await page.evaluate(() => document.getAnimations().map((a) => `${a.animationName}:${a.effect.getComputedTiming().endTime}`));
    return { ok: ms <= 1500, actual: `confetti canvas was on screen for ${ms} ms (limit 1 500 ms); other animations still registered: ${css.join(", ") || "none"}`, evidence: await shot(page, "fill-thanks-emil"), defect: "FE2-confetti-duration" };
  });
  await page.context().close();
}

// ---------- manager fills in the own team's round (BUG-004) ----------
{
  const page = await session(browser, USERS.mgrA);
  await test("C", "Manager can reach the own team's questionnaire from the UI (BUG-004)", { steps: "Home page and /rounds as manazer.alfa: look for a link to the fill page", expected: "A 'Vyplniť' link is visible on the home page even when three other tasks are shown", req: "BUG-004, IT-11, MVP-06" }, async () => {
    await go(page, "/");
    const home = await page.locator(`main a[href="${FILL}"]`).count();
    const tasks = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 400);
    const evidence = await shot(page, "home-manager-1280");
    await go(page, "/rounds");
    const rounds = await page.locator(`main a[href="${FILL}"]`).count();
    return { ok: home > 0, actual: `fill links on /: ${home}, on /rounds: ${rounds}; home text: ${tasks}`, evidence };
  });
  await test("C", "Manager submits the questionnaire", { steps: "Click 'Vyplniť', answer, submit", expected: "Thank-you screen; menu item 'Prieskumy' or 'Domov' active", req: "MVP-06, MVP-09" }, async () => {
    await page.goto(`${BASE}/`); await page.locator(`main a[href="${FILL}"]`).first().click();
    await page.waitForURL(`**${FILL}`); await page.getByRole("button", { name: "Začať" }).click();
    await answerAll(page, 4);
    await page.getByRole("button", { name: "Odoslať" }).click();
    await page.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 8000 });
    const below = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 300);
    return { ok: true, actual: `thank-you shown; text: ${below}`, evidence: await shot(page, "fill-thanks-manager") };
  });
  await page.context().close();
}

await browser.close();
