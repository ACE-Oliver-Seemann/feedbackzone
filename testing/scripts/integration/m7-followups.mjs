// Session 2026-11-12_002, follow-up scenarios across sections A–G: client-side navigation after
// a change (no full reload), keyboard-only and phone journeys, celebration variants, deadline
// "today", draft pages. Starts from a seed-only database.
import {
  BASE, U, db, resetDb, recorder, stepper, session, shot, mainOnly, api, pathOf, teams, ymd, DAY, fmtDate,
  apiRound, apiRespond, wizard, toast, rowById, transition, closeBrowser, getBrowser, uiLogin, PASSWORD,
} from "./lib.mjs";

const R = recorder("m7-followups");
const step = stepper(R);
resetDb(false);
const { A: teamA, B: teamB } = await teams();
const mgrAApi = await api(U.mgrA); const hrApi = await api(U.hr);
const r1 = await apiRound(mgrAApi, { teamId: teamA.id, name: "Pulse – nadväzujúce QA" });
const nav = (page, name) => page.locator("header nav").first().getByRole("link", { name });

// ───── state after a change, reached by clicks only (no address-bar reload)
const adam = await session(U.alfa[0]);
await step({ j: "A", d: "After submitting, 'Späť na moje prieskumy' shows the round as 'Odoslané' without a manual reload", pre: "Adam submitted the round through the wizard", steps: "click 'Späť na moje prieskumy' on the thank-you screen", exp: "home page: 'Nič nečaká.' and the badge 'Odoslané'; no 'Vyplniť' link (MVP-06)" }, async () => {
  await adam.locator("main#main").getByRole("link", { name: "Vyplniť" }).first().click();
  await adam.waitForURL("**/fill");
  await adam.getByRole("button", { name: "Začať" }).click();
  for (let i = 0; i < 4; i++) { await adam.getByText(`Otázka ${i + 1} z 4`).waitFor({ state: "attached" }); await adam.locator("fieldset button[aria-pressed]").nth(3).click(); await adam.getByRole("button", { name: "Ďalej" }).click(); }
  await adam.getByRole("button", { name: "Odoslať" }).click();
  await adam.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 10000 });
  await adam.getByRole("link", { name: "Späť na moje prieskumy" }).click();
  await adam.waitForURL(`${BASE}/`);
  await adam.getByRole("heading", { name: "Čo treba urobiť teraz" }).waitFor();
  await adam.waitForTimeout(800);
  const text = await mainOnly(adam);
  const fill = await adam.locator("main#main").getByRole("link", { name: "Vyplniť" }).count();
  return [text.includes("Odoslané") && text.includes("Nič nečaká.") && fill === 0, `'Odoslané'=${text.includes("Odoslané")}, 'Nič nečaká.'=${text.includes("Nič nečaká.")}, 'Vyplniť' links=${fill}`, await shot(adam, "m7-01-home-after-submit")];
});
const barbora = await session(U.alfa[1]);
await step({ j: "A", d: "Browser Back from the thank-you screen does not offer the survey again as unfilled", pre: "Barbora came from the home page, filled the round and sees the thank-you screen", steps: "press the browser Back button", exp: "home page shows the round as 'Odoslané' (or, if the old view is restored, clicking 'Vyplniť' says the round is already filled in); never a second response" }, async () => {
  await barbora.locator("main#main").getByRole("link", { name: "Vyplniť" }).first().click();
  await barbora.waitForURL("**/fill");
  await barbora.getByRole("button", { name: "Začať" }).click();
  for (let i = 0; i < 4; i++) { await barbora.getByText(`Otázka ${i + 1} z 4`).waitFor({ state: "attached" }); await barbora.locator("fieldset button[aria-pressed]").nth(2).click(); await barbora.getByRole("button", { name: "Ďalej" }).click(); }
  await barbora.getByRole("button", { name: "Odoslať" }).click();
  await barbora.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 10000 });
  await barbora.goBack(); await barbora.waitForURL(`${BASE}/`); await barbora.waitForTimeout(1200);
  const stale = await barbora.locator("main#main").getByRole("link", { name: "Vyplniť" }).count();
  const evidence = await shot(barbora, "m7-02-back-after-submit");
  let second = "not needed";
  if (stale) {
    await barbora.locator("main#main").getByRole("link", { name: "Vyplniť" }).first().click();
    await barbora.waitForURL("**/fill"); await barbora.waitForTimeout(800);
    second = await barbora.locator("main#main h1").first().innerText();
  }
  const n = await db.response.count({ where: { roundId: r1 } });
  return [stale === 0 && n === 2, `stale 'Vyplniť' links after Back=${stale}; following it shows '${second}'; responses=${n}`, evidence];
});
for (let i = 2; i < 5; i++) await apiRespond(U.alfa[i], r1, [2, 4, 3, 5], i === 2 ? "Komentár k nadväzujúcemu kolu (QA)." : "");
const mgrA = await session(U.mgrA);
await step({ j: "A", d: "After the manager closes a round and writes the first step, the list reached through the menu shows the new state", pre: "round with 5 responses open; manager on /rounds", steps: "Uzavrieť → confirm → 'Výsledky' → add a step → click 'Prieskumy' in the menu", exp: "row 'Uzavreté' without 'Čaká na krok' – all by clicks, no manual reload (MVP-15)" }, async () => {
  await nav(mgrA, "Prieskumy").click(); await mgrA.waitForURL("**/rounds");
  await transition(mgrA, rowById(mgrA, r1), "Uzavrieť", true);
  await toast(mgrA, "Kolo je uzavreté.").waitFor({ timeout: 8000 });
  await rowById(mgrA, r1).getByText("Čaká na krok").waitFor({ timeout: 8000 });
  await rowById(mgrA, r1).getByRole("link", { name: "Výsledky" }).click();
  await mgrA.waitForURL("**/results");
  await mgrA.fill('input[name="topic"]', "Prvý krok po kole QA"); await mgrA.fill('textarea[name="description"]', "Opis prvého kroku."); await mgrA.fill('input[name="dueDate"]', ymd(new Date(Date.now() + 7 * DAY)));
  await mgrA.getByRole("button", { name: "Pridať krok" }).click();
  await toast(mgrA, "Krok je pridaný.").waitFor({ timeout: 8000 });
  await nav(mgrA, "Prieskumy").click(); await mgrA.waitForURL("**/rounds"); await mgrA.waitForTimeout(800);
  const text = (await rowById(mgrA, r1).innerText()).replace(/\s+/g, " ");
  return [text.includes("Uzavreté") && !text.includes("Čaká na krok"), text, await shot(mgrA, "m7-03-rounds-after-step")];
});
await step({ j: "A", d: "Manager's home, reached through the menu after writing the step, no longer asks for it", pre: "previous step", steps: "click 'Domov'", exp: "no task 'Kolo „Pulse – nadväzujúce QA“ je uzavreté…' (IT-11)" }, async () => {
  await nav(mgrA, "Domov").click(); await mgrA.waitForURL(`${BASE}/`); await mgrA.waitForTimeout(800);
  const text = await mainOnly(mgrA);
  return [!text.includes("Kolo „Pulse – nadväzujúce QA“ je uzavreté"), text.slice(0, 260)];
});
await step({ j: "A", d: "Browser Back to the results page after the step was added still shows the step", pre: "manager went results → Prieskumy → Domov", steps: "Back twice", exp: "results page lists 'Prvý krok po kole QA' (not the state from before it was added)" }, async () => {
  await mgrA.goBack(); await mgrA.goBack(); await mgrA.waitForURL("**/results"); await mgrA.waitForTimeout(1200);
  const has = (await mainOnly(mgrA)).includes("Prvý krok po kole QA");
  return [has, `step listed after Back=${has}`];
});
await step({ j: "A", d: "Employee's team page, reached through the menu, shows the new step and the round on top", pre: "Adam's browser is still on the home page from before the round was closed", steps: "click 'Môj tím'", exp: "'Pulse – nadväzujúce QA' with 'Prvý krok po kole QA' and 'Plánované' (MVP-14)" }, async () => {
  await nav(adam, "Môj tím").click(); await adam.waitForURL("**/team/**"); await adam.waitForTimeout(800);
  const first = (await adam.locator("main#main ol > li").first().innerText()).replace(/\s+/g, " ");
  return [first.startsWith("Pulse – nadväzujúce QA") && first.includes("Prvý krok po kole QA") && first.includes("Plánované"), first.slice(0, 300)];
});
await step({ j: "A", d: "A closed round disappears from the employee's 'Moje prieskumy' list of open rounds", pre: "round closed; Adam had answered it", steps: "click 'Domov'", exp: "no row for the closed round among open surveys, or it is clearly not offered for filling (MVP-06: open rounds)" }, async () => {
  await nav(adam, "Domov").click(); await adam.waitForURL(`${BASE}/`); await adam.waitForTimeout(800);
  const text = await mainOnly(adam);
  const fill = await adam.locator("main#main").getByRole("link", { name: "Vyplniť" }).count();
  return [fill === 0 && !text.includes("Čaká na vyplnenie"), `text='${text.slice(0, 200)}'; fill links=${fill}`];
});

