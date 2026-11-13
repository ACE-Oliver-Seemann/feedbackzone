// Journey 10 (regression variants): empty states, rounds with 3 and 5 questions, labelled
// scales, keyboard-only filling, form validation in the round form, wording rules
// (NFR-04, NFR-07) and long unbroken text on a phone. Seed-only start.
import { BASE, U, db, resetDb, recorder, session, shot, mainText, api, ymd, sk, round2, closeBrowser } from "./lib.mjs";

const R = recorder("j10-variants");
const step = async (meta, fn) => {
  try { const [ok, actual, evidence] = await fn(); return R.check({ j: "J10", ...meta }, ok, actual, evidence ?? ""); }
  catch (error) { return R.check({ j: "J10", ...meta }, false, `SCRIPT/RUNTIME ERROR: ${error.message}`); }
};
const DAY = 864e5;
resetDb(false);
const teamA = await db.team.findFirstOrThrow({ where: { name: "Tím Alfa" } });
const teamB = await db.team.findFirstOrThrow({ where: { name: "Tím Beta" } });
const hrApi = await api(U.hr); const mgrAApi = await api(U.mgrA);
const adam = await session(U.alfa[0], { width: 360, height: 740 });
const mgrA = await session(U.mgrA);
const hr = await session(U.hr);
const overflow = (p) => p.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));

// ───── empty states on a fresh seed
await step({ d: "Empty state: team page of a team without closed rounds and without kudos", pre: "seed only (Alfa has no round)", steps: "Adam opens 'Môj tím'", exp: "'Tím zatiaľ nemá žiadne uzavreté kolo.' and 'V tíme zatiaľ nie je žiadne verejné kudos.'" }, async () => {
  await adam.goto(`${BASE}/team/${teamA.id}`);
  const t = await mainText(adam);
  return [t.includes("Tím zatiaľ nemá žiadne uzavreté kolo.") && t.includes("V tíme zatiaľ nie je žiadne verejné kudos."), t.slice(-160), await shot(adam, "j10-01-empty-team-360")];
});
await step({ d: "Empty state: trend of a team without closed rounds", pre: "seed only", steps: "manager Alfa opens 'Vývoj tímu'", exp: "'Tím zatiaľ nemá žiadne uzavreté kolo.'; no chart, no table" }, async () => {
  await mgrA.goto(`${BASE}/team/${teamA.id}/trend`);
  const t = await mainText(mgrA);
  return [t.includes("Tím zatiaľ nemá žiadne uzavreté kolo.") && (await mgrA.locator("svg, table").count()) === 0, t.slice(-120)];
});
await step({ d: "Empty state: comparison of teams when no round is above the threshold", pre: "seed only (the only closed round has 4 responses)", steps: "HR opens 'Porovnanie tímov'", exp: "'V tomto období nemá žiadny tím uzavreté kolo nad prahom dôvernosti.'; no table (NFR-02)" }, async () => {
  await hr.goto(`${BASE}/hr/heatmap`);
  const t = await mainText(hr);
  return [t.includes("V tomto období nemá žiadny tím uzavreté kolo nad prahom dôvernosti.") && (await hr.locator("table").count()) === 0, t.slice(-150), await shot(hr, "j10-02-empty-heatmap")];
});
await step({ d: "Empty state: manager whose team never had a round", pre: "seed only", steps: "manager Alfa opens '/'", exp: "task 'Tím ešte nemal žiadny prieskum. Vytvor prvé kolo.' with 'Nové kolo' → /rounds/new; /rounds says 'Zatiaľ tu nie je žiadne kolo.'" }, async () => {
  await mgrA.goto(`${BASE}/`);
  const tasks = await mgrA.locator("main ol > li p").allInnerTexts();
  const href = await mgrA.locator("main ol > li").first().getByRole("link").getAttribute("href");
  await mgrA.goto(`${BASE}/rounds`);
  const empty = (await mainText(mgrA)).includes("Zatiaľ tu nie je žiadne kolo.");
  return [tasks.join() === "Tím ešte nemal žiadny prieskum. Vytvor prvé kolo." && href === "/rounds/new" && empty, `tasks=${JSON.stringify(tasks)}; href=${href}; empty list text=${empty}`, await shot(mgrA, "j10-03-empty-rounds")];
});
await step({ d: "Empty state: 'Moje kudos' without kudos", pre: "seed only", steps: "Adam opens Kudos → Moje kudos", exp: "'Zatiaľ tu nemáš žiadne kudos.'" }, async () => {
  await adam.goto(`${BASE}/kudos/me`);
  return [(await mainText(adam)).includes("Zatiaľ tu nemáš žiadne kudos."), "empty text shown"];
});

