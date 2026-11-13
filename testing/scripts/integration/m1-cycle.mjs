// Session 2026-11-12_002, sections A + D + G: the full feedback cycle through the redesigned UI
// with API and database verification at every step, and the confidentiality threshold (4 vs 5)
// on every screen that shows results. Starts from a seed-only database.
import {
  BASE, U, db, resetDb, recorder, stepper, session, shot, mainOnly, api, sk, fmtDate, round2, ymd, DAY,
  toast, row, rowById, transition, wizard, apiRespond, pathOf, teams, isoWeek, closeBrowser,
} from "./lib.mjs";

const R = recorder("m1-cycle");
const step = stepper(R);
resetDb(false);
const { A: teamA, B: teamB } = await teams();
const seedBeta = await db.round.findFirstOrThrow({ where: { teamId: teamB.id } });
const NAME_A = `Pulse – ${isoWeek(new Date())}. týždeň`;
const NAME_B = "Pulse – prah QA";
const CUSTOM_Q = "Rozdelenie úloh v našom tíme je spravodlivé (QA).";
const menu = (page) => page.locator('header nav[aria-label="Hlavná navigácia"]').first().locator("a").allInnerTexts();

// ───────────────────────── HR: login, home, new round
const hr = await session(U.hr);
await step({ j: "A", d: "HR logs in through the form and lands on the home page", pre: "seed only", steps: "open /login, fill e-mail + password, submit", exp: "path '/', heading 'Čo treba urobiť teraz' (MVP-01, IT-11)" }, async () => {
  const h = await hr.getByRole("heading", { name: "Čo treba urobiť teraz" }).isVisible();
  return [pathOf(hr) === "/" && h, `path=${pathOf(hr)}, heading=${h}`, await shot(hr, "m1-01-hr-home")];
});
await step({ j: "G", d: "HR main menu has exactly the five items of IT-12", pre: "HR logged in", steps: "read the main navigation", exp: "Domov, Prieskumy, Prehľady, Podnety, Kudos" }, async () => {
  const items = (await menu(hr)).map((s) => s.trim());
  return [items.join(",") === "Domov,Prieskumy,Prehľady,Podnety,Kudos", items.join(",")];
});
await step({ j: "G", d: "HR home task: closed rounds without an action, recomputed from the database", pre: "seed: 1 closed Beta round, no action", steps: "read the first task; compute from Round/Action", exp: "'1 uzavreté kolo čaká na krok manažéra. Najdlhšie Tím Beta, N dní.' (IT-11)" }, async () => {
  const days = Math.floor((Date.now() - seedBeta.closedAt.getTime()) / DAY);
  const dayWord = days === 1 ? "1 deň" : days >= 2 && days <= 4 ? `${days} dni` : `${days} dní`;
  const expected = `1 uzavreté kolo čaká na krok manažéra. Najdlhšie Tím Beta, ${dayWord}.`;
  const text = await hr.locator("main#main ul[role=list] > li p").first().innerText();
  return [text === expected, `UI='${text}' expected='${expected}'`];
});

await hr.goto(`${BASE}/rounds/new`, { waitUntil: "networkidle" });
let defaultsHr = [];
await step({ j: "G", d: "New round form is prefilled: name, deadline +7 days, 3 questions + the fixed question (IT-13, IT-04)", pre: "HR logged in", steps: "open /rounds/new", exp: `name '${NAME_A}', deadline today+7, 3 ticked, counter 4, preselection notice, fixed question block` }, async () => {
  const name = await hr.inputValue('input[name="name"]');
  const closes = await hr.inputValue('input[name="closesAt"]');
  const expClose = ymd(new Date(Date.now() + 7 * DAY));
  const ticked = await hr.locator('input[type="checkbox"]:checked').count();
  const counter = await hr.getByText(/Otázok v kole:/).innerText();
  const notice = await hr.getByText("Predvybrali sme odporúčané otázky").isVisible();
  const fixed = await hr.getByText("Stála otázka").first().isVisible();
  defaultsHr = await hr.locator('label:has(input[type="checkbox"]:checked)').allInnerTexts();
  return [name === NAME_A && closes === expClose && ticked === 3 && counter === "Otázok v kole: 4 (treba 3 až 5)" && notice && fixed,
    `name='${name}', closes=${closes} (exp ${expClose}), ticked=${ticked}, counter='${counter}', notice=${notice}, fixed=${fixed}`, await shot(hr, "m1-02-new-round-defaults")];
});
await step({ j: "G", d: "Preselected questions are recommended ones from three different topics, each in an expanded topic", pre: "form open", steps: "read ticked labels and their <details> state", exp: "3 labels with 'Odporúčaná', 3 distinct open <details> (IT-13)" }, async () => {
  const open = await hr.locator("details[open]:has(input:checked)").count();
  const closedWith = await hr.locator("details:not([open]):has(input:checked)").count();
  const rec = defaultsHr.filter((s) => s.includes("Odporúčaná")).length;
  return [open === 3 && closedWith === 0 && rec === 3, `open topics with a ticked question=${open}, collapsed with ticked=${closedWith}, recommended=${rec}`];
});
await step({ j: "A", d: "Fewer than 3 questions: the form does not save and says why", pre: "form open, defaults", steps: "untick 2 of 3 questions (2 in total with the fixed one); Uložiť koncept", exp: "stays on /rounds/new, message 'Kolo musí mať spolu 3 až 5 otázok.', no round created (MVP-04)" }, async () => {
  const before = await db.round.count();
  const checked = hr.locator('input[type="checkbox"]:checked');
  await checked.nth(0).uncheck({ force: true }); await checked.nth(0).uncheck({ force: true });
  await hr.getByRole("button", { name: "Uložiť koncept" }).click();
  await hr.waitForTimeout(800);
  const msg = await hr.getByText("Kolo musí mať spolu 3 až 5 otázok.").isVisible().catch(() => false);
  const after = await db.round.count();
  return [pathOf(hr) === "/rounds/new" && after === before, `path=${pathOf(hr)}, message=${msg}, rounds ${before}→${after}; counter='${await hr.getByText(/Otázok v kole:/).innerText()}'`, await shot(hr, "m1-03-too-few")];
});
await step({ j: "A", d: "More than 5 questions cannot be selected in the form", pre: "form open", steps: "tick questions until 4 are ticked; try to tick a 5th library question (6 in total)", exp: "the sixth cannot be ticked or the form refuses to save; no round with 6 questions (MVP-04)" }, async () => {
  await hr.reload({ waitUntil: "networkidle" });
  await hr.locator("details:not([open]) > summary").evaluateAll((els) => els.forEach((e) => e.click()));
  const boxes = hr.locator('input[type="checkbox"]:not(:checked)');
  await boxes.nth(0).check({ force: true });
  const five = await hr.getByText(/Otázok v kole:/).innerText();
  const disabledCount = await hr.locator('input[type="checkbox"]:not(:checked):disabled').count();
  const remaining = await hr.locator('input[type="checkbox"]:not(:checked)').count();
  let sixth = "not attempted";
  if (disabledCount < remaining) {
    await hr.locator('input[type="checkbox"]:not(:checked):not(:disabled)').first().check({ force: true }).catch(() => {});
    sixth = await hr.getByText(/Otázok v kole:/).innerText();
  }
  const ok = five.startsWith("Otázok v kole: 5") && (disabledCount === remaining || !sixth.startsWith("Otázok v kole: 6"));
  return [ok, `after 4 ticks: '${five}'; unticked=${remaining}, of them disabled=${disabledCount}; after trying a 6th: '${sixth}'`, await shot(hr, "m1-04-max-five")];
});
let roundA;
await step({ j: "A", d: "HR saves the round for Tím Alfa as a draft with the defaults (two clicks)", pre: "form reloaded with defaults", steps: "open /rounds/new; Uložiť koncept", exp: "redirect to the list of rounds; toast 'Koncept kola je uložený.'; DB: DRAFT round of Tím Alfa with 4 questions, fixed question at position 1 (MVP-04, IT-04)" }, async () => {
  await hr.goto(`${BASE}/rounds/new`, { waitUntil: "networkidle" });
  await hr.getByRole("button", { name: "Uložiť koncept" }).click();
  await hr.waitForURL((u) => u.pathname !== "/rounds/new", { timeout: 10000 });
  const t = await toast(hr, "Koncept kola je uložený.").isVisible().catch(() => false);
  roundA = await db.round.findFirst({ where: { name: NAME_A, teamId: teamA.id }, include: { questions: { include: { question: true }, orderBy: { position: "asc" } } } });
  const ok = roundA?.status === "DRAFT" && roundA.questions.length === 4 && roundA.questions[0].question.fixed && t;
  return [ok, `path=${pathOf(hr)}, toast=${t}, status=${roundA?.status}, questions=${roundA?.questions.length}, first fixed=${roundA?.questions[0]?.question.fixed}, startsAt=${roundA?.startsAt}`, await shot(hr, "m1-05-draft-saved")];
});
await step({ j: "D", d: "List of rounds for HR shows the draft with team, status, deadline and participation equal to the database", pre: "draft saved", steps: "read the row on /hr/rounds", exp: `row '${NAME_A}': Tím Alfa, Koncept, deadline ${fmtDate(Date.now() + 7 * DAY)}, no participation figure for a draft` }, async () => {
  if (pathOf(hr) !== "/hr/rounds") await hr.goto(`${BASE}/hr/rounds`, { waitUntil: "networkidle" });
  const text = (await rowById(hr, roundA.id).innerText()).replace(/\s+/g, " ");
  const ok = text.includes("Tím Alfa") && text.includes("Koncept") && text.includes(fmtDate(roundA.closesAt)) && !/d z d/.test(text);
  return [ok, text];
});
const adamApi = await api(U.alfa[0]);
await step({ j: "A", d: "A draft is invisible to team members (home page and API)", pre: "draft exists, not started", steps: "Adam: GET /api/rounds and GET /api/rounds/:id", exp: "list without the draft; detail refused (404/403/409), no questions" }, async () => {
  const list = await adamApi("/api/rounds"); const one = await adamApi(`/api/rounds/${roundA.id}`);
  const inList = list.json.rounds.some((r) => r.id === roundA.id);
  return [!inList && one.status >= 400 && !one.text.includes("questions"), `in list=${inList}; detail HTTP ${one.status} ${one.text.slice(0, 80)}`];
});
await step({ j: "A", d: "Start dialog can be cancelled and nothing changes", pre: "draft row on /hr/rounds", steps: "Spustiť → dialog 'Spustiť kolo?' → Zrušiť", exp: "dialog closes, status stays DRAFT in UI and DB, no toast" }, async () => {
  await transition(hr, rowById(hr, roundA.id), "Spustiť", false);
  await hr.waitForTimeout(600);
  const dbStatus = (await db.round.findUnique({ where: { id: roundA.id } })).status;
  const ui = (await rowById(hr, roundA.id).innerText()).includes("Koncept");
  const t = await toast(hr, "Kolo je spustené").count();
  const open = await hr.locator("dialog[open]").count();
  return [dbStatus === "DRAFT" && ui && t === 0 && open === 0, `db=${dbStatus}, row shows Koncept=${ui}, toast count=${t}, dialog open=${open}`];
});
await step({ j: "A", d: "HR starts the round through the confirm dialog", pre: "draft row", steps: "Spustiť → confirm Spustiť", exp: "toast 'Kolo je spustené. Tím ho už vidí.'; row shows 'Otvorené' and an 'Uzavrieť' button; DB: OPEN with startsAt (MVP-05)" }, async () => {
  await transition(hr, rowById(hr, roundA.id), "Spustiť", true);
  await toast(hr, "Kolo je spustené. Tím ho už vidí.").waitFor({ timeout: 8000 });
  await rowById(hr, roundA.id).getByText("Otvorené").waitFor({ timeout: 8000 });
  const r = await db.round.findUnique({ where: { id: roundA.id } });
  const closeBtn = await rowById(hr, roundA.id).getByRole("button", { name: "Uzavrieť" }).count();
  return [r.status === "OPEN" && r.startsAt !== null && closeBtn === 1, `db=${r.status}, startsAt set=${r.startsAt !== null}, Uzavrieť button=${closeBtn}`, await shot(hr, "m1-06-round-open")];
});
const hrApi = await api(U.hr);
await step({ j: "A", d: "A running round cannot be started again or edited", pre: "round OPEN", steps: "POST /api/rounds/:id/open again; look for an edit control in the row", exp: "409; no edit link (MVP-05)" }, async () => {
  const r = await hrApi(`/api/rounds/${roundA.id}/open`, "POST");
  const links = await rowById(hr, roundA.id).locator("a").allInnerTexts();
  return [r.status === 409 && !links.some((l) => /uprav/i.test(l)), `HTTP ${r.status} ${r.text}; row links=${links.join("|")}`];
});

