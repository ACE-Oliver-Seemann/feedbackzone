// Journey 8: multi-user and concurrent scenarios. Seed-only start.
import { BASE, U, db, resetDb, recorder, session, shot, mainText, api, ymd, fillWizard, closeBrowser } from "./lib.mjs";

const R = recorder("j8-concurrency");
const step = async (meta, fn) => {
  try { const [ok, actual, evidence] = await fn(); return R.check({ j: "J8", ...meta }, ok, actual, evidence ?? ""); }
  catch (error) { return R.check({ j: "J8", ...meta }, false, `SCRIPT/RUNTIME ERROR: ${error.message}`); }
};
resetDb(false);
const teamA = await db.team.findFirstOrThrow({ where: { name: "Tím Alfa" } });
const teamB = await db.team.findFirstOrThrow({ where: { name: "Tím Beta" } });
const seedBeta = await db.round.findFirstOrThrow({ where: { teamId: teamB.id } });
const hrApi = await api(U.hr); const mgrAApi = await api(U.mgrA); const mgrBApi = await api(U.mgrB);
const qs = (await hrApi("/api/questions")).json.questions.filter((q) => !q.fixed).slice(0, 3).map((q) => q.id);
const mk = async (name, teamId, open = true) => { const c = await hrApi("/api/rounds", "POST", { name, teamId, closesAt: ymd(new Date(Date.now() + 7 * 864e5)), questionIds: qs }); if (open) await hrApi(`/api/rounds/${c.json.round.id}/open`, "POST"); return c.json.round.id; };
const counts = async (roundId) => `${await db.participation.count({ where: { roundId } })}/${await db.response.count({ where: { roundId } })}`;
const row = (page, name) => page.locator("main li", { has: page.getByRole("heading", { name, exact: true }) }).first();