// ───── round form validation
await step({ d: "Round form: empty name is refused, other inputs stay", pre: "manager on /rounds/new", steps: "clear the name; save", exp: "'Zadaj názov kola (najviac 120 znakov).'; 3 questions still ticked; no round" }, async () => {
  await mgrA.goto(`${BASE}/rounds/new`);
  await mgrA.locator('input[name="name"]').fill("   ");
  await mgrA.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgrA.getByText("Zadaj názov kola (najviac 120 znakov).").waitFor();
  const ticked = await mgrA.locator('input[type="checkbox"]:checked').count();
  return [ticked === 3 && (await db.round.count({ where: { teamId: teamA.id } })) === 0, `ticked=${ticked}; rounds=${await db.round.count({ where: { teamId: teamA.id } })}`];
});
await step({ d: "Round form: a deadline in the past is refused", pre: "manager on /rounds/new", steps: "name 'QA minulosť', deadline yesterday (typed), save", exp: "'Zadaj dátum uzávierky, ktorý je dnes alebo neskôr.'; no round (MVP-04)" }, async () => {
  await mgrA.locator('input[name="name"]').fill("QA minulosť");
  await mgrA.locator('input[name="closesAt"]').fill(ymd(new Date(Date.now() - DAY)));
  await mgrA.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgrA.getByText("Zadaj dátum uzávierky, ktorý je dnes alebo neskôr.").waitFor();
  return [(await db.round.count({ where: { teamId: teamA.id } })) === 0, "error shown; rounds=0", await shot(mgrA, "j10-04-past-deadline")];
});
await step({ d: "Round form: an emptied deadline is refused", pre: "manager on /rounds/new", steps: "clear the date; save", exp: "the same deadline message; no round" }, async () => {
  await mgrA.locator('input[name="closesAt"]').fill("");
  await mgrA.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgrA.waitForTimeout(1200);
  const shown = await mgrA.getByText("Zadaj dátum uzávierky, ktorý je dnes alebo neskôr.").isVisible();
  return [shown && (await db.round.count({ where: { teamId: teamA.id } })) === 0, `message shown=${shown}`];
});
await step({ d: "Round form: name with quotes and HTML is stored and shown literally everywhere", pre: "manager on /rounds/new", steps: "name '<i>QA</i> & \"kolo\" 5 otázok', pick 4 questions incl. the two labelled-scale questions, deadline +7, save, start", exp: "list, employee task and wizard show the name as typed; no markup rendered" }, async () => {
  const NAME = '<i>QA</i> & "kolo" 5 otázok';
  await mgrA.locator('input[name="name"]').fill(NAME);
  await mgrA.locator('input[name="closesAt"]').fill(ymd(new Date(Date.now() + 7 * DAY)));
  while ((await mgrA.locator('input[type="checkbox"]:checked').count()) > 0) await mgrA.locator('input[type="checkbox"]:checked').first().uncheck();
  while ((await mgrA.locator("form details:not([open]) > summary").count()) > 0) await mgrA.locator("form details:not([open]) > summary").first().click();
  for (const text of ["Ako často bolo za posledné dva týždne potrebné pracovať nadčas", "Ako často sa za posledné dva týždne pracovný deň skončil pocitom vyčerpania", "Mám dosť času robiť prácu poriadne.", "Priority nášho tímu sú mi jasné."]) await mgrA.locator("label", { hasText: text }).locator('input[type="checkbox"]').check();
  const counter = await mgrA.getByText(/Otázok v kole:/).innerText();
  await mgrA.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgrA.waitForURL("**/rounds");
  await mgrA.locator("main li", { hasText: "5 otázok" }).getByRole("button", { name: "Spustiť" }).click();
  await mgrA.locator("main li", { hasText: "Otvorené" }).first().waitFor();
  const listText = await mgrA.locator("main li h3").first().innerText();
  await adam.goto(`${BASE}/`);
  const task = await adam.locator("main ol > li p").first().innerText();
  const italics = (await adam.locator("main i").count()) + (await mgrA.locator("main i").count());
  return [counter === "Otázok v kole: 5 (treba 3 až 5)" && listText === NAME && task === `Čaká na teba prieskum „${NAME}“. Má 5 otázok a zaberie asi 2 minúty.` && italics === 0, `counter='${counter}'; list='${listText}'; task='${task}'; <i> rendered=${italics}`, await shot(adam, "j10-05-name-special-360")];
});
const r5 = await db.round.findFirstOrThrow({ where: { teamId: teamA.id }, include: { questions: { orderBy: { position: "asc" }, include: { question: true } } } });

