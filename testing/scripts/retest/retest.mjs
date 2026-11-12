// Retest of the defects fixed after QA session 2026-11-12_001, in a real
// browser (Edge) against the final build on the isolated QA server.
// Run on seed + demo data:  node retest.mjs [baseUrl]
// Each line is one executed check: RT-nnn PASS|FAIL  [BUG-xxx] description => actual
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3302";
const SHOTS = process.env.QA_SHOTS ?? "./testing/reports/2026-11-12_001/evidence/retest/shots";
mkdirSync(SHOTS, { recursive: true });

let n = 0;
let failures = 0;
function check(bug, description, ok, actual = "") {
  n++;
  if (!ok) failures++;
  const id = `RT-${String(n).padStart(3, "0")}`;
  console.log(`${id} ${ok ? "PASS" : "FAIL"}  [${bug}] ${description}${actual !== "" ? ` => ${String(actual).replace(/\s+/g, " ").slice(0, 220)}` : ""}`);
}
/** Runs a check that needs several steps; a script error counts as a failure, never as a pass. */
async function attempt(bug, description, fn) {
  try {
    const [ok, actual] = await fn();
    check(bug, description, ok, actual);
  } catch (error) {
    check(bug, description, false, `SCRIPT ERROR: ${String(error.message).split("\n")[0]}`);
  }
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
const jsErrors = [];
const MOBILE = { width: 360, height: 740 };
const DESKTOP = { width: 1280, height: 800 };

async function session(email, viewport = MOBILE, extra = {}) {
  const context = await browser.newContext({ viewport, locale: "sk-SK", ...extra });
  const page = await context.newPage();
  page.on("pageerror", (error) => jsErrors.push(`${email}: ${error.message}`));
  await page.goto(`${BASE}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill("Heslo123");
  await page.getByRole("button", { name: "Prihlásiť sa" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return { page, context, api: context.request };
}
const overflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const text = (page) => page.locator("body").innerText();
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const json = async (response) => (response.ok() ? response.json() : null);

// ───────────────────────── accounts and data
const hr = await session("hr@example.test");
const mgrA = await session("manazer.alfa@example.test");
const mgrB = await session("manazer.beta@example.test");
const adam = await session("adam.alfa@example.test");

const meA = (await json(await mgrA.api.get(`${BASE}/api/me`))).user;
const meAdam = (await json(await adam.api.get(`${BASE}/api/me`))).user;
const roundsA = (await json(await mgrA.api.get(`${BASE}/api/rounds`))).rounds;
const openA = roundsA.find((round) => round.status === "OPEN");
const closedOkA = roundsA.find((round) => round.name === "Pulse – 46. týždeň");
// Three rotating questions for rounds created by the retest (the fixed one is added by the server).
const pickedIds = (await json(await mgrA.api.get(`${BASE}/api/questions`))).questions
  .filter((question) => !question.fixed)
  .slice(0, 3)
  .map((question) => question.id);

// ───────────────────────── BUG-004 manager reaches the own survey
await attempt("BUG-004", "manager with 3 tasks on the home page still has a 'Vyplniť' link to the open round", async () => {
  const tasks = await mgrA.page.locator("main ol > li").count();
  const links = await mgrA.page.locator(`main a[href="/rounds/${openA.id}/fill"]`).count();
  await shot(mgrA.page, "bug-004-manager-home");
  return [tasks === 3 && links >= 1, `tasks=${tasks}; fill links=${links}`];
});
await attempt("BUG-004", "the link opens the questionnaire of the own team", async () => {
  await mgrA.page.locator(`main a[href="/rounds/${openA.id}/fill"]`).first().click();
  await mgrA.page.getByRole("button", { name: "Začať" }).waitFor();
  return [true, new URL(mgrA.page.url()).pathname.replace(openA.id, ":id")];
});

// ───────────────────────── BUG-016, BUG-022, BUG-031, BUG-006 questionnaire
await adam.page.goto(`${BASE}/rounds/${openA.id}/fill`);
await attempt("BUG-022", "menu item 'Domov' is marked while an employee fills in the questionnaire", async () => {
  const current = await adam.page.locator('header nav a[aria-current="page"]').allInnerTexts();
  return [current.length === 1 && current[0] === "Domov", current.join(",")];
});
await attempt("BUG-016", "after 'Začať' the keyboard focus is inside the questionnaire, not lost on <body>", async () => {
  await adam.page.getByRole("button", { name: "Začať" }).click();
  await adam.page.getByText("1 z 4", { exact: true }).waitFor();
  const tag = await adam.page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.getAttribute("tabindex")}`);
  return [tag === "DIV:-1", `activeElement=${tag}`];
});
await attempt("BUG-016", "after 'Ďalej' the focus moves to the new question again", async () => {
  await adam.page.getByRole("button", { name: /^4 – / }).click();
  await adam.page.getByRole("button", { name: "Ďalej" }).click();
  await adam.page.getByText("2 z 4", { exact: true }).waitFor();
  const tag = await adam.page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.getAttribute("tabindex")}`);
  return [tag === "DIV:-1", `activeElement=${tag}`];
});
await attempt("BUG-016", "the questionnaire can be completed to the comment step with the keyboard only", async () => {
  for (let question = 2; question <= 4; question++) {
    await adam.page.getByText(`${question} z 4`, { exact: true }).waitFor();
    await adam.page.keyboard.press("Tab"); // first scale button after the focused container
    await adam.page.keyboard.press("Enter");
    await adam.page.getByRole("button", { name: "Ďalej" }).focus();
    await adam.page.keyboard.press("Enter");
  }
  await adam.page.getByRole("textbox").waitFor();
  return [true, "reached the comment step"];
});
await attempt("BUG-031", "with 'reduce motion' the progress bar has no transition", async () => {
  const context = await browser.newContext({ viewport: MOBILE, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.getByLabel("E-mail").fill("barbora.alfa@example.test");
  await page.getByLabel("Heslo").fill("Heslo123");
  await page.getByRole("button", { name: "Prihlásiť sa" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.goto(`${BASE}/rounds/${openA.id}/fill`);
  await page.getByRole("button", { name: "Začať" }).click();
  await page.getByText("1 z 4", { exact: true }).waitFor();
  const property = await page.locator("div[aria-hidden=true] > div").first().evaluate((el) => getComputedStyle(el).transitionProperty);
  await context.close();
  return [property === "none", `transition-property=${property}`];
});
await attempt("BUG-006", "the comment counter counts one emoji as one character", async () => {
  await adam.page.getByRole("textbox").fill("😀😀😀");
  const counter = await adam.page.getByText(/\/ 1000/).innerText();
  return [counter.startsWith("3 "), counter];
});

// ───────────────────────── BUG-012 expired session in forms
await attempt("BUG-012", "questionnaire: after the session ends, submitting says to log in again and keeps the answers", async () => {
  await adam.page.getByRole("textbox").fill("Komentár, ktorý sa nesmie stratiť.");
  await adam.context.clearCookies();
  await adam.page.getByRole("button", { name: "Odoslať" }).click();
  const alert = adam.page.locator("[role=alert]").filter({ hasText: "Prihlásenie vypršalo" });
  await alert.waitFor();
  const kept = await adam.page.getByRole("textbox").inputValue();
  await shot(adam.page, "bug-012-session-expired");
  return [kept === "Komentár, ktorý sa nesmie stratiť.", `${await alert.innerText()} | comment kept=${kept.length > 0}`];
});
const adam2 = await session("adam.alfa@example.test");
await attempt("BUG-012", "kudos form: after the session ends, the message asks to log in again", async () => {
  await adam2.page.goto(`${BASE}/kudos/new`);
  await adam2.page.getByLabel("Komu").selectOption({ label: "Cyril Ukážkový (Tím Alfa)" });
  await adam2.page.getByLabel("Za čo").fill("Ďakujem za pomoc s testovaním opráv.");
  await adam2.context.clearCookies();
  await adam2.page.getByRole("button", { name: "Poslať kudos" }).click();
  const alert = adam2.page.locator("[role=alert]").filter({ hasText: "Prihlásenie vypršalo" });
  await alert.waitFor();
  return [true, await alert.innerText()];
});

// ───────────────────────── BUG-001 logout ends the session everywhere
await attempt("BUG-001", "after logout in one window, a second window of the same user is sent to the login page", async () => {
  const first = await session("cyril.alfa@example.test");
  const second = await session("cyril.alfa@example.test");
  const stolen = (await second.context.cookies()).find((cookie) => cookie.name === "fz_session").value;
  await first.page.getByRole("button", { name: "Odhlásiť sa" }).click();
  await first.page.waitForURL("**/login");
  await second.page.goto(`${BASE}/`);
  const path = new URL(second.page.url()).pathname;
  const api = await fetch(`${BASE}/api/me`, { headers: { cookie: `fz_session=${stolen}` } });
  return [path === "/login" && api.status === 401, `second window path=${path}; old cookie on /api/me=${api.status}`];
});
await attempt("BUG-038", "a failed logout request shows a message instead of silently staying logged in", async () => {
  const user = await session("dana.alfa@example.test");
  await user.page.route("**/api/logout", (route) => route.abort());
  await user.page.getByRole("button", { name: "Odhlásiť sa" }).click();
  const alert = user.page.locator("header [role=alert]");
  await alert.waitFor();
  return [(await alert.innerText()).includes("Odhlásenie sa nepodarilo"), await alert.innerText()];
});

// ───────────────────────── BUG-013 not-found page
for (const [who, page] of [["logged-in employee", adam2.page], ["HR", hr.page]]) {
  await attempt("BUG-013", `unknown address as ${who}: Slovak 404 page with a link back`, async () => {
    const context = who === "HR" ? hr.context : await browser.newContext({ viewport: MOBILE });
    const target = who === "HR" ? page : await context.newPage();
    const response = await target.goto(`${BASE}/toto-neexistuje`);
    const heading = await target.getByRole("heading", { level: 1 }).innerText();
    const link = await target.getByRole("link", { name: "Späť na úvod" }).count();
    const lang = await target.locator("html").getAttribute("lang");
    return [response.status() === 404 && heading === "Túto stránku sme nenašli" && link === 1 && lang === "sk", `HTTP ${response.status()}; h1="${heading}"; back link=${link}; lang=${lang}`];
  });
}

// ───────────────────────── BUG-011 long unbroken text
const LONG = "https://example.test/" + "velmi-dlhy-odkaz-bez-medzier-".repeat(14);
await attempt("BUG-011", "setup: long unbroken text stored as action, kudos, issue, note and round name", async () => {
  const action = await mgrA.api.post(`${BASE}/api/rounds/${closedOkA.id}/actions`, { data: { topic: "Odkaz", description: LONG, dueDate: "2026-12-20" } });
  const kudos = await mgrA.api.post(`${BASE}/api/kudos`, { data: { toUserId: meAdam.id, text: LONG, value: "HELPING", visibility: "TEAM" } });
  const issue = await hr.api.post(`${BASE}/api/hr/issues`, { data: { title: "Dlhý text", description: LONG, source: "OTHER", ownerGroup: "OTHER" } });
  const note = await hr.api.post(`${BASE}/api/hr/notes`, { data: { title: "Dlhý text", meetingDate: "2026-11-10", text: LONG } });
  const round = await mgrA.api.post(`${BASE}/api/rounds`, { data: { name: "A".repeat(110), teamId: meA.teamId, closesAt: "2026-12-31", questionIds: pickedIds } });
  const codes = [action.status(), kudos.status(), issue.status(), note.status(), round.status()];
  return [codes.every((code) => code === 201), `action/kudos/issue/note/round = ${codes.join("/")}`];
});
await attempt("BUG-011", "360 px: list of rounds with a 110-character unbroken round name does not scroll sideways", async () => {
  await mgrA.page.goto(`${BASE}/rounds`);
  const extra = await overflow(mgrA.page);
  return [extra <= 0, `page wider than the screen by ${extra} px`];
});
const adam3 = await session("adam.alfa@example.test");
for (const [label, who, path] of [
  ["results page (action)", mgrA, `/rounds/${closedOkA.id}/results`],
  ["team page (action, kudos)", adam3, `/team/${meA.teamId}`],
  ["my kudos", adam3, "/kudos/me"],
  ["HR issues", hr, "/hr/issues"],
  ["HR notes", hr, "/hr/notes"],
  ["report", mgrA, `/rounds/${closedOkA.id}/report`],
]) {
  await attempt("BUG-011", `360 px: ${label} with a 420-character unbroken link does not scroll sideways`, async () => {
    await who.page.goto(`${BASE}${path}`);
    const extra = await overflow(who.page);
    if (label.startsWith("team")) await shot(who.page, "bug-011-long-text-team");
    return [extra <= 0, `page wider than the screen by ${extra} px`];
  });
}

// ───────────────────────── XSS regression on the same texts
await attempt("REGRESSION", "HTML in an action is shown as text and runs no script", async () => {
  let dialog = false;
  mgrA.page.on("dialog", (d) => { dialog = true; d.dismiss(); });
  await mgrA.api.post(`${BASE}/api/rounds/${closedOkA.id}/actions`, { data: { topic: "<b>tučné</b>", description: "<script>alert(1)</script><img src=x onerror=alert(2)>", dueDate: "2026-12-20" } });
  await mgrA.page.goto(`${BASE}/rounds/${closedOkA.id}/results`);
  const shown = (await text(mgrA.page)).includes("<script>alert(1)</script>");
  const injected = await mgrA.page.locator("main img[src=x], main b").count();
  return [shown && injected === 0 && !dialog, `shown literally=${shown}; injected elements=${injected}; dialog=${dialog}`];
});

// ───────────────────────── BUG-015 plurals on rendered pages
await attempt("BUG-015", "manager Beta home: 'uzavreté 3 dni' (was '3 dní')", async () => {
  await mgrB.page.goto(`${BASE}/`);
  const body = await text(mgrB.page);
  return [/uzavreté 3 dni /.test(body) && !/uzavreté [234] dní/.test(body), (body.match(/Kolo „[^“]+“ je uzavreté[^.]+\./g) ?? []).join(" | ")];
});
await attempt("BUG-015", "HR home and overview: number of days and verb agree", async () => {
  await hr.page.goto(`${BASE}/`);
  const home = await text(hr.page);
  await hr.page.goto(`${BASE}/hr/overview`);
  const overview = await text(hr.page);
  const bad = /\b[234] dní\b|\b1 dní\b|z 1 uzavretých kôl|pred 0 dňami/;
  const headline = (overview.match(/\d+ z \d+ uzavret\S+ k\S+ \S+ na krok\.[^.]+\./) ?? [""])[0];
  return [!bad.test(home) && !bad.test(overview) && headline !== "", headline];
});

// ───────────────────────── BUG-009 / BUG-033 / BUG-028 lists and filters
await attempt("BUG-009", "issues page with an unknown filter in the address falls back to 'Nevybavené' and lists only unfinished", async () => {
  await hr.api.post(`${BASE}/api/hr/issues`, { data: { title: "Hotový podnet na test filtra", source: "OTHER", ownerGroup: "OTHER" } });
  const all = (await json(await hr.api.get(`${BASE}/api/hr/issues?status=ALL`))).issues;
  const target = all.find((issue) => issue.title === "Hotový podnet na test filtra");
  await hr.api.patch(`${BASE}/api/hr/issues/${target.id}`, { data: { status: "DONE" } });
  const response = await hr.page.goto(`${BASE}/hr/issues?status=NEZMYSEL&group=NIC`);
  const selected = await hr.page.locator("select[name=status]").inputValue();
  const doneShown = await hr.page.getByRole("heading", { name: "Hotový podnet na test filtra" }).count();
  const api = await hr.api.get(`${BASE}/api/hr/issues?status=NEZMYSEL`);
  return [response.status() === 200 && selected === "ACTIVE" && doneShown === 0 && api.status() === 400, `page HTTP ${response.status()}; filter=${selected}; finished issue shown=${doneShown}; API with unknown filter=${api.status()}`];
});
await attempt("BUG-033", "the page behind menu 'Prieskumy' is headed 'Prieskumy…' for manager and HR", async () => {
  await mgrA.page.goto(`${BASE}/rounds`);
  const manager = await mgrA.page.getByRole("heading", { level: 1 }).innerText();
  await hr.page.goto(`${BASE}/hr/rounds`);
  const hrHeading = await hr.page.getByRole("heading", { level: 1 }).innerText();
  return [manager.startsWith("Prieskumy") && hrHeading.startsWith("Prieskumy"), `manager="${manager}"; HR="${hrHeading}"`];
});
await attempt("BUG-028", "lists of rounds use h1 then h2 (no skipped level) and the main menu has a name", async () => {
  const levels = await hr.page.locator("main h1, main h2, main h3").evaluateAll((els) => [...new Set(els.map((el) => el.tagName))].join(","));
  const nav = await hr.page.locator("header nav").getAttribute("aria-label");
  return [levels === "H1,H2" && nav === "Hlavné menu", `levels=${levels}; nav label=${nav}`];
});

// ───────────────────────── BUG-017, BUG-018 new round form
await attempt("BUG-017", "new round as HR: after switching the team every preselected question is in an expanded topic", async () => {
  await hr.page.goto(`${BASE}/rounds/new`);
  await hr.page.locator("select[name=teamId]").selectOption({ label: "Tím Beta" });
  const state = await hr.page.evaluate(() => {
    const checked = [...document.querySelectorAll("fieldset input[type=checkbox]:checked")];
    return { checked: checked.length, hidden: checked.filter((box) => !box.closest("details")?.open).length, open: document.querySelectorAll("fieldset details[open]").length };
  });
  return [state.checked === 3 && state.hidden === 0 && state.open === 3, JSON.stringify(state)];
});
await attempt("BUG-018", "new round as manager: an own question added to a full round is saved with an explanation and its topic is expanded", async () => {
  await mgrA.page.goto(`${BASE}/rounds/new`);
  // 3 preselected + fixed = 4; tick one more to fill the round (5).
  await mgrA.page.locator("fieldset details:not([open]) > summary").first().click();
  await mgrA.page.locator("fieldset details[open] input[type=checkbox]:not(:checked)").first().check();
  await mgrA.page.getByText("Otázok v kole: 5").waitFor();
  await mgrA.page.getByLabel("Pridať vlastnú otázku").fill("Retest: rozdelenie úloh v tíme je spravodlivé.");
  await mgrA.page.getByRole("button", { name: "Pridať otázku" }).click();
  const notice = mgrA.page.locator("[role=status]").filter({ hasText: "kolo je už plné" });
  await notice.waitFor();
  const visible = await mgrA.page.getByText("Retest: rozdelenie úloh v tíme je spravodlivé.").isVisible();
  const stillFive = await mgrA.page.getByText("Otázok v kole: 5").isVisible();
  await shot(mgrA.page, "bug-018-own-question-full-round");
  return [visible && stillFive, `notice shown; question visible=${visible}; counter still 5=${stillFive}`];
});

// ───────────────────────── BUG-021 report of a draft
await attempt("BUG-021", "report of a draft says it is a draft and shows no participation", async () => {
  const drafts = (await json(await mgrA.api.get(`${BASE}/api/rounds`))).rounds.filter((round) => round.status === "DRAFT");
  const created = drafts[0] ?? (await json(await mgrA.api.post(`${BASE}/api/rounds`, { data: { name: "Retest koncept", closesAt: "2026-12-31", questionIds: pickedIds } }))).round;
  await mgrA.page.goto(`${BASE}/rounds/${created.id}/report`);
  const body = await text(mgrA.page);
  return [body.includes("Kolo je koncept a ešte nebolo spustené.") && !body.includes("Odpovedalo"), body.replace(/\s+/g, " ").slice(160, 330)];
});

// ───────────────────────── BUG-024 kudos to a recipient without a team
await attempt("BUG-024", "public kudos to HR is refused with an explanation; private kudos to HR is sent", async () => {
  const page = adam3.page;
  await page.goto(`${BASE}/kudos/new`);
  await page.getByLabel("Komu").selectOption({ label: "Hana Personálna" });
  await page.getByLabel("Za čo").fill("Ďakujem za rýchle vybavenie žiadosti.");
  await page.getByRole("button", { name: "Poslať kudos" }).click();
  const error = page.locator("[role=alert]").filter({ hasText: "Príjemca bez tímu" });
  await error.waitFor();
  await page.locator("input[name=visibility][value=PRIVATE]").check();
  await page.getByRole("button", { name: "Poslať kudos" }).click();
  await page.getByText("Kudos je odoslané.").waitFor();
  return [true, await error.innerText().catch(() => "error shown, then private kudos sent")];
});

// ───────────────────────── BUG-023, BUG-025, BUG-032, BUG-035, BUG-030 trend and comparison
await attempt("BUG-023", "trend table: keyboard-focusable scroll region with a hint", async () => {
  await mgrA.page.goto(`${BASE}/team/${meA.teamId}/trend`);
  const region = mgrA.page.locator('[role=region][tabindex="0"]');
  const hint = await mgrA.page.getByText("dá sa posúvať do strán").count();
  return [(await region.count()) === 1 && hint === 1, `regions=${await region.count()}; hint=${hint}`];
});
await attempt("BUG-025", "trend chart labels are at least 11 px at 360 px", async () => {
  const sizes = await mgrA.page.locator("figure svg text").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height * 10) / 10));
  const smallest = Math.min(...sizes);
  await shot(mgrA.page, "bug-025-trend-360");
  return [smallest >= 11, `smallest label height=${smallest} px of ${sizes.length} labels`];
});
await attempt("BUG-032", "comparison legend: steps do not overlap ('pod 3,0', 'od 3,0', …)", async () => {
  await hr.page.goto(`${BASE}/hr/heatmap`);
  const body = await text(hr.page);
  const legend = (body.match(/Skóre:[\s\S]*?bez dát/) ?? [""])[0].replace(/\s+/g, " ");
  return [legend.includes("pod 3,0") && legend.includes("od 3,0") && legend.includes("od 4,5") && !/ až /.test(legend), legend];
});
await attempt("BUG-035", "comparison: Tím Beta 'Stála otázka' shows 4,07 (was 4,06)", async () => {
  const api = await json(await hr.api.get(`${BASE}/api/hr/heatmap`));
  const beta = api.teams.find((team) => team.teamName === "Tím Beta");
  const cell = beta.cells["Stála otázka"];
  const shown = (await text(hr.page)).includes("4,07");
  return [cell === 4.07 && shown, `API=${cell}; shown on the page=${shown}`];
});
await attempt("BUG-023", "comparison table: keyboard-focusable scroll region", async () => {
  const count = await hr.page.locator('[role=region][tabindex="0"]').count();
  return [count === 1, `regions=${count}`];
});
function contrast(foreground, background) {
  const lum = (rgb) => {
    const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => { const c = Number(v) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(foreground), lum(background)].sort((x, y) => y - x);
  return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
}
await attempt("BUG-030", "comparison: the dash for 'no data' has a contrast of at least 4.5 : 1", async () => {
  const color = await hr.page.locator("td", { hasText: /^–$/ }).first().evaluate((el) => getComputedStyle(el).color);
  const ratio = contrast(color, "rgb(255,255,255)");
  return [ratio >= 4.5, `${color} on white = ${ratio} : 1`];
});
await attempt("BUG-030", "placeholder text has a contrast of at least 4.5 : 1", async () => {
  await mgrA.page.goto(`${BASE}/rounds/new`);
  const color = await mgrA.page.getByLabel("Pridať vlastnú otázku").evaluate((el) => getComputedStyle(el, "::placeholder").color);
  const ratio = contrast(color, "rgb(255,255,255)");
  return [ratio >= 4.5, `${color} on white = ${ratio} : 1`];
});

// ───────────────────────── BUG-027 titles
await attempt("BUG-027", "every screen has its own browser title", async () => {
  const titles = [];
  for (const path of ["/", "/hr/rounds", "/hr/overview", "/hr/heatmap", "/hr/issues", "/hr/notes", "/kudos/new", "/kudos/me", "/rounds/new"]) {
    await hr.page.goto(`${BASE}${path}`);
    titles.push(await hr.page.title());
  }
  const unique = new Set(titles).size;
  return [unique === titles.length && titles.every((title) => title.endsWith("– Feedback portál")), `${unique} distinct of ${titles.length}: ${titles.slice(0, 4).join(" | ")}`];
});

// ───────────────────────── BUG-026 touch targets at 360 px
async function minHeight(page, selector) {
  const heights = await page.locator(selector).evaluateAll((els) => els.filter((el) => el.getClientRects().length).map((el) => Math.round(el.getBoundingClientRect().height)));
  return heights.length ? Math.min(...heights) : -1;
}
for (const [label, who, path, selector] of [
  ["main menu links", adam3, "/", "header nav a"],
  ["logout button", adam3, "/", "header button"],
  ["home task and list buttons", adam3, "/", "main a[href*='/fill']"],
  ["tabs inside a page", adam3, "/kudos/new", "main nav a"],
  ["kudos form: selects, text, submit", adam3, "/kudos/new", "main select, main textarea, main button[type=submit]"],
  ["round list buttons (manager)", mgrA, "/rounds", "main li a, main li button, main a[href='/rounds/new']"],
  ["new round: inputs, question rows, submit", mgrA, "/rounds/new", "main input[type=text], main input[type=date], main select, main fieldset label, main button[type=submit]"],
  ["issues: filters and controls (HR)", hr, "/hr/issues", "main select, main form[method=get] button"],
]) {
  await attempt("BUG-026", `360 px: ${label} are at least 44 px tall`, async () => {
    await who.page.goto(`${BASE}${path}`);
    const smallest = await minHeight(who.page, selector);
    return [smallest >= 44, `smallest=${smallest} px`];
  });
}
await attempt("BUG-026", "360 px: login inputs and button are at least 44 px tall", async () => {
  const context = await browser.newContext({ viewport: MOBILE });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  const smallest = await minHeight(page, "input, button");
  await context.close();
  return [smallest >= 44, `smallest=${smallest} px`];
});
await attempt("BUG-026", "360 px: 'Rozdelenie odpovedí' toggle is at least 24 px tall (WCAG minimum)", async () => {
  await mgrA.page.goto(`${BASE}/rounds/${closedOkA.id}/results`);
  const smallest = await minHeight(mgrA.page, "main li details > summary");
  return [smallest >= 24, `smallest=${smallest} px`];
});

// ───────────────────────── regression: layout at two widths, key flow, console
const PAGES = [
  ["HR home", hr, "/"], ["HR rounds", hr, "/hr/rounds"], ["HR overview", hr, "/hr/overview"], ["HR comparison", hr, "/hr/heatmap"],
  ["HR issues", hr, "/hr/issues"], ["HR notes", hr, "/hr/notes"],
  ["manager home", mgrA, "/"], ["manager rounds", mgrA, "/rounds"], ["new round", mgrA, "/rounds/new"],
  ["results", mgrA, `/rounds/${closedOkA.id}/results`], ["report", mgrA, `/rounds/${closedOkA.id}/report`],
  ["trend", mgrA, `/team/${meA.teamId}/trend`], ["team page", adam3, `/team/${meA.teamId}`],
  ["employee home", adam3, "/"], ["kudos form", adam3, "/kudos/new"], ["my kudos", adam3, "/kudos/me"],
];
for (const viewport of [MOBILE, DESKTOP]) {
  for (const [label, who, path] of PAGES) {
    await attempt("REGRESSION", `${viewport.width} px: ${label} loads with HTTP 200 and no sideways scrolling`, async () => {
      await who.page.setViewportSize(viewport);
      const response = await who.page.goto(`${BASE}${path}`);
      const extra = await overflow(who.page);
      return [response.status() === 200 && extra <= 0, `HTTP ${response.status()}; overflow=${extra} px`];
    });
  }
}
await attempt("REGRESSION", "employee completes the questionnaire at 360 px and sees the thank-you screen", async () => {
  const user = await session("emil.alfa@example.test");
  await user.page.locator(`main a[href="/rounds/${openA.id}/fill"]`).first().click();
  await user.page.getByRole("button", { name: "Začať" }).click();
  for (let question = 1; question <= 4; question++) {
    await user.page.getByText(`${question} z 4`, { exact: true }).waitFor();
    await user.page.getByRole("button", { name: /^4 – / }).click();
    await user.page.getByRole("button", { name: "Ďalej" }).click();
  }
  await user.page.getByRole("button", { name: "Odoslať" }).click();
  await user.page.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor();
  const second = await user.api.post(`${BASE}/api/rounds/${openA.id}/responses`, { data: { answers: [1, 1, 1, 1] } });
  return [second.status() === 409, `thank-you shown; second submission=${second.status()}`];
});
await attempt("REGRESSION", "permissions still hold in the browser: employee gets 403 on results, trend and HR pages", async () => {
  const codes = [];
  for (const path of [`/rounds/${closedOkA.id}/results`, `/team/${meA.teamId}/trend`, "/hr/overview", "/hr/issues", "/rounds"]) {
    codes.push((await adam3.page.goto(`${BASE}${path}`)).status());
  }
  return [codes.every((code) => code === 403), codes.join(",")];
});
check("REGRESSION", "no uncaught JavaScript error in any window during the retest", jsErrors.length === 0, jsErrors.slice(0, 3).join(" | ") || "none");

await browser.close();
console.log(`\nTOTAL ${n}  PASS ${n - failures}  FAIL ${failures}`);
process.exit(failures === 0 ? 0 : 1);