// ───── simultaneous submissions by different users (UI)
const r1 = await mk("QA súbežné kolo 1", teamA.id);
const pages = [];
for (let i = 0; i < 5; i++) pages.push(await session(U.alfa[i], { width: [360, 412, 820, 1280, 1536][i], height: 800 }));
const mgrPage = await session(U.mgrA);
await step({ d: "Six members (5 employees + manager) press 'Odoslať' at the same moment in six browsers", pre: "all six on the comment step of the same round", steps: "click Odoslať in all six pages concurrently", exp: "six thank-you screens; 6 participations, 6 responses; multiset of stored values equals the inputs" }, async () => {
  const all = [...pages, mgrPage];
  const answers = [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 1], [4, 5, 1, 2], [5, 1, 2, 3], [3, 3, 3, 3]];
  await Promise.all(all.map((p, i) => fillWizard(p, r1, answers[i], `QA súbežný komentár ${i + 1}`, { stopBeforeSubmit: true })));
  await Promise.all(all.map((p) => p.getByRole("button", { name: "Odoslať" }).click()));
  await Promise.all(all.map((p) => p.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 15000 })));
  const resp = await db.response.findMany({ where: { roundId: r1 } });
  const got = resp.map((r) => [r.v1, r.v2, r.v3, r.v4].join("")).sort().join();
  return [(await counts(r1)) === "6/6" && got === answers.map((a) => a.join("")).sort().join() && resp.every((r) => r.comment), `DB=${await counts(r1)}; values=${got}`, await shot(pages[0], "j8-01-concurrent-submit")];
});
await step({ d: "The same user in two tabs submits the same round at the same moment", pre: "new round; Adam has the wizard on the comment step in two tabs with different answers", steps: "click Odoslať in both tabs concurrently", exp: "one tab: thank-you; the other: 'Toto kolo už máš vyplnené'; exactly 1 participation and 1 response" }, async () => {
  const r2 = await mk("QA súbežné kolo 2", teamA.id);
  const tab1 = pages[0]; const tab2 = await tab1.context().newPage();
  await Promise.all([fillWizard(tab1, r2, [1, 1, 1, 1], "tab 1", { stopBeforeSubmit: true }), fillWizard(tab2, r2, [5, 5, 5, 5], "tab 2", { stopBeforeSubmit: true })]);
  await Promise.all([tab1.getByRole("button", { name: "Odoslať" }).click(), tab2.getByRole("button", { name: "Odoslať" }).click()]);
  await tab1.waitForTimeout(1500);
  const t = [await mainText(tab1), await mainText(tab2)];
  const thanks = t.filter((x) => x.includes("Ďakujeme za odpoveď")).length; const already = t.filter((x) => x.includes("Toto kolo už máš vyplnené")).length;
  const s = await shot(tab2, "j8-02-two-tabs-same-user");
  await tab2.close();
  return [thanks === 1 && already === 1 && (await counts(r2)) === "1/1", `thank-you tabs=${thanks}, 'already submitted' tabs=${already}, DB=${await counts(r2)}`, s];
});
await step({ d: "Ten parallel API submissions of the same user", pre: "new open round; Barbora's session", steps: "10× POST /api/rounds/:id/responses at once", exp: "exactly one 201, nine 409 already_submitted, no 500; 1 participation, 1 response" }, async () => {
  const r3 = await mk("QA súbežné kolo 3", teamA.id);
  const b = await api(U.alfa[1]);
  const res = await Promise.all(Array.from({ length: 10 }, (_, i) => b(`/api/rounds/${r3}/responses`, "POST", { answers: [1 + (i % 5), 2, 3, 4] })));
  const st = res.map((r) => r.status).sort().join();
  return [res.filter((r) => r.status === 201).length === 1 && res.filter((r) => r.status === 409).length === 9 && (await counts(r3)) === "1/1", `statuses=${st}; DB=${await counts(r3)}`];
});
await step({ d: "Twelve users of two teams submit to their own rounds in parallel (API)", pre: "one open round per team", steps: "12 parallel POSTs (6 Alfa, 6 Beta)", exp: "12× 201; each round 6/6; no cross-team rows" }, async () => {
  const ra = await mk("QA paralelne Alfa", teamA.id); const rb = await mk("QA paralelne Beta", teamB.id);
  const sessions = await Promise.all([...U.alfa, U.mgrA, ...U.beta, U.mgrB].map((e) => api(e)));
  const res = await Promise.all(sessions.map((s, i) => s(`/api/rounds/${i < 6 ? ra : rb}/responses`, "POST", { answers: [3, 4, 2, 5], comment: `QA ${i}` })));
  const wrongTeam = await db.response.count({ where: { OR: [{ roundId: ra, teamId: teamB.id }, { roundId: rb, teamId: teamA.id }] } });
  return [res.every((r) => r.status === 201) && (await counts(ra)) === "6/6" && (await counts(rb)) === "6/6" && wrongTeam === 0, `statuses=${res.map((r) => r.status).join()}; Alfa=${await counts(ra)}, Beta=${await counts(rb)}, wrong-team rows=${wrongTeam}`];
});
await step({ d: "A member of another team submits to a foreign round while it is open", pre: "open Alfa round", steps: "Filip (Beta): POST response to the Alfa round", exp: "403; nothing stored (data isolation)" }, async () => {
  const r = await db.round.findFirst({ where: { name: "QA súbežné kolo 2" } });
  const f = await api(U.beta[0]);
  const before = await counts(r.id);
  const res = await f(`/api/rounds/${r.id}/responses`, "POST", { answers: [1, 1, 1, 1] });
  return [res.status === 403 && (await counts(r.id)) === before, `HTTP ${res.status}; DB ${before}→${await counts(r.id)}`];
});