// ───────────────────────── Manager Beta: own question + threshold round
const mgrB = await session(U.mgrB);
await step({ j: "G", d: "Manager main menu: Domov, Prieskumy, Môj tím, Kudos", pre: "manager Beta logged in", steps: "read the main navigation", exp: "exactly these four (IT-12)" }, async () => {
  const items = (await menu(mgrB)).map((s) => s.trim());
  return [items.join(",") === "Domov,Prieskumy,Môj tím,Kudos", items.join(",")];
});
await mgrB.goto(`${BASE}/rounds/new`, { waitUntil: "networkidle" });
await step({ j: "A", d: "Manager can create a round only for the own team", pre: "manager Beta on /rounds/new", steps: "read the team select; POST /api/rounds for Tím Alfa", exp: "only 'Tím Beta' offered; API 403 (matrix)" }, async () => {
  const options = await mgrB.locator('select[name="teamId"] option').allInnerTexts();
  const call = await api(U.mgrB);
  const qs = await db.question.findMany({ where: { fixed: false, teamId: null }, take: 3 });
  const r = await call("/api/rounds", "POST", { name: "Cudzie", teamId: teamA.id, closesAt: ymd(new Date(Date.now() + 7 * DAY)), questionIds: qs.map((q) => q.id) });
  return [options.join(",") === "Tím Beta" && r.status === 403, `options=${options.join(",")}; POST for Alfa → HTTP ${r.status}`];
});
await step({ j: "G", d: "Own question: too short text is refused", pre: "form open", steps: "type 'Krátka' (6 chars) into 'Pridať vlastnú otázku'; Pridať otázku", exp: "message 'Otázka musí mať 10 až 200 znakov.' or disabled button; nothing stored (IT-07)" }, async () => {
  const input = mgrB.getByLabel("Pridať vlastnú otázku");
  await input.fill("Krátka");
  const btn = mgrB.getByRole("button", { name: "Pridať otázku" });
  const disabled = await btn.isDisabled();
  if (!disabled) await btn.click();
  await mgrB.waitForTimeout(500);
  const msg = await mgrB.getByText("Otázka musí mať 10 až 200 znakov.").isVisible().catch(() => false);
  const n = await db.question.count({ where: { teamId: { not: null } } });
  return [n === 0 && (msg || disabled), `button disabled=${disabled}, message=${msg}, team questions in DB=${n}`];
});
await step({ j: "G", d: "Manager adds an own question; it is stored for the team, ticked and visible in an expanded topic", pre: "form open with 3 defaults", steps: `type '${CUSTOM_Q}'; Pridať otázku`, exp: "toast 'Otázka je pridaná do knižnice tímu.'; DB: question with teamId = Tím Beta, scale AGREEMENT; counter 5 (IT-07, BUG-018)" }, async () => {
  await mgrB.getByLabel("Pridať vlastnú otázku").fill(CUSTOM_Q);
  await mgrB.getByRole("button", { name: "Pridať otázku" }).click();
  await toast(mgrB, "Otázka je pridaná do knižnice tímu.").waitFor({ timeout: 8000 });
  const q = await db.question.findFirst({ where: { text: CUSTOM_Q } });
  const counter = await mgrB.getByText(/Otázok v kole:/).innerText();
  const visible = await mgrB.locator("details[open] label", { hasText: CUSTOM_Q }).locator("input").isChecked().catch(() => false);
  return [q?.teamId === teamB.id && q.scale === "AGREEMENT" && counter.startsWith("Otázok v kole: 5") && visible, `db teamId ok=${q?.teamId === teamB.id}, scale=${q?.scale}, counter='${counter}', ticked in open topic=${visible}`, await shot(mgrB, "m1-07-own-question")];
});
let roundB;
await step({ j: "A", d: "Manager saves the round under a custom name with 5 questions (fixed + 3 + own)", pre: "own question ticked", steps: `name '${NAME_B}'; Uložiť koncept`, exp: "redirect to /rounds with toast; DB: 5 questions, own question included, fixed first" }, async () => {
  await mgrB.fill('input[name="name"]', NAME_B);
  await mgrB.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgrB.waitForURL("**/rounds", { timeout: 10000 });
  const t = await toast(mgrB, "Koncept kola je uložený.").isVisible().catch(() => false);
  roundB = await db.round.findFirst({ where: { name: NAME_B }, include: { questions: { include: { question: true }, orderBy: { position: "asc" } } } });
  const hasOwn = roundB?.questions.some((q) => q.question.text === CUSTOM_Q);
  return [roundB?.questions.length === 5 && hasOwn && roundB.questions[0].question.fixed && t, `path=${pathOf(mgrB)}, toast=${t}, questions=${roundB?.questions.length}, own included=${hasOwn}, fixed first=${roundB?.questions[0]?.question.fixed}`];
});
await step({ j: "A", d: "Manager starts the own round from /rounds", pre: "draft in the list", steps: "Spustiť → confirm", exp: "toast, row 'Otvorené', DB OPEN" }, async () => {
  await transition(mgrB, rowById(mgrB, roundB.id), "Spustiť", true);
  await toast(mgrB, "Kolo je spustené. Tím ho už vidí.").waitFor({ timeout: 8000 });
  const s = (await db.round.findUnique({ where: { id: roundB.id } })).status;
  return [s === "OPEN", `db=${s}`];
});
await step({ j: "F", d: "Own question of Tím Beta is not offered to the manager of Tím Alfa and cannot be used by them", pre: "own question exists", steps: "manager Alfa: GET /api/questions; POST /api/rounds with that question id", exp: "not in the library; 400 (IT-07)" }, async () => {
  const call = await api(U.mgrA);
  const q = await db.question.findFirst({ where: { text: CUSTOM_Q } });
  const lib = await call("/api/questions");
  const present = JSON.stringify(lib.json).includes(q.id);
  const qs = await db.question.findMany({ where: { fixed: false, teamId: null }, take: 2 });
  const r = await call("/api/rounds", "POST", { name: "Pokus", teamId: teamA.id, closesAt: ymd(new Date(Date.now() + 7 * DAY)), questionIds: [...qs.map((x) => x.id), q.id] });
  const hrLib = await hrApi("/api/questions");
  return [!present && r.status === 400 && JSON.stringify(hrLib.json).includes(q.id), `in Alfa library=${present}; POST → HTTP ${r.status} ${r.text}; HR sees it=${JSON.stringify(hrLib.json).includes(q.id)}`];
});

