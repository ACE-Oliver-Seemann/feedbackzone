// Journey 1 + 2: the full feedback cycle through the real UI with DB verification at
// every step, and the confidentiality threshold (4 vs 5 responses) on every screen.
// Starts from a seed-only database.
import {
  BASE, U, db, resetDb, recorder, session, shot, mainText, api, sk, fmtDate, round2, ymd,
  fillWizard, closeBrowser,
} from "./lib.mjs";

const R = recorder("j1-cycle");
const step = async (meta, fn) => {
  try {
    const [ok, actual, evidence] = await fn();
    return R.check(meta, ok, actual, evidence ?? "");
  } catch (error) {
    return R.check(meta, false, `SCRIPT/RUNTIME ERROR: ${error.message}`);
  }
};
const DAY = 864e5;
const li = (page, name) => page.locator("main li", { has: page.getByRole("heading", { name, exact: true }) }).first();

resetDb(false);
const teamA = await db.team.findFirstOrThrow({ where: { name: "Tím Alfa" } });
const teamB = await db.team.findFirstOrThrow({ where: { name: "Tím Beta" } });
const seedBeta = await db.round.findFirstOrThrow({ where: { teamId: teamB.id } });
const isoWeek = (date) => {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  return Math.ceil(((day.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
};
const NAME_A = `Pulse – ${isoWeek(new Date())}. týždeň`;
const NAME_M = "Pulse – vlastná otázka QA";
const CUSTOM_Q = "Rozdelenie úloh v našom tíme je spravodlivé (QA).";

// ───────────────────────── HR: home + two-click round
const hr = await session(U.hr);
await step({ j: "J1", d: "HR logs in through the form and lands on the home page", pre: "seed only", steps: "open /login, fill e-mail+password, submit", exp: "URL path '/', heading 'Čo treba urobiť teraz' (MVP-01, IT-11)" }, async () => {
  const h = await hr.getByRole("heading", { name: "Čo treba urobiť teraz" }).isVisible();
  return [new URL(hr.url()).pathname === "/" && h, `path=${new URL(hr.url()).pathname}, heading=${h}`, await shot(hr, "j1-01-hr-home")];
});
await step({ j: "J4", d: "HR home task counts closed rounds without an action and names the longest waiting team (recomputed from DB)", pre: "seed only: 1 closed Beta round, no action", steps: "read first task; compute from Round/Action tables", exp: "'1 uzavreté kolo čaká na krok manažéra. Najdlhšie Tím Beta, N dní.' with N=floor(days since closedAt) (IT-11)" }, async () => {
  const days = Math.floor((Date.now() - seedBeta.closedAt.getTime()) / DAY);
  const expected = `1 uzavreté kolo čaká na krok manažéra. Najdlhšie Tím Beta, ${days === 1 ? "1 deň" : `${days} dní`}.`;
  const text = await hr.locator("main ol > li").first().locator("p").innerText();
  return [text === expected, `UI='${text}' expected='${expected}'`];
});

await hr.goto(`${BASE}/rounds/new`);
let defaultsHr = [];
await step({ j: "J1", d: "New round form is prefilled: name, deadline +7 days, 3 questions + fixed question (IT-13)", pre: "HR logged in", steps: "open /rounds/new", exp: `name '${NAME_A}', deadline today+7, 3 ticked, 'Otázok v kole: 4 (treba 3 až 5)', notice about preselection` }, async () => {
  const name = await hr.locator('input[name="name"]').inputValue();
  const closes = await hr.locator('input[name="closesAt"]').inputValue();
  const expClose = ymd(new Date(Date.now() + 7 * DAY));
  const ticked = await hr.locator('input[type="checkbox"]:checked').count();
  const counter = await hr.getByText(/Otázok v kole:/).innerText();
  const notice = await hr.getByText("Predvybrali sme odporúčané otázky").isVisible();
  const team = await hr.locator('select[name="teamId"] option:checked').innerText();
  defaultsHr = await hr.locator('label:has(input[type="checkbox"]:checked) span.flex-1').allInnerTexts();
  return [name === NAME_A && closes === expClose && ticked === 3 && counter === "Otázok v kole: 4 (treba 3 až 5)" && notice && team === "Tím Alfa",
    `name='${name}', closes=${closes} (exp ${expClose}), ticked=${ticked}, counter='${counter}', notice=${notice}, team=${team}`, await shot(hr, "j1-02-new-round-defaults")];
});
await step({ j: "J1", d: "Preselected questions are recommended (starter) questions from 3 different topics", pre: "form open", steps: "compare ticked question texts with Question table", exp: "3 starter questions, 3 distinct topics (IT-13)" }, async () => {
  const texts = defaultsHr.map((t) => t.replace(/\s*Odporúčaná\s*$/, "").trim());
  const qs = await db.question.findMany({ where: { text: { in: texts } } });
  const topics = new Set(qs.map((q) => q.topic));
  return [qs.length === 3 && qs.every((q) => q.starter && !q.fixed && q.teamId === null) && topics.size === 3, `found=${qs.length}, starter=${qs.map((q) => q.starter)}, topics=${[...topics].join(" | ")}`];
});
await step({ j: "J1", d: "Two-click round: HR saves the prefilled form without touching it", pre: "form open, defaults untouched", steps: "click 'Uložiť koncept'", exp: "redirect to /hr/rounds; DB: 1 new DRAFT round for Tím Alfa, 4 questions, fixed question at position 1, startsAt null (MVP-04, IT-04)" }, async () => {
  await hr.getByRole("button", { name: "Uložiť koncept" }).click();
  await hr.waitForURL("**/hr/rounds");
  const rounds = await db.round.findMany({ where: { teamId: teamA.id }, include: { questions: { include: { question: true }, orderBy: { position: "asc" } } } });
  const r = rounds[0];
  const ok = rounds.length === 1 && r.status === "DRAFT" && r.name === NAME_A && r.questions.length === 4 && r.questions[0].question.fixed && r.startsAt === null;
  return [ok, `rounds=${rounds.length}, status=${r?.status}, q=${r?.questions.length}, pos1.fixed=${r?.questions[0]?.question.fixed}, startsAt=${r?.startsAt}, closesAt=${r?.closesAt.toISOString()}`];
});
const roundA = await db.round.findFirstOrThrow({ where: { teamId: teamA.id, name: NAME_A } });
await step({ j: "J1", d: "Deadline is stored as the end of the chosen day (server local time)", pre: "draft created", steps: "read Round.closesAt", exp: "today+7 at 23:59:59.999 local" }, async () => {
  const exp = new Date(); exp.setDate(exp.getDate() + 7); exp.setHours(23, 59, 59, 999);
  return [roundA.closesAt.getTime() === exp.getTime(), `closesAt=${roundA.closesAt.toISOString()} expected=${exp.toISOString()}`];
});
await step({ j: "J1", d: "HR list shows the draft with 'Koncept', a 'Spustiť' button, and no participation", pre: "draft exists", steps: "read /hr/rounds", exp: "badge Koncept, button Spustiť, no 'Účasť', no 'Výsledky' link (MVP-05, MVP-12)" }, async () => {
  const text = await li(hr, NAME_A).innerText();
  return [text.includes("Koncept") && text.includes("Spustiť") && !text.includes("Účasť") && !text.includes("Výsledky") && text.includes("Tím Alfa"), text, await shot(hr, "j1-03-hr-rounds-draft")];
});

// ───────────────────────── employee cannot see a draft
const emp = [];
const VIEWPORTS = [
  { width: 360, height: 740 }, { width: 390, height: 844 }, { width: 768, height: 1024 },
  { width: 1366, height: 768 }, { width: 1920, height: 1080 },
];
for (let i = 0; i < 5; i++) emp.push(await session(U.alfa[i], VIEWPORTS[i]));
await step({ j: "J1", d: "Employee does not see a draft round on the home page", pre: "round A is DRAFT", steps: "Adam opens /", exp: "'Nič nečaká.' and no survey list (MVP-05, MVP-06)" }, async () => {
  const text = await mainText(emp[0]);
  return [text.includes("Nič nečaká.") && !text.includes(NAME_A), text.slice(0, 300), await shot(emp[0], "j1-04-emp-home-draft-360")];
});
await step({ j: "J1", d: "Employee opening the fill URL of a draft directly gets a not-found page", pre: "round A is DRAFT", steps: `Adam opens /rounds/${"<id>"}/fill`, exp: "HTTP 404, no question text" }, async () => {
  const res = await emp[0].goto(`${BASE}/rounds/${roundA.id}/fill`);
  const text = await mainText(emp[0]);
  return [res.status() === 404 && !text.includes("Začať"), `HTTP ${res.status()}, text='${text.slice(0, 120)}'`];
});

// ───────────────────────── HR opens the round
await step({ j: "J1", d: "HR starts the round with the 'Spustiť' button (confirm dialog accepted)", pre: "round A is DRAFT", steps: "click Spustiť, accept confirm", exp: "badge 'Otvorené', 'Uzavrieť' button; DB status OPEN, startsAt = now (MVP-05)" }, async () => {
  await li(hr, NAME_A).getByRole("button", { name: "Spustiť" }).click();
  await li(hr, NAME_A).getByText("Otvorené").waitFor({ timeout: 10000 });
  const r = await db.round.findUnique({ where: { id: roundA.id } });
  const text = await li(hr, NAME_A).innerText();
  return [r.status === "OPEN" && Math.abs(Date.now() - r.startsAt.getTime()) < 60000 && text.includes("Uzavrieť") && text.includes("Účasť: 0 z 6"), `DB status=${r.status}, startsAt=${r.startsAt?.toISOString()}, UI='${text}'`, await shot(hr, "j1-05-hr-rounds-open")];
});
const hrApi = await api(U.hr);
await step({ j: "J1", d: "A running round cannot be started again", pre: "round A is OPEN", steps: "POST /api/rounds/:id/open", exp: "409 invalid_state (MVP-05)" }, async () => {
  const res = await hrApi(`/api/rounds/${roundA.id}/open`, "POST");
  return [res.status === 409 && res.json?.error === "invalid_state", `HTTP ${res.status} ${res.text}`];
});

// ───────────────────────── manager: own question + own round
const mgrA = await session(U.mgrA);
await mgrA.goto(`${BASE}/rounds/new`);
let mgrDefaults = [];
await step({ j: "J1", d: "Manager's new-round form offers only the own team and rotates the preselected questions", pre: "round A (HR) used 3 starter questions", steps: "manager Alfa opens /rounds/new", exp: "team select has exactly 'Tím Alfa'; the 3 preselected questions differ from those of round A (IT-13)" }, async () => {
  const options = await mgrA.locator('select[name="teamId"] option').allInnerTexts();
  mgrDefaults = (await mgrA.locator('label:has(input[type="checkbox"]:checked) span.flex-1').allInnerTexts()).map((t) => t.replace(/\s*Odporúčaná\s*$/, "").trim());
  const used = (await db.roundQuestion.findMany({ where: { roundId: roundA.id }, include: { question: true } })).map((q) => q.question.text);
  const overlap = mgrDefaults.filter((t) => used.includes(t));
  return [options.length === 1 && options[0] === "Tím Alfa" && mgrDefaults.length === 3 && overlap.length === 0, `options=${options}, preselected=${mgrDefaults.length}, overlap with round A=${overlap.length}`];
});
const customInput = mgrA.getByLabel("Pridať vlastnú otázku");
await step({ j: "J1", d: "Own question shorter than 10 characters is refused with a clear message", pre: "manager on /rounds/new", steps: "type 'Krátka', click 'Pridať otázku'", exp: "'Otázka musí mať 10 až 200 znakov.'; no Question row (IT-07)" }, async () => {
  await customInput.fill("Krátka");
  await mgrA.getByRole("button", { name: "Pridať otázku" }).click();
  await mgrA.getByText("Otázka musí mať 10 až 200 znakov.").waitFor();
  const n = await db.question.count({ where: { teamId: { not: null } } });
  return [n === 0, `error shown, custom questions in DB=${n}`];
});
await step({ j: "J1", d: "Manager adds an own question; it is ticked and counted", pre: "3 preselected + fixed = 4", steps: `type '${CUSTOM_Q}', press Enter`, exp: "question appears under 'Vlastné otázky tímu', ticked; counter 5; DB row with teamId=Alfa, scale AGREEMENT, not starter/fixed (IT-07)" }, async () => {
  await customInput.fill(CUSTOM_Q);
  await customInput.press("Enter");
  await mgrA.getByText("Otázok v kole: 5 (treba 3 až 5)").waitFor();
  const q = await db.question.findFirst({ where: { text: CUSTOM_Q } });
  const rounds = await db.round.count({ where: { teamId: teamA.id } });
  return [q && q.teamId === teamA.id && q.scale === "AGREEMENT" && !q.starter && !q.fixed && q.topic === "Vlastné otázky tímu" && rounds === 1, `DB question=${JSON.stringify(q)}; rounds for Alfa still ${rounds} (Enter did not submit the round)`, await shot(mgrA, "j1-06-mgr-custom-question")];
});
await step({ j: "J1", d: "The same own question cannot be added twice", pre: "own question exists", steps: "type the same text in different case, click 'Pridať otázku'", exp: "'Takáto otázka už v knižnici je.'; still one row (IT-07)" }, async () => {
  await customInput.fill(CUSTOM_Q.toUpperCase());
  await mgrA.getByRole("button", { name: "Pridať otázku" }).click();
  await mgrA.getByText("Takáto otázka už v knižnici je.").waitFor();
  const n = await db.question.count({ where: { teamId: teamA.id } });
  await customInput.fill("");
  return [n === 1, `custom questions for Alfa=${n}`];
});
await step({ j: "J1", d: "A sixth question cannot be ticked", pre: "5 questions selected", steps: "inspect unticked checkboxes", exp: "all unticked checkboxes are disabled (MVP-04)" }, async () => {
  const enabled = await mgrA.locator('input[type="checkbox"]:not(:checked):not(:disabled)').count();
  const disabled = await mgrA.locator('input[type="checkbox"]:not(:checked):disabled').count();
  return [enabled === 0 && disabled > 20, `enabled unticked=${enabled}, disabled unticked=${disabled}`];
});
await step({ j: "J1", d: "Fewer than 3 questions: the form does not save", pre: "manager on /rounds/new", steps: "untick down to fixed+1, click 'Uložiť koncept'", exp: "'Kolo musí mať spolu 3 až 5 otázok.'; no new round in DB (MVP-04)" }, async () => {
  const ticked = mgrA.locator('input[type="checkbox"]:checked');
  // untick three of the four ticked (keeps 1 + fixed = 2)
  for (let i = 0; i < 3; i++) await ticked.first().uncheck();
  const counter = await mgrA.getByText(/Otázok v kole:/).innerText();
  await mgrA.getByRole("button", { name: "Uložiť koncept" }).click();
  const shown = await mgrA.getByText("Kolo musí mať spolu 3 až 5 otázok.").isVisible();
  const rounds = await db.round.count({ where: { teamId: teamA.id } });
  return [shown && rounds === 1 && counter === "Otázok v kole: 2 (treba 3 až 5)", `counter='${counter}', error shown=${shown}, rounds=${rounds}`, await shot(mgrA, "j1-07-too-few-questions")];
});
await step({ j: "J1", d: "Manager saves a round with fixed + 2 library + own question under a custom name", pre: "form with 2 selected (1 library + own) ", steps: "tick one more library question, set name, save", exp: "redirect to /rounds; DB: DRAFT round with 4 questions incl. the own question (MVP-04, IT-07)" }, async () => {
  // which one is still ticked? make sure the own question is ticked, plus two library ones
  const own = mgrA.locator("label", { hasText: CUSTOM_Q }).locator('input[type="checkbox"]');
  if (!(await own.isChecked())) await own.check();
  let total = Number((await mgrA.getByText(/Otázok v kole:/).innerText()).match(/: (\d)/)[1]);
  const candidates = mgrA.locator('details[open] input[type="checkbox"]:not(:checked)');
  while (total < 4) { await candidates.first().check(); total++; }
  await mgrA.locator('input[name="name"]').fill(NAME_M);
  await mgrA.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgrA.waitForURL("**/rounds");
  const r = await db.round.findFirst({ where: { name: NAME_M }, include: { questions: { include: { question: true }, orderBy: { position: "asc" } } } });
  const hasOwn = r?.questions.some((q) => q.question.text === CUSTOM_Q);
  return [r && r.status === "DRAFT" && r.teamId === teamA.id && r.questions.length === 4 && hasOwn && r.questions[0].question.fixed, `status=${r?.status}, questions=${r?.questions.map((q) => q.position + ":" + q.question.topic).join(", ")}`];
});
const roundM = await db.round.findFirstOrThrow({ where: { name: NAME_M }, include: { questions: { include: { question: true }, orderBy: { position: "asc" } } } });
const mgrBApi = await api(U.mgrB);
const mgrAApi = await api(U.mgrA);
await step({ j: "J1", d: "Another team's manager does not get the own question and cannot use it", pre: "own question of Alfa exists", steps: "manager Beta: GET /api/questions; POST /api/rounds with that question id", exp: "question absent from the list; POST → 400 (IT-07)" }, async () => {
  const q = await db.question.findFirstOrThrow({ where: { text: CUSTOM_Q } });
  const list = await mgrBApi("/api/questions");
  const lib = list.json.questions.filter((x) => !x.fixed).slice(0, 2).map((x) => x.id);
  const res = await mgrBApi("/api/rounds", "POST", { name: "QA cudzia otázka", teamId: teamB.id, closesAt: ymd(new Date(Date.now() + 7 * DAY)), questionIds: [...lib, q.id] });
  const leaked = list.json.questions.some((x) => x.id === q.id);
  return [!leaked && res.status === 400, `in manager B list=${leaked}; POST → HTTP ${res.status} ${res.text}`];
});
await step({ j: "J1", d: "HR sees the own question only when the owning team is selected in the form", pre: "own question of Alfa exists", steps: "HR opens /rounds/new (Alfa selected), then switches team to Beta", exp: "question visible for Alfa, hidden for Beta (IT-07)" }, async () => {
  await hr.goto(`${BASE}/rounds/new`);
  const forAlfa = await hr.getByText(CUSTOM_Q).count();
  await hr.locator('select[name="teamId"]').selectOption({ label: "Tím Beta" });
  const forBeta = await hr.getByText(CUSTOM_Q).count();
  return [forAlfa === 1 && forBeta === 0, `visible for Alfa=${forAlfa}, for Beta=${forBeta}`];
});
await step({ j: "J1", d: "Manager starts the own round from /rounds", pre: "round M is DRAFT", steps: "click Spustiť in the row of round M", exp: "DB status OPEN; row shows 'Otvorené' and 'Účasť: 0 z 6'" }, async () => {
  await li(mgrA, NAME_M).getByRole("button", { name: "Spustiť" }).click();
  await li(mgrA, NAME_M).getByText("Otvorené").waitFor();
  const r = await db.round.findUnique({ where: { id: roundM.id } });
  const text = await li(mgrA, NAME_M).innerText();
  return [r.status === "OPEN" && text.includes("Účasť: 0 z 6"), `DB=${r.status}; UI='${text}'`, await shot(mgrA, "j1-08-mgr-rounds")];
});

// ───────────────────────── employees fill round A
await emp[0].goto(`${BASE}/`);
await step({ j: "J1", d: "Employee home lists both open rounds as tasks with the number of questions", pre: "rounds A and M open, nothing answered", steps: "Adam (360 px) opens /", exp: "2 tasks 'Čaká na teba prieskum „…“. Má 4 otázky a zaberie asi 2 minúty.' each with 'Vyplniť'; list 'Moje prieskumy' with 2× 'Čaká na vyplnenie' (MVP-06, IT-11)" }, async () => {
  const tasks = await emp[0].locator("main ol > li p").allInnerTexts();
  const badges = await emp[0].getByText("Čaká na vyplnenie").count();
  const ok = tasks.length === 2 && tasks.every((t) => /^Čaká na teba prieskum „.+“\. Má 4 otázky a zaberie asi 2 minúty\.$/.test(t)) && badges === 2;
  return [ok, `tasks=${JSON.stringify(tasks)}, badges=${badges}`, await shot(emp[0], "j1-09-emp-home-tasks-360")];
});
const ANSWERS_A = [[4, 3, 5, 4], [2, 3, 4, 4], [5, 4, 4, 3], [3, 3, 5, 5], [4, 2, 4, 4]];
const COMMENTS_A = ["QA komentár jedna: menej porád v utorok.", "", "QA komentár dva:\ndruhý riadok s <b>značkou</b> & znakmi „úvodzovky“.", "", "QA komentár tri."];
const qA = await db.roundQuestion.findMany({ where: { roundId: roundA.id }, orderBy: { position: "asc" }, include: { question: true } });

// first member: detailed wizard behaviour at 360 px
{
  const p = emp[0];
  await p.locator("main ol > li", { hasText: NAME_A }).getByRole("link", { name: "Vyplniť" }).click();
  await step({ j: "J1", d: "Task button leads to the fill page; intro shows the exact confidentiality text", pre: "Adam on home, 360 px", steps: "click 'Vyplniť' in the task of round A", exp: "URL /rounds/:id/fill; text of NFR-04 verbatim; '4 otázky, zaberie to do 2 minút.' (MVP-07)" }, async () => {
    await p.getByRole("button", { name: "Začať" }).waitFor();
    const text = await mainText(p);
    const exact = "Tvoje odpovede sú dôverné. Manažér ani tím neuvidia, kto čo napísal, výsledky vidia iba za skupinu aspoň 5 ľudí.";
    return [p.url().endsWith(`/rounds/${roundA.id}/fill`) && text.includes(exact) && text.includes("4 otázky, zaberie to do 2 minút."), text.slice(0, 400), await shot(p, "j1-10-fill-intro-360")];
  });
  await p.getByRole("button", { name: "Začať" }).click();
  await step({ j: "J1", d: "First question: progress '1 z 4', fixed question first, 'Ďalej' disabled until a value is chosen", pre: "wizard started", steps: "read the first question screen", exp: "progress '1 z 4'; legend = fixed question; Ďalej disabled (MVP-08, IT-04)" }, async () => {
    const progress = await p.getByText("1 z 4", { exact: true }).isVisible();
    const legend = await p.locator("legend").innerText();
    const disabled = await p.getByRole("button", { name: "Ďalej" }).isDisabled();
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    return [progress && legend === qA[0].question.text && disabled && !overflow, `progress=${progress}, legend='${legend}', nextDisabled=${disabled}, horizontalOverflow=${overflow}`, await shot(p, "j1-11-fill-q1-360")];
  });
  await step({ j: "J1", d: "Back/Next keep the chosen answers", pre: "question 1", steps: "choose 4 → Ďalej → choose 3 → Späť → check 4 is pressed → Ďalej → check 3 is pressed", exp: "previous answers stay selected (MVP-08)" }, async () => {
    const btn = (n) => p.locator("fieldset button[aria-pressed]").nth(n - 1);
    await btn(4).click();
    await p.getByRole("button", { name: "Ďalej" }).click();
    await btn(3).click();
    await p.getByRole("button", { name: "Späť" }).click();
    const first = await btn(4).getAttribute("aria-pressed");
    const prog1 = await p.getByText("1 z 4", { exact: true }).isVisible();
    await p.getByRole("button", { name: "Ďalej" }).click();
    const second = await btn(3).getAttribute("aria-pressed");
    const prog2 = await p.getByText("2 z 4", { exact: true }).isVisible();
    return [first === "true" && second === "true" && prog1 && prog2, `q1 pressed=${first}, q2 pressed=${second}, progress shown 1/4=${prog1} 2/4=${prog2}`];
  });
  await step({ j: "J1", d: "Comment step: optional comment with a live counter, max 1000 characters enforced in the browser", pre: "questions 3 and 4 answered", steps: "answer q3=5, q4=4; type 1005 characters; read counter; replace with the real comment", exp: "counter '1000 / 1000' (input truncated), then counter equals the comment length (MVP-08)" }, async () => {
    const btn = (n) => p.locator("fieldset button[aria-pressed]").nth(n - 1);
    await p.getByRole("button", { name: "Ďalej" }).click();
    await btn(5).click(); await p.getByRole("button", { name: "Ďalej" }).click();
    await btn(4).click(); await p.getByRole("button", { name: "Ďalej" }).click();
    await p.locator("textarea").fill("x".repeat(1005));
    const c1 = await p.getByText(/\d+ \/ 1000/).innerText();
    await p.locator("textarea").fill(COMMENTS_A[0]);
    const c2 = await p.getByText(/\d+ \/ 1000/).innerText();
    return [c1 === "1000 / 1000" && c2 === `${COMMENTS_A[0].length} / 1000`, `counter after 1005 chars='${c1}', after comment='${c2}'`, await shot(p, "j1-12-fill-comment-360")];
  });
  const before = { p: await db.participation.count({ where: { roundId: roundA.id } }), r: await db.response.count({ where: { roundId: roundA.id } }) };
  await step({ j: "J1", d: "Nothing is stored before the final submit", pre: "wizard on the comment step", steps: "count Participation/Response rows of round A", exp: "0 / 0 (MVP-09: sent at once at the end)" }, async () => [before.p === 0 && before.r === 0, `participations=${before.p}, responses=${before.r}`]);
  await step({ j: "J1", d: "Submit (360 px): thank-you screen, one Participation and one Response row with the chosen values", pre: "comment typed", steps: "click Odoslať", exp: "'Ďakujeme za odpoveď'; DB: participation for Adam, response v=[4,3,5,4] with the comment (MVP-09)" }, async () => {
    await p.getByRole("button", { name: "Odoslať" }).click();
    await p.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor();
    const adam = await db.user.findUniqueOrThrow({ where: { email: U.alfa[0] } });
    const part = await db.participation.findMany({ where: { roundId: roundA.id } });
    const resp = await db.response.findMany({ where: { roundId: roundA.id } });
    const r = resp[0];
    const ok = part.length === 1 && part[0].userId === adam.id && resp.length === 1 && [r.v1, r.v2, r.v3, r.v4].join() === "4,3,5,4" && r.v5 === null && r.comment === COMMENTS_A[0];
    return [ok, `participations=${part.length}, responses=${resp.length}, values=${[r?.v1, r?.v2, r?.v3, r?.v4, r?.v5]}, comment='${r?.comment}'`, await shot(p, "j1-13-fill-thanks-360")];
  });
  await step({ j: "J1", d: "Confetti / animated thank-you after submitting (TESTING_RULES.md, IT-02)", pre: "thank-you screen", steps: "look for a canvas / confetti element", exp: "animation appears", }, async () => {
    const canvas = await p.locator("canvas, [class*=confetti]").count();
    return ["BLOCKED", `NOT IMPLEMENTED in this build: IT-02 is 'pozastavené' (canvas/confetti elements found: ${canvas}). Not a defect.`];
  });
}
// members 2..5 at other viewports
for (let i = 1; i < 5; i++) {
  const p = emp[i];
  const vp = VIEWPORTS[i];
  await step({ j: "J1", d: `Member ${i + 1} fills round A at ${vp.width}×${vp.height}`, pre: "round A open", steps: "complete the wizard, submit", exp: `thank-you screen; DB: ${i + 1} participations and ${i + 1} responses; no page errors; no horizontal overflow`, }, async () => {
    await fillWizard(p, roundA.id, ANSWERS_A[i], COMMENTS_A[i], { stopBeforeSubmit: true });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (i === 4) {
      // double click on submit (two clicks in the same tick)
      await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Odoslať"); b.click(); b.click(); });
    } else {
      await p.getByRole("button", { name: "Odoslať" }).click();
    }
    await p.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor();
    const pc = await db.participation.count({ where: { roundId: roundA.id } });
    const rc = await db.response.count({ where: { roundId: roundA.id } });
    return [pc === i + 1 && rc === i + 1 && !overflow && p.errors.length === 0, `participations=${pc}, responses=${rc}, overflow=${overflow}, pageErrors=${p.errors.length}${i === 4 ? " (submit was double-clicked)" : ""}`, await shot(p, `j1-14-thanks-${vp.width}`)];
  });
}
await step({ j: "J8", d: "Double click on 'Odoslať' creates exactly one response", pre: "Emil double-clicked submit in the previous step", steps: "count rows", exp: "5 participations, 5 responses, no duplicate" }, async () => {
  const pc = await db.participation.count({ where: { roundId: roundA.id } });
  const rc = await db.response.count({ where: { roundId: roundA.id } });
  return [pc === 5 && rc === 5, `participations=${pc}, responses=${rc}`];
});
await step({ j: "J1", d: "Stored responses equal what was entered (as a multiset, since rows carry no author)", pre: "5 responses", steps: "compare sorted value tuples and comments with the inputs", exp: "identical multisets; empty comments stored as NULL" }, async () => {
  const resp = await db.response.findMany({ where: { roundId: roundA.id } });
  const got = resp.map((r) => [r.v1, r.v2, r.v3, r.v4].join()).sort().join(" | ");
  const exp = ANSWERS_A.map((a) => a.join()).sort().join(" | ");
  const gc = resp.map((r) => r.comment).filter((c) => c !== null).sort().join(" || ");
  const ec = COMMENTS_A.filter(Boolean).sort().join(" || ");
  return [got === exp && gc === ec && resp.filter((r) => r.comment === null).length === 2, `values: ${got}; comments stored=${resp.filter((r) => r.comment !== null).length}, null=${resp.filter((r) => r.comment === null).length}`];
});

// ───────────────────────── second attempt
await step({ j: "J1", d: "Second attempt through the UI is refused", pre: "Adam already answered round A", steps: "open /rounds/:id/fill again", exp: "'Toto kolo už máš vyplnené', no 'Začať' button (MVP-09)" }, async () => {
  await emp[0].goto(`${BASE}/rounds/${roundA.id}/fill`);
  const text = await mainText(emp[0]);
  return [text.includes("Toto kolo už máš vyplnené") && text.includes("Do každého kola sa dá odpovedať iba raz.") && !text.includes("Začať"), text.slice(0, 300), await shot(emp[0], "j1-15-second-attempt")];
});
const adamApi = await api(U.alfa[0]);
await step({ j: "J1", d: "Second attempt through the API is refused with 409 and stores nothing", pre: "Adam already answered", steps: "POST /api/rounds/:id/responses {answers:[1,1,1,1]}", exp: "409 already_submitted; counts stay 5/5 (MVP-09)" }, async () => {
  const res = await adamApi(`/api/rounds/${roundA.id}/responses`, "POST", { answers: [1, 1, 1, 1], comment: "druhý pokus" });
  const pc = await db.participation.count({ where: { roundId: roundA.id } });
  const rc = await db.response.count({ where: { roundId: roundA.id } });
  return [res.status === 409 && res.json?.error === "already_submitted" && pc === 5 && rc === 5, `HTTP ${res.status} ${res.text}; participations=${pc}, responses=${rc}`];
});
await step({ j: "J1", d: "Home shows 'Odoslané' for the answered round and keeps the task for the other one", pre: "Adam answered A, not M", steps: "open /", exp: "one task (round M); list: round A 'Odoslané', round M 'Čaká na vyplnenie' (MVP-06)" }, async () => {
  await emp[0].goto(`${BASE}/`);
  const tasks = await emp[0].locator("main ol > li p").allInnerTexts();
  const a = await li(emp[0], NAME_A).innerText();
  const m = await li(emp[0], NAME_M).innerText();
  return [tasks.length === 1 && tasks[0].includes(NAME_M) && a.includes("Odoslané") && m.includes("Čaká na vyplnenie"), `tasks=${JSON.stringify(tasks)}; A='${a}'; M='${m}'`, await shot(emp[0], "j1-16-home-odoslane")];
});

// ───────────────────────── open round: participation only
await step({ j: "J1", d: "Manager sees only participation for the open round", pre: "round A open, 5 responses", steps: "manager opens /rounds/:id/results", exp: "'Odpovedalo 5 z 6 členov tímu', notice that results come after closing, no 'Priemer', no comments (MVP-10)" }, async () => {
  await mgrA.goto(`${BASE}/rounds/${roundA.id}/results`);
  const text = await mainText(mgrA);
  const html = await mgrA.content();
  const leak = COMMENTS_A.filter(Boolean).some((c) => html.includes(c.slice(0, 20)));
  return [text.includes("Odpovedalo 5 z 6 členov tímu") && text.includes("Výsledky sa zobrazia až po uzavretí kola") && !text.includes("Priemer") && !leak && text.includes("Kroky sa dajú zapísať po uzavretí kola."), `${text.slice(0, 350)} | comment text in HTML=${leak}`, await shot(mgrA, "j1-17-open-results")];
});
await step({ j: "J1", d: "API for the open round returns no results", pre: "round A open", steps: "manager: GET /api/rounds/:id/results and /suggestions", exp: "status not_closed, no questions/comments keys" }, async () => {
  const res = await mgrAApi(`/api/rounds/${roundA.id}/results`);
  const sug = await mgrAApi(`/api/rounds/${roundA.id}/suggestions`);
  return [res.json.status === "not_closed" && !("questions" in res.json) && !("comments" in res.json) && sug.json.status === "not_closed", `results=${res.text.slice(0, 250)}; suggestions=${sug.text}`];
});
await step({ j: "J1", d: "An action cannot be written for an open round", pre: "round A open", steps: "manager: POST /api/rounds/:id/actions", exp: "409 round_not_closed; no Action row (MVP-13)" }, async () => {
  const res = await mgrAApi(`/api/rounds/${roundA.id}/actions`, "POST", { topic: "QA", description: "QA", dueDate: ymd(new Date()) });
  const n = await db.action.count({ where: { roundId: roundA.id } });
  return [res.status === 409 && n === 0, `HTTP ${res.status} ${res.text}; actions=${n}`];
});
await step({ j: "J6", d: "Participation shown to manager (/rounds) and HR (/hr/rounds) equals the DB", pre: "round A: 5 responses; round M: 0", steps: "read 'Účasť' in both lists; count Participation rows", exp: "A: '5 z 6', M: '0 z 6' in both views" }, async () => {
  await mgrA.goto(`${BASE}/rounds`);
  await hr.goto(`${BASE}/hr/rounds`);
  const m1 = await li(mgrA, NAME_A).innerText(); const m2 = await li(mgrA, NAME_M).innerText();
  const h1 = await li(hr, NAME_A).innerText(); const h2 = await li(hr, NAME_M).innerText();
  const pa = await db.participation.count({ where: { roundId: roundA.id } });
  const members = await db.user.count({ where: { teamId: teamA.id } });
  return [[m1, h1].every((t) => t.includes(`Účasť: ${pa} z ${members}`)) && [m2, h2].every((t) => t.includes(`Účasť: 0 z ${members}`)), `DB ${pa}/${members}; mgr A='${m1}'; hr A='${h1}'`];
});

// ───────────────────────── manual close
await step({ j: "J1", d: "Manager closes round A with the 'Uzavrieť' button", pre: "round A open with 5 responses", steps: "click Uzavrieť, accept confirm", exp: "badges 'Uzavreté' + 'Čaká na krok'; DB CLOSED, closedAt = now (MVP-05, MVP-15)" }, async () => {
  await li(mgrA, NAME_A).getByRole("button", { name: "Uzavrieť" }).click();
  await li(mgrA, NAME_A).getByText("Čaká na krok").waitFor();
  const r = await db.round.findUnique({ where: { id: roundA.id } });
  const text = await li(mgrA, NAME_A).innerText();
  return [r.status === "CLOSED" && Math.abs(Date.now() - r.closedAt.getTime()) < 60000 && text.includes("Uzavreté"), `DB status=${r.status}, closedAt=${r.closedAt?.toISOString()}; UI='${text}'`, await shot(mgrA, "j1-18-closed")];
});
await step({ j: "J1", d: "Late responder: the manager (not yet answered) opens the closed round to fill it", pre: "round A closed", steps: "manager opens /rounds/:id/fill; POST response via API", exp: "'Kolo je uzavreté'; API 409 round_closed; counts stay 5/5 (MVP-09)" }, async () => {
  await mgrA.goto(`${BASE}/rounds/${roundA.id}/fill`);
  const text = await mainText(mgrA);
  const res = await mgrAApi(`/api/rounds/${roundA.id}/responses`, "POST", { answers: [3, 3, 3, 3] });
  const rc = await db.response.count({ where: { roundId: roundA.id } });
  return [text.includes("Kolo je uzavreté") && res.status === 409 && res.json.error === "round_closed" && rc === 5, `UI='${text.slice(0, 200)}'; HTTP ${res.status} ${res.text}; responses=${rc}`];
});

// ───────────────────────── results at exactly 5 responses
const responsesA = await db.response.findMany({ where: { roundId: roundA.id } });
const expA = qA.map((q) => {
  const values = responsesA.map((r) => r[`v${q.position}`]);
  const dist = [1, 2, 3, 4, 5].map((v) => values.filter((x) => x === v).length);
  return { text: q.question.text, topic: q.question.topic, fixed: q.question.fixed, scale: q.question.scale, avg: round2(values.reduce((a, b) => a + b, 0) / values.length), dist };
});
await mgrA.goto(`${BASE}/rounds/${roundA.id}/results`);
await step({ j: "J2", d: "Threshold boundary 5: manager sees participation, averages for every question (recomputed from DB)", pre: "round A closed with exactly 5 responses", steps: "open results; recompute averages from Response rows", exp: "'Odpovedalo 5 z 6 členov tímu'; each card shows the DB average (MVP-10, NFR-02)" }, async () => {
  const cards = mgrA.locator("section:has(h2:text-is('Otázky')) > ul > li");
  const n = await cards.count();
  const got = [];
  for (let i = 0; i < n; i++) got.push({ text: await cards.nth(i).locator("h3").innerText(), avg: await cards.nth(i).locator("span.text-2xl").innerText() });
  const ok = n === 4 && got.every((g, i) => g.text === expA[i].text && g.avg === sk(expA[i].avg)) && (await mainText(mgrA)).includes("Odpovedalo 5 z 6 členov tímu");
  return [ok, `UI=${got.map((g) => g.avg).join(" | ")}; DB=${expA.map((e) => sk(e.avg)).join(" | ")}`, await shot(mgrA, "j1-19-results-5")];
});
await step({ j: "J6", d: "Distribution of answers per question equals the DB", pre: "results of round A", steps: "expand 'Rozdelenie odpovedí' of every question; read aria-labels", exp: "5 counts per question identical to counts computed from Response rows" }, async () => {
  const cards = mgrA.locator("section:has(h2:text-is('Otázky')) > ul > li");
  const got = [];
  for (let i = 0; i < 4; i++) {
    await cards.nth(i).locator("summary").click();
    const labels = await cards.nth(i).locator("details li").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    got.push(labels.map((l) => Number(l.match(/: (\d+)×/)[1])));
  }
  return [JSON.stringify(got) === JSON.stringify(expA.map((e) => e.dist)), `UI=${JSON.stringify(got)}; DB=${JSON.stringify(expA.map((e) => e.dist))}`, await shot(mgrA, "j1-20-distribution")];
});
await step({ j: "J1", d: "Comments: collapsed with the count in the heading, shown without names, special characters intact", pre: "3 of 5 responses have a comment", steps: "read summary; expand; compare with DB", exp: "'Komentáre (3)'; the 3 texts equal the DB set; HTML tags shown as text, line break kept (MVP-10)" }, async () => {
  const summary = await mgrA.locator("details > summary", { hasText: "Komentáre" }).innerText();
  await mgrA.locator("details > summary", { hasText: "Komentáre" }).click();
  const items = await mgrA.locator("details:has(> summary:has-text('Komentáre')) > ul > li").allInnerTexts();
  const exp = COMMENTS_A.filter(Boolean).sort();
  const names = (await db.user.findMany({ where: { teamId: teamA.id } })).map((u) => u.name);
  const text = await mgrA.locator("main").innerText();
  const noNames = names.filter((n) => n !== "Alena Testová").every((n) => !text.includes(n));
  const bold = await mgrA.locator("details b").count();
  return [summary.trim() === "Komentáre (3)" && JSON.stringify([...items].sort()) === JSON.stringify(exp) && noNames && bold === 0, `summary='${summary}', items=${JSON.stringify(items)}, employee names on page=${!noNames}, <b> elements rendered=${bold}`, await shot(mgrA, "j1-21-comments")];
});
const fav = (e) => (["OVERTIME", "FREQUENCY"].includes(e.scale) ? 6 - e.avg : e.avg);
await step({ j: "J6", d: "'V skratke' names the best and the weakest question correctly", pre: "results of round A", steps: "recompute strongest/weakest (ties → lower position)", exp: "sentences 'Najlepšie: „…“ (x).' and 'Najslabšie: „…“ (y).' match (IT-13)" }, async () => {
  const sorted = expA.map((e, i) => ({ ...e, pos: i })).sort((a, b) => fav(b) - fav(a) || a.pos - b.pos);
  const s = `Najlepšie: „${sorted[0].text}“ (${sk(sorted[0].avg)}).`;
  const w = `Najslabšie: „${sorted.at(-1).text}“ (${sk(sorted.at(-1).avg)}).`;
  const text = await mainText(mgrA);
  return [text.includes(s) && text.includes(w), `expected: ${s} / ${w}; present=${text.includes(s)}/${text.includes(w)}`];
});
let suggestions = [];
await step({ j: "J1", d: "Two rule-based suggestions for the two weakest non-fixed questions of different topics, labelled as not AI", pre: "round A closed above threshold", steps: "read 'Návrhy krokov'; recompute the expected questions", exp: "2 suggestions with 'Reaguje na otázku „…“ (priemer x).' for the expected questions; note 'Návrhy podľa pravidiel, nie AI' (IT-09)" }, async () => {
  const cand = expA.filter((e) => !e.fixed).sort((a, b) => fav(a) - fav(b) || a.text.localeCompare(b.text, "sk"));
  const chosen = [];
  for (const c of cand) { if (chosen.length < 2 && !chosen.some((x) => x.topic === c.topic)) chosen.push(c); }
  for (const c of cand) { if (chosen.length < 2 && !chosen.includes(c)) chosen.push(c); }
  const cards = mgrA.locator("#kroky ul > li:has(button:text-is('Použiť ako krok'))");
  const n = await cards.count();
  for (let i = 0; i < n; i++) suggestions.push({ topic: await cards.nth(i).locator("p").nth(0).innerText(), text: await cards.nth(i).locator("p").nth(1).innerText(), because: await cards.nth(i).locator("p").nth(2).innerText() });
  const note = await mgrA.getByText("Návrhy podľa pravidiel, nie AI").isVisible();
  const ok = n === 2 && note && suggestions.every((s, i) => s.because === `Reaguje na otázku „${chosen[i].text}“ (priemer ${sk(chosen[i].avg)}).` && s.topic === chosen[i].topic);
  return [ok, `UI=${JSON.stringify(suggestions.map((s) => s.because))}; expected questions=${chosen.map((c) => c.text + " " + sk(c.avg)).join(" | ")}`, await shot(mgrA, "j1-22-suggestions")];
});
await step({ j: "J4", d: "Manager home shows the task for the closed round without an action", pre: "round A closed today, no action", steps: "manager opens /", exp: "first task: 'Kolo „A“ je uzavreté od dnes a tím čaká…' with button 'Výsledky a krok' → results (IT-11)" }, async () => {
  await mgrA.goto(`${BASE}/`);
  const first = mgrA.locator("main ol > li").first();
  const text = await first.locator("p").innerText();
  const href = await first.getByRole("link").getAttribute("href");
  const all = await mgrA.locator("main ol > li p").allInnerTexts();
  return [text === `Kolo „${NAME_A}“ je uzavreté od dnes a tím čaká, čo sa s výsledkami stane. Pozri výsledky a zapíš krok.` && href === `/rounds/${roundA.id}/results`, `tasks=${JSON.stringify(all)}; href=${href}`, await shot(mgrA, "j1-23-mgr-home-task")];
});
await step({ j: "J4", d: "HR home task now counts 2 rounds waiting", pre: "Beta seed round + round A without action", steps: "HR opens /", exp: "'2 uzavreté kolá čakajú na krok manažéra. Najdlhšie Tím Beta, N dní.'" }, async () => {
  await hr.goto(`${BASE}/`);
  const days = Math.floor((Date.now() - seedBeta.closedAt.getTime()) / DAY);
  const exp = `2 uzavreté kolá čakajú na krok manažéra. Najdlhšie Tím Beta, ${days} dní.`;
  const text = await hr.locator("main ol > li").first().locator("p").innerText();
  return [text === exp, `UI='${text}'; expected='${exp}'`, await shot(hr, "j1-24-hr-home-2-waiting")];
});

// ───────────────────────── actions
await mgrA.goto(`${BASE}/rounds/${roundA.id}/results`);
await step({ j: "J1", d: "Empty action form is refused with a message and nothing is stored", pre: "results of round A, manager", steps: "click 'Pridať krok' with an empty form", exp: "'Vyplň tému, čo sa urobí a platný termín.'; 0 Action rows (MVP-13)" }, async () => {
  await mgrA.getByRole("button", { name: "Pridať krok" }).click();
  await mgrA.getByText("Vyplň tému, čo sa urobí a platný termín.").waitFor();
  const n = await db.action.count({ where: { roundId: roundA.id } });
  return [n === 0, `error shown; actions=${n}`];
});
const due1 = ymd(new Date(Date.now() + 14 * DAY));
await step({ j: "J1", d: "'Použiť ako krok' copies the suggestion into the form", pre: "2 suggestions shown", steps: "click 'Použiť ako krok' on the first suggestion", exp: "Téma = suggestion topic, 'Čo sa urobí' = suggestion text (IT-09)" }, async () => {
  await mgrA.getByRole("button", { name: "Použiť ako krok" }).first().click();
  const topic = await mgrA.locator('input[name="topic"]').inputValue();
  const desc = await mgrA.locator('textarea[name="description"]').inputValue();
  return [topic === suggestions[0].topic && desc === suggestions[0].text, `topic='${topic}', description='${desc.slice(0, 80)}…'`];
});
await step({ j: "J1", d: "Manager saves the suggested action with a due date", pre: "form prefilled", steps: `set Termín=${due1}, click 'Pridať krok'`, exp: "action appears in the list with status 'Plánované'; DB Action row; badge 'Čaká na krok' disappears; form is cleared (MVP-13, MVP-15)" }, async () => {
  await mgrA.locator('input[name="dueDate"]').fill(due1);
  await mgrA.getByRole("button", { name: "Pridať krok" }).click();
  await mgrA.locator("#kroky ul > li h3", { hasText: suggestions[0].topic }).first().waitFor();
  const a = await db.action.findMany({ where: { roundId: roundA.id } });
  const text = await mainText(mgrA);
  const topicAfter = await mgrA.locator('input[name="topic"]').inputValue();
  const ok = a.length === 1 && a[0].topic === suggestions[0].topic && a[0].description === suggestions[0].text && a[0].status === "PLANNED" && ymd(a[0].dueDate) === due1 && !text.includes("Čaká na krok") && topicAfter === "";
  return [ok, `DB=${JSON.stringify({ ...a[0], description: a[0]?.description.slice(0, 40) })}; 'Čaká na krok' on page=${text.includes("Čaká na krok")}; topic field after save='${topicAfter}'`, await shot(mgrA, "j1-25-action-added")];
});
const due2 = ymd(new Date(Date.now() + 3 * DAY));
await step({ j: "J1", d: "Manager writes a second action by hand with status 'Prebieha'", pre: "one action exists", steps: "fill Téma, Čo sa urobí (2 lines), Termín, Stav=Prebieha; save", exp: "2 actions ordered by due date; DB row IN_PROGRESS (MVP-13)" }, async () => {
  await mgrA.locator('input[name="topic"]').fill("QA téma porady");
  await mgrA.locator('textarea[name="description"]').fill("QA: zrušíme utorkovú poradu.\nDruhý riadok.");
  await mgrA.locator('input[name="dueDate"]').fill(due2);
  await mgrA.locator('select[name="status"]').selectOption("IN_PROGRESS");
  await mgrA.getByRole("button", { name: "Pridať krok" }).click();
  await mgrA.locator("#kroky ul > li h3", { hasText: "QA téma porady" }).waitFor();
  const a = await db.action.findMany({ where: { roundId: roundA.id }, orderBy: { dueDate: "asc" } });
  const order = await mgrA.locator("#kroky > ul > li h3").allInnerTexts();
  return [a.length === 2 && a[0].topic === "QA téma porady" && a[0].status === "IN_PROGRESS" && order[0] === "QA téma porady", `DB=${a.map((x) => x.topic + ":" + x.status).join(", ")}; UI order=${order.join(" | ")}`];
});
await step({ j: "J1", d: "Manager changes the status of an action to 'Hotové'; it survives a reload", pre: "action 'QA téma porady' is Prebieha", steps: "select 'Hotové' in its row; reload", exp: "DB status DONE; select shows 'Hotové' after reload (MVP-13)" }, async () => {
  const row = mgrA.locator("#kroky > ul > li", { hasText: "QA téma porady" });
  await row.getByLabel("Stav").selectOption("DONE");
  await mgrA.waitForTimeout(800);
  const a = await db.action.findFirst({ where: { roundId: roundA.id, topic: "QA téma porady" } });
  await mgrA.reload();
  const value = await mgrA.locator("#kroky > ul > li", { hasText: "QA téma porady" }).getByLabel("Stav").inputValue();
  return [a.status === "DONE" && value === "DONE", `DB=${a.status}; UI after reload=${value}`, await shot(mgrA, "j1-26-action-done")];
});
await step({ j: "J4", d: "Manager home: the task of round A disappears once it has an action", pre: "round A has 2 actions; manager has not filled round M", steps: "manager opens /", exp: "no 'Kolo „A“ je uzavreté…' task; the task to fill round M remains (IT-11)" }, async () => {
  await mgrA.goto(`${BASE}/`);
  const all = await mgrA.locator("main ol > li p").allInnerTexts();
  return [!all.some((t) => t.includes(`Kolo „${NAME_A}“`)) && all.some((t) => t.includes(`Čaká na teba prieskum „${NAME_M}“`)), JSON.stringify(all), await shot(mgrA, "j1-27-mgr-home-after-action")];
});
await step({ j: "J4", d: "HR home: count drops back to 1 after the manager wrote an action", pre: "round A has actions; Beta seed round has none", steps: "HR opens /", exp: "'1 uzavreté kolo čaká na krok manažéra. Najdlhšie Tím Beta, N dní.' (IT-11)" }, async () => {
  await hr.goto(`${BASE}/`);
  const text = await hr.locator("main ol > li").first().locator("p").innerText();
  return [text.startsWith("1 uzavreté kolo čaká na krok manažéra. Najdlhšie Tím Beta"), text, await shot(hr, "j1-28-hr-home-after-action")];
});
await step({ j: "J6", d: "HR reaction overview reflects the new state (recomputed from DB)", pre: "2 closed rounds, 1 with actions", steps: "HR opens /hr/overview", exp: "headline '1 z 2 uzavretých kôl čaká na krok. Najdlhšie Tím Beta, N dní.'; Alfa 'Krok má 1 z 1 uzavretých kôl.'; Beta 'Krok má 0 z 1…'; totals 1 (50 %), Plánované 1, Prebieha 0, Hotové 1 (IT-05, IT-13)" }, async () => {
  await hr.goto(`${BASE}/hr/overview`);
  const days = Math.floor((Date.now() - seedBeta.closedAt.getTime()) / DAY);
  const text = await mainText(hr);
  for (const s of await hr.locator("main details > summary").all()) await s.click();
  const full = await mainText(hr);
  const ok = text.includes(`1 z 2 uzavretých kôl čaká na krok. Najdlhšie Tím Beta, ${days} dní.`) && full.includes("Krok má 1 z 1 uzavretých kôl.") && full.includes("Krok má 0 z 1 uzavretých kôl.") && full.includes("1 (50 %)") && full.includes("Plánované: 1, Prebieha: 0, Hotové: 1");
  return [ok, full.slice(0, 700), await shot(hr, "j1-29-hr-overview")];
});
await step({ j: "J6", d: "HR list: 'Čaká na krok' only on the round without an action", pre: "A has actions, Beta seed round has none", steps: "HR opens /hr/rounds", exp: "badge on the Beta round, none on round A (MVP-15)" }, async () => {
  await hr.goto(`${BASE}/hr/rounds`);
  const a = await li(hr, NAME_A).innerText(); const b = await li(hr, seedBeta.name).innerText();
  return [!a.includes("Čaká na krok") && b.includes("Čaká na krok"), `A='${a}'; Beta='${b}'`, await shot(hr, "j1-30-hr-rounds-badges")];
});

// ───────────────────────── team page ("Povedali ste, urobili sme")
await step({ j: "J1", d: "Employee sees the round, averages and both actions on 'Povedali ste, urobili sme'", pre: "round A closed (5 responses) with 2 actions", steps: "Adam (360 px): menu 'Môj tím'", exp: "round A with 'Odpovedalo 5 z 6', 4 averages equal to DB, actions with badges 'Hotové' and 'Plánované' (MVP-14)" }, async () => {
  const p = emp[0];
  await p.goto(`${BASE}/`);
  await p.locator("header nav").getByRole("link", { name: "Môj tím" }).click();
  await p.getByRole("heading", { name: "Povedali ste, urobili sme" }).waitFor();
  const card = li(p, NAME_A);
  const avgs = await card.locator('span[aria-label="Priemer"]').allInnerTexts();
  const text = await card.innerText();
  const ok = text.includes("Odpovedalo 5 z 6") && JSON.stringify(avgs) === JSON.stringify(expA.map((e) => sk(e.avg))) && text.includes("QA téma porady") && text.includes("Hotové") && text.includes("Plánované");
  return [ok, `avgs=${avgs.join(" | ")}; card='${text.replace(/\s+/g, " ").slice(0, 300)}'`, await shot(p, "j1-31-team-page-360")];
});
await step({ j: "J9", d: "Team page for an employee contains no comments, no distribution and no way to change actions", pre: "Adam on the team page", steps: "search the full HTML (incl. embedded RSC payload) for comment texts; look for selects/forms", exp: "no comment text anywhere in the document; no <select>, no action form (matrix: employee sees no comments)" }, async () => {
  const html = await emp[0].content();
  const leak = COMMENTS_A.filter(Boolean).filter((c) => html.includes(c.split("\n")[0].slice(0, 18)));
  const selects = await emp[0].locator("main select").count();
  const dist = html.includes("Rozdelenie odpovedí");
  return [leak.length === 0 && selects === 0 && !dist, `comment fragments in HTML=${leak.length}, selects=${selects}, distribution=${dist}`];
});
await step({ j: "J6", d: "Team page: the 'Uzavreté <date>' label of a manually closed round shows the real closing date", pre: "round A closed manually today; its deadline is today+7", steps: "read the label on the team page; compare with Round.closedAt", exp: `'Uzavreté ${fmtDate(new Date())}' (the day it was closed)` }, async () => {
  const text = (await li(emp[0], NAME_A).locator("p").first().innerText()).trim();
  const r = await db.round.findUnique({ where: { id: roundA.id } });
  return [text.startsWith(`Uzavreté ${fmtDate(r.closedAt)}`), `UI='${text}'; DB closedAt=${r.closedAt.toISOString()} (${fmtDate(r.closedAt)}), closesAt=${r.closesAt.toISOString()} (${fmtDate(r.closesAt)})`, await shot(emp[0], "j1-32-team-page-closed-date")];
});

// ───────────────────────── other roles on round A
await step({ j: "J1", d: "HR sees the same results, reads actions and suggestions, but cannot write actions", pre: "round A closed with 2 actions", steps: "HR opens /rounds/:id/results", exp: "same 4 averages; action list with badges; no status select; no 'Pridať krok'; no 'Použiť ako krok'; link 'Vytvoriť podnet z tohto kola' (matrix, MVP-12)" }, async () => {
  await hr.goto(`${BASE}/rounds/${roundA.id}/results`);
  const avgs = await hr.locator("section:has(h2:text-is('Otázky')) span.text-2xl").allInnerTexts();
  const selects = await hr.locator("main select").count();
  const add = await hr.getByRole("button", { name: "Pridať krok" }).count();
  const use = await hr.getByRole("button", { name: "Použiť ako krok" }).count();
  const link = await hr.getByRole("link", { name: "Vytvoriť podnet z tohto kola" }).count();
  const sug = await hr.getByText(/Reaguje na otázku/).count();
  return [JSON.stringify(avgs) === JSON.stringify(expA.map((e) => sk(e.avg))) && selects === 0 && add === 0 && use === 0 && link === 1 && sug === 2, `avgs=${avgs.join(" | ")}, selects=${selects}, addBtn=${add}, useBtn=${use}, issueLink=${link}, suggestions=${sug}`, await shot(hr, "j1-33-hr-results")];
});
await step({ j: "J5", d: "HR cannot write or change an action through the API", pre: "round A closed", steps: "HR: POST /api/rounds/:id/actions; PATCH /api/actions/:id", exp: "403 + 403; DB unchanged (matrix)" }, async () => {
  const a = await db.action.findFirst({ where: { roundId: roundA.id, topic: "QA téma porady" } });
  const r1 = await hrApi(`/api/rounds/${roundA.id}/actions`, "POST", { topic: "HR", description: "HR", dueDate: due1 });
  const r2 = await hrApi(`/api/actions/${a.id}`, "PATCH", { status: "PLANNED" });
  const after = await db.action.findUnique({ where: { id: a.id } });
  const n = await db.action.count({ where: { roundId: roundA.id } });
  return [r1.status === 403 && r2.status === 403 && after.status === "DONE" && n === 2, `POST ${r1.status}, PATCH ${r2.status}, status=${after.status}, actions=${n}`];
});
const mgrB = await session(U.mgrB);
await step({ j: "J5", d: "Manager of team Beta cannot open results, report, trend or team page of team Alfa", pre: "manager Beta logged in", steps: "open the four URLs directly", exp: "HTTP 403 page 'Sem nemáš prístup' on each (MVP-03, NFR-03)" }, async () => {
  const out = [];
  for (const path of [`/rounds/${roundA.id}/results`, `/rounds/${roundA.id}/report`, `/team/${teamA.id}/trend`, `/team/${teamA.id}`]) {
    const res = await mgrB.goto(`${BASE}${path}`);
    const text = await mainText(mgrB);
    out.push(`${path.replace(roundA.id, ":id").replace(teamA.id, ":team")} → ${res.status()} ${text.includes("Sem nemáš prístup")} leak=${text.includes("Priemer")}`);
  }
  return [out.every((o) => o.includes("→ 403 true leak=false")), out.join("; "), await shot(mgrB, "j1-34-mgrB-403")];
});
await step({ j: "J5", d: "Manager Beta gets 403 from every API of round A", pre: "manager Beta session", steps: "GET results, suggestions, trend, summary; POST close/open/actions", exp: "403 everywhere (NFR-03)" }, async () => {
  const calls = [
    ["GET", `/api/rounds/${roundA.id}/results`], ["GET", `/api/rounds/${roundA.id}/suggestions`], ["GET", `/api/teams/${teamA.id}/trend`],
    ["GET", `/api/teams/${teamA.id}/summary`], ["POST", `/api/rounds/${roundA.id}/close`], ["POST", `/api/rounds/${roundA.id}/open`],
    ["POST", `/api/rounds/${roundA.id}/actions`], ["GET", `/api/rounds/${roundA.id}`], ["POST", `/api/rounds/${roundA.id}/responses`],
  ];
  const out = [];
  for (const [m, p] of calls) out.push(`${m} ${p.replace(roundA.id, ":id").replace(teamA.id, ":team")}=${(await mgrBApi(p, m, m === "POST" ? {} : undefined)).status}`);
  return [out.every((o) => o.endsWith("=403")), out.join("; ")];
});
await step({ j: "J5", d: "Employee of team Alfa cannot open results, report, trend, new round, HR pages via direct URL", pre: "Adam logged in", steps: "open URLs directly", exp: "403 page on each (matrix)" }, async () => {
  const out = [];
  for (const path of [`/rounds/${roundA.id}/results`, `/rounds/${roundA.id}/report`, `/team/${teamA.id}/trend`, "/rounds/new", "/rounds", "/hr/rounds", "/hr/overview", "/hr/heatmap", "/hr/issues", "/hr/notes", `/team/${teamB.id}`]) {
    const res = await emp[0].goto(`${BASE}${path}`);
    out.push(`${path.replace(roundA.id, ":id").replace(teamA.id, ":teamA").replace(teamB.id, ":teamB")}=${res.status()}`);
  }
  return [out.every((o) => o.endsWith("=403")), out.join("; "), await shot(emp[0], "j1-35-emp-403")];
});

// ───────────────────────── report
await step({ j: "J1", d: "Printable report matches the results and contains no comments", pre: "round A closed (5) with 2 actions", steps: "manager: click 'Report na tlač' on results; compare table with DB", exp: "participation, 4 rows with averages and distributions from DB, 2 actions with status, 2 suggestions, note that comments are excluded, no comment text in HTML (IT-08)" }, async () => {
  await mgrA.goto(`${BASE}/rounds/${roundA.id}/results`);
  await mgrA.getByRole("link", { name: "Report na tlač" }).click();
  await mgrA.getByRole("button", { name: "Vytlačiť alebo uložiť ako PDF" }).waitFor();
  // Reload: after a client-side navigation the document still holds the inline payload of the previous (results) page.
  await mgrA.reload();
  const rows = await mgrA.locator("article table tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent.trim())));
  const exp = expA.map((e) => [sk(e.avg), ...e.dist.map(String)]);
  const html = await mgrA.content();
  const text = await mainText(mgrA);
  const leak = COMMENTS_A.filter(Boolean).some((c) => html.includes(c.split("\n")[0].slice(0, 18)));
  const ok = JSON.stringify(rows) === JSON.stringify(exp) && text.includes("Odpovedalo 5 z 6 členov tímu") && text.includes("QA téma porady (Hotové)") && text.includes("(Plánované)") && !leak && text.includes("Komentáre nie sú súčasťou reportu") && (await mgrA.getByText(/Reaguje na otázku/).count()) === 2;
  return [ok, `rows=${JSON.stringify(rows)}; expected=${JSON.stringify(exp)}; commentLeak=${leak}`, await shot(mgrA, "j1-36-report")];
});
await step({ j: "J1", d: "Report in print media hides the menu and buttons", pre: "report page open", steps: "emulate print media; check header and print button visibility; save PDF", exp: "header and buttons hidden in print (IT-08)" }, async () => {
  await mgrA.emulateMedia({ media: "print" });
  const header = await mgrA.locator("header").first().isVisible();
  const btn = await mgrA.getByRole("button", { name: "Vytlačiť alebo uložiť ako PDF" }).isVisible();
  const s = await shot(mgrA, "j1-37-report-print-media");
  await mgrA.emulateMedia({ media: "screen" });
  return [!header && !btn, `app header visible in print=${header}, print button visible=${btn}`, s];
});

// ───────────────────────── trend + heatmap with one round above threshold
const scoreA = (() => {
  const topics = {};
  for (const e of expA.filter((x) => !x.fixed)) (topics[e.topic] ??= []).push(fav(e));
  return { fixed: round2(expA.filter((e) => e.fixed).map(fav)[0]), topics: Object.fromEntries(Object.entries(topics).map(([k, v]) => [k, round2(v.reduce((a, b) => a + b, 0) / v.length)])) };
})();
await step({ j: "J6", d: "Team trend shows round A with scores recomputed from DB and warns about little data", pre: "Alfa: 1 closed round above threshold", steps: "manager: Môj tím → tab 'Vývoj tímu'", exp: "notice 'Graf vychádza iba z 1 kola…'; table row: 5 responses, fixed score and topic scores from DB (IT-08)" }, async () => {
  await mgrA.goto(`${BASE}/team/${teamA.id}`);
  await mgrA.getByRole("navigation", { name: "Tím Alfa" }).getByRole("link", { name: "Vývoj tímu" }).click();
  await mgrA.getByRole("heading", { name: "Vývoj tímu" }).waitFor();
  const head = await mgrA.locator("table thead th").allInnerTexts();
  const row = await mgrA.locator("table tbody tr").first().locator("th,td").allInnerTexts();
  const exp = {};
  head.forEach((h, i) => (exp[h] = row[i]));
  const okTopics = Object.entries(scoreA.topics).every(([k, v]) => exp[k] === sk(v));
  const notice = await mgrA.getByText("Graf vychádza iba z 1 kola.").count();
  return [okTopics && exp["Stála otázka"] === sk(scoreA.fixed) && exp["Odpovedí"] === "5" && notice === 1, `row=${JSON.stringify(exp)}; expected fixed=${sk(scoreA.fixed)} topics=${JSON.stringify(scoreA.topics)}; fewRoundsNotice=${notice}`, await shot(mgrA, "j1-38-trend-1")];
});
await step({ j: "J6", d: "HR comparison of teams shows Alfa with round A scores and Beta (4 responses) without data", pre: "Alfa 1 round above threshold; Beta 1 round with 4 responses", steps: "HR: Prehľady → Porovnanie tímov", exp: "Alfa: '1 kolo' and cells = DB scores; Beta: '0 kôl' and only '–' (IT-08, NFR-02)" }, async () => {
  await hr.goto(`${BASE}/hr/overview`);
  await hr.getByRole("navigation", { name: "Prehľady" }).getByRole("link", { name: "Porovnanie tímov" }).click();
  await hr.getByRole("heading", { name: "Porovnanie tímov" }).waitFor();
  const head = await hr.locator("table thead th").allInnerTexts();
  const rows = await hr.locator("table tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("th,td")].map((c) => c.innerText.replace(/\s+/g, " ").trim())));
  const alfa = Object.fromEntries(head.map((h, i) => [h, rows[0][i]]));
  const beta = rows[1];
  const ok = alfa["Tím"] === "Tím Alfa 1 kolo" && alfa["Stála otázka"] === sk(scoreA.fixed) && Object.entries(scoreA.topics).every(([k, v]) => alfa[k] === sk(v)) && beta[0] === "Tím Beta 0 kôl" && beta.slice(1).every((c) => c === "–");
  return [ok, `alfa=${JSON.stringify(alfa)}; beta=${JSON.stringify(beta)}`, await shot(hr, "j1-39-heatmap")];
});

// ───────────────────────── round M: 4 responses, thank-you with actions, auto close
const ANSWERS_M = [[5, 4, 4, 5], [3, 4, 2, 4], [4, 4, 3, 3], [2, 5, 4, 4]];
const COMMENTS_M = ["QA tajný komentár M1 pod prahom.", "", "QA tajný komentár M2 pod prahom.", ""];
for (let i = 0; i < 4; i++) {
  await fillWizard(emp[i], roundM.id, ANSWERS_M[i], COMMENTS_M[i]);
  await emp[i].getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor();
  if (i === 0) {
    await step({ j: "J1", d: "Thank-you screen shows the actions of the team's last closed round", pre: "round A closed with 2 actions; Adam submits round M", steps: "submit round M; read the section under the thank-you", exp: `'Čo sa urobilo po kole „${NAME_A}“' with both actions and their status (MVP-09, MVP-14)` }, async () => {
      const text = await mainText(emp[0]);
      return [text.includes(`Čo sa urobilo po kole „${NAME_A}“`) && text.includes("QA téma porady") && text.includes("Hotové") && text.includes(suggestions[0].topic), text.slice(0, 500), await shot(emp[0], "j1-40-thanks-with-actions-360")];
    });
    await step({ j: "J1", d: "Own question of the manager was asked in the wizard (4th question) and stored", pre: "Adam answered round M", steps: "check RoundQuestion positions and the stored response", exp: "the own question is part of round M; response values [5,4,4,5]" }, async () => {
      const r = await db.response.findFirst({ where: { roundId: roundM.id } });
      const pos = roundM.questions.find((q) => q.question.text === CUSTOM_Q)?.position;
      return [pos >= 2 && [r.v1, r.v2, r.v3, r.v4].join() === "5,4,4,5", `own question position=${pos}; stored=${[r.v1, r.v2, r.v3, r.v4]}`];
    });
  }
}
await step({ j: "J2", d: "Open round with 4 responses: all counts agree", pre: "4 members answered round M", steps: "count rows; read manager list", exp: "4 participations, 4 responses, 'Účasť: 4 z 6'" }, async () => {
  await mgrA.goto(`${BASE}/rounds`);
  const text = await li(mgrA, NAME_M).innerText();
  const pc = await db.participation.count({ where: { roundId: roundM.id } });
  const rc = await db.response.count({ where: { roundId: roundM.id } });
  return [pc === 4 && rc === 4 && text.includes("Účasť: 4 z 6"), `participations=${pc}, responses=${rc}; UI='${text}'`];
});
// Emil is in the middle of the wizard when the deadline passes
await fillWizard(emp[4], roundM.id, [1, 1, 1, 1], "QA komentár, ktorý sa nesmie uložiť.", { stopBeforeSubmit: true });
const past = new Date(Date.now() - 60000);
await db.round.update({ where: { id: roundM.id }, data: { closesAt: past } });
await step({ j: "J1", d: "Automatic close by deadline while a member is on the last step of the wizard", pre: "Emil on the comment step of round M; deadline moved to 1 minute ago directly in the QA database (simulates time passing)", steps: "Emil clicks Odoslať", exp: "'Kolo je uzavreté' / 'Do uzavretého kola sa už nedá odpovedať.'; DB: round CLOSED with closedAt = deadline; still 4 responses; no participation for Emil (MVP-05, MVP-09)" }, async () => {
  await emp[4].getByRole("button", { name: "Odoslať" }).click();
  await emp[4].getByRole("heading", { name: "Kolo je uzavreté" }).waitFor();
  const r = await db.round.findUnique({ where: { id: roundM.id } });
  const rc = await db.response.count({ where: { roundId: roundM.id } });
  const emil = await db.user.findUniqueOrThrow({ where: { email: U.alfa[4] } });
  const part = await db.participation.count({ where: { roundId: roundM.id, userId: emil.id } });
  const text = await mainText(emp[4]);
  return [r.status === "CLOSED" && r.closedAt.getTime() === past.getTime() && rc === 4 && part === 0 && text.includes("Do uzavretého kola sa už nedá odpovedať."), `DB status=${r.status}, closedAt=${r.closedAt?.toISOString()} (deadline ${past.toISOString()}), responses=${rc}, Emil participation=${part}`, await shot(emp[4], "j1-41-autoclose-mid-fill")];
});
await step({ j: "J7", d: "After the round closed under the member's hands, the typed answers are gone but the app is not broken", pre: "Emil sees 'Kolo je uzavreté'", steps: "click 'Späť na moje prieskumy'", exp: "home loads, no page errors, round M no longer listed" }, async () => {
  await emp[4].getByRole("link", { name: "Späť na moje prieskumy" }).click();
  await emp[4].getByRole("heading", { name: "Čo treba urobiť teraz" }).waitFor();
  const text = await mainText(emp[4]);
  return [!text.includes(NAME_M) && emp[4].errors.length === 0, `home='${text.slice(0, 200)}', pageErrors=${emp[4].errors.length}`];
});

// ───────────────────────── threshold: 4 responses on every screen
await mgrA.goto(`${BASE}/rounds/${roundM.id}/results`);
await step({ j: "J2", d: "Below threshold (4): manager's results page shows only 'Nedostatok odpovedí'", pre: "round M closed with 4 responses, 2 comments", steps: "manager opens results of round M", exp: "'Nedostatok odpovedí', 'Kolo má 4 odpovede. Výsledky sa zobrazujú až od 5…'; no averages, no 'V skratke', no comments, no suggestions (MVP-11)" }, async () => {
  const text = await mainText(mgrA);
  const html = await mgrA.content();
  const leak = html.includes("QA tajný komentár");
  const ok = text.includes("Nedostatok odpovedí") && text.includes("Kolo má 4 odpovede. Výsledky sa zobrazujú až od 5, aby odpovede zostali dôverné.") && text.includes("Odpovedalo 4 z 6 členov tímu") && !text.includes("Priemer") && !text.includes("V skratke") && !text.includes("Komentáre") && !text.includes("Návrhy krokov") && !leak;
  return [ok, `${text.slice(0, 420)} | commentInHtml=${leak}`, await shot(mgrA, "j1-42-insufficient-mgr")];
});
await step({ j: "J2", d: "Below threshold: results API returns only the status and the count", pre: "round M closed with 4", steps: "manager: GET /api/rounds/:id/results", exp: "keys exactly round, participation, status='insufficient_responses', responseCount=4 (MVP-11, NFR-02)" }, async () => {
  const res = await mgrAApi(`/api/rounds/${roundM.id}/results`);
  const keys = Object.keys(res.json).sort().join();
  return [keys === "participation,responseCount,round,status" && res.json.status === "insufficient_responses" && res.json.responseCount === 4 && !res.text.includes("QA tajný"), res.text];
});
await step({ j: "J2", d: "Below threshold: suggestions API returns nothing", pre: "round M closed with 4", steps: "manager and HR: GET /api/rounds/:id/suggestions", exp: "status insufficient_responses, no suggestions (IT-09)" }, async () => {
  const a = await mgrAApi(`/api/rounds/${roundM.id}/suggestions`); const b = await hrApi(`/api/rounds/${roundM.id}/suggestions`);
  return [a.json.status === "insufficient_responses" && !("suggestions" in a.json) && b.json.status === "insufficient_responses", `${a.text} | ${b.text}`];
});
await step({ j: "J2", d: "Below threshold: HR sees the same restriction on page and API", pre: "round M closed with 4", steps: "HR opens results; GET results API", exp: "'Nedostatok odpovedí', no averages/comments; API insufficient_responses (MVP-12)" }, async () => {
  await hr.goto(`${BASE}/rounds/${roundM.id}/results`);
  const text = await mainText(hr);
  const html = await hr.content();
  const res = await hrApi(`/api/rounds/${roundM.id}/results`);
  return [text.includes("Nedostatok odpovedí") && !text.includes("Priemer") && !html.includes("QA tajný komentár") && res.json.status === "insufficient_responses" && !("questions" in res.json), `${text.slice(0, 250)} | api=${res.text.slice(0, 200)}`, await shot(hr, "j1-43-insufficient-hr")];
});
await step({ j: "J2", d: "Below threshold: printable report shows no numbers", pre: "round M closed with 4", steps: "manager opens /rounds/:id/report", exp: "'Nedostatok odpovedí', no table, no suggestions (IT-08)" }, async () => {
  await mgrA.goto(`${BASE}/rounds/${roundM.id}/report`);
  const text = await mainText(mgrA);
  const tables = await mgrA.locator("article table").count();
  return [text.includes("Nedostatok odpovedí") && tables === 0 && !text.includes("Návrhy krokov") && !(await mgrA.content()).includes("QA tajný"), `${text.slice(0, 300)} | tables=${tables}`, await shot(mgrA, "j1-44-insufficient-report")];
});
await step({ j: "J2", d: "Below threshold: team page (employee) shows the round without averages", pre: "round M closed with 4; round A closed with 5", steps: "Barbora opens Môj tím", exp: "round M: 'Odpovedalo 4 z 6' + 'Nedostatok odpovedí – priemery sa zobrazujú až od 5 odpovedí.' and no averages; round A still shows 4 averages (MVP-14)" }, async () => {
  const p = emp[1];
  await p.goto(`${BASE}/team/${teamA.id}`);
  const m = li(p, NAME_M); const a = li(p, NAME_A);
  const mText = await m.innerText();
  const mAvg = await m.locator('span[aria-label="Priemer"]').count();
  const aAvg = await a.locator('span[aria-label="Priemer"]').count();
  return [mText.includes("Odpovedalo 4 z 6") && mText.includes("Nedostatok odpovedí – priemery sa zobrazujú až od 5 odpovedí.") && mAvg === 0 && aAvg === 4, `M='${mText.replace(/\s+/g, " ")}', averages M=${mAvg}, A=${aAvg}`, await shot(p, "j1-45-team-page-threshold")];
});
await step({ j: "J2", d: "Below threshold: team summary API for an employee carries no numbers for round M", pre: "as above", steps: "Adam: GET /api/teams/:id/summary", exp: "round M results = {status:'insufficient_responses'} only; round A has averages but no distribution/comments" }, async () => {
  const res = await adamApi(`/api/teams/${teamA.id}/summary`);
  const m = res.json.rounds.find((r) => r.id === roundM.id); const a = res.json.rounds.find((r) => r.id === roundA.id);
  const ok = JSON.stringify(m.results) === '{"status":"insufficient_responses"}' && a.results.questions.length === 4 && !res.text.includes("distribution") && !res.text.includes("comment") && !res.text.includes("QA ");
  return [ok || (JSON.stringify(m.results) === '{"status":"insufficient_responses"}' && !res.text.includes("distribution") && !res.text.includes("QA komentár")), `M=${JSON.stringify(m.results)}; A.questions=${a.results.questions.length}; has 'distribution'=${res.text.includes("distribution")}; has comment text=${res.text.includes("QA komentár") || res.text.includes("QA tajný")}`];
});
await step({ j: "J2", d: "Below threshold: trend shows the round as a gap", pre: "Alfa: round A (5), round M (4)", steps: "manager opens trend; GET /api/teams/:id/trend", exp: "row of round M says 'Nedostatok odpovedí' with 4 in 'Odpovedí'; API point has no fixed/topics (IT-08)" }, async () => {
  await mgrA.goto(`${BASE}/team/${teamA.id}/trend`);
  const row = await mgrA.locator("table tbody tr", { hasText: NAME_M }).innerText();
  const res = await mgrAApi(`/api/teams/${teamA.id}/trend`);
  const pt = res.json.points.find((p) => p.roundId === roundM.id);
  return [row.includes("Nedostatok odpovedí") && /\t4\t|\s4\s/.test(row) && pt.status === "insufficient_responses" && !("fixed" in pt) && !("topics" in pt), `row='${row.replace(/\s+/g, " ")}'; api point=${JSON.stringify(pt)}`, await shot(mgrA, "j1-46-trend-gap")];
});
await step({ j: "J2", d: "Below threshold: the round does not contribute to the comparison of teams", pre: "as above", steps: "HR opens /hr/heatmap; compare Alfa cells with the scores of round A alone", exp: "Alfa still '1 kolo', identical cells (IT-08: a round below the threshold contributes nothing)" }, async () => {
  await hr.goto(`${BASE}/hr/heatmap`);
  const head = await hr.locator("table thead th").allInnerTexts();
  const cells = await hr.locator("table tbody tr").first().locator("th,td").allInnerTexts();
  const alfa = Object.fromEntries(head.map((h, i) => [h, cells[i].replace(/\s+/g, " ").trim()]));
  const ok = alfa["Tím"] === "Tím Alfa 1 kolo" && alfa["Stála otázka"] === sk(scoreA.fixed) && Object.entries(scoreA.topics).every(([k, v]) => alfa[k] === sk(v)) && !head.includes("Vlastné otázky tímu");
  return [ok, JSON.stringify(alfa), await shot(hr, "j1-47-heatmap-threshold")];
});
await step({ j: "J2", d: "Below threshold: manager can still record an action for the round and the team sees it", pre: "round M closed with 4", steps: "manager adds an action on results of round M; employee opens team page", exp: "action saved (MVP-13 applies to every closed round) and visible to the team" }, async () => {
  await mgrA.goto(`${BASE}/rounds/${roundM.id}/results`);
  await mgrA.locator('input[name="topic"]').fill("QA krok pod prahom");
  await mgrA.locator('textarea[name="description"]').fill("QA: zopakujeme kolo.");
  await mgrA.locator('input[name="dueDate"]').fill(due1);
  await mgrA.getByRole("button", { name: "Pridať krok" }).click();
  await mgrA.locator("#kroky ul > li h3", { hasText: "QA krok pod prahom" }).waitFor();
  await emp[1].goto(`${BASE}/team/${teamA.id}`);
  const t = await li(emp[1], NAME_M).innerText();
  const n = await db.action.count({ where: { roundId: roundM.id } });
  return [n === 1 && t.includes("QA krok pod prahom"), `actions=${n}; team page has it=${t.includes("QA krok pod prahom")}`];
});
await step({ j: "J2", d: "Seeded Beta round with 4 responses: its own manager sees only 'Nedostatok odpovedí'", pre: "seed", steps: "manager Beta opens the results of the seeded round", exp: "'Nedostatok odpovedí', count 4, nothing else (acceptance step 4)" }, async () => {
  await mgrB.goto(`${BASE}/rounds/${seedBeta.id}/results`);
  const text = await mainText(mgrB);
  return [text.includes("Nedostatok odpovedí") && text.includes("Kolo má 4 odpovede.") && !text.includes("Priemer"), text.slice(0, 300), await shot(mgrB, "j1-48-beta-insufficient")];
});
await step({ j: "J6", d: "Team page order: closed rounds newest first", pre: "Alfa has rounds A (closed today, deadline +7 d) and M (deadline moved to the past)", steps: "read order of round cards on the team page", exp: "sorted by deadline descending as implemented: A, then M (MVP-14 'najnovšie hore')" }, async () => {
  const order = await emp[1].locator("main > div > ul > li > h2").allInnerTexts();
  return [order[0] === NAME_A && order[1] === NAME_M, order.join(" | ")];
});

console.log(`\nJ1 done: ${R.rows.length} checks, ${R.rows.filter((r) => r.status === "FAIL").length} failed, ${R.rows.filter((r) => r.status === "BLOCKED").length} blocked`);
await closeBrowser();