// ───── closing while someone fills in
await step({ d: "The manager closes the round while a member is on the last step", pre: "new open round; Cyril on the comment step", steps: "manager clicks 'Uzavrieť' in /rounds; Cyril clicks Odoslať", exp: "Cyril sees 'Kolo je uzavreté'; nothing stored; manager's list shows 'Uzavreté'" }, async () => {
  const r4 = await mk("QA zatvorenie počas vypĺňania", teamA.id);
  await fillWizard(pages[2], r4, [4, 4, 4, 4], "QA nestihnutý komentár", { stopBeforeSubmit: true });
  await mgrPage.goto(`${BASE}/rounds`);
  await row(mgrPage, "QA zatvorenie počas vypĺňania").getByRole("button", { name: "Uzavrieť" }).click();
  await row(mgrPage, "QA zatvorenie počas vypĺňania").getByText("Uzavreté").waitFor();
  await pages[2].getByRole("button", { name: "Odoslať" }).click();
  await pages[2].getByRole("heading", { name: "Kolo je uzavreté" }).waitFor();
  return [(await counts(r4)) === "0/0", `DB=${await counts(r4)}`, await shot(pages[2], "j8-03-closed-while-filling")];
});
await step({ d: "Race: close and five submissions fired together (repeated 3×)", pre: "3 fresh open rounds", steps: "Promise.all([close, 5 responses]) for each round", exp: "every response is either 201 or 409 round_closed; participations = responses in each round; results count equals stored rows; no 500" }, async () => {
  const members = await Promise.all(U.alfa.map((e) => api(e)));
  const out = [];
  for (let n = 0; n < 3; n++) {
    const r = await mk(`QA race ${n + 1}`, teamA.id);
    const res = await Promise.all([mgrAApi(`/api/rounds/${r}/close`, "POST"), ...members.map((m) => m(`/api/rounds/${r}/responses`, "POST", { answers: [2, 3, 4, 5] }))]);
    const st = res.map((x) => x.status);
    const [p, q] = (await counts(r)).split("/").map(Number);
    const api2 = await mgrAApi(`/api/rounds/${r}/results`);
    out.push({ st: st.join(), p, q, shown: api2.json.participation.responded, bad: st.some((s) => ![200, 201, 409].includes(s)) || p !== q || api2.json.participation.responded !== q || st.slice(1).filter((s) => s === 201).length !== q });
  }
  return [out.every((o) => !o.bad), JSON.stringify(out.map(({ bad, ...o }) => o))];
});

// ───── two people acting on the same round
const hrPage = await session(U.hr);
await step({ d: "HR and the manager both press 'Spustiť' on the same draft at the same time", pre: "draft visible in /hr/rounds and in /rounds", steps: "click Spustiť in both browsers concurrently", exp: "DB OPEN with one startsAt; one side may show 'Kolo medzitým zmenilo stav. Obnov stránku.'; no crash" }, async () => {
  const r = await mk("QA dvaja naraz spustiť", teamA.id, false);
  await Promise.all([hrPage.goto(`${BASE}/hr/rounds`), mgrPage.goto(`${BASE}/rounds`)]);
  await Promise.all([row(hrPage, "QA dvaja naraz spustiť").getByRole("button", { name: "Spustiť" }).click(), row(mgrPage, "QA dvaja naraz spustiť").getByRole("button", { name: "Spustiť" }).click()]);
  await hrPage.waitForTimeout(1500);
  const x = await db.round.findUnique({ where: { id: r } });
  const msgs = [...(await hrPage.getByRole("alert").allInnerTexts()), ...(await mgrPage.getByRole("alert").allInnerTexts())].filter(Boolean);
  return [x.status === "OPEN" && x.startsAt !== null && msgs.every((m) => m === "Kolo medzitým zmenilo stav. Obnov stránku."), `DB=${x.status}; messages=${JSON.stringify(msgs)}; page errors=${hrPage.errors.length + mgrPage.errors.length}`, await shot(hrPage, "j8-04-both-open")];
});
await step({ d: "HR and the manager both press 'Uzavrieť' at the same time", pre: "the round from the previous step is open in both lists", steps: "reload both lists; click Uzavrieť in both concurrently", exp: "DB CLOSED once (single closedAt); loser sees the 'changed state' message" }, async () => {
  await Promise.all([hrPage.goto(`${BASE}/hr/rounds`), mgrPage.goto(`${BASE}/rounds`)]);
  await Promise.all([row(hrPage, "QA dvaja naraz spustiť").getByRole("button", { name: "Uzavrieť" }).click(), row(mgrPage, "QA dvaja naraz spustiť").getByRole("button", { name: "Uzavrieť" }).click()]);
  await hrPage.waitForTimeout(1500);
  const x = await db.round.findFirst({ where: { name: "QA dvaja naraz spustiť" } });
  const msgs = [...(await hrPage.getByRole("alert").allInnerTexts()), ...(await mgrPage.getByRole("alert").allInnerTexts())].filter(Boolean);
  return [x.status === "CLOSED" && x.closedAt !== null && msgs.length <= 1, `DB=${x.status}, closedAt=${x.closedAt?.toISOString()}; messages=${JSON.stringify(msgs)}`];
});
await step({ d: "Two parallel close requests through the API", pre: "open round", steps: "HR and manager: POST close at once", exp: "one 200 and one 409 invalid_state" }, async () => {
  const r = await mk("QA dvaja naraz API", teamA.id);
  const res = await Promise.all([hrApi(`/api/rounds/${r}/close`, "POST"), mgrAApi(`/api/rounds/${r}/close`, "POST")]);
  const st = res.map((x) => x.status).sort().join();
  return [st === "200,409", `statuses=${st}`];
});
await step({ d: "Automatic close: several users load pages at the same moment after the deadline", pre: "open round with its deadline moved 1 minute into the past in the QA DB", steps: "6 parallel GETs (home pages + API) by different users", exp: "round CLOSED with closedAt = deadline; all requests 200" }, async () => {
  const r = await mk("QA auto-close race", teamA.id);
  const past = new Date(Date.now() - 60000);
  await db.round.update({ where: { id: r }, data: { closesAt: past } });
  const s = await Promise.all(U.alfa.map((e) => api(e)));
  const res = await Promise.all([...s.map((c) => c("/")), mgrAApi("/api/rounds"), hrApi("/api/hr/overview")]);
  const x = await db.round.findUnique({ where: { id: r } });
  return [x.status === "CLOSED" && x.closedAt.getTime() === past.getTime() && res.every((q) => q.status === 200), `DB=${x.status}, closedAt=deadline=${x.closedAt.getTime() === past.getTime()}; statuses=${res.map((q) => q.status).join()}`];
});