// ───────────────────────── Employee Adam: home, wizard, thanks
const adam = await session(U.alfa[0]);
await step({ j: "G", d: "Employee main menu: Domov, Môj tím, Kudos", pre: "Adam logged in", steps: "read the main navigation", exp: "exactly these three (IT-12)" }, async () => {
  const items = (await menu(adam)).map((s) => s.trim());
  return [items.join(",") === "Domov,Môj tím,Kudos", items.join(",")];
});
await step({ j: "A", d: "Employee home shows the open round as a task and in 'Moje prieskumy'", pre: "round A open", steps: "read the home page", exp: `task 'Čaká na teba prieskum „${NAME_A}“. Má 4 otázky a zaberie asi 2 minúty.' with 'Vyplniť'; list row with 'Čaká na vyplnenie' (IT-11, MVP-06)` }, async () => {
  const task = await adam.locator("main#main ul[role=list] > li p").first().innerText();
  const badge = await adam.locator("main#main section li", { hasText: NAME_A }).getByText("Čaká na vyplnenie").isVisible();
  const expected = `Čaká na teba prieskum „${NAME_A}“. Má 4 otázky a zaberie asi 2 minúty.`;
  return [task === expected && badge, `task='${task}', badge=${badge}`, await shot(adam, "m1-08-emp-home")];
});
await step({ j: "F", d: "Employee of Tím Alfa does not see the round of Tím Beta anywhere", pre: "Beta round open", steps: "home page text; GET /api/rounds; GET /api/rounds/<beta id>", exp: "not on the page, not in the list, detail 403" }, async () => {
  const text = await mainOnly(adam);
  const list = await adamApi("/api/rounds"); const one = await adamApi(`/api/rounds/${roundB.id}`);
  return [!text.includes(NAME_B) && !list.json.rounds.some((r) => r.id === roundB.id) && one.status === 403, `on page=${text.includes(NAME_B)}; in API list=${list.json.rounds.some((r) => r.id === roundB.id)}; detail HTTP ${one.status}`];
});
await adam.getByRole("link", { name: "Vyplniť" }).first().click();
await adam.waitForURL("**/fill");
await step({ j: "A", d: "Intro screen shows the exact confidentiality text before the first question", pre: "Adam clicked 'Vyplniť'", steps: "read the intro", exp: "NFR-04 sentence verbatim, '4 otázky, zaberie to do 2 minút.', button 'Začať' (MVP-07)" }, async () => {
  const text = await mainOnly(adam);
  const exact = "Tvoje odpovede sú dôverné. Manažér ani tím neuvidia, kto čo napísal, výsledky vidia iba za skupinu aspoň 5 ľudí.";
  return [text.includes(exact) && text.includes("4 otázky, zaberie to do 2 minút.") && !/anonym/i.test(text), `exact text=${text.includes(exact)}, duration=${text.includes("4 otázky, zaberie to do 2 minút.")}`, await shot(adam, "m1-09-fill-intro")];
});
await adam.getByRole("button", { name: "Začať" }).click();
await step({ j: "A", d: "First question: one question per screen, progress '1 z 4', 'Ďalej' disabled until a value is chosen", pre: "wizard started", steps: "read the screen", exp: "one fieldset, 5 buttons, '1 z 4', Ďalej disabled, the fixed question first (MVP-08, IT-04)" }, async () => {
  await adam.getByText("Otázka 1 z 4").waitFor({ state: "attached" });
  const fs = await adam.locator("main#main fieldset").count();
  const buttons = await adam.locator("fieldset button[aria-pressed]").count();
  const legend = await adam.locator("main#main fieldset legend").innerText();
  const disabled = await adam.getByRole("button", { name: "Ďalej" }).isDisabled();
  const progress = await adam.locator("main#main").getByText("1 z 4", { exact: true }).count();
  return [fs === 1 && buttons === 5 && disabled && progress >= 1 && legend === roundA.questions[0].question.text, `fieldsets=${fs}, buttons=${buttons}, next disabled=${disabled}, legend='${legend}'`, await shot(adam, "m1-10-fill-q1")];
});
await step({ j: "A", d: "Back keeps the chosen answer", pre: "question 1", steps: "choose 4 → Ďalej → choose 2 → Späť", exp: "question 1 shown again with 4 pressed; then question 2 still has 2" }, async () => {
  await adam.locator("fieldset button[aria-pressed]").nth(3).click();
  await adam.getByRole("button", { name: "Ďalej" }).click();
  await adam.getByText("Otázka 2 z 4").waitFor({ state: "attached" });
  await adam.locator("fieldset button[aria-pressed]").nth(1).click();
  await adam.getByRole("button", { name: "Späť" }).click();
  await adam.getByText("Otázka 1 z 4").waitFor({ state: "attached" });
  const q1 = await adam.locator('fieldset button[aria-pressed="true"]').getAttribute("aria-label");
  await adam.getByRole("button", { name: "Ďalej" }).click();
  await adam.getByText("Otázka 2 z 4").waitFor({ state: "attached" });
  const q2 = await adam.locator('fieldset button[aria-pressed="true"]').getAttribute("aria-label");
  return [q1.startsWith("4") && q2.startsWith("2"), `q1 pressed='${q1}', q2 pressed='${q2}'`];
});
const ADAM_COMMENT = "Pomohlo by menej porád v jeden deň (QA Adam).";
await step({ j: "A", d: "Comment step: optional comment with a counter, max 1 000 characters", pre: "questions 3 and 4 answered", steps: "answer 5 and 3; on the last step type a comment", exp: "label 'Komentár', counter 'N / 1000', textarea maxlength 1000 (MVP-08)" }, async () => {
  await adam.getByRole("button", { name: "Ďalej" }).click();
  for (const [i, v] of [[3, 5], [4, 3]]) {
    await adam.getByText(`Otázka ${i} z 4`).waitFor({ state: "attached" });
    await adam.locator("fieldset button[aria-pressed]").nth(v - 1).click();
    await adam.getByRole("button", { name: "Ďalej" }).click();
  }
  await adam.locator("textarea").fill(ADAM_COMMENT);
  const counter = await adam.getByText(`${ADAM_COMMENT.length} / 1000`).isVisible();
  const max = await adam.locator("textarea").getAttribute("maxlength");
  return [counter && max === "1000", `counter visible=${counter}, maxlength=${max}`, await shot(adam, "m1-11-fill-comment")];
});
let celebration = "";
await step({ j: "A", d: "Submit: thank-you screen with a celebration, one response and one participation stored", pre: "comment typed", steps: "Odoslať", exp: "heading 'Ďakujeme za odpoveď'; a celebration element appears; DB: 1 Response (4,2,5,3 + comment), 1 Participation for Adam (MVP-09, IT-02)" }, async () => {
  await adam.getByRole("button", { name: "Odoslať" }).click();
  await adam.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 10000 });
  celebration = await adam.evaluate(() => {
    const c = document.querySelector("canvas, [data-celebrate], [data-confetti]");
    return c ? `${c.tagName.toLowerCase()}${c.hasAttribute("data-celebrate") ? "[data-celebrate]" : ""}` : "";
  });
  const resp = await db.response.findMany({ where: { roundId: roundA.id } });
  const part = await db.participation.findMany({ where: { roundId: roundA.id }, include: { user: true } });
  const r = resp[0];
  const ok = resp.length === 1 && part.length === 1 && part[0].user.email === U.alfa[0] && r.v1 === 4 && r.v2 === 2 && r.v3 === 5 && r.v4 === 3 && r.v5 === null && r.comment === ADAM_COMMENT;
  return [ok, `responses=${resp.length} (${r?.v1},${r?.v2},${r?.v3},${r?.v4},${r?.v5}), comment stored=${r?.comment === ADAM_COMMENT}, participations=${part.length}, celebration element='${celebration}'`, await shot(adam, "m1-12-thanks")];
});
await step({ j: "A", d: "Thank-you screen shows the last closed round's steps section and a way back", pre: "just submitted; team Alfa has no closed round", steps: "read the screen", exp: "thanks text, a cheer line, link 'Späť na moje prieskumy' (MVP-09, MVP-14)" }, async () => {
  const text = await mainOnly(adam);
  const cheers = ["Výborne, prieskum je hotový!", "Ďakujeme, tvoj hlas sa počíta.", "Hotovo. Vďaka, že pomáhaš tímu napredovať.", "Super, máš to za sebou. Tvoj názor pomáha celému tímu."];
  const cheer = cheers.find((c) => text.includes(c)) ?? "";
  const back = await adam.getByRole("link", { name: "Späť na moje prieskumy" }).count();
  return [text.includes("Tvoja odpoveď je odoslaná.") && back === 1, `cheer='${cheer}', back link=${back}, text='${text.slice(0, 260)}'`];
});
await step({ j: "A", d: "The celebration does not block navigation right after submitting", pre: "thank-you screen, animation possibly running", steps: "click 'Môj tím' in the menu immediately", exp: "team page opens within 5 s (IT-02: animation must not block controls)" }, async () => {
  const t0 = Date.now();
  await adam.locator("header nav").first().getByRole("link", { name: "Môj tím" }).click();
  await adam.waitForURL(`**/team/${teamA.id}`, { timeout: 5000 });
  await adam.getByRole("heading", { name: "Povedali ste, urobili sme" }).waitFor({ timeout: 5000 });
  return [true, `navigated in ${Date.now() - t0} ms; page errors=${adam.errors.length}`];
});
await step({ j: "A", d: "Home marks the round as 'Odoslané' and the task disappears", pre: "Adam submitted", steps: "open /", exp: "'Nič nečaká.' and the row has the badge 'Odoslané' without a 'Vyplniť' link (MVP-06)" }, async () => {
  await adam.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const text = await mainOnly(adam);
  const badge = await adam.locator("main#main section li", { hasText: NAME_A }).getByText("Odoslané").isVisible();
  const fill = await adam.locator("main#main").getByRole("link", { name: "Vyplniť" }).count();
  return [text.includes("Nič nečaká.") && badge && fill === 0, `nothing=${text.includes("Nič nečaká.")}, badge=${badge}, fill links=${fill}`, await shot(adam, "m1-13-home-submitted")];
});
await step({ j: "A", d: "Second attempt through the UI is refused", pre: "Adam submitted", steps: "open /rounds/:id/fill again", exp: "'Toto kolo už máš vyplnené', no 'Začať' button (MVP-09)" }, async () => {
  await adam.goto(`${BASE}/rounds/${roundA.id}/fill`, { waitUntil: "networkidle" });
  const h = await adam.getByRole("heading", { name: "Toto kolo už máš vyplnené" }).isVisible();
  const start = await adam.getByRole("button", { name: "Začať" }).count();
  return [h && start === 0, `heading=${h}, start buttons=${start}`, await shot(adam, "m1-14-already")];
});
await step({ j: "A", d: "Second submission through the API is refused with 409 and stores nothing", pre: "Adam submitted", steps: "POST /api/rounds/:id/responses again", exp: "409; still 1 response and 1 participation (MVP-09)" }, async () => {
  const r = await adamApi(`/api/rounds/${roundA.id}/responses`, "POST", { answers: [1, 1, 1, 1] });
  const n = await db.response.count({ where: { roundId: roundA.id } }); const p = await db.participation.count({ where: { roundId: roundA.id } });
  return [r.status === 409 && n === 1 && p === 1, `HTTP ${r.status} ${r.text}; responses=${n}, participations=${p}`];
});