// ───── 5 questions, labelled scales, keyboard only
await step({ d: "Wizard with 5 questions: intro and progress wording", pre: "open round with 5 questions; Adam at 360 px", steps: "open the wizard, start", exp: "'5 otázok, zaberie to do 2 minút.'; progress '1 z 5'" }, async () => {
  await adam.goto(`${BASE}/rounds/${r5.id}/fill`);
  const intro = (await mainText(adam)).includes("5 otázok, zaberie to do 2 minút.");
  await adam.getByRole("button", { name: "Začať" }).click();
  const prog = await adam.getByText("1 z 5", { exact: true }).isVisible();
  return [intro && prog, `intro=${intro}, progress=${prog}`];
});
await step({ d: "Wizard: numeric scale shows end labels and the meaning of the chosen number", pre: "question 1 (fixed, quality scale)", steps: "choose 2", exp: "labels 'Veľmi zlé' / 'Veľmi dobré'; after choosing 2 the text 'Skôr zlé' appears (IT-03)" }, async () => {
  const t0 = await adam.locator("fieldset").locator("xpath=..").innerText();
  await adam.locator("fieldset button[aria-pressed]").nth(1).click();
  const chosen = await adam.locator("p[aria-live=polite]").last().innerText();
  return [t0.includes("Veľmi zlé") && t0.includes("Veľmi dobré") && chosen === "Skôr zlé", `end labels present; chosen label='${chosen}'`, await shot(adam, "j10-06-quality-scale-360")];
});
const order = r5.questions.map((q) => q.question.scale);
await step({ d: "Wizard: frequency scales show five labelled answers instead of numbers", pre: "questions with scales OVERTIME and FREQUENCY in the round", steps: "walk to each of them; read the buttons; choose the 2nd and the 4th label", exp: "OVERTIME: Nikdy, Raz či dvakrát, Každý týždeň, Väčšinu dní, Takmer denne; FREQUENCY: Nikdy, Zriedka, Občas, Často, Takmer vždy (IT-03); no horizontal overflow at 360 px" }, async () => {
  const seen = {}; let of = false;
  for (let i = 1; i < 5; i++) {
    await adam.getByRole("button", { name: "Ďalej" }).click();
    const labels = await adam.locator("fieldset button[aria-pressed]").allInnerTexts();
    seen[order[i]] = labels.join(", ");
    const m = await overflow(adam); of ||= m.s > m.c;
    if (order[i] === "OVERTIME") { await adam.locator("fieldset button[aria-pressed]").nth(1).click(); await shot(adam, "j10-07-overtime-scale-360"); }
    else if (order[i] === "FREQUENCY") await adam.locator("fieldset button[aria-pressed]").nth(3).click();
    else await adam.locator("fieldset button[aria-pressed]").nth(4).click();
  }
  return [seen.OVERTIME === "Nikdy, Raz či dvakrát, Každý týždeň, Väčšinu dní, Takmer denne" && seen.FREQUENCY === "Nikdy, Zriedka, Občas, Často, Takmer vždy" && !of, `OVERTIME='${seen.OVERTIME}'; FREQUENCY='${seen.FREQUENCY}'; overflow=${of}`];
});
await step({ d: "Wizard: changing an earlier answer from the comment step", pre: "all 5 answered; Adam on the comment step", steps: "Späť → change the 5th answer → Ďalej → Odoslať with a whitespace-only comment", exp: "stored values reflect the changed answer; labelled answers stored as integers 2 and 4; whitespace comment stored as NULL (MVP-08, IT-03)" }, async () => {
  await adam.getByRole("button", { name: "Ďalej" }).click();
  await adam.getByRole("button", { name: "Späť" }).click();
  const last = order[4] === "OVERTIME" ? 2 : order[4] === "FREQUENCY" ? 4 : 1;
  if (last === 1) await adam.locator("fieldset button[aria-pressed]").nth(0).click();
  await adam.getByRole("button", { name: "Ďalej" }).click();
  await adam.locator("textarea").fill("   \n  ");
  await adam.getByRole("button", { name: "Odoslať" }).click();
  await adam.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor();
  const r = await db.response.findFirst({ where: { roundId: r5.id } });
  const vals = [r.v1, r.v2, r.v3, r.v4, r.v5];
  const exp = order.map((s, i) => (i === 0 ? 2 : s === "OVERTIME" ? 2 : s === "FREQUENCY" ? 4 : i === 4 ? 1 : 5));
  return [vals.join() === exp.join() && r.comment === null, `stored=${vals}; expected=${exp}; comment=${JSON.stringify(r.comment)}`];
});
await step({ d: "Wizard can be completed with the keyboard only", pre: "Barbora, desktop, open round with 5 questions", steps: "Tab to 'Začať' + Enter; for each question Tab to an answer + Space, Tab to 'Ďalej' + Enter; type a comment; Tab to 'Odoslať' + Enter", exp: "thank-you screen; one more response stored (accessibility of the core flow)" }, async () => {
  const p = await session(U.alfa[1]);
  await p.goto(`${BASE}/rounds/${r5.id}/fill`);
  const tabTo = async (match) => {
    for (let i = 0; i < 60; i++) {
      await p.keyboard.press("Tab");
      const t = await p.evaluate(() => { const e = document.activeElement; return e ? `${e.tagName}|${(e.getAttribute("aria-label") ?? e.textContent ?? "").trim()}` : ""; });
      if (match(t)) return true;
    }
    return false;
  };
  let ok = await tabTo((t) => t === "BUTTON|Začať"); await p.keyboard.press("Enter");
  for (let i = 0; i < 5 && ok; i++) {
    ok = await p.evaluate(() => !!document.querySelector("fieldset button[aria-pressed]"));
    await p.locator("legend").waitFor();
    // move focus into the fieldset from the top of the document
    await p.evaluate(() => document.activeElement?.blur());
    ok = ok && (await tabTo((t) => t.startsWith("BUTTON|3") || t === "BUTTON|Každý týždeň" || t === "BUTTON|Občas"));
    await p.keyboard.press("Space");
    ok = ok && (await tabTo((t) => t === "BUTTON|Ďalej")); await p.keyboard.press("Enter");
  }
  ok = ok && (await tabTo((t) => t.startsWith("TEXTAREA")));
  await p.keyboard.type("QA komentár napísaný iba klávesnicou.");
  ok = ok && (await tabTo((t) => t === "BUTTON|Odoslať")); await p.keyboard.press("Enter");
  await p.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 8000 }).catch(() => {});
  const done = await p.getByRole("heading", { name: "Ďakujeme za odpoveď" }).count();
  const r = await db.response.findFirst({ where: { roundId: r5.id, comment: "QA komentár napísaný iba klávesnicou." } });
  const s = await shot(p, "j10-08-keyboard-only");
  await p.context().close();
  return [ok && done === 1 && r && [r.v1, r.v2, r.v3, r.v4, r.v5].join() === "3,3,3,3,3", `keyboard path ok=${ok}; thank-you=${done}; stored=${r ? [r.v1, r.v2, r.v3, r.v4, r.v5] : "none"}`, s];
});
await step({ d: "Comment of exactly 1000 characters with diacritics and emoji is stored intact", pre: "Cyril on the comment step", steps: "paste a 1000-character text (JS length) ending with 'ľščťžýáíé 👍'; submit", exp: "201; stored comment identical" }, async () => {
  const c = await api(U.alfa[2]);
  const tail = "ľščťžýáíé 👍"; const text = "a".repeat(1000 - tail.length) + tail;
  const res = await c(`/api/rounds/${r5.id}/responses`, "POST", { answers: [4, 4, 4, 4, 4], comment: text });
  const r = await db.response.findFirst({ where: { roundId: r5.id, comment: { endsWith: "👍" } } });
  const over = await (await api(U.alfa[3]))(`/api/rounds/${r5.id}/responses`, "POST", { answers: [4, 4, 4, 4, 4], comment: "b".repeat(1001) });
  return [res.status === 201 && r?.comment === text && over.status === 400, `HTTP ${res.status}; stored identical=${r?.comment === text}; 1001 characters → HTTP ${over.status} ${over.text}`];
});
await step({ d: "The manager fills in the round of the own team from the home task", pre: "manager Alfa has not answered", steps: "home → 'Vyplniť' → complete the wizard", exp: "thank-you; participation row for the manager; list shows 'Účasť: 4 z 6' (matrix: manager has employee rights in the own team)" }, async () => {
  await mgrA.goto(`${BASE}/`);
  await mgrA.locator("main ol > li", { hasText: "Čaká na teba prieskum" }).getByRole("link", { name: "Vyplniť" }).click();
  await mgrA.getByRole("button", { name: "Začať" }).click();
  for (let i = 0; i < 5; i++) { await mgrA.locator("fieldset button[aria-pressed]").nth(3).click(); await mgrA.getByRole("button", { name: "Ďalej" }).click(); }
  await mgrA.getByRole("button", { name: "Odoslať" }).click();
  await mgrA.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor();
  const m = await db.user.findUniqueOrThrow({ where: { email: U.mgrA } });
  const part = await db.participation.count({ where: { roundId: r5.id, userId: m.id } });
  await mgrA.goto(`${BASE}/rounds`);
  const t = (await mgrA.locator("main li").first().innerText()).replace(/\s+/g, " ");
  return [part === 1 && t.includes("Účasť: 4 z 6"), `manager participation=${part}; list='${t}'`];
});
await step({ d: "Round with 5 questions: results after closing show 5 cards, the reversed-scale note twice, and all five stored columns are used", pre: "2 more members answer (API) → 6 responses; manager closes", steps: "close via API; open results", exp: "5 cards with averages = DB (v1..v5); note 'Pri tejto otázke je nižšia hodnota lepšia.' on exactly 2 cards" }, async () => {
  await (await api(U.alfa[3]))(`/api/rounds/${r5.id}/responses`, "POST", { answers: [5, 1, 1, 5, 5] });
  await (await api(U.alfa[4]))(`/api/rounds/${r5.id}/responses`, "POST", { answers: [3, 2, 5, 2, 4] });
  await mgrAApi(`/api/rounds/${r5.id}/close`, "POST");
  await mgrA.goto(`${BASE}/rounds/${r5.id}/results`);
  const avgs = await mgrA.locator("section:has(h2:text-is('Otázky')) span.text-2xl").allInnerTexts();
  const rs = await db.response.findMany({ where: { roundId: r5.id } });
  const exp = [1, 2, 3, 4, 5].map((k) => sk(round2(rs.reduce((s, r) => s + r[`v${k}`], 0) / rs.length)));
  const notes = await mgrA.getByText("Pri tejto otázke je nižšia hodnota lepšia.").count();
  return [rs.length === 6 && avgs.join() === exp.join() && notes === 2, `responses=${rs.length}; UI=${avgs.join(" | ")}; DB=${exp.join(" | ")}; notes=${notes}`, await shot(mgrA, "j10-09-results-5-questions")];
});
await step({ d: "'V skratke' treats a reversed scale correctly: a low average on 'how often overtime' counts as good", pre: "round with OVERTIME and FREQUENCY questions closed", steps: "recompute best/worst with 6 − average for reversed scales", exp: "sentences name the right questions (IT-13)" }, async () => {
  const rs = await db.response.findMany({ where: { roundId: r5.id } });
  const qs = r5.questions.map((q) => { const avg = round2(rs.reduce((s, r) => s + r[`v${q.position}`], 0) / rs.length); return { text: q.question.text, avg, fav: ["OVERTIME", "FREQUENCY"].includes(q.question.scale) ? 6 - avg : avg, pos: q.position }; });
  const sorted = [...qs].sort((a, b) => b.fav - a.fav || a.pos - b.pos);
  const text = await mainText(mgrA);
  const a = `Najlepšie: „${sorted[0].text}“ (${sk(sorted[0].avg)}).`; const b = `Najslabšie: „${sorted.at(-1).text}“ (${sk(sorted.at(-1).avg)}).`;
  return [text.includes(a) && text.includes(b), `${a} ${b} → present=${text.includes(a)}/${text.includes(b)}`];
});