// ───── action status in two tabs
await step({ d: "Action status changed in two tabs of the manager", pre: "closed Beta round with one action 'Plánované'; results page open in two tabs", steps: "tab 1: set 'Hotové'; tab 2 (still showing 'Plánované'): set 'Prebieha'; then look at tab 1 without reloading and after reloading", exp: "last write wins in the DB (IN_PROGRESS); after reload both tabs agree with the DB" }, async () => {
  await mgrBApi(`/api/rounds/${seedBeta.id}/actions`, "POST", { topic: "QA krok dve karty", description: "QA", dueDate: ymd(new Date(Date.now() + 864e5)) });
  const t1 = await session(U.mgrB); const t2 = await t1.context().newPage();
  await t1.goto(`${BASE}/rounds/${seedBeta.id}/results`); await t2.goto(`${BASE}/rounds/${seedBeta.id}/results`);
  const sel = (p) => p.locator("#kroky > ul > li", { hasText: "QA krok dve karty" }).getByLabel("Stav");
  await sel(t1).selectOption("DONE"); await t1.waitForTimeout(600);
  const stale = await sel(t2).inputValue();
  await sel(t2).selectOption("IN_PROGRESS"); await t2.waitForTimeout(600);
  const dbs = (await db.action.findFirst({ where: { topic: "QA krok dve karty" } })).status;
  const t1Before = await sel(t1).inputValue();
  await t1.reload();
  const t1After = await sel(t1).inputValue();
  const s = await shot(t1, "j8-05-action-two-tabs");
  await t1.context().close();
  return [dbs === "IN_PROGRESS" && t1After === "IN_PROGRESS", `tab 2 before its change showed=${stale}; DB=${dbs}; tab 1 without reload still shows=${t1Before} (stale, no warning); tab 1 after reload=${t1After}`, s];
});
await step({ d: "Two parallel PATCHes of the same action", pre: "action exists", steps: "PATCH DONE and PATCH PLANNED at once", exp: "both 200; DB holds one of the two valid values" }, async () => {
  const a = await db.action.findFirst({ where: { topic: "QA krok dve karty" } });
  const res = await Promise.all([mgrBApi(`/api/actions/${a.id}`, "PATCH", { status: "DONE" }), mgrBApi(`/api/actions/${a.id}`, "PATCH", { status: "PLANNED" })]);
  const s = (await db.action.findUnique({ where: { id: a.id } })).status;
  return [res.every((r) => r.status === 200) && ["DONE", "PLANNED"].includes(s), `statuses=${res.map((r) => r.status)}; DB=${s}`];
});