// ───────────────────────── four more members (one on a 360 px phone) → 5 responses in round A
const answersA = [[4, 2, 5, 3]];
const commentsA = [ADAM_COMMENT];
const barbora = await session(U.alfa[1], { width: 360, height: 740 });
await step({ j: "A", d: "Second member fills the round on a 360 px phone without horizontal scrolling", pre: "round A open", steps: "Barbora at 360×740: full wizard 5,4,4,2 with a comment", exp: "thank-you screen; document width ≤ 360 at every step (MVP-08, NFR-07)" }, async () => {
  await barbora.goto(`${BASE}/rounds/${roundA.id}/fill`, { waitUntil: "networkidle" });
  const widths = [];
  const w = async () => widths.push(await barbora.evaluate(() => document.documentElement.scrollWidth));
  await w();
  await barbora.getByRole("button", { name: "Začať" }).click();
  const a = [5, 4, 4, 2];
  for (let i = 0; i < 4; i++) {
    await barbora.getByText(`Otázka ${i + 1} z 4`).waitFor({ state: "attached" });
    await w();
    await barbora.locator("fieldset button[aria-pressed]").nth(a[i] - 1).click();
    await barbora.getByRole("button", { name: "Ďalej" }).click();
  }
  await barbora.locator("textarea").fill("Viac času na sústredenú prácu (QA Barbora).");
  await w();
  const evidence = await shot(barbora, "m1-15-mobile-comment");
  await barbora.getByRole("button", { name: "Odoslať" }).click();
  await barbora.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 10000 });
  await w();
  answersA.push(a); commentsA.push("Viac času na sústredenú prácu (QA Barbora).");
  return [widths.every((x) => x <= 360), `scrollWidth per step=${widths.join(",")}`, evidence];
});
for (const [i, a, c] of [[2, [3, 3, 4, 4], ""], [3, [2, 5, 5, 1], "Jasnejšie priority na začiatku týždňa (QA Dana)."], [4, [5, 1, 3, 5], ""]]) {
  const page = await session(U.alfa[i]);
  await step({ j: "A", d: `Member ${i + 1} of Tím Alfa fills the round through the wizard`, pre: "round A open", steps: `wizard ${a.join(",")}${c ? " with comment" : " without comment"}`, exp: "thank-you screen; response count grows by one" }, async () => {
    await wizard(page, roundA.id, a, c);
    answersA.push(a); if (c) commentsA.push(c);
    const n = await db.response.count({ where: { roundId: roundA.id } });
    return [n === answersA.length, `responses in DB=${n}`];
  });
  await page.context().close();
}
await step({ j: "D", d: "NFR-01: Response rows carry no user and no time; their order does not reveal who answered", pre: "5 responses, 5 participations in round A", steps: "PRAGMA table_info(Response/Participation); compare stored rows with what each member sent", exp: "Response columns = id, roundId, teamId, v1..v5, comment; Participation = roundId, userId; ids are UUIDs; both WITHOUT ROWID" }, async () => {
  const rc = (await db.$queryRawUnsafe(`PRAGMA table_info("Response")`)).map((c) => c.name);
  const pc = (await db.$queryRawUnsafe(`PRAGMA table_info("Participation")`)).map((c) => c.name);
  const ddl = await db.$queryRawUnsafe(`SELECT name, sql FROM sqlite_master WHERE name IN ('Response','Participation')`);
  const without = ddl.every((d) => /WITHOUT ROWID/i.test(d.sql));
  const rows = await db.response.findMany({ where: { roundId: roundA.id } });
  const uuid = rows.every((r) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.id));
  const ok = rc.join(",") === "id,roundId,teamId,v1,v2,v3,v4,v5,comment" && pc.join(",") === "roundId,userId" && without && uuid;
  return [ok, `Response cols=${rc.join(",")}; Participation cols=${pc.join(",")}; WITHOUT ROWID=${without}; uuid ids=${uuid}`];
});
const mgrA = await session(U.mgrA);
const mgrAApi = await api(U.mgrA);
await step({ j: "A", d: "Open round shows only participation to the manager, in the UI and in the API", pre: "round A open with 5 of 6", steps: "manager Alfa opens /rounds/:id/results; GET /api/rounds/:id/results", exp: "'Odpovedalo 5 z 6 členov tímu', 'Výsledky sa zobrazia až po uzavretí kola…', no averages or comments (MVP-10)" }, async () => {
  await mgrA.goto(`${BASE}/rounds/${roundA.id}/results`, { waitUntil: "networkidle" });
  const text = await mainOnly(mgrA);
  const r = await mgrAApi(`/api/rounds/${roundA.id}/results`);
  const leak = /average|distribution|comments/.test(r.text) && r.text.includes(ADAM_COMMENT);
  return [text.includes("Odpovedalo 5 z 6 členov tímu") && text.includes("Výsledky sa zobrazia až po uzavretí kola") && !text.includes("Priemer") && !r.text.includes("QA Adam"),
    `UI participation ok=${text.includes("Odpovedalo 5 z 6 členov tímu")}; UI has 'Priemer'=${text.includes("Priemer")}; API keys=${Object.keys(r.json ?? {}).join(",")}; comment leak=${leak}`, await shot(mgrA, "m1-16-open-results")];
});
await step({ j: "A", d: "Manager also sees the own-team round to fill in, and fills it as the sixth person", pre: "manager Alfa has not answered", steps: "home → 'Vyplniť' → wizard 4,4,4,3", exp: "thank-you; 6 responses, 6 participations (matrix: manager fills own team's round)" }, async () => {
  await mgrA.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const link = await mgrA.locator("main#main").getByRole("link", { name: "Vyplniť" }).count();
  await wizard(mgrA, roundA.id, [4, 4, 4, 3], "");
  answersA.push([4, 4, 4, 3]);
  const n = await db.response.count({ where: { roundId: roundA.id } }); const p = await db.participation.count({ where: { roundId: roundA.id } });
  return [link >= 1 && n === 6 && p === 6, `fill links on home=${link}; responses=${n}; participations=${p}`];
});
await step({ j: "C", d: "HR cannot fill in a round (page and API)", pre: "round A open", steps: "HR opens /rounds/:id/fill; POST responses as HR", exp: "403 page; API 403; nothing stored (matrix)" }, async () => {
  await hr.goto(`${BASE}/rounds/${roundA.id}/fill`, { waitUntil: "networkidle" });
  const forbidden = await hr.getByRole("heading", { name: "Sem nemáš prístup" }).isVisible().catch(() => false);
  const r = await hrApi(`/api/rounds/${roundA.id}/responses`, "POST", { answers: [3, 3, 3, 3] });
  const n = await db.response.count({ where: { roundId: roundA.id } });
  return [forbidden && r.status === 403 && n === 6, `403 page=${forbidden}; API HTTP ${r.status}; responses=${n}`];
});