// ───── 3 questions, other team, HR-created
const lib = (await hrApi("/api/questions")).json.questions.filter((q) => !q.fixed && q.scale === "AGREEMENT");
const c3 = await hrApi("/api/rounds", "POST", { name: "QA kolo 3 otázky", teamId: teamB.id, closesAt: ymd(new Date(Date.now() + 7 * DAY)), questionIds: [lib[0].id, lib[1].id] });
const r3 = c3.json.round.id;
const mgrB = await session(U.mgrB);
await step({ d: "A draft created by HR appears in the team manager's list and the manager can start it", pre: "HR created a draft for Tím Beta via API (fixed + 2 questions)", steps: "manager Beta opens /rounds; clicks Spustiť", exp: "row 'QA kolo 3 otázky', 'Koncept', '3 otázky'; after the click 'Otvorené' (matrix: manager manages rounds of the own team)" }, async () => {
  await mgrB.goto(`${BASE}/rounds`);
  const row = mgrB.locator("main li", { has: mgrB.getByRole("heading", { name: "QA kolo 3 otázky", exact: true }) });
  const before = (await row.innerText()).replace(/\s+/g, " ");
  await row.getByRole("button", { name: "Spustiť" }).click();
  await row.getByText("Otvorené").waitFor();
  return [before.includes("Koncept") && before.includes("3 otázky") && (await db.round.findUnique({ where: { id: r3 } })).status === "OPEN", `before='${before}'; DB after=OPEN`];
});
await step({ d: "Results page of a draft opened by direct URL", pre: "second draft for Beta (API)", steps: "manager Beta opens /rounds/:id/results of a draft", exp: "'Kolo je koncept a ešte nebolo spustené.'; no participation line, no report link" }, async () => {
  const d = await hrApi("/api/rounds", "POST", { name: "QA koncept", teamId: teamB.id, closesAt: ymd(new Date(Date.now() + 7 * DAY)), questionIds: [lib[0].id, lib[1].id] });
  await mgrB.goto(`${BASE}/rounds/${d.json.round.id}/results`);
  const t = await mainText(mgrB);
  return [t.includes("Kolo je koncept a ešte nebolo spustené.") && !t.includes("Odpovedalo") && !t.includes("Report na tlač"), t.slice(-200), await shot(mgrB, "j10-10-draft-results")];
});
const filip = await session(U.beta[0], { width: 360, height: 740 });
await step({ d: "Wizard with 3 questions on a phone", pre: "Filip (Beta), 360 px", steps: "home → Vyplniť → answer 3 questions → submit", exp: "task says 'Má 3 otázky'; progress '1 z 3' … '3 z 3'; response stored with v4 and v5 NULL" }, async () => {
  await filip.goto(`${BASE}/`);
  const task = await filip.locator("main ol > li p").first().innerText();
  await filip.getByRole("link", { name: "Vyplniť" }).click();
  await filip.getByRole("button", { name: "Začať" }).click();
  const prog = [];
  for (let i = 0; i < 3; i++) { prog.push(await adamProgress(filip)); await filip.locator("fieldset button[aria-pressed]").nth(i + 2).click(); await filip.getByRole("button", { name: "Ďalej" }).click(); }
  await filip.getByRole("button", { name: "Odoslať" }).click();
  await filip.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor();
  const r = await db.response.findFirst({ where: { roundId: r3 } });
  return [task.includes("Má 3 otázky") && prog.join() === "1 z 3,2 z 3,3 z 3" && [r.v1, r.v2, r.v3].join() === "3,4,5" && r.v4 === null && r.v5 === null, `task='${task}'; progress=${prog}; stored=${[r.v1, r.v2, r.v3, r.v4, r.v5]}`, await shot(filip, "j10-11-three-questions-360")];
});
async function adamProgress(p) { return (await p.locator("p[aria-live=polite]").first().innerText()).trim(); }
await step({ d: "A round of another team is invisible to an employee and cannot be opened", pre: "open Beta round", steps: "Adam (Alfa): home; direct URL /rounds/:id/fill; GET /api/rounds", exp: "not on the home page; 403 page; API list has no Beta round" }, async () => {
  await adam.goto(`${BASE}/`);
  const home = (await mainText(adam)).includes("QA kolo 3 otázky");
  const res = await adam.goto(`${BASE}/rounds/${r3}/fill`);
  const list = (await (await api(U.alfa[0]))("/api/rounds")).json.rounds;
  return [!home && res.status() === 403 && list.every((x) => x.teamId === teamA.id), `on home=${home}; fill page HTTP ${res.status()}; API rounds of other teams=${list.filter((x) => x.teamId !== teamA.id).length}`];
});
await step({ d: "Round with 3 questions: results, report and team page show 3 questions", pre: "4 more Beta members answer (API) → 5 responses; manager closes", steps: "close; open results, report, team page", exp: "3 averages on each screen, equal to the DB" }, async () => {
  for (const [i, e] of U.beta.slice(1).entries()) await (await api(e))(`/api/rounds/${r3}/responses`, "POST", { answers: [1 + i, 2 + (i % 3), 5 - i] });
  await (await api(U.mgrB))(`/api/rounds/${r3}/close`, "POST");
  const rs = await db.response.findMany({ where: { roundId: r3 } });
  const exp = [1, 2, 3].map((k) => sk(round2(rs.reduce((s, r) => s + r[`v${k}`], 0) / rs.length))).join(" | ");
  await mgrB.goto(`${BASE}/rounds/${r3}/results`);
  const a = (await mgrB.locator("section:has(h2:text-is('Otázky')) span.text-2xl").allInnerTexts()).join(" | ");
  await mgrB.goto(`${BASE}/rounds/${r3}/report`);
  const b = (await mgrB.locator("article table tbody tr td:first-of-type").allInnerTexts()).join(" | ");
  await filip.goto(`${BASE}/team/${teamB.id}`);
  const c = (await filip.locator("main li", { has: filip.getByRole("heading", { name: "QA kolo 3 otázky" }) }).first().locator('span[aria-label="Priemer"]').allInnerTexts()).join(" | ");
  return [rs.length === 5 && a === exp && b === exp && c === exp, `DB=${exp}; results=${a}; report=${b}; team page=${c}`];
});