// ───── double clicks (real dblclick events) on every create button
const dbl = async (d, pre, prepare, button, count, expected, name) =>
  step({ d, pre, steps: "fill the form; double-click the submit button (two real click events ~0 ms apart)", exp: `exactly ${expected} new row(s)` }, async () => {
    const before = await count();
    const p = await prepare();
    await button(p).dblclick();
    await p.waitForTimeout(1500);
    const after = await count();
    return [after - before === expected, `rows ${before}→${after}`, await shot(p, name)];
  });
await dbl("Double click on 'Poslať kudos'", "Adam on the kudos form", async () => {
  const p = pages[0];
  await p.goto(`${BASE}/kudos/new`);
  await p.locator('select[name="toUserId"]').selectOption({ label: "Dana Príkladná (Tím Alfa)" });
  await p.locator("form textarea").fill("QA dvojklik na odoslanie kudos.");
  return p;
}, (p) => p.getByRole("button", { name: "Poslať kudos" }), () => db.kudos.count(), 1, "j8-06-dbl-kudos");
await dbl("Double click on 'Pridať krok'", "manager Beta on results of the closed round", async () => {
  const p = await session(U.mgrB);
  await p.goto(`${BASE}/rounds/${seedBeta.id}/results`);
  await p.locator('input[name="topic"]').fill("QA dvojklik krok");
  await p.locator('textarea[name="description"]').fill("QA dvojklik");
  await p.locator('input[name="dueDate"]').fill(ymd(new Date(Date.now() + 864e5)));
  return p;
}, (p) => p.getByRole("button", { name: "Pridať krok" }), () => db.action.count(), 1, "j8-07-dbl-action");
await dbl("Double click on 'Uložiť koncept'", "HR on /rounds/new with defaults", async () => {
  await hrPage.goto(`${BASE}/rounds/new`);
  await hrPage.locator('input[name="name"]').fill("QA dvojklik kolo");
  return hrPage;
}, (p) => p.getByRole("button", { name: "Uložiť koncept" }), () => db.round.count({ where: { name: "QA dvojklik kolo" } }), 1, "j8-08-dbl-round");
await dbl("Double click on 'Pridať podnet'", "HR on /hr/issues with the form open", async () => {
  await hrPage.goto(`${BASE}/hr/issues`);
  await hrPage.locator("details > summary", { hasText: "Pridať podnet" }).click();
  await hrPage.locator('form#new input[name="title"]').fill("QA dvojklik podnet");
  return hrPage;
}, (p) => p.locator("form#new").getByRole("button", { name: "Pridať podnet" }), () => db.issue.count(), 1, "j8-09-dbl-issue");
await dbl("Double click on 'Uložiť poznámku'", "HR on /hr/notes with the form filled", async () => {
  await hrPage.goto(`${BASE}/hr/notes`);
  await hrPage.locator('input[name="title"]').fill("QA dvojklik poznámka");
  await hrPage.locator('input[name="meetingDate"]').fill(ymd(new Date()));
  await hrPage.locator('textarea[name="text"]').fill("QA text");
  return hrPage;
}, (p) => p.getByRole("button", { name: "Uložiť poznámku" }), () => db.meetingNote.count(), 1, "j8-10-dbl-note");
await step({ d: "Double click on 'Pridať otázku' (own question)", pre: "manager Alfa on /rounds/new", steps: "type a question; double-click 'Pridať otázku'", exp: "exactly 1 own question; no 'duplicate' error left on screen for the user" }, async () => {
  await mgrPage.goto(`${BASE}/rounds/new`);
  await mgrPage.getByLabel("Pridať vlastnú otázku").fill("QA dvojklik: úlohy sú rozdelené férovo.");
  await mgrPage.getByRole("button", { name: "Pridať otázku" }).dblclick();
  await mgrPage.waitForTimeout(1200);
  const n = await db.question.count({ where: { teamId: teamA.id } });
  const dup = await mgrPage.getByText("Takáto otázka už v knižnici je.").count();
  return [n === 1 && dup === 0, `own questions=${n}; duplicate message shown=${dup}`];
});
await step({ d: "Five parallel requests creating the same own question", pre: "manager Alfa session", steps: "5× POST /api/questions with the same text at once", exp: "one 201, four 400 duplicate; exactly one row (IT-07: 'Takáto otázka už v knižnici je')" }, async () => {
  const res = await Promise.all(Array.from({ length: 5 }, () => mgrAApi("/api/questions", "POST", { text: "QA paralelná vlastná otázka tímu." })));
  const n = await db.question.count({ where: { text: "QA paralelná vlastná otázka tímu." } });
  return [n === 1, `statuses=${res.map((r) => r.status).sort().join()}; rows with the same text=${n}`];
});
await step({ d: "Five parallel kudos from five senders to one recipient", pre: "5 Beta employees", steps: "5 parallel POST /api/kudos", exp: "5× 201; recipient's 'Moje kudos' API lists all five" }, async () => {
  const to = await db.user.findUniqueOrThrow({ where: { email: U.mgrB } });
  const s = await Promise.all(U.beta.map((e) => api(e)));
  const res = await Promise.all(s.map((c, i) => c("/api/kudos", "POST", { toUserId: to.id, text: `QA paralelné kudos číslo ${i + 1} pre manažéra.`, value: "HELPING", visibility: i % 2 ? "PRIVATE" : "TEAM" })));
  const mine = await mgrBApi("/api/kudos/me");
  const n = mine.json.kudos.filter((k) => k.text.startsWith("QA paralelné kudos")).length;
  return [res.every((r) => r.status === 201) && n === 5, `statuses=${res.map((r) => r.status)}; listed=${n}`];
});