// ───── deadline today, draft pages
const hr = await session(U.hr);
await step({ j: "A", d: "A round with today's date as the deadline can be created, started and filled in today", pre: "HR on /rounds/new", steps: "set 'Dátum uzávierky' to today; Uložiť koncept; Spustiť; a member opens the fill page", exp: "the form accepts today ('dnes alebo neskôr'); the round starts and stays open for the rest of today; the member can answer (MVP-04, MVP-05)" }, async () => {
  await hr.goto(`${BASE}/rounds/new`, { waitUntil: "networkidle" });
  await hr.fill('input[name="name"]', "Pulse – uzávierka dnes QA");
  await hr.fill('input[name="closesAt"]', ymd(new Date()));
  await hr.getByRole("button", { name: "Uložiť koncept" }).click();
  await hr.waitForURL((u) => u.pathname !== "/rounds/new", { timeout: 10000 }).catch(() => {});
  const r = await db.round.findFirst({ where: { name: "Pulse – uzávierka dnes QA" } });
  if (!r) return [false, `the form refused today's date: '${(await mainOnly(hr)).match(/Zadaj dátum[^.]*\./)?.[0] ?? "no message"}'`, await shot(hr, "m7-04-deadline-today")];
  await transition(hr, rowById(hr, r.id), "Spustiť", true);
  await hr.waitForTimeout(1500);
  const rowText = (await rowById(hr, r.id).innerText()).replace(/\s+/g, " ");
  const s = (await db.round.findUnique({ where: { id: r.id } })).status;
  const resp = await apiRespond(U.alfa[3], r.id, [3, 3, 3, 3]);
  const s2 = (await db.round.findUnique({ where: { id: r.id } })).status;
  return [s === "OPEN" && resp.status === 201 && s2 === "OPEN", `closesAt stored=${r.closesAt.toISOString()}; after start db=${s}; row='${rowText.slice(0, 120)}'; member's answer → HTTP ${resp.status}; still ${s2}`, await shot(hr, "m7-04-deadline-today")];
});
await step({ j: "A", d: "A deadline in the past is refused by the form", pre: "HR on /rounds/new", steps: "set the deadline to yesterday (typed, bypassing the picker's minimum); Uložiť koncept", exp: "'Zadaj dátum uzávierky, ktorý je dnes alebo neskôr.'; nothing stored (MVP-04)" }, async () => {
  const before = await db.round.count();
  await hr.goto(`${BASE}/rounds/new`, { waitUntil: "networkidle" });
  await hr.fill('input[name="closesAt"]', ymd(new Date(Date.now() - DAY)));
  await hr.getByRole("button", { name: "Uložiť koncept" }).click();
  await hr.waitForTimeout(1000);
  const msg = await hr.getByText("Zadaj dátum uzávierky, ktorý je dnes alebo neskôr.").isVisible().catch(() => false);
  return [msg && (await db.round.count()) === before && pathOf(hr) === "/rounds/new", `message=${msg}; rounds ${before}→${await db.round.count()}`];
});
await step({ j: "G", d: "HR choosing the other team in the new-round form gets that team's defaults and saves for it", pre: "HR on /rounds/new (default Tím Alfa)", steps: "select 'Tím Beta'; read ticked questions; Uložiť koncept", exp: "3 ticked questions in expanded topics; the saved draft belongs to Tím Beta with 4 questions (IT-13, BUG-017)" }, async () => {
  await hr.goto(`${BASE}/rounds/new`, { waitUntil: "networkidle" });
  await hr.selectOption('select[name="teamId"]', teamB.id);
  await hr.waitForTimeout(600);
  const ticked = await hr.locator('input[type="checkbox"]:checked').count();
  const hidden = await hr.locator("details:not([open]):has(input:checked)").count();
  await hr.fill('input[name="name"]', "Pulse – HR pre Betu QA");
  await hr.getByRole("button", { name: "Uložiť koncept" }).click();
  await hr.waitForURL((u) => u.pathname !== "/rounds/new", { timeout: 10000 });
  const r = await db.round.findFirst({ where: { name: "Pulse – HR pre Betu QA" }, include: { questions: true } });
  return [ticked === 3 && hidden === 0 && r?.teamId === teamB.id && r.questions.length === 4, `ticked=${ticked}, ticked in collapsed topics=${hidden}, saved for Beta=${r?.teamId === teamB.id}, questions=${r?.questions.length}`];
});
await step({ j: "G", d: "Results and report of a draft say it is a draft and show no participation of a closed round", pre: "the Beta draft from the previous step", steps: "HR opens its results and its report", exp: "'Kolo je koncept a ešte nebolo spustené.'; no 'Odpovedalo 0 z 6', no step form (BUG-021)" }, async () => {
  const r = await db.round.findFirst({ where: { name: "Pulse – HR pre Betu QA" } });
  await hr.goto(`${BASE}/rounds/${r.id}/results`, { waitUntil: "networkidle" }); const a = await mainOnly(hr);
  await hr.goto(`${BASE}/rounds/${r.id}/report`, { waitUntil: "networkidle" }); const b = await mainOnly(hr);
  return [a.includes("Kolo je koncept a ešte nebolo spustené.") && b.includes("Kolo je koncept a ešte nebolo spustené.") && !/Odpovedalo 0 z 6/.test(a + b), `results draft text=${a.includes("Kolo je koncept")}, report draft text=${b.includes("Kolo je koncept")}, 'Odpovedalo 0 z 6' present=${/Odpovedalo 0 z 6/.test(a + b)}`, await shot(hr, "m7-05-draft-report")];
});