// ───── print, language, wording
await step({ d: "Report: the print button opens the browser print dialog", pre: "manager Beta on the report", steps: "replace window.print with a counter; click 'Vytlačiť alebo uložiť ako PDF'", exp: "window.print called once" }, async () => {
  await mgrB.goto(`${BASE}/rounds/${r3}/report`);
  await mgrB.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await mgrB.getByRole("button", { name: "Vytlačiť alebo uložiť ako PDF" }).click();
  const n = await mgrB.evaluate(() => window.__printed);
  return [n === 1, `window.print calls=${n}`];
});
await step({ d: "Report can be saved as PDF from the browser", pre: "manager Beta on the report", steps: "render the page to PDF (print media, A4)", exp: "a PDF is produced; header/menu are not printed" }, async () => {
  await mgrB.emulateMedia({ media: "print" });
  const pdf = await mgrB.pdf({ format: "A4", path: `${(await import("./lib.mjs")).EVIDENCE}/j10-report.pdf` });
  const header = await mgrB.locator("header").first().isVisible();
  await mgrB.emulateMedia({ media: "screen" });
  return [pdf.length > 5000 && !header, `PDF bytes=${pdf.length}; app header visible in print=${header}`, "j10-report.pdf"];
});
const PAGES = {
  [U.alfa[0]]: ["/", `/team/${teamA.id}`, "/kudos/new", "/kudos/me", `/rounds/${r5.id}/fill`],
  [U.mgrA]: ["/", "/rounds", "/rounds/new", `/rounds/${r5.id}/results`, `/rounds/${r5.id}/report`, `/team/${teamA.id}`, `/team/${teamA.id}/trend`, "/kudos/new", "/kudos/me"],
  [U.hr]: ["/", "/hr/rounds", "/rounds/new", "/hr/overview", "/hr/heatmap", "/hr/issues", "/hr/notes", `/rounds/${r5.id}/results`, `/rounds/${r3}/report`, `/team/${teamB.id}`, `/team/${teamB.id}/trend`, "/kudos/new", "/kudos/me"],
};
let allHtml = {};
await step({ d: "NFR-04: the forbidden word does not appear on any page of any role", pre: "pages with real content (results, comments, kudos, issues)", steps: "load 27 pages as employee, manager and HR plus /login; search the full HTML for 'anonym' (any case)", exp: "0 occurrences; the word 'dôvern' is used instead" }, async () => {
  let hits = []; let n = 0; let confidential = 0;
  for (const [email, paths] of Object.entries(PAGES)) {
    const a = await api(email);
    for (const p of paths) { const r = await a(p); n++; allHtml[`${email}${p}`] = r.text; if (/anonym/i.test(r.text)) hits.push(p); if (/dôvern/i.test(r.text)) confidential++; }
  }
  const login = await (await fetch(`${BASE}/login`)).text(); n++;
  if (/anonym/i.test(login)) hits.push("/login");
  return [hits.length === 0 && confidential > 0, `pages scanned=${n}; pages containing the forbidden word=${hits.length}; pages using 'dôvern…'=${confidential}`];
});
await step({ d: "NFR-07: pages declare Slovak as the document language", pre: "-", steps: "read <html lang> of /login and of an application page", exp: "lang='sk'" }, async () => {
  const a = await adam.goto(`${BASE}/`).then(() => adam.locator("html").getAttribute("lang"));
  const anon = await session(null); await anon.goto(`${BASE}/login`);
  const b = await anon.locator("html").getAttribute("lang");
  const title = await anon.title();
  await anon.context().close();
  return [a === "sk" && b === "sk", `app lang=${a}; login lang=${b}; <title>='${title}'`];
});
await step({ d: "NFR-07: the not-found page is in Slovak like the rest of the UI", pre: "Adam logged in", steps: "open /taka-stranka-nie-je and the fill URL of a draft", exp: "Slovak text and a way back (as on the 403 page 'Sem nemáš prístup' / 'Späť na úvod')" }, async () => {
  await adam.goto(`${BASE}/taka-stranka-nie-je`);
  const t = (await adam.locator("body").innerText()).replace(/\s+/g, " ");
  const back = await adam.locator("body a").count();
  return [!/This page could not be found/i.test(t) && back > 0, `main text='${t}'; links inside main=${back}`, await shot(adam, "j10-12-404-english-360")];
});