// ───── different roles, same data, same moment
await step({ d: "Results of one round requested by manager and HR in parallel are identical (except comment order)", pre: "round 'QA súbežné kolo 1' closed with 6 responses", steps: "close the round; GET results as manager and HR at once ×3", exp: "identical participation, averages, distributions and the same set of comments" }, async () => {
  await mgrAApi(`/api/rounds/${r1}/close`, "POST");
  const res = await Promise.all([mgrAApi(`/api/rounds/${r1}/results`), hrApi(`/api/rounds/${r1}/results`), mgrAApi(`/api/rounds/${r1}/results`), hrApi(`/api/rounds/${r1}/results`)]);
  const norm = (j) => JSON.stringify({ p: j.participation, q: j.questions, c: [...j.comments].sort() });
  const same = new Set(res.map((r) => norm(r.json))).size === 1;
  return [same && res[0].json.responseCount === 6, `identical=${same}; responseCount=${res[0].json.responseCount}; averages=${res[0].json.questions.map((q) => q.average)}`];
});
await step({ d: "An employee and the manager of the same team see the same averages for the same round", pre: "round closed with 6 responses", steps: "Adam: team page; manager: results page", exp: "the four averages are identical" }, async () => {
  await pages[0].goto(`${BASE}/team/${teamA.id}`);
  const a = await row(pages[0], "QA súbežné kolo 1").locator('span[aria-label="Priemer"]').allInnerTexts();
  await mgrPage.goto(`${BASE}/rounds/${r1}/results`);
  const m = await mgrPage.locator("section:has(h2:text-is('Otázky')) span.text-2xl").allInnerTexts();
  return [a.length === 4 && JSON.stringify(a) === JSON.stringify(m), `employee=${a.join(" | ")}; manager=${m.join(" | ")}`];
});

console.log(`\nJ8 done: ${R.rows.length} checks, ${R.rows.filter((r) => r.status === "FAIL").length} failed`);
await closeBrowser();