// ───── confirm dialog, keyboard, phone
await step({ j: "E", d: "Escape closes the confirm dialog without starting the round", pre: "HR on /hr/rounds with a draft", steps: "Spustiť → press Escape", exp: "dialog closed; DB DRAFT; no toast; focus back on the page" }, async () => {
  const r = await db.round.findFirst({ where: { name: "Pulse – HR pre Betu QA" } });
  await hr.goto(`${BASE}/hr/rounds`, { waitUntil: "networkidle" });
  await rowById(hr, r.id).getByRole("button", { name: "Spustiť" }).click();
  await hr.locator("dialog[open]").waitFor();
  const title = await hr.locator("dialog[open]").innerText();
  await hr.keyboard.press("Escape");
  await hr.waitForTimeout(500);
  const open = await hr.locator("dialog[open]").count();
  const s = (await db.round.findUnique({ where: { id: r.id } })).status;
  return [open === 0 && s === "DRAFT" && title.includes("Spustiť kolo?") && title.includes("Po spustení sa už nedá upravovať."), `dialog text='${title.replace(/\s+/g, " ")}'; open after Escape=${open}; db=${s}`];
});
await step({ j: "A", d: "Whole employee journey with the keyboard only: login, open the survey, answer, submit", pre: "open round for Tím Beta; Filip logged out", steps: "type e-mail, Tab, password, Enter; Tab to 'Vyplniť', Enter; Enter on 'Začať'; per question: focus a value, Space, Tab to 'Ďalej', Enter; Tab to 'Odoslať', Enter", exp: "thank-you screen; 1 response 1/2/3/4-pattern stored; no mouse used (MVP-08, IT-02 'neblokujú ovládanie')" }, async () => {
  const id = await apiRound(await api(U.mgrB), { teamId: teamB.id, name: "Pulse – klávesnica QA" });
  const p = await session(null);
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.locator('input[name="email"]').focus();
  await p.keyboard.type(U.beta[0]); await p.keyboard.press("Tab"); await p.keyboard.type(PASSWORD); await p.keyboard.press("Enter");
  await p.waitForURL(`${BASE}/`, { timeout: 10000 });
  await p.locator("main#main ul[role=list]").getByRole("link", { name: "Vyplniť" }).first().focus();
  await p.keyboard.press("Enter");
  await p.waitForURL("**/fill");
  await p.getByRole("button", { name: "Začať" }).focus(); await p.keyboard.press("Enter");
  const vals = [1, 2, 3, 4];
  for (let i = 0; i < 4; i++) {
    await p.getByText(`Otázka ${i + 1} z 4`).waitFor({ state: "attached" });
    await p.locator("fieldset button[aria-pressed]").nth(vals[i] - 1).focus();
    await p.keyboard.press("Space");
    await p.getByRole("button", { name: "Ďalej" }).focus();
    await p.keyboard.press("Enter");
  }
  await p.locator("textarea").focus(); await p.keyboard.type("Klávesnicou (QA Filip).");
  await p.keyboard.press("Tab"); await p.keyboard.press("Tab");
  const focused = await p.evaluate(() => document.activeElement?.textContent?.trim());
  await p.getByRole("button", { name: "Odoslať" }).focus(); await p.keyboard.press("Enter");
  await p.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 10000 });
  const r = await db.response.findFirst({ where: { roundId: id } });
  await p.context().close();
  return [[r.v1, r.v2, r.v3, r.v4].join() === "1,2,3,4" && r.comment === "Klávesnicou (QA Filip).", `stored=${r.v1},${r.v2},${r.v3},${r.v4}; comment ok=${r.comment === "Klávesnicou (QA Filip)."}; element focused after two Tabs from the comment='${focused}'`];
});
await step({ j: "A", d: "Manager's journey on a 360 px phone: menu → new round → save → start → own survey", pre: "manager Beta at 360×740", steps: "tap 'Prieskumy' → 'Vytvoriť kolo' → 'Uložiť koncept' → 'Spustiť' → confirm → 'Domov' → 'Vyplniť' → wizard", exp: "every step reachable by tapping, no horizontal scrolling, round started and answered (NFR-07, IT-01 'funguje od šírky 360 px')" }, async () => {
  const p = await session(U.mgrB, { width: 360, height: 740 });
  const widths = [];
  const w = async () => widths.push(await p.evaluate(() => document.documentElement.scrollWidth));
  const mobileNav = p.locator('header nav[aria-label="Hlavná navigácia"]').filter({ visible: true }).first();
  await mobileNav.getByRole("link", { name: "Prieskumy" }).click(); await p.waitForURL("**/rounds"); await w();
  await p.locator("main#main").getByRole("link", { name: "Vytvoriť kolo" }).click(); await p.waitForURL("**/rounds/new"); await p.waitForLoadState("networkidle"); await w();
  await p.fill('input[name="name"]', "Pulse – z mobilu QA");
  await p.getByRole("button", { name: "Uložiť koncept" }).click(); await p.waitForURL("**/rounds"); await w();
  const r = await db.round.findFirst({ where: { name: "Pulse – z mobilu QA" } });
  await transition(p, rowById(p, r.id), "Spustiť", true);
  await toast(p, "Kolo je spustené. Tím ho už vidí.").waitFor({ timeout: 8000 }); await w();
  const evidence = await shot(p, "m7-06-mobile-rounds");
  await p.locator('header nav[aria-label="Hlavná navigácia"]').filter({ visible: true }).first().getByRole("link", { name: "Domov" }).click(); await p.waitForURL(`${BASE}/`); await w();
  await p.locator("main#main").getByRole("link", { name: "Vyplniť" }).filter({ visible: true }).last().click(); await p.waitForURL("**/fill");
  const which = pathOf(p).split("/")[2];
  await p.getByRole("button", { name: "Začať" }).click();
  const total = (await db.roundQuestion.count({ where: { roundId: which } }));
  for (let i = 0; i < total; i++) { await p.getByText(`Otázka ${i + 1} z ${total}`).waitFor({ state: "attached" }); await w(); await p.locator("fieldset button[aria-pressed]").nth(4).click(); await p.getByRole("button", { name: "Ďalej" }).click(); }
  await p.getByRole("button", { name: "Odoslať" }).click();
  await p.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 10000 }); await w();
  const s = (await db.round.findUnique({ where: { id: r.id } })).status;
  const n = await db.response.count({ where: { roundId: which } });
  await p.context().close();
  return [s === "OPEN" && n >= 1 && widths.every((x) => x <= 360), `round ${s}; responses in the filled round=${n}; scrollWidth per step=${widths.join(",")}`, evidence];
});