// ───── long unbroken text on a phone
const URL_TEXT = "https://intranet.example.test/wiki/prevadzka/zasadacky/rezervacie/poschodie-3/klimatizacia-a-vetranie-2026";
await step({ d: "Long unbroken text (a 104-character URL) in a comment does not break the results page on a phone", pre: "new Alfa round answered by 5 members, one comment is just the URL; closed", steps: "manager opens results at 360 px and expands the comments", exp: "no horizontal page scroll; the text wraps inside its card (NFR-07)" }, async () => {
  const c = await mgrAApi("/api/rounds", "POST", { name: "QA dlhý text", teamId: teamA.id, closesAt: ymd(new Date(Date.now() + 7 * DAY)), questionIds: [lib[0].id, lib[1].id] });
  const id = c.json.round.id;
  await mgrAApi(`/api/rounds/${id}/open`, "POST");
  for (const [i, e] of U.alfa.entries()) await (await api(e))(`/api/rounds/${id}/responses`, "POST", { answers: [3, 4, 4], comment: i === 0 ? URL_TEXT : null });
  await mgrAApi(`/api/rounds/${id}/close`, "POST");
  await mgrAApi(`/api/rounds/${id}/actions`, "POST", { topic: "QA odkaz", description: URL_TEXT, dueDate: ymd(new Date(Date.now() + 7 * DAY)) });
  const p = await session(U.mgrA, { width: 360, height: 740 });
  await p.goto(`${BASE}/rounds/${id}/results`);
  await p.locator("details > summary", { hasText: "Komentáre" }).click();
  const m = await overflow(p);
  const s = await shot(p, "j10-13-long-comment-360");
  await p.context().close();
  return [m.s <= m.c, `scrollWidth=${m.s}, clientWidth=${m.c}`, s];
});
await step({ d: "Long unbroken text in an action description does not break the team page on a phone", pre: "action whose description is the 104-character URL", steps: "Adam opens 'Môj tím' at 360 px", exp: "no horizontal page scroll" }, async () => {
  await adam.goto(`${BASE}/team/${teamA.id}`);
  const m = await overflow(adam);
  return [m.s <= m.c, `scrollWidth=${m.s}, clientWidth=${m.c}`, await shot(adam, "j10-14-long-action-360")];
});
await step({ d: "Long unbroken text in a kudos does not break the team feed and 'Moje kudos' on a phone", pre: "Barbora sends Adam a public kudos whose text is the URL", steps: "Adam opens 'Moje kudos' and 'Môj tím' at 360 px", exp: "no horizontal page scroll on either page" }, async () => {
  const b = await api(U.alfa[1]); const a = await db.user.findUniqueOrThrow({ where: { email: U.alfa[0] } });
  await b("/api/kudos", "POST", { toUserId: a.id, text: URL_TEXT, value: "HELPING", visibility: "TEAM" });
  await adam.goto(`${BASE}/kudos/me`);
  const m1 = await overflow(adam); const s = await shot(adam, "j10-15-long-kudos-360");
  await adam.goto(`${BASE}/team/${teamA.id}`);
  const m2 = await overflow(adam);
  return [m1.s <= m1.c && m2.s <= m2.c, `Moje kudos: ${m1.s}/${m1.c}; team page: ${m2.s}/${m2.c}`, s];
});
await step({ d: "Long unbroken text in an issue and a note does not break HR pages on a phone", pre: "issue description and note text contain the URL", steps: "HR opens /hr/issues and /hr/notes at 360 px", exp: "no horizontal page scroll" }, async () => {
  await hrApi("/api/hr/issues", "POST", { title: "QA odkaz v podnete", description: URL_TEXT, source: "OTHER", ownerGroup: "HR" });
  await hrApi("/api/hr/notes", "POST", { title: "QA odkaz v poznámke", meetingDate: ymd(new Date()), text: URL_TEXT });
  const p = await session(U.hr, { width: 360, height: 740 });
  await p.goto(`${BASE}/hr/issues`); const m1 = await overflow(p); const s = await shot(p, "j10-16-long-issue-360");
  await p.goto(`${BASE}/hr/notes`); const m2 = await overflow(p);
  await p.context().close();
  return [m1.s <= m1.c && m2.s <= m2.c, `issues: ${m1.s}/${m1.c}; notes: ${m2.s}/${m2.c}`, s];
});
await step({ d: "Main pages of every role have no horizontal scroll at 360 px with ordinary content", pre: "data from this journey", steps: "open 11 pages at 360 px as employee, manager and HR (pages without the injected URL)", exp: "scrollWidth ≤ clientWidth everywhere (NFR-07)" }, async () => {
  const bad = [];
  for (const [email, paths] of [[U.beta[0], ["/", `/team/${teamB.id}`, "/kudos/new"]], [U.mgrB, ["/", "/rounds", "/rounds/new", `/rounds/${r3}/results`, `/team/${teamB.id}/trend`]], [U.hr, ["/", "/hr/rounds", "/hr/overview"]]]) {
    const p = await session(email, { width: 360, height: 740 });
    for (const path of paths) { await p.goto(`${BASE}${path}`); const m = await overflow(p); if (m.s > m.c) bad.push(`${path}: ${m.s}/${m.c}`); }
    await p.context().close();
  }
  return [bad.length === 0, `pages with overflow=${bad.join("; ") || "none"}`];
});

console.log(`\nJ10 done: ${R.rows.length} checks, ${R.rows.filter((r) => r.status === "FAIL").length} failed`);
await closeBrowser();