// ───────────────────────── threshold: round B with exactly 4 responses
const answersB = [[3, 4, 2, 5, 1], [4, 4, 3, 5, 2], [2, 3, 3, 4, 2], [5, 5, 4, 4, 3]];
const filip = await session(U.beta[0]);
await step({ j: "A", d: "Member of Tím Beta fills a 5-question round incl. the manager's own question", pre: "round B open", steps: "Filip: wizard 3,4,2,5,1 with a comment", exp: "progress up to '5 z 5'; own question is the last one; thank-you" }, async () => {
  await filip.goto(`${BASE}/rounds/${roundB.id}/fill`, { waitUntil: "networkidle" });
  await filip.getByRole("button", { name: "Začať" }).click();
  let lastLegend = "";
  for (let i = 0; i < 5; i++) {
    await filip.getByText(`Otázka ${i + 1} z 5`).waitFor({ state: "attached" });
    lastLegend = await filip.locator("main#main fieldset legend").innerText();
    await filip.locator("fieldset button[aria-pressed]").nth(answersB[0][i] - 1).click();
    await filip.getByRole("button", { name: "Ďalej" }).click();
  }
  await filip.locator("textarea").fill("Tajný komentár pod prahom (QA Filip).");
  await filip.getByRole("button", { name: "Odoslať" }).click();
  await filip.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 10000 });
  return [lastLegend === CUSTOM_Q, `5th legend='${lastLegend}'`];
});
await step({ j: "A", d: "Three more Beta members answer (API), giving exactly 4 responses", pre: "round B open, 1 response", steps: "POST responses as Gabriela, Hugo, Ivana", exp: "201 ×3; 4 responses, 4 participations" }, async () => {
  const st = [];
  for (let i = 1; i <= 3; i++) st.push((await apiRespond(U.beta[i], roundB.id, answersB[i], i === 1 ? "Druhý tajný komentár (QA Gabriela)." : "")).status);
  const n = await db.response.count({ where: { roundId: roundB.id } });
  return [st.every((s) => s === 201) && n === 4, `statuses=${st.join(",")}; responses=${n}`];
});
await step({ j: "A", d: "Manager closes the round through the confirm dialog", pre: "round B open with 4 of 6", steps: "manager Beta on /rounds: Uzavrieť → confirm", exp: "toast 'Kolo je uzavreté.'; row 'Uzavreté' + 'Čaká na krok'; DB CLOSED with closedAt ≈ now (MVP-05, MVP-15, IT-05)" }, async () => {
  await mgrB.goto(`${BASE}/rounds`, { waitUntil: "networkidle" });
  await transition(mgrB, rowById(mgrB, roundB.id), "Uzavrieť", true);
  await toast(mgrB, "Kolo je uzavreté.").waitFor({ timeout: 8000 });
  await rowById(mgrB, roundB.id).getByText("Čaká na krok").waitFor({ timeout: 8000 });
  const r = await db.round.findUnique({ where: { id: roundB.id } });
  const fresh = r.closedAt && Math.abs(Date.now() - r.closedAt.getTime()) < 60000;
  return [r.status === "CLOSED" && fresh, `db=${r.status}, closedAt within 60 s=${fresh}`, await shot(mgrB, "m1-17-closed-row")];
});
const mgrBApi = await api(U.mgrB);
await step({ j: "A", d: "Below the threshold the API returns only the state and the count", pre: "round B closed with 4 responses", steps: "GET /api/rounds/:id/results as manager Beta and as HR", exp: "status 'insufficient_responses', count 4, no averages, distribution or comments (MVP-11, NFR-02)" }, async () => {
  const a = await mgrBApi(`/api/rounds/${roundB.id}/results`); const b = await hrApi(`/api/rounds/${roundB.id}/results`);
  const clean = (r) => !/QA Filip|QA Gabriela|average|distribution/.test(r.text) && r.text.includes("insufficient_responses");
  return [clean(a) && clean(b), `manager: ${a.text.slice(0, 300)} | HR clean=${clean(b)}`];
});
await step({ j: "A", d: "Below the threshold the results page shows 'Nedostatok odpovedí' and nothing else", pre: "round B closed with 4", steps: "manager Beta opens results", exp: "'Nedostatok odpovedí', 'Kolo má 4 odpovede. Výsledky sa zobrazujú až od 5…'; no averages, comments, summary or suggestions (MVP-11, IT-09, IT-13)" }, async () => {
  await mgrB.goto(`${BASE}/rounds/${roundB.id}/results`, { waitUntil: "networkidle" });
  const text = await mainOnly(mgrB);
  const bad = ["Priemer", "V skratke", "Návrhy krokov", "Komentáre", "QA Filip", "QA Gabriela"].filter((s) => text.includes(s));
  return [text.includes("Nedostatok odpovedí") && text.includes("Kolo má 4 odpovede. Výsledky sa zobrazujú až od 5, aby odpovede zostali dôverné.") && bad.length === 0, `forbidden strings present=${bad.join("|") || "none"}`, await shot(mgrB, "m1-18-insufficient")];
});
await step({ j: "A", d: "Below the threshold: suggestions endpoint, report, team page, trend and comparison give no values", pre: "round B closed with 4", steps: "GET suggestions; open report, team page, trend (manager Beta), heatmap (HR)", exp: "no suggestion; report and team page say 'Nedostatok odpovedí'; trend row without values; comparison has no Beta value (IT-08, IT-09)" }, async () => {
  const s = await mgrBApi(`/api/rounds/${roundB.id}/suggestions`);
  await mgrB.goto(`${BASE}/rounds/${roundB.id}/report`, { waitUntil: "networkidle" });
  const report = await mainOnly(mgrB);
  await mgrB.goto(`${BASE}/team/${teamB.id}`, { waitUntil: "networkidle" });
  const team = await mgrB.locator("main#main ol > li", { hasText: NAME_B }).innerText();
  await mgrB.goto(`${BASE}/team/${teamB.id}/trend`, { waitUntil: "networkidle" });
  const trendRow = (await mgrB.locator("tbody tr", { hasText: NAME_B }).locator("td").allInnerTexts()).join("|");
  const trendApi = await mgrBApi(`/api/teams/${teamB.id}/trend`);
  await hr.goto(`${BASE}/hr/heatmap`, { waitUntil: "networkidle" });
  const heat = await mainOnly(hr);
  const sumApi = await mgrBApi(`/api/teams/${teamB.id}/summary`);
  const apiLeak = /"average":\s*\d/.test(JSON.stringify(sumApi.json.rounds?.find((r) => r.id === roundB.id) ?? {}));
  const ok = !/"topic"|"description"/.test(JSON.stringify(s.json?.suggestions ?? [])) && (s.json?.suggestions ?? []).length === 0 && report.includes("Nedostatok odpovedí") && !report.includes("Priemer")
    && team.includes("Nedostatok odpovedí") && !team.includes("Priemer") && !/\d[,.]\d/.test(trendRow) && trendRow.startsWith("4|") && heat.includes("V tomto období nemá žiadny tím uzavreté kolo nad prahom dôvernosti.") && !apiLeak;
  return [ok, `suggestions HTTP ${s.status} ${s.text.slice(0, 120)}; report insufficient=${report.includes("Nedostatok odpovedí")}; team insufficient=${team.includes("Nedostatok odpovedí")}; trend cells='${trendRow}'; trend API has avg for it=${JSON.stringify(trendApi.json).includes('"fixed":')}; heatmap empty=${heat.includes("V tomto období nemá žiadny tím")}; summary API leak=${apiLeak}`, await shot(mgrB, "m1-19-trend-gap")];
});
await step({ j: "A", d: "A fifth response cannot be added after closing", pre: "round B closed", steps: "Jakub opens the fill page; POST responses via API", exp: "page 'Kolo je uzavreté'; API 409; still 4 responses (MVP-09)" }, async () => {
  const jakub = await session(U.beta[4]);
  await jakub.goto(`${BASE}/rounds/${roundB.id}/fill`, { waitUntil: "networkidle" });
  const h = await jakub.getByRole("heading", { name: "Kolo je uzavreté" }).isVisible().catch(() => false);
  const r = await apiRespond(U.beta[4], roundB.id, [1, 1, 1, 1, 1]);
  const n = await db.response.count({ where: { roundId: roundB.id } });
  await jakub.context().close();
  return [h && r.status === 409 && n === 4, `closed page=${h}; API HTTP ${r.status} ${r.text}; responses=${n}`];
});