// ───── celebration variants
await step({ j: "A", d: "With the system setting 'reduce motion' the submit still completes and no confetti is drawn", pre: "Emil's browser emulates prefers-reduced-motion: reduce; round open", steps: "fill and submit the round", exp: "thank-you screen; no confetti canvas (IT-02)" }, async () => {
  const id = await apiRound(mgrAApi, { teamId: teamA.id, name: "Pulse – bez pohybu QA" });
  const p = await session(U.alfa[4], { width: 1280, height: 800 }, { reducedMotion: "reduce" });
  await wizard(p, id, [3, 3, 3, 3], "", { submit: false });
  await p.getByRole("button", { name: "Odoslať" }).click();
  await p.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 10000 });
  const canvas = await p.locator("canvas[data-confetti]").count();
  const mode = await p.evaluate(() => document.documentElement.getAttribute("data-motion"));
  await p.context().close();
  return [canvas === 0, `confetti canvas=${canvas}; html data-motion='${mode}'`];
});
await step({ j: "A", d: "The confetti canvas never intercepts clicks and removes itself", pre: "Dana submits a round with animations on", steps: "right after the thank-you appears read the canvas style; wait 4 s", exp: "pointer-events none while present; gone within 4 s (IT-02: at most 1.5 s, must not block)" }, async () => {
  const id = (await db.round.findFirst({ where: { name: "Pulse – bez pohybu QA" } })).id;
  const p = await session(U.alfa[3]);
  await wizard(p, id, [4, 4, 4, 4], "", { submit: false });
  await p.getByRole("button", { name: "Odoslať" }).click();
  await p.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 10000 });
  const style = await p.locator("canvas[data-confetti]").first().evaluate((c) => getComputedStyle(c).pointerEvents).catch(() => "no canvas");
  const t0 = Date.now(); let gone = -1;
  while (Date.now() - t0 < 4000) { if ((await p.locator("canvas[data-confetti]").count()) === 0) { gone = Date.now() - t0; break; } await p.waitForTimeout(100); }
  await p.context().close();
  return [(style === "none" || style === "no canvas") && gone >= 0, `pointer-events='${style}'; removed after ≈${gone} ms`];
});
await step({ j: "B", d: "New kudos arriving while the recipient opens the 'Poslať kudos' tab directly: the notice is not lost", pre: "Cyril visited /kudos with 1 kudos; a second one arrives; he opens /kudos?tab=send", steps: "open /kudos?tab=send; then click the 'Moje kudos' tab", exp: "the notice 'Máš 1 nové kudos' is visible when he switches to 'Moje kudos'; confetti does not fire over the send form while the notice is hidden" }, async () => {
  const cyrilUser = await db.user.findUnique({ where: { email: U.alfa[2] } });
  const sender = await api(U.alfa[0]);
  await sender("/api/kudos", "POST", { toUserId: cyrilUser.id, text: "Prvé kudos pre Cyrila, ďakujem (QA).", value: "QUALITY", visibility: "TEAM" });
  const p = await session(U.alfa[2]);
  await p.goto(`${BASE}/kudos`, { waitUntil: "networkidle" });
  await sender("/api/kudos", "POST", { toUserId: cyrilUser.id, text: "Druhé kudos pre Cyrila, ďakujem (QA).", value: "QUALITY", visibility: "TEAM" });
  await p.goto(`${BASE}/kudos?tab=send`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(700);
  const confettiOnSend = await p.locator("canvas[data-confetti]").count();
  const noticeHidden = !(await p.getByText("Máš 1 nové kudos").isVisible().catch(() => false));
  const evidence = await shot(p, "m7-07-confetti-on-send-tab");
  await p.getByRole("tab", { name: /Moje kudos/ }).click();
  const notice = await p.getByText("Máš 1 nové kudos").isVisible().catch(() => false);
  await p.context().close();
  return [notice && confettiOnSend === 0, `on the send tab: notice hidden=${noticeHidden}, confetti canvas=${confettiOnSend}; after switching to 'Moje kudos': notice=${notice}`, evidence];
});
await step({ j: "B", d: "Unknown ?tab value falls back to the received tab", pre: "Adam logged in", steps: "open /kudos?tab=xyz", exp: "'Moje kudos' selected, no error" }, async () => {
  const resp = await adam.goto(`${BASE}/kudos?tab=xyz`, { waitUntil: "networkidle" });
  const sel = (await adam.getByRole("tab", { selected: true }).innerText()).replace(/\s+/g, " ");
  return [resp.status() === 200 && sel.startsWith("Moje kudos"), `HTTP ${resp.status()}; selected='${sel}'`];
});

// ───── toasts
await step({ j: "G", d: "A toast disappears by itself and can be dismissed; it never covers the dialog buttons", pre: "manager adds a step", steps: "add a second step; read the toast; click 'Zavrieť oznámenie'", exp: "toast visible after the server answer with a dismiss button; gone after the click" }, async () => {
  await mgrA.goto(`${BASE}/rounds/${r1}/results`, { waitUntil: "networkidle" });
  await mgrA.fill('input[name="topic"]', "Druhý krok QA"); await mgrA.fill('textarea[name="description"]', "Opis druhého kroku."); await mgrA.fill('input[name="dueDate"]', ymd(new Date(Date.now() + 8 * DAY)));
  await mgrA.getByRole("button", { name: "Pridať krok" }).click();
  await toast(mgrA, "Krok je pridaný.").waitFor({ timeout: 8000 });
  const btn = mgrA.getByRole("button", { name: "Zavrieť oznámenie" });
  const has = await btn.count();
  if (has) await btn.first().click();
  await mgrA.waitForTimeout(700);
  const after = await toast(mgrA, "Krok je pridaný.").count();
  return [has >= 1 && after === 0 && (await db.action.count({ where: { roundId: r1 } })) === 2, `dismiss buttons=${has}; toast after dismiss=${after}; steps in DB=${await db.action.count({ where: { roundId: r1 } })}`];
});
await step({ j: "G", d: "Toast does not stay forever", pre: "manager changes a step status", steps: "set status 'Hotové'; wait up to 10 s", exp: "toast shown, then removed without user action" }, async () => {
  await mgrA.locator('#kroky select[aria-label="Stav"]').first().selectOption("DONE");
  await toast(mgrA, "Stav kroku je uložený.").waitFor({ timeout: 8000 });
  const t0 = Date.now(); let gone = -1;
  while (Date.now() - t0 < 10000) { if ((await toast(mgrA, "Stav kroku je uložený.").count()) === 0) { gone = Date.now() - t0; break; } await mgrA.waitForTimeout(200); }
  return [gone >= 0, `toast removed after ≈${gone} ms`];
});
// ───── regression of BUG-020 with rounds whose deadline order differs from their closing order
await step({ j: "G", d: "Thank-you screen shows the steps of the round that was closed last, not of the one with the latest deadline", pre: "Tím Beta: round X (deadline in 10 days) closed by hand and given a step; then round Y (deadline shifted into the past, so it closes automatically later than X… time simulation) with its own step; open round Z", steps: "a member fills round Z", exp: "section 'Čo sa urobilo po kole „Y“' with Y's step; X's step is not shown there (MVP-09, MVP-14, BUG-020)" }, async () => {
  const mb = await api(U.mgrB);
  const x = await apiRound(mb, { teamId: teamB.id, name: "Kolo X QA", days: 10 });
  await mb(`/api/rounds/${x}/close`, "POST");
  await db.round.update({ where: { id: x }, data: { closedAt: new Date(Date.now() - 2 * DAY) } }); // closed by hand two days ago
  const y = await apiRound(mb, { teamId: teamB.id, name: "Kolo Y QA", days: 3 });
  await db.round.update({ where: { id: y }, data: { closesAt: new Date(Date.now() - 3600e3) } }); // deadline passed an hour ago
  await mb("/api/rounds"); // first load after the deadline closes Y
  const ax = await mb(`/api/rounds/${x}/actions`, "POST", { topic: "Krok kola X", description: "Patrí ku kolu X.", dueDate: ymd(new Date(Date.now() + 5 * DAY)), status: "PLANNED" });
  const ay = await mb(`/api/rounds/${y}/actions`, "POST", { topic: "Krok kola Y", description: "Patrí ku kolu Y.", dueDate: ymd(new Date(Date.now() + 5 * DAY)), status: "PLANNED" });
  const z = await apiRound(mb, { teamId: teamB.id, name: "Kolo Z QA", days: 5 });
  const p = await session(U.beta[2]);
  await wizard(p, z, [3, 3, 3, 3], "");
  const text = await mainOnly(p);
  const evidence = await shot(p, "m7-08-thanks-last-closed");
  await p.goto(`${BASE}/team/${teamB.id}`, { waitUntil: "networkidle" });
  const order = (await p.locator("main#main ol > li > h2").allInnerTexts()).slice(0, 2).join(" > ");
  await p.context().close();
  const ys = (await db.round.findUnique({ where: { id: y } })).status;
  return [ax.status === 201 && ay.status === 201 && ys === "CLOSED" && text.includes("Čo sa urobilo po kole „Kolo Y QA“") && text.includes("Krok kola Y") && !text.includes("Krok kola X") && order === "Kolo Y QA > Kolo X QA", `Y status=${ys}; thank-you names Y=${text.includes("Čo sa urobilo po kole „Kolo Y QA“")}, shows Y's step=${text.includes("Krok kola Y")}, shows X's step=${text.includes("Krok kola X")}; team page order='${order}'`, evidence];
});
await step({ j: "E", d: "Server log of the whole session holds no answer values, comments or kudos texts", pre: "server log written by the QA server during all suites of this session", steps: "search the log for texts used by the suites and for JSON keys of request bodies", exp: "nothing found; error lines have the form '[api] METHOD /path failed: ErrorClass' (NFR-01)" }, async () => {
  const fs = await import("node:fs");
  const file = "testing/reports/2026-11-12_002/evidence/server-e2e.log";
  if (!fs.existsSync(file)) return "BLOCKED: server log not found at the expected path";
  const log = fs.readFileSync(file, "utf8");
  const needles = ["(QA", "QA)", "komentár", "Komentár", "\"answers\"", "\"comment\"", "\"text\"", "Heslo123", "passwordHash", "fz_session="];
  const hits = needles.filter((n) => log.includes(n));
  const apiLines = log.split(/\r?\n/).filter((l) => l.includes("[api]"));
  const odd = apiLines.filter((l) => !/^\[api\] [A-Z]+ \/api\/[^\s]* failed: \w+$/.test(l.trim()));
  return [hits.length === 0 && odd.length === 0, `log bytes=${log.length}; needles found=${hits.join(", ") || "none"}; '[api]' lines=${apiLines.length}, not in the expected form=${odd.length}${odd.length ? ` (first: '${odd[0].slice(0, 120)}')` : ""}`];
});
await step({ j: "E", d: "Backend or database unavailable while a server-rendered page loads", pre: "would need the QA server or its database to be stopped", steps: "stop the server / lock the database; open a page", exp: "an understandable error page" }, async () =>
  "BLOCKED: the shared QA server and its database must not be stopped or locked in this session; failures of API calls were simulated in the browser instead (m4)");
const errs = [adam, barbora, mgrA, hr].flatMap((p) => p.errors);
await step({ j: "G", d: "No uncaught JavaScript error in the follow-up scenarios", pre: "sessions above", steps: "collect 'pageerror' events", exp: "none" }, async () => [errs.length === 0, `page errors=${errs.length} ${errs.slice(0, 3).join(" | ")}`]);
await closeBrowser();