// ───────────────────────── round A closed by the manager: results above the threshold
await step({ j: "A", d: "Manager Alfa closes round A (6 responses) through the dialog", pre: "round A open, 6 of 6", steps: "/rounds: Uzavrieť → confirm", exp: "toast; DB CLOSED" }, async () => {
  await mgrA.goto(`${BASE}/rounds`, { waitUntil: "networkidle" });
  await transition(mgrA, rowById(mgrA, roundA.id), "Uzavrieť", true);
  await toast(mgrA, "Kolo je uzavreté.").waitFor({ timeout: 8000 });
  const s = (await db.round.findUnique({ where: { id: roundA.id } })).status;
  return [s === "CLOSED", `db=${s}`];
});
const avg = (i) => round2(answersA.reduce((s, a) => s + a[i], 0) / answersA.length);
await mgrA.goto(`${BASE}/rounds/${roundA.id}/results`, { waitUntil: "networkidle" });
await step({ j: "D", d: "Results page: participation and the average of every question equal the values the members sent", pre: "round A closed, answers known to the script", steps: "read each question's 'Priemer'", exp: `'Odpovedalo 6 z 6 členov tímu'; averages ${[0, 1, 2, 3].map((i) => sk(avg(i))).join(" / ")} in question order (MVP-10)` }, async () => {
  const text = await mainOnly(mgrA);
  const items = mgrA.locator("main#main section", { has: mgrA.getByRole("heading", { name: "Otázky" }) }).locator("ul > li:has(h3)");
  const ui = [];
  for (let i = 0; i < await items.count(); i++) ui.push([await items.nth(i).locator("h3").innerText(), (await items.nth(i).locator("p", { hasText: "Priemer" }).innerText()).replace(/\s+/g, " ").replace("Priemer ", "")]);
  const ok = ui.length === 4 && ui.every(([q, a], i) => q === roundA.questions[i].question.text && a === sk(avg(i))) && text.includes("Odpovedalo 6 z 6 členov tímu");
  return [ok, `UI=${ui.map((u) => u[1]).join(" / ")}; expected=${[0, 1, 2, 3].map((i) => sk(avg(i))).join(" / ")}`, await shot(mgrA, "m1-20-results")];
});
await step({ j: "D", d: "Results API equals the database and the UI; no author information anywhere", pre: "round A closed", steps: "GET /api/rounds/:id/results; compare with Response rows", exp: "averages and distributions recomputed from DB match; body has no userId, name or e-mail of a respondent (NFR-01)" }, async () => {
  const r = await mgrAApi(`/api/rounds/${roundA.id}/results`);
  const rows = await db.response.findMany({ where: { roundId: roundA.id } });
  const qs = r.json.questions ?? [];
  let ok = qs.length === 4;
  qs.forEach((q, i) => {
    const vals = rows.map((x) => x[`v${i + 1}`]);
    const dist = [1, 2, 3, 4, 5].map((v) => vals.filter((x) => x === v).length);
    if (Math.abs(q.average - vals.reduce((a, b) => a + b, 0) / vals.length) > 0.006) ok = false;
    if (JSON.stringify(q.distribution) !== JSON.stringify(dist) && JSON.stringify(Object.values(q.distribution)) !== JSON.stringify(dist)) ok = false;
  });
  const names = (await db.user.findMany({ where: { teamId: teamA.id } })).flatMap((u) => [u.id, u.email, u.name]);
  const leak = names.filter((n) => r.text.includes(n));
  return [ok && leak.length === 0, `questions=${qs.length}; averages=${qs.map((q) => q.average).join(",")}; identity strings in body=${leak.length}; keys=${Object.keys(r.json).join(",")}`];
});
await step({ j: "D", d: "Distribution of answers is collapsed and, when opened, equals the database", pre: "results page", steps: "check <details> closed; open the first; read 'Hodnota n: k×'", exp: "collapsed by default; counts equal DB for question 1 (IT-13, MVP-10)" }, async () => {
  const d = mgrA.locator("main#main details", { hasText: "Rozdelenie odpovedí" }).first();
  const wasOpen = await d.evaluate((e) => e.open);
  await d.locator("summary").click();
  const labels = await d.locator("li[aria-label]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const vals = answersA.map((a) => a[0]);
  const exp = [1, 2, 3, 4, 5].map((v) => `Hodnota ${v}: ${vals.filter((x) => x === v).length}×`);
  return [!wasOpen && labels.join(";") === exp.join(";"), `open by default=${wasOpen}; UI=${labels.join(";")}`];
});
await step({ j: "D", d: "Comments: collapsed with the count in the heading; the set equals the database; no names", pre: "3 comments were sent", steps: "read heading; open; read blockquotes", exp: "'Komentáre (3)', the three texts, hint 'V náhodnom poradí, bez mien.' (MVP-10, IT-13)" }, async () => {
  const d = mgrA.locator("main#main details", { has: mgrA.getByRole("heading", { name: /Komentáre/ }) });
  const heading = await d.getByRole("heading").innerText();
  const wasOpen = await d.evaluate((e) => e.open);
  await d.locator("summary").click();
  const quotes = (await d.locator("blockquote").allInnerTexts()).sort();
  const names = (await db.user.findMany({ where: { teamId: teamA.id } })).map((u) => u.name);
  const text = await d.innerText();
  return [heading === "Komentáre (3)" && !wasOpen && JSON.stringify(quotes) === JSON.stringify([...commentsA].sort()) && !names.some((n) => text.includes(n)), `heading='${heading}', open by default=${wasOpen}, comments match=${JSON.stringify(quotes) === JSON.stringify([...commentsA].sort())}`, await shot(mgrA, "m1-21-comments")];
});
await step({ j: "D", d: "Comments are served in a random order (not the order of submission)", pre: "3 comments", steps: "GET results 12×; collect the orders", exp: "more than one distinct order (MVP-10)" }, async () => {
  const orders = new Set();
  for (let i = 0; i < 12; i++) orders.add(JSON.stringify((await mgrAApi(`/api/rounds/${roundA.id}/results`)).json.comments));
  return [orders.size > 1, `distinct orders in 12 calls=${orders.size}`];
});
let suggestions = [];
await step({ j: "G", d: "Summary box names the best and the weakest question and the first suggested step", pre: "results page", steps: "read 'V skratke'; compare with averages and GET suggestions", exp: "best = highest average, weakest = lowest (fixed question excluded from weakest per IT-09 only for suggestions); suggested step = first suggestion (IT-13)" }, async () => {
  const text = await mainOnly(mgrA);
  suggestions = (await mgrAApi(`/api/rounds/${roundA.id}/suggestions`)).json.suggestions ?? [];
  const avgs = [0, 1, 2, 3].map(avg);
  const best = roundA.questions[avgs.indexOf(Math.max(...avgs))].question.text;
  const worst = roundA.questions[avgs.indexOf(Math.min(...avgs))].question.text;
  const b = text.includes(`Najlepšie: „${best}“ (${sk(Math.max(...avgs))}).`);
  const w = text.includes(`Najslabšie: „${worst}“ (${sk(Math.min(...avgs))}).`);
  const first = suggestions[0]?.suggestion ?? "";
  const s = first && text.includes(first);
  return [b && w && s, `best ok=${b}, weakest ok=${w}, first suggestion shown=${!!s}; summary='${text.slice(text.indexOf("V skratke"), text.indexOf("V skratke") + 330)}'`];
});
await step({ j: "G", d: "Two rule-based suggestions for the two weakest non-fixed questions from different topics, labelled as not AI", pre: "results page", steps: "read 'Návrhy krokov'; compare with API and own computation", exp: "2 suggestions, different topics, note 'Návrhy podľa pravidiel, nie AI', each names its question and average (IT-09)" }, async () => {
  const text = await mainOnly(mgrA);
  const note = text.includes("Návrhy podľa pravidiel, nie AI");
  const buttons = await mgrA.getByRole("button", { name: "Použiť ako krok" }).count();
  const topics = new Set(suggestions.map((s) => s.topic));
  const nonFixed = [1, 2, 3].map((i) => ({ q: roundA.questions[i].question, a: avg(i) })).sort((x, y) => x.a - y.a);
  const weakest = nonFixed[0];
  const refers = text.includes(`Reaguje na otázku „${weakest.q.text}“ (priemer ${sk(weakest.a)}).`);
  return [note && buttons === 2 && suggestions.length === 2 && topics.size === 2 && refers, `note=${note}, buttons=${buttons}, API suggestions=${suggestions.length}, topics=${[...topics].join(" | ")}, refers to weakest (${weakest.q.text.slice(0, 40)}…)=${refers}`, await shot(mgrA, "m1-22-suggestions")];
});
await step({ j: "A", d: "'Použiť ako krok' copies the suggestion into the step form without saving", pre: "results page, no action yet", steps: "click the first 'Použiť ako krok'", exp: "topic and description filled; no Action in DB yet (IT-09)" }, async () => {
  await mgrA.getByRole("button", { name: "Použiť ako krok" }).first().click();
  const topic = await mgrA.inputValue('input[name="topic"]'); const desc = await mgrA.inputValue('textarea[name="description"]');
  const n = await db.action.count({ where: { roundId: roundA.id } });
  return [topic !== "" && desc !== "" && n === 0, `topic='${topic}', description='${desc.slice(0, 60)}…', actions in DB=${n}`];
});
await step({ j: "A", d: "Step form refuses to save without a due date", pre: "topic and description prefilled, no date", steps: "Pridať krok", exp: "inline message 'Zadaj platný termín.'; no toast; no Action stored (MVP-13)" }, async () => {
  await mgrA.getByRole("button", { name: "Pridať krok" }).click();
  await mgrA.waitForTimeout(800);
  const msg = await mgrA.getByText("Zadaj platný termín.").isVisible().catch(() => false);
  const generic = await mgrA.getByText("Vyplň tému, čo sa urobí a platný termín.").isVisible().catch(() => false);
  const t = await toast(mgrA, "Krok je pridaný.").count();
  const n = await db.action.count({ where: { roundId: roundA.id } });
  return [(msg || generic) && t === 0 && n === 0, `field message=${msg}, generic message=${generic}, toast=${t}, actions=${n}`, await shot(mgrA, "m1-23-action-invalid")];
});
const DUE = ymd(new Date(Date.now() + 14 * DAY));
let actionRow;
await step({ j: "A", d: "Manager writes the step", pre: "form prefilled", steps: `due date ${DUE}; Pridať krok`, exp: "toast 'Krok je pridaný.'; step in the list with status 'Plánované'; DB Action with the same topic, text, date, PLANNED, createdAt (MVP-13, IT-05)" }, async () => {
  const topic = await mgrA.inputValue('input[name="topic"]'); const desc = await mgrA.inputValue('textarea[name="description"]');
  await mgrA.fill('input[name="dueDate"]', DUE);
  await mgrA.getByRole("button", { name: "Pridať krok" }).click();
  await toast(mgrA, "Krok je pridaný.").waitFor({ timeout: 8000 });
  actionRow = await db.action.findFirst({ where: { roundId: roundA.id } });
  const sel = mgrA.locator('#kroky select[aria-label="Stav"]');
  await sel.first().waitFor({ timeout: 8000 });
  const value = await sel.first().inputValue();
  const ok = actionRow?.topic === topic && actionRow.description === desc && ymd(actionRow.dueDate) === DUE && actionRow.status === "PLANNED" && value === "PLANNED" && actionRow.createdAt;
  return [ok, `db topic ok=${actionRow?.topic === topic}, due=${actionRow && ymd(actionRow.dueDate)}, status=${actionRow?.status}, UI select=${value}`, await shot(mgrA, "m1-24-action-added")];
});
await step({ j: "A", d: "Form is cleared after saving and 'Čaká na krok' disappears from the list of rounds", pre: "step saved", steps: "read the form; open /rounds", exp: "empty topic; row of round A without 'Čaká na krok' (MVP-15)" }, async () => {
  const topic = await mgrA.inputValue('input[name="topic"]');
  await mgrA.goto(`${BASE}/rounds`, { waitUntil: "networkidle" });
  const text = await rowById(mgrA, roundA.id).innerText();
  return [topic === "" && !text.includes("Čaká na krok"), `topic after save='${topic}', row='${text.replace(/\s+/g, " ")}'`];
});
await step({ j: "A", d: "Manager changes the status of the step", pre: "step PLANNED", steps: "results → select 'Prebieha'", exp: "toast 'Stav kroku je uložený.'; DB IN_PROGRESS; value survives a reload (MVP-13)" }, async () => {
  await mgrA.goto(`${BASE}/rounds/${roundA.id}/results`, { waitUntil: "networkidle" });
  await mgrA.locator('#kroky select[aria-label="Stav"]').first().selectOption("IN_PROGRESS");
  await toast(mgrA, "Stav kroku je uložený.").waitFor({ timeout: 8000 });
  const s = (await db.action.findUnique({ where: { id: actionRow.id } })).status;
  await mgrA.reload({ waitUntil: "networkidle" });
  const v = await mgrA.locator('#kroky select[aria-label="Stav"]').first().inputValue();
  return [s === "IN_PROGRESS" && v === "IN_PROGRESS", `db=${s}, after reload=${v}`];
});

// ───────────────────────── team page, report, trend, heatmap, HR view
await step({ j: "A", d: "Employee sees the step and the averages in 'Povedali ste, urobili sme'", pre: "round A closed with a step IN_PROGRESS", steps: "Adam opens the team page", exp: "round A on top: 'Odpovedalo 6 z 6', 4 averages equal to the results, step topic + text + 'Prebieha' + due date; no comments (MVP-14)" }, async () => {
  await adam.goto(`${BASE}/team/${teamA.id}`, { waitUntil: "networkidle" });
  const first = adam.locator("main#main ol > li").first();
  const text = (await first.innerText()).replace(/\s+/g, " ");
  const avgs = [0, 1, 2, 3].every((i) => text.includes(`${roundA.questions[i].question.text} Priemer ${sk(avg(i))}`) || text.includes(`Priemer ${sk(avg(i))}`));
  const ok = text.startsWith(NAME_A) && text.includes("Odpovedalo 6 z 6") && avgs && text.includes(actionRow.topic) && text.includes(actionRow.description) && text.includes("Prebieha") && text.includes(`Termín ${fmtDate(actionRow.dueDate)}`) && !commentsA.some((c) => text.includes(c));
  return [ok, text.slice(0, 500), await shot(adam, "m1-25-team-page")];
});
await step({ j: "D", d: "Team summary API equals the team page and never contains comments or respondents", pre: "as above", steps: "Adam: GET /api/teams/:id/summary", exp: "round A with responded 6, averages, action; no comment text; no participation list (NFR-01)" }, async () => {
  const r = await adamApi(`/api/teams/${teamA.id}/summary`);
  const ra = r.json.rounds.find((x) => x.id === roundA.id);
  const leak = commentsA.some((c) => r.text.includes(c)) || /userId|participations/.test(r.text.replace(/fromUser|toUser/g, ""));
  return [ra && ra.actions.length === 1 && ra.actions[0].status === "IN_PROGRESS" && !leak, `round keys=${Object.keys(ra ?? {}).join(",")}; actions=${ra?.actions.length}; leak=${leak}`];
});
await step({ j: "C", d: "Employee cannot open results, report, suggestions or the step form", pre: "Adam logged in", steps: "open /rounds/:id/results and /report; GET results, suggestions; POST actions", exp: "403 pages; API 403 ×3; no Action added (matrix)" }, async () => {
  await adam.goto(`${BASE}/rounds/${roundA.id}/results`, { waitUntil: "networkidle" });
  const p1 = await adam.getByRole("heading", { name: "Sem nemáš prístup" }).isVisible().catch(() => false);
  await adam.goto(`${BASE}/rounds/${roundA.id}/report`, { waitUntil: "networkidle" });
  const p2 = await adam.getByRole("heading", { name: "Sem nemáš prístup" }).isVisible().catch(() => false);
  const a = await adamApi(`/api/rounds/${roundA.id}/results`); const b = await adamApi(`/api/rounds/${roundA.id}/suggestions`);
  const c = await adamApi(`/api/rounds/${roundA.id}/actions`, "POST", { topic: "x", description: "y", dueDate: DUE, status: "PLANNED" });
  const n = await db.action.count();
  return [p1 && p2 && a.status === 403 && b.status === 403 && c.status === 403 && n === 1, `pages 403=${p1},${p2}; API ${a.status},${b.status},${c.status}; actions=${n}`, await shot(adam, "m1-26-emp-403")];
});
await step({ j: "F", d: "Manager of Tím Beta cannot see results of Tím Alfa (acceptance step 3)", pre: "round A closed above the threshold", steps: "manager Beta: results page, report, team page, trend; API results, summary, trend, close", exp: "403 everywhere (NFR-03)" }, async () => {
  const pages = [];
  for (const u of [`/rounds/${roundA.id}/results`, `/rounds/${roundA.id}/report`, `/team/${teamA.id}`, `/team/${teamA.id}/trend`]) {
    await mgrB.goto(BASE + u, { waitUntil: "networkidle" });
    pages.push(await mgrB.getByRole("heading", { name: "Sem nemáš prístup" }).isVisible().catch(() => false));
  }
  const st = [];
  for (const u of [`/api/rounds/${roundA.id}/results`, `/api/teams/${teamA.id}/summary`, `/api/teams/${teamA.id}/trend`, `/api/rounds/${roundA.id}/suggestions`]) st.push((await mgrBApi(u)).status);
  st.push((await mgrBApi(`/api/actions/${actionRow.id}`, "PATCH", { status: "DONE" })).status);
  const s = (await db.action.findUnique({ where: { id: actionRow.id } })).status;
  return [pages.every(Boolean) && st.every((x) => x === 403) && s === "IN_PROGRESS", `pages 403=${pages.join(",")}; API=${st.join(",")}; action status still ${s}`, await shot(mgrB, "m1-27-mgrB-403")];
});
await step({ j: "A", d: "HR sees the same results, but has no step form and cannot write a step", pre: "round A closed", steps: "HR opens results; POST action as HR; PATCH action as HR", exp: "same averages; link 'Vytvoriť podnet z tohto kola'; no 'Pridať krok' form; status shown as text; API 403 ×2 (MVP-12, matrix)" }, async () => {
  await hr.goto(`${BASE}/rounds/${roundA.id}/results`, { waitUntil: "networkidle" });
  const text = await mainOnly(hr);
  const avgsOk = [0, 1, 2, 3].every((i) => text.includes(`Priemer ${sk(avg(i))}`));
  const form = await hr.locator('form:has(input[name="topic"])').count();
  const selects = await hr.locator('#kroky select').count();
  const link = await hr.getByRole("link", { name: "Vytvoriť podnet z tohto kola" }).count();
  const a = await hrApi(`/api/rounds/${roundA.id}/actions`, "POST", { topic: "x", description: "y", dueDate: DUE, status: "PLANNED" });
  const b = await hrApi(`/api/actions/${actionRow.id}`, "PATCH", { status: "DONE" });
  return [avgsOk && form === 0 && selects === 0 && link === 1 && a.status === 403 && b.status === 403, `averages=${avgsOk}, step form=${form}, status selects=${selects}, issue link=${link}, API ${a.status},${b.status}`, await shot(hr, "m1-28-hr-results")];
});
await step({ j: "G", d: "Printable report: results, steps and suggestions, but no comments", pre: "round A closed with comments", steps: "manager Alfa opens /rounds/:id/report", exp: "averages, step, suggestions, print button; note that comments are not included; none of the comment texts (IT-08)" }, async () => {
  await mgrA.goto(`${BASE}/rounds/${roundA.id}/report`, { waitUntil: "networkidle" });
  const text = await mainOnly(mgrA);
  const html = await mgrA.content();
  const leak = commentsA.filter((c) => html.includes(c));
  const btn = await mgrA.getByRole("button", { name: "Vytlačiť alebo uložiť ako PDF" }).count();
  const ok = [0, 1, 2, 3].every((i) => text.includes(sk(avg(i)))) && text.includes(actionRow.topic) && text.includes("Komentáre nie sú súčasťou reportu") && leak.length === 0 && btn === 1;
  return [ok, `averages present=${[0, 1, 2, 3].every((i) => text.includes(sk(avg(i))))}, step=${text.includes(actionRow.topic)}, comment texts in HTML=${leak.length}, print button=${btn}`, await shot(mgrA, "m1-29-report")];
});
await step({ j: "G", d: "Report in print media hides the menu and the buttons", pre: "report open", steps: "emulate print media; check visibility of header nav and print button", exp: "both hidden (IT-08)" }, async () => {
  await mgrA.emulateMedia({ media: "print" });
  const nav = await mgrA.locator("header nav").first().isVisible().catch(() => false);
  const btn = await mgrA.getByRole("button", { name: "Vytlačiť alebo uložiť ako PDF" }).isVisible().catch(() => false);
  const evidence = await shot(mgrA, "m1-30-report-print");
  await mgrA.emulateMedia({ media: "screen" });
  return [!nav && !btn, `nav visible=${nav}, print button visible=${btn}`, evidence];
});
await step({ j: "D", d: "Team trend: round A has values equal to the results, with the 'few rounds' warning", pre: "Tím Alfa has one closed round above the threshold", steps: "manager Alfa opens /team/:id/trend; GET trend API", exp: "row: 6 responses, fixed question average; 'Graf vychádza iba z 1 kola…' (IT-08)" }, async () => {
  await mgrA.goto(`${BASE}/team/${teamA.id}/trend`, { waitUntil: "networkidle" });
  const cells = await mgrA.locator("tbody tr", { hasText: NAME_A }).locator("td").allInnerTexts();
  const text = await mainOnly(mgrA);
  const few = text.includes("Graf vychádza iba z 1 kola. Na posúdenie vývoja je to málo, ber ho s rezervou.");
  return [cells[0] === "6" && cells[1] === sk(avg(0)) && few, `cells=${cells.join("|")}; few-rounds note=${few}`, await shot(mgrA, "m1-31-trend")];
});
await step({ j: "D", d: "Comparison of teams: Tím Alfa has values from round A, Tím Beta (4 and 4 responses) is absent or empty", pre: "A: 1 round above threshold; B: 2 rounds below", steps: "HR opens /hr/heatmap; GET /api/hr/heatmap", exp: "Alfa: '1 kolo', fixed question = its average; Beta has no numeric cell (IT-08)" }, async () => {
  await hr.goto(`${BASE}/hr/heatmap`, { waitUntil: "networkidle" });
  const rowA = await hr.locator("tbody tr", { hasText: "Tím Alfa" }).innerText();
  const rowBCount = await hr.locator("tbody tr", { hasText: "Tím Beta" }).count();
  const rowB = rowBCount ? await hr.locator("tbody tr", { hasText: "Tím Beta" }).locator("td").allInnerTexts() : [];
  const fixedCell = await hr.locator("tbody tr", { hasText: "Tím Alfa" }).locator("td").first().innerText();
  return [rowA.includes("1 kolo") && fixedCell === sk(avg(0)) && rowB.every((c) => c === "–"), `Alfa='${rowA.replace(/\s+/g, " ")}'; Beta cells='${rowB.join("|")}'`, await shot(hr, "m1-32-heatmap")];
});
await step({ j: "D", d: "HR overview after one step: numbers recomputed from the database", pre: "3 closed rounds (seed Beta, round B, round A); 1 step on round A", steps: "open /hr/overview; GET /api/hr/overview; count in DB", exp: "headline '2 z 3 uzavretých kôl čakajú na krok. Najdlhšie Tím Beta, …'; Alfa 'Krok má 1 z 1 uzavretého kola.'; Beta 'Krok má 0 z 2 uzavretých kôl.' (IT-05, IT-13, BUG-015)" }, async () => {
  await hr.goto(`${BASE}/hr/overview`, { waitUntil: "networkidle" });
  const text = await mainOnly(hr);
  const o = await hrApi("/api/hr/overview");
  const closed = await db.round.count({ where: { status: "CLOSED" } });
  const withAction = await db.round.count({ where: { status: "CLOSED", actions: { some: {} } } });
  const ok = closed === 3 && withAction === 1 && text.includes("2 z 3 uzavretých kôl čakajú na krok. Najdlhšie Tím Beta,") && text.includes("Krok má 1 z 1 uzavretého kola.") && text.includes("Krok má 0 z 2 uzavretých kôl.");
  return [ok, `DB closed=${closed}, with action=${withAction}; API total=${JSON.stringify(o.json.total ?? o.json.overall ?? {}).slice(0, 200)}; headline='${text.slice(text.indexOf("Ako často"), text.indexOf("Ako často") + 140)}'`, await shot(hr, "m1-33-overview")];
});
await step({ j: "G", d: "HR list of rounds: summary tiles and 'Čaká na krok' badges equal the database", pre: "as above", steps: "open /hr/rounds", exp: "Otvorené kolá 0, Čakajú na krok 2, Všetky kolá 3; badge on both Beta rounds, not on round A (MVP-12, MVP-15)" }, async () => {
  await hr.goto(`${BASE}/hr/rounds`, { waitUntil: "networkidle" });
  const dl = (await hr.locator('dl[aria-label="Súhrn kôl"]').innerText()).replace(/\s+/g, " ");
  const a = (await rowById(hr, roundA.id).innerText()).includes("Čaká na krok");
  const b = (await rowById(hr, roundB.id).innerText()).includes("Čaká na krok");
  const c = (await rowById(hr, seedBeta.id).innerText()).includes("Čaká na krok");
  return [dl === "Otvorené kolá 0 Čakajú na krok 2 Všetky kolá 3" && !a && b && c, `tiles='${dl}', badge A=${a}, B=${b}, seed Beta=${c}`, await shot(hr, "m1-34-hr-rounds")];
});

// ───────────────────────── next round: thank-you shows the steps of the last closed round; auto close
let roundC;
await step({ j: "A", d: "Next round: after submitting, the thank-you screen shows the steps of the last closed round", pre: "round A closed with a step; new round C opened by the manager (API)", steps: "Cyril fills round C through the wizard", exp: `section 'Čo sa urobilo po kole „${NAME_A}“' with the step and its status (MVP-09, MVP-14, BUG-020)` }, async () => {
  const qs = await db.question.findMany({ where: { fixed: false, teamId: null, starter: true }, take: 3, orderBy: { id: "desc" } });
  const c = await mgrAApi("/api/rounds", "POST", { name: "Pulse – ďalšie kolo QA", teamId: teamA.id, closesAt: ymd(new Date(Date.now() + 3 * DAY)), questionIds: qs.map((q) => q.id) });
  roundC = c.json.round;
  await mgrAApi(`/api/rounds/${roundC.id}/open`, "POST");
  const cyril = await session(U.alfa[2]);
  await wizard(cyril, roundC.id, [4, 4, 4, 4], "");
  const text = await mainOnly(cyril);
  const evidence = await shot(cyril, "m1-35-thanks-with-steps");
  await cyril.context().close();
  return [text.includes(`Čo sa urobilo po kole „${NAME_A}“`) && text.includes(actionRow.topic) && text.includes("Prebieha"), text.slice(0, 400), evidence];
});
await step({ j: "A", d: "Round closes automatically on the first load after its deadline, dated at the deadline", pre: "round C open; its closesAt shifted 2 h into the past in the QA database (time simulation)", steps: "manager opens /rounds", exp: "row 'Uzavreté'; DB CLOSED with closedAt = closesAt; fill page says 'Kolo je uzavreté' (MVP-05, IT-05)" }, async () => {
  const past = new Date(Date.now() - 2 * 3600e3);
  await db.round.update({ where: { id: roundC.id }, data: { closesAt: past } });
  await mgrA.goto(`${BASE}/rounds`, { waitUntil: "networkidle" });
  const text = await rowById(mgrA, roundC.id).innerText();
  const r = await db.round.findUnique({ where: { id: roundC.id } });
  await adam.goto(`${BASE}/rounds/${roundC.id}/fill`, { waitUntil: "networkidle" });
  const closedPage = await adam.getByRole("heading", { name: "Kolo je uzavreté" }).isVisible().catch(() => false);
  return [text.includes("Uzavreté") && r.status === "CLOSED" && r.closedAt?.getTime() === past.getTime() && closedPage, `row='${text.replace(/\s+/g, " ")}', db=${r.status}, closedAt==closesAt: ${r.closedAt?.getTime() === past.getTime()}, fill page closed=${closedPage}`];
});
await step({ j: "A", d: "Team page orders closed rounds by the real closing time, newest first (BUG-019)", pre: "round A closed by hand a few minutes ago (deadline in 7 days); round C auto-closed 2 h ago", steps: "Adam opens the team page", exp: `first '${NAME_A}' (closed now), then 'Pulse – ďalšie kolo QA'; date of round A = today, not its deadline` }, async () => {
  await adam.goto(`${BASE}/team/${teamA.id}`, { waitUntil: "networkidle" });
  const names = await adam.locator("main#main ol > li > h2").allInnerTexts();
  const first = await adam.locator("main#main ol > li").first().innerText();
  return [names[0] === NAME_A && names[1] === "Pulse – ďalšie kolo QA" && first.includes(`Uzavreté ${fmtDate(new Date())}`), `order=${names.join(" > ")}; first has today's date=${first.includes(`Uzavreté ${fmtDate(new Date())}`)}`];
});
await step({ j: "G", d: "Manager home: closed round without a step becomes a task that leads to its results", pre: "round C closed with 1 response, no step", steps: "manager Alfa opens /", exp: "task 'Kolo „Pulse – ďalšie kolo QA“ je uzavreté od dnes a tím čaká…' with 'Výsledky a krok' → /rounds/<C>/results (IT-11)" }, async () => {
  await mgrA.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const li = mgrA.locator("main#main ul[role=list] > li", { hasText: "Pulse – ďalšie kolo QA" });
  const text = await li.locator("p").innerText();
  const href = await li.getByRole("link", { name: "Výsledky a krok" }).getAttribute("href");
  return [text === "Kolo „Pulse – ďalšie kolo QA“ je uzavreté od dnes a tím čaká, čo sa s výsledkami stane. Pozri výsledky a zapíš krok." && href === `/rounds/${roundC.id}/results`, `task='${text}', href=${href}`, await shot(mgrA, "m1-36-mgr-home")];
});
await step({ j: "D", d: "Whole-database integrity after the cycle", pre: "all steps above", steps: "count rows per round", exp: "responses = participations in every round; no orphan rows; every response has the team of its round" }, async () => {
  const rounds = await db.round.findMany({ include: { _count: { select: { responses: true, participations: true } }, responses: true } });
  const bad = rounds.filter((r) => r._count.responses !== r._count.participations || r.responses.some((x) => x.teamId !== r.teamId));
  return [bad.length === 0, rounds.map((r) => `${r.name}: ${r._count.responses}/${r._count.participations}`).join("; ")];
});
const errs = [hr, mgrA, mgrB, adam, barbora, filip].flatMap((p) => p.errors);
await step({ j: "G", d: "No uncaught JavaScript error on any page during the whole cycle", pre: "6 browser sessions used above", steps: "collect 'pageerror' events", exp: "none" }, async () => [errs.length === 0, `page errors=${errs.length} ${errs.slice(0, 3).join(" | ")}`]);

await closeBrowser();
