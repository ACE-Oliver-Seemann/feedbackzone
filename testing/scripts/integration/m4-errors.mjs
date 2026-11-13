// Session 2026-11-12_002, section E: error handling through the redesigned UI. Failed, slow, aborted
// and invalid server answers are simulated with Playwright route interception in the browser;
// the server and the database stay real. Starts from a seed-only database.
import {
  BASE, U, db, resetDb, recorder, stepper, session, shot, mainOnly, api, pathOf, teams, ymd, DAY,
  apiRound, apiRespond, wizard, toast, toastRegion, rowById, closeBrowser, PASSWORD,
} from "./lib.mjs";
import fs from "node:fs";

const R = recorder("m4-errors");
const step = stepper(R, { j: "E" });
resetDb(false);
const { A: teamA } = await teams();
const mgrAApi = await api(U.mgrA);
const hrApi = await api(U.hr);
const roundOpen = await apiRound(mgrAApi, { teamId: teamA.id, name: "Pulse – chyby QA" });
const roundClosed = await apiRound(mgrAApi, { teamId: teamA.id, name: "Pulse – uzavreté QA" });
for (let i = 0; i < 5; i++) await apiRespond(U.alfa[i], roundClosed, [3, 2, 4, 5]);
await mgrAApi(`/api/rounds/${roundClosed}/close`, "POST");
const GENERIC = "Niečo sa nepodarilo. Skús to znova.";
const fail500 = (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"internal_error"}' });
const slow = (ms) => async (route) => { await new Promise((r) => setTimeout(r, ms)); await route.continue(); };
const respCount = (id) => db.response.count({ where: { roundId: id } });
const ISSUES0 = await db.issue.count(); const NOTES0 = await db.meetingNote.count(); // the seed already contains some

// ───── wizard
const adam = await session(U.alfa[0]);
const RESP = `**/api/rounds/${roundOpen}/responses`;
await step({ d: "Submit answered with 500: understandable message, wizard stays on the last step with the answers", pre: "Adam on the comment step; POST responses → 500 (intercepted)", steps: "Odoslať", exp: `'${GENERIC}'; comment kept; no thank-you; no celebration; 0 responses` }, async () => {
  await wizard(adam, roundOpen, [4, 3, 5, 2], "Komentár pri chybe 500 (QA Adam).", { submit: false });
  await adam.route(RESP, fail500);
  await adam.getByRole("button", { name: "Odoslať" }).click();
  await adam.getByText(GENERIC).waitFor({ timeout: 8000 });
  const kept = await adam.locator("textarea").inputValue();
  const thanks = await adam.getByRole("heading", { name: "Ďakujeme za odpoveď" }).count();
  const confetti = await adam.locator("canvas[data-confetti]").count();
  await adam.unroute(RESP);
  return [kept.includes("QA Adam") && thanks === 0 && confetti === 0 && (await respCount(roundOpen)) === 0, `comment kept=${kept.includes("QA Adam")}, thank-you=${thanks}, confetti=${confetti}, responses=${await respCount(roundOpen)}`, await shot(adam, "m4-01-submit-500")];
});
await step({ d: "Back from the failed last step still shows the chosen answers", pre: "error shown on the comment step", steps: "Späť; read the pressed button", exp: "question 4 of 4 with value 2 pressed; error message gone" }, async () => {
  await adam.getByRole("button", { name: "Späť" }).click();
  await adam.getByText("Otázka 4 z 4").waitFor({ state: "attached" });
  const pressed = await adam.locator('fieldset button[aria-pressed="true"]').getAttribute("aria-label");
  await adam.getByRole("button", { name: "Ďalej" }).click();
  await adam.locator("textarea").waitFor();
  return [pressed.startsWith("2"), `pressed='${pressed}', comment after returning='${(await adam.locator("textarea").inputValue()).slice(0, 30)}'`];
});
await step({ d: "Submit with the connection cut: message, nothing lost", pre: "same form; request aborted (intercepted)", steps: "Odoslať", exp: `'${GENERIC}'; comment kept; 0 responses` }, async () => {
  await adam.route(RESP, (r) => r.abort("connectionfailed"));
  await adam.getByRole("button", { name: "Odoslať" }).click();
  await adam.getByText(GENERIC).waitFor({ timeout: 8000 });
  await adam.unroute(RESP);
  const kept = await adam.locator("textarea").inputValue();
  return [kept.includes("QA Adam") && (await respCount(roundOpen)) === 0, `comment kept=${kept.includes("QA Adam")}, responses=${await respCount(roundOpen)}`];
});
await step({ d: "Submit while the browser is offline, then again online", pre: "same form; browser offline", steps: "Odoslať (offline) → go online → Odoslať", exp: "message while offline; then thank-you; exactly 1 response with 4,3,5,2 and the comment" }, async () => {
  await adam.context().setOffline(true);
  await adam.getByRole("button", { name: "Odoslať" }).click();
  await adam.getByText(GENERIC).waitFor({ timeout: 8000 });
  await adam.context().setOffline(false);
  await adam.getByRole("button", { name: "Odoslať" }).click();
  await adam.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 10000 });
  const rows = await db.response.findMany({ where: { roundId: roundOpen } });
  return [rows.length === 1 && [rows[0].v1, rows[0].v2, rows[0].v3, rows[0].v4].join() === "4,3,5,2" && rows[0].comment.includes("QA Adam"), `responses=${rows.length}; values=${rows[0]?.v1},${rows[0]?.v2},${rows[0]?.v3},${rows[0]?.v4}`, await shot(adam, "m4-02-after-retry")];
});
const barbora = await session(U.alfa[1]);
await step({ d: "Slow submit: button shows progress, is disabled, and a double click sends one request", pre: "Barbora on the comment step; POST responses delayed 2.5 s", steps: "double-click Odoslať; observe; wait", exp: "'Odosielam…' disabled, 'Späť' disabled; no thank-you before the answer; 1 request; then thank-you; 2 responses in total" }, async () => {
  await wizard(barbora, roundOpen, [2, 2, 3, 3], "", { submit: false });
  let requests = 0;
  await barbora.route(RESP, async (route) => { requests++; await new Promise((r) => setTimeout(r, 2500)); await route.continue(); });
  await barbora.getByRole("button", { name: "Odoslať" }).dblclick();
  await barbora.waitForTimeout(700);
  const busy = barbora.getByRole("button", { name: /Odosielam/ });
  const disabled = (await busy.count()) === 1 && await busy.isDisabled();
  const backDisabled = await barbora.getByRole("button", { name: "Späť" }).isDisabled();
  const early = await barbora.getByRole("heading", { name: "Ďakujeme za odpoveď" }).count();
  const evidence = await shot(barbora, "m4-03-slow-submit");
  await barbora.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 10000 });
  await barbora.unroute(RESP);
  return [disabled && backDisabled && early === 0 && requests === 1 && (await respCount(roundOpen)) === 2, `pending button disabled=${disabled}, back disabled=${backDisabled}, thank-you before answer=${early}, requests=${requests}, responses=${await respCount(roundOpen)}`, evidence];
});
const cyril = await session(U.alfa[2]);
await step({ d: "Lost reply: the server stored the answer but the reply never arrived; a retry must not store it twice", pre: "Cyril on the comment step; the request reaches the server, the reply is dropped", steps: "Odoslať → error → Odoslať again", exp: "after the retry the user learns the round is already filled in; exactly 1 response and 1 participation for Cyril (MVP-09)" }, async () => {
  await wizard(cyril, roundOpen, [5, 5, 5, 5], "", { submit: false });
  await cyril.route(RESP, async (route) => { await route.fetch(); await route.abort("connectionreset"); });
  await cyril.getByRole("button", { name: "Odoslať" }).click();
  await cyril.getByText(GENERIC).waitFor({ timeout: 8000 });
  await cyril.unroute(RESP);
  await cyril.getByRole("button", { name: "Odoslať" }).click();
  await cyril.getByRole("heading", { name: "Toto kolo už máš vyplnené" }).waitFor({ timeout: 8000 });
  const u = await db.user.findUnique({ where: { email: U.alfa[2] } });
  const p = await db.participation.count({ where: { roundId: roundOpen, userId: u.id } });
  return [p === 1 && (await respCount(roundOpen)) === 3, `participations of Cyril=${p}, responses=${await respCount(roundOpen)}`, await shot(cyril, "m4-04-lost-reply")];
});
const dana = await session(U.alfa[3]);
await step({ d: "Invalid server answer (HTML with status 200 instead of JSON 201) does not break the wizard", pre: "Dana on the comment step; POST answered 200 text/html", steps: "Odoslać", exp: `'${GENERIC}', no thank-you, no script error; then a real submit works` }, async () => {
  await wizard(dana, roundOpen, [1, 2, 3, 4], "", { submit: false });
  await dana.route(RESP, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<html><body>proxy error</body></html>" }));
  await dana.getByRole("button", { name: "Odoslať" }).click();
  await dana.getByText(GENERIC).waitFor({ timeout: 8000 });
  const thanks = await dana.getByRole("heading", { name: "Ďakujeme za odpoveď" }).count();
  await dana.unroute(RESP);
  await dana.getByRole("button", { name: "Odoslať" }).click();
  await dana.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 10000 });
  return [thanks === 0 && dana.errors.length === 0 && (await respCount(roundOpen)) === 4, `thank-you on invalid answer=${thanks}, page errors=${dana.errors.length}, responses=${await respCount(roundOpen)}`];
});
const emil = await session(U.alfa[4]);
await step({ d: "Refresh in the middle of the wizard: starts again from the intro, nothing stored, no error", pre: "Emil on question 3 of 4", steps: "reload the page", exp: "intro screen (answers are not saved on the server by design, NFR-01 / idea FILL-06); 0 new responses; wizard usable" }, async () => {
  await emil.goto(`${BASE}/rounds/${roundOpen}/fill`, { waitUntil: "networkidle" });
  await emil.getByRole("button", { name: "Začať" }).click();
  for (let i = 0; i < 2; i++) { await emil.getByText(`Otázka ${i + 1} z 4`).waitFor({ state: "attached" }); await emil.locator("fieldset button[aria-pressed]").nth(2).click(); await emil.getByRole("button", { name: "Ďalej" }).click(); }
  await emil.getByText("Otázka 3 z 4").waitFor({ state: "attached" });
  await emil.reload({ waitUntil: "networkidle" });
  const intro = await emil.getByRole("button", { name: "Začať" }).count();
  const stored = await emil.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  return [intro === 1 && (await respCount(roundOpen)) === 4 && !/"answers"|v1/.test(stored), `intro after reload=${intro}, responses=${await respCount(roundOpen)}, browser storage keys=${Object.keys(JSON.parse(stored)).join(",") || "none"}`];
});
await step({ d: "Browser Back and Forward in the middle of the wizard", pre: "Emil came from the home page and is on question 2", steps: "home → Vyplniť → Začať → answer 1 → Ďalej → browser Back → browser Forward", exp: "Back leaves to the home page; Forward returns to the intro; no response stored; no script error" }, async () => {
  await emil.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await emil.locator("main#main").getByRole("link", { name: "Vyplniť" }).first().click();
  await emil.waitForURL("**/fill");
  await emil.getByRole("button", { name: "Začať" }).click();
  await emil.locator("fieldset button[aria-pressed]").nth(0).click();
  await emil.getByRole("button", { name: "Ďalej" }).click();
  await emil.goBack(); await emil.waitForURL(`${BASE}/`, { timeout: 8000 }); await emil.waitForLoadState("networkidle");
  const back = pathOf(emil);
  await emil.goForward(); await emil.waitForURL("**/fill", { timeout: 8000 }); await emil.waitForLoadState("networkidle");
  const fwd = pathOf(emil);
  const intro = await emil.getByRole("button", { name: "Začať" }).count();
  const q = await emil.locator("main#main fieldset").count();
  return [back === "/" && fwd.endsWith("/fill") && (intro === 1 || q === 1) && emil.errors.length === 0 && (await respCount(roundOpen)) === 4, `Back → ${back}; Forward → ${fwd.replace(/c[a-z0-9]{20,}/, ":id")} with intro=${intro}, question=${q}; page errors=${emil.errors.length}`];
});
await step({ d: "Rapid clicks on 'Začať' and 'Ďalej' do not skip a question", pre: "Emil on the intro", steps: "double-click Začať; choose a value; double-click Ďalej", exp: "after the first double click question 1; after the second question 2 (not 3)" }, async () => {
  if (!(await emil.getByRole("button", { name: "Začať" }).count())) await emil.reload({ waitUntil: "networkidle" });
  await emil.getByRole("button", { name: "Začať" }).dblclick();
  await emil.waitForTimeout(500);
  const p1 = await emil.locator("main#main").getByText(/^Otázka \d z 4$/).innerText();
  await emil.locator("fieldset button[aria-pressed]").nth(3).click();
  await emil.getByRole("button", { name: "Ďalej" }).dblclick();
  await emil.waitForTimeout(700);
  const p2 = await emil.locator("main#main").getByText(/^Otázka \d z 4$/).innerText();
  return [p1 === "Otázka 1 z 4" && p2 === "Otázka 2 z 4", `after double 'Začať': '${p1}'; after double 'Ďalej': '${p2}'`];
});
await step({ d: "Round closed by the manager while a member is in the wizard", pre: "Emil on the comment step; manager closes the round (API)", steps: "Odoslať", exp: "'Kolo je uzavreté' + 'Do uzavretého kola sa už nedá odpovedať.'; no celebration; response not stored (MVP-09)" }, async () => {
  await wizard(emil, roundOpen, [3, 3, 3, 3], "Neskorý komentár (QA Emil).", { submit: false });
  await mgrAApi(`/api/rounds/${roundOpen}/close`, "POST");
  await emil.getByRole("button", { name: "Odoslať" }).click();
  await emil.getByRole("heading", { name: "Kolo je uzavreté" }).waitFor({ timeout: 8000 });
  const confetti = await emil.locator("canvas[data-confetti]").count();
  return [confetti === 0 && (await respCount(roundOpen)) === 4, `confetti=${confetti}, responses=${await respCount(roundOpen)}`, await shot(emil, "m4-05-closed-mid-fill")];
});

// ───── kudos
const KUDOS = "**/api/kudos";
const uB = await db.user.findUnique({ where: { email: U.alfa[1] } });
const fillKudos = async (page, text) => {
  await page.goto(`${BASE}/kudos?tab=send`, { waitUntil: "networkidle" });
  await page.selectOption('select[name="toUserId"]', uB.id);
  await page.locator("form textarea").fill(text);
};
await step({ d: "Kudos answered with 500: message, no confirmation, no confetti, form content stays", pre: "Adam's kudos form filled; POST /api/kudos → 500", steps: "Poslať kudos", exp: `'${GENERIC}'; no 'Kudos je odoslané.'; text and recipient kept; 0 kudos` }, async () => {
  await fillKudos(adam, "Kudos pri chybe servera, ďakujem (QA).");
  await adam.route(KUDOS, fail500);
  await adam.locator('form button[type="submit"]').click();
  await adam.getByText(GENERIC).waitFor({ timeout: 8000 });
  const sent = await adam.getByText("Kudos je odoslané.").count();
  const confetti = await adam.locator("canvas[data-confetti]").count();
  const kept = await adam.locator("form textarea").inputValue(); const to = await adam.inputValue('select[name="toUserId"]');
  await adam.unroute(KUDOS);
  return [sent === 0 && confetti === 0 && kept.includes("QA") && to === uB.id && (await db.kudos.count()) === 0, `confirmation=${sent}, confetti=${confetti}, text kept=${kept.includes("QA")}, recipient kept=${to === uB.id}, kudos=${await db.kudos.count()}`, await shot(adam, "m4-06-kudos-500")];
});
await step({ d: "Kudos confirmation and confetti appear only after the server confirmed (slow answer), double click sends once", pre: "same form; POST delayed 2.5 s", steps: "double-click Poslať kudos; look after 0.8 s; wait", exp: "at 0.8 s: button 'Posielam…' disabled, no confirmation, no confetti; afterwards confirmation; 1 request, 1 kudos" }, async () => {
  let requests = 0;
  await adam.route(KUDOS, async (route) => { requests++; await new Promise((r) => setTimeout(r, 2500)); await route.continue(); });
  await adam.locator('form button[type="submit"]').dblclick();
  await adam.waitForTimeout(800);
  const early = await adam.getByText("Kudos je odoslané.").count();
  const earlyConfetti = await adam.locator("canvas[data-confetti]").count();
  const btn = adam.locator('form button[type="submit"]');
  const state = `${(await btn.innerText()).trim()}/${await btn.isDisabled()}`;
  await adam.getByText("Kudos je odoslané.").waitFor({ timeout: 8000 });
  await adam.unroute(KUDOS);
  return [early === 0 && earlyConfetti === 0 && state === "Posielam…/true" && requests === 1 && (await db.kudos.count()) === 1, `confirmation before answer=${early}, confetti before answer=${earlyConfetti}, button='${state}', requests=${requests}, kudos=${await db.kudos.count()}`];
});
await step({ d: "Kudos with the connection cut, then a retry", pre: "form filled; request aborted", steps: "Poslať kudos → error → Poslať kudos", exp: "message; then confirmation; exactly one more kudos" }, async () => {
  await fillKudos(adam, "Kudos po výpadku spojenia, ďakujem (QA).");
  await adam.route(KUDOS, (r) => r.abort("connectionfailed"));
  await adam.locator('form button[type="submit"]').click();
  await adam.getByText(GENERIC).waitFor({ timeout: 8000 });
  await adam.unroute(KUDOS);
  await adam.locator('form button[type="submit"]').click();
  await adam.getByText("Kudos je odoslané.").waitFor({ timeout: 8000 });
  const errGone = await adam.getByText(GENERIC).count();
  return [(await db.kudos.count()) === 2 && errGone === 0, `kudos=${await db.kudos.count()}, error still shown after success=${errGone}`];
});

// ───── manager: steps
const mgrA = await session(U.mgrA);
const ACTIONS = `**/api/rounds/${roundClosed}/actions`;
const fillAction = async (topic) => {
  await mgrA.goto(`${BASE}/rounds/${roundClosed}/results`, { waitUntil: "networkidle" });
  await mgrA.fill('input[name="topic"]', topic);
  await mgrA.fill('textarea[name="description"]', "Opis kroku na test chýb.");
  await mgrA.fill('input[name="dueDate"]', ymd(new Date(Date.now() + 10 * DAY)));
};
await step({ d: "Step answered with 500: message, no toast, form content stays, nothing stored", pre: "manager on results of a closed round, form filled; POST actions → 500", steps: "Pridať krok", exp: `'${GENERIC}'; no toast 'Krok je pridaný.'; topic kept; 0 actions` }, async () => {
  await fillAction("Téma pri chybe QA");
  await mgrA.route(ACTIONS, fail500);
  await mgrA.getByRole("button", { name: "Pridať krok" }).click();
  await mgrA.getByText(GENERIC).waitFor({ timeout: 8000 });
  const t = await toast(mgrA, "Krok je pridaný.").count();
  const kept = await mgrA.inputValue('input[name="topic"]');
  await mgrA.unroute(ACTIONS);
  return [t === 0 && kept === "Téma pri chybe QA" && (await db.action.count()) === 0, `toast=${t}, topic kept='${kept}', actions=${await db.action.count()}`, await shot(mgrA, "m4-07-action-500")];
});
await step({ d: "Step toast appears only after the server confirmed; double click stores one step", pre: "same form; POST delayed 2.5 s", steps: "double-click Pridať krok; look after 0.8 s; wait", exp: "no toast and no new list item at 0.8 s; then toast; 1 request; 1 action" }, async () => {
  let requests = 0;
  await mgrA.route(ACTIONS, async (route) => { requests++; await new Promise((r) => setTimeout(r, 2500)); await route.continue(); });
  await mgrA.getByRole("button", { name: "Pridať krok" }).dblclick();
  await mgrA.waitForTimeout(800);
  const early = await toast(mgrA, "Krok je pridaný.").count();
  const earlyItems = await mgrA.locator('#kroky select[aria-label="Stav"]').count();
  await toast(mgrA, "Krok je pridaný.").waitFor({ timeout: 8000 });
  await mgrA.unroute(ACTIONS);
  return [early === 0 && earlyItems === 0 && requests === 1 && (await db.action.count()) === 1, `toast before answer=${early}, list items before answer=${earlyItems}, requests=${requests}, actions=${await db.action.count()}`];
});
const action = await db.action.findFirst();
const PATCH = `**/api/actions/${action.id}`;
await step({ d: "Status change answered with 500: message, select returns to the stored value, no toast", pre: "step PLANNED; PATCH → 500", steps: "choose 'Hotové'", exp: `'${GENERIC}'; select shows 'Plánované' again; no toast; DB PLANNED` }, async () => {
  await mgrA.reload({ waitUntil: "networkidle" });
  await mgrA.route(PATCH, fail500);
  await mgrA.locator('#kroky select[aria-label="Stav"]').first().selectOption("DONE");
  await mgrA.locator("#kroky").getByText(GENERIC).waitFor({ timeout: 8000 });
  const v = await mgrA.locator('#kroky select[aria-label="Stav"]').first().inputValue();
  const t = await toast(mgrA, "Stav kroku je uložený.").count();
  await mgrA.unroute(PATCH);
  const s = (await db.action.findUnique({ where: { id: action.id } })).status;
  return [v === "PLANNED" && t === 0 && s === "PLANNED", `select=${v}, toast=${t}, db=${s}`, await shot(mgrA, "m4-08-status-500")];
});
await step({ d: "Status change: toast only after the server confirmed; select is busy meanwhile", pre: "step PLANNED; PATCH delayed 2 s", steps: "choose 'Prebieha'; look after 0.6 s; wait", exp: "select disabled with aria-busy at 0.6 s, no toast yet; then toast 'Stav kroku je uložený.'; DB IN_PROGRESS" }, async () => {
  await mgrA.route(PATCH, slow(2000));
  const sel = mgrA.locator('#kroky select[aria-label="Stav"]').first();
  await sel.selectOption("IN_PROGRESS");
  await mgrA.waitForTimeout(600);
  const busy = `${await sel.getAttribute("aria-busy")}/${await sel.isDisabled()}`;
  const early = await toast(mgrA, "Stav kroku je uložený.").count();
  await toast(mgrA, "Stav kroku je uložený.").waitFor({ timeout: 8000 });
  await mgrA.unroute(PATCH);
  const s = (await db.action.findUnique({ where: { id: action.id } })).status;
  return [busy === "true/true" && early === 0 && s === "IN_PROGRESS", `aria-busy/disabled=${busy}, toast before answer=${early}, db=${s}`];
});

// ───── manager: round transitions and the new-round form
const draft = await apiRound(mgrAApi, { teamId: teamA.id, name: "Pulse – koncept chyby QA", open: false });
const OPEN = `**/api/rounds/${draft}/open`;
const clickOpen = async () => { await rowById(mgrA, draft).getByRole("button", { name: "Spustiť" }).click(); await mgrA.locator("dialog[open]").getByRole("button", { name: "Spustiť" }).click(); };
await step({ d: "Starting a round answered with 500: message in the row, no toast, round stays a draft", pre: "draft on /rounds; POST open → 500", steps: "Spustiť → confirm", exp: `'${GENERIC}'; no toast; row 'Koncept'; DB DRAFT; dialog closed` }, async () => {
  await mgrA.goto(`${BASE}/rounds`, { waitUntil: "networkidle" });
  await mgrA.route(OPEN, fail500);
  await clickOpen();
  await rowById(mgrA, draft).getByText(GENERIC).waitFor({ timeout: 8000 });
  const t = await toast(mgrA, "Kolo je spustené").count();
  const dialog = await mgrA.locator("dialog[open]").count();
  const text = await rowById(mgrA, draft).innerText();
  await mgrA.unroute(OPEN);
  const s = (await db.round.findUnique({ where: { id: draft } })).status;
  return [t === 0 && dialog === 0 && text.includes("Koncept") && s === "DRAFT", `toast=${t}, dialog open=${dialog}, row has Koncept=${text.includes("Koncept")}, db=${s}`, await shot(mgrA, "m4-09-open-500")];
});
await step({ d: "Starting a round: toast only after the server confirmed; double confirm sends one request", pre: "draft; POST open delayed 2 s", steps: "Spustiť → double-click confirm; look after 0.6 s; wait", exp: "no toast at 0.6 s and the row still 'Koncept'; then toast and 'Otvorené'; 1 request; no error message" }, async () => {
  let requests = 0;
  await mgrA.route(OPEN, async (route) => { requests++; await new Promise((r) => setTimeout(r, 2000)); await route.continue(); });
  await rowById(mgrA, draft).getByRole("button", { name: "Spustiť" }).click();
  await mgrA.locator("dialog[open]").getByRole("button", { name: "Spustiť" }).dblclick().catch(() => {});
  await mgrA.waitForTimeout(600);
  const early = await toast(mgrA, "Kolo je spustené").count();
  const earlyRow = (await rowById(mgrA, draft).innerText()).includes("Koncept");
  await toast(mgrA, "Kolo je spustené. Tím ho už vidí.").waitFor({ timeout: 8000 });
  await rowById(mgrA, draft).getByText("Otvorené").waitFor({ timeout: 8000 });
  await mgrA.unroute(OPEN);
  const err = await rowById(mgrA, draft).getByText(/nepodarilo|zmenilo stav/).count();
  return [early === 0 && earlyRow && requests === 1 && err === 0, `toast before answer=${early}, row still Koncept before answer=${earlyRow}, requests=${requests}, error text=${err}`];
});
await step({ d: "Closing a round with the connection cut: message, round stays open; retry works", pre: "round open; POST close aborted", steps: "Uzavrieť → confirm → error → Uzavrieť → confirm", exp: `'${GENERIC}', DB OPEN; after retry toast 'Kolo je uzavreté.' and DB CLOSED` }, async () => {
  const CLOSE = `**/api/rounds/${draft}/close`;
  await mgrA.route(CLOSE, (r) => r.abort("connectionfailed"));
  await rowById(mgrA, draft).getByRole("button", { name: "Uzavrieť" }).click();
  await mgrA.locator("dialog[open]").getByRole("button", { name: "Uzavrieť" }).click();
  await rowById(mgrA, draft).getByText(GENERIC).waitFor({ timeout: 8000 });
  const s1 = (await db.round.findUnique({ where: { id: draft } })).status;
  await mgrA.unroute(CLOSE);
  await rowById(mgrA, draft).getByRole("button", { name: "Uzavrieť" }).click();
  await mgrA.locator("dialog[open]").getByRole("button", { name: "Uzavrieť" }).click();
  await toast(mgrA, "Kolo je uzavreté.").waitFor({ timeout: 8000 });
  const s2 = (await db.round.findUnique({ where: { id: draft } })).status;
  return [s1 === "OPEN" && s2 === "CLOSED", `after failure db=${s1}; after retry db=${s2}`];
});
await step({ d: "Stale list: starting a round that someone else already started gives a clear message", pre: "manager has /rounds open with a draft; HR starts it meanwhile (API)", steps: "Spustiť → confirm in the stale tab", exp: "'Kolo medzitým zmenilo stav. Obnov stránku.'; no toast; DB OPEN once" }, async () => {
  const id = await apiRound(mgrAApi, { teamId: teamA.id, name: "Pulse – súbeh spustenia QA", open: false });
  await mgrA.goto(`${BASE}/rounds`, { waitUntil: "networkidle" });
  await hrApi(`/api/rounds/${id}/open`, "POST");
  await rowById(mgrA, id).getByRole("button", { name: "Spustiť" }).click();
  await mgrA.locator("dialog[open]").getByRole("button", { name: "Spustiť" }).click();
  await rowById(mgrA, id).getByText("Kolo medzitým zmenilo stav. Obnov stránku.").waitFor({ timeout: 8000 });
  const t = await toast(mgrA, "Kolo je spustené").count();
  await mgrAApi(`/api/rounds/${id}/close`, "POST");
  return [t === 0, `message shown; toast=${t}`, await shot(mgrA, "m4-10-stale-open")];
});
await step({ d: "Draft whose deadline has passed cannot be started and says why", pre: "draft with closesAt shifted to yesterday in the QA database (time simulation)", steps: "Spustiť → confirm", exp: "'Uzávierka kola už prešla, kolo sa nedá spustiť.'; DB DRAFT (known limitation BUG-010: such a draft cannot be edited or removed)" }, async () => {
  const id = await apiRound(mgrAApi, { teamId: teamA.id, name: "Pulse – starý koncept QA", open: false });
  await db.round.update({ where: { id }, data: { closesAt: new Date(Date.now() - DAY) } });
  await mgrA.goto(`${BASE}/rounds`, { waitUntil: "networkidle" });
  await rowById(mgrA, id).getByRole("button", { name: "Spustiť" }).click();
  await mgrA.locator("dialog[open]").getByRole("button", { name: "Spustiť" }).click();
  await rowById(mgrA, id).getByText("Uzávierka kola už prešla, kolo sa nedá spustiť.").waitFor({ timeout: 8000 });
  const s = (await db.round.findUnique({ where: { id } })).status;
  return [s === "DRAFT", `db=${s}`, await shot(mgrA, "m4-11-deadline-passed")];
});
const ROUNDS = "**/api/rounds";
await step({ d: "New round answered with 500: stays on the form with the entered values, nothing stored", pre: "manager on /rounds/new with a custom name; POST /api/rounds → 500", steps: "Uložiť koncept", exp: `'${GENERIC}'; path /rounds/new; name kept; 3 questions still ticked; no toast; no new round` }, async () => {
  const before = await db.round.count();
  await mgrA.goto(`${BASE}/rounds/new`, { waitUntil: "networkidle" });
  await mgrA.fill('input[name="name"]', "Pulse – chyba pri uložení QA");
  await mgrA.route(ROUNDS, (r) => (r.request().method() === "POST" ? fail500(r) : r.continue()));
  await mgrA.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgrA.getByText(GENERIC).waitFor({ timeout: 8000 });
  const name = await mgrA.inputValue('input[name="name"]'); const ticked = await mgrA.locator('input[type="checkbox"]:checked').count();
  const t = await toast(mgrA, "Koncept kola je uložený.").count();
  await mgrA.unroute(ROUNDS);
  return [pathOf(mgrA) === "/rounds/new" && name === "Pulse – chyba pri uložení QA" && ticked === 3 && t === 0 && (await db.round.count()) === before, `path=${pathOf(mgrA)}, name kept=${name === "Pulse – chyba pri uložení QA"}, ticked=${ticked}, toast=${t}, rounds ${before}→${await db.round.count()}`, await shot(mgrA, "m4-12-new-round-500")];
});
await step({ d: "New round saved with a slow answer and a double click creates one draft", pre: "same form; POST delayed 2 s", steps: "double-click Uložiť koncept", exp: "button 'Ukladám…' disabled; 1 request; 1 new draft; redirect with toast" }, async () => {
  const before = await db.round.count();
  let requests = 0;
  await mgrA.route(ROUNDS, async (r) => { if (r.request().method() !== "POST") return r.continue(); requests++; await new Promise((x) => setTimeout(x, 2000)); await r.continue(); });
  await mgrA.getByRole("button", { name: "Uložiť koncept" }).dblclick();
  await mgrA.waitForTimeout(500);
  const pending = await mgrA.getByRole("button", { name: /Ukladám/ }).isDisabled().catch(() => false);
  await mgrA.waitForURL("**/rounds", { timeout: 10000 });
  await mgrA.unroute(ROUNDS);
  const t = await toast(mgrA, "Koncept kola je uložený.").isVisible().catch(() => false);
  return [pending && requests === 1 && (await db.round.count()) === before + 1 && t, `pending button disabled=${pending}, requests=${requests}, rounds ${before}→${await db.round.count()}, toast=${t}`];
});
await step({ d: "Known BUG-037: lost reply on saving a round + retry creates a second identical draft", pre: "manager on /rounds/new; the request is stored but the reply dropped", steps: "Uložiť koncept → error → Uložiť koncept", exp: "KNOWN open defect BUG-037: two drafts with the same name; neither can be removed in the UI" }, async () => {
  const NAME = "Pulse – stratená odpoveď QA";
  await mgrA.goto(`${BASE}/rounds/new`, { waitUntil: "networkidle" });
  await mgrA.fill('input[name="name"]', NAME);
  await mgrA.route(ROUNDS, async (r) => { if (r.request().method() !== "POST") return r.continue(); await r.fetch(); await r.abort("connectionreset"); });
  await mgrA.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgrA.getByText(GENERIC).waitFor({ timeout: 8000 });
  await mgrA.unroute(ROUNDS);
  await mgrA.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgrA.waitForURL("**/rounds", { timeout: 10000 });
  const n = await db.round.count({ where: { name: NAME } });
  const del = await rowById(mgrA, (await db.round.findFirst({ where: { name: NAME } })).id).getByRole("button", { name: /Zmazať|Odstrániť/ }).count();
  return [n === 2 && del === 0, `drafts named '${NAME}'=${n} (known BUG-037); delete control=${del}`, await shot(mgrA, "m4-13-duplicate-draft")];
});
await step({ d: "Own question answered with 500: message, nothing ticked, nothing stored", pre: "manager on /rounds/new; POST /api/questions → 500", steps: "type an own question; Pridať otázku", exp: "'Otázku sa nepodarilo pridať. Skús to znova.'; no toast; counter unchanged; text kept; no team question in DB" }, async () => {
  await mgrA.goto(`${BASE}/rounds/new`, { waitUntil: "networkidle" });
  await mgrA.route("**/api/questions", (r) => (r.request().method() === "POST" ? fail500(r) : r.continue()));
  await mgrA.getByLabel("Pridať vlastnú otázku").fill("Naše porady majú jasný cieľ a záver (QA).");
  await mgrA.getByRole("button", { name: "Pridať otázku" }).click();
  await mgrA.getByText("Otázku sa nepodarilo pridať. Skús to znova.").waitFor({ timeout: 8000 });
  const t = await toast(mgrA, "Otázka je pridaná").count();
  const counter = await mgrA.getByText(/Otázok v kole:/).innerText();
  const kept = await mgrA.getByLabel("Pridať vlastnú otázku").inputValue();
  await mgrA.unroute("**/api/questions");
  const n = await db.question.count({ where: { teamId: { not: null } } });
  return [t === 0 && counter.startsWith("Otázok v kole: 4") && kept !== "" && n === 0, `toast=${t}, counter='${counter}', text kept=${kept !== ""}, team questions=${n}`];
});

// ───── HR: issues and notes
const hr = await session(U.hr);
const openIssueForm = async () => {
  await hr.goto(`${BASE}/hr/issues`, { waitUntil: "networkidle" });
  const s = hr.locator("main#main summary", { hasText: "Pridať podnet" });
  if (!(await hr.locator('form#new input[name="title"]').isVisible())) await s.click();
};
await step({ d: "Issue answered with 500: message, no toast, form content stays, nothing stored", pre: "HR issue form filled; POST /api/hr/issues → 500", steps: "Pridať podnet", exp: `'${GENERIC}'; title kept; no new issue` }, async () => {
  await openIssueForm();
  await hr.fill('form#new input[name="title"]', "Podnet pri chybe servera QA");
  await hr.route("**/api/hr/issues", (r) => (r.request().method() === "POST" ? fail500(r) : r.continue()));
  await hr.locator("form#new").getByRole("button", { name: "Pridať podnet" }).click();
  await hr.locator("form#new").getByText(GENERIC).waitFor({ timeout: 8000 });
  const t = await toast(hr, "Podnet je pridaný.").count();
  const kept = await hr.inputValue('form#new input[name="title"]');
  await hr.unroute("**/api/hr/issues");
  return [t === 0 && kept === "Podnet pri chybe servera QA" && (await db.issue.count()) === ISSUES0, `toast=${t}, title kept=${kept !== ""}, issues ${ISSUES0}→${await db.issue.count()}`, await shot(hr, "m4-14-issue-500")];
});
await step({ d: "Issue toast only after the server confirmed; double click stores one issue", pre: "same form; POST delayed 2 s", steps: "double-click Pridať podnet; look after 0.6 s; wait", exp: "no toast at 0.6 s; then toast 'Podnet je pridaný.' and the issue in the list; exactly 1 new issue" }, async () => {
  let requests = 0;
  await hr.route("**/api/hr/issues", async (r) => { if (r.request().method() !== "POST") return r.continue(); requests++; await new Promise((x) => setTimeout(x, 2000)); await r.continue(); });
  await hr.locator("form#new").getByRole("button", { name: "Pridať podnet" }).dblclick();
  await hr.waitForTimeout(600);
  const early = await toast(hr, "Podnet je pridaný.").count();
  await toast(hr, "Podnet je pridaný.").waitFor({ timeout: 8000 });
  await hr.unroute("**/api/hr/issues");
  await hr.getByRole("heading", { name: "Podnet pri chybe servera QA" }).waitFor({ timeout: 8000 });
  return [early === 0 && requests === 1 && (await db.issue.count()) === ISSUES0 + 1, `toast before answer=${early}, requests=${requests}, issues ${ISSUES0}→${await db.issue.count()}`];
});
await step({ d: "Issue status change answered with 500: message, select returns, nothing changed", pre: "1 open issue; PATCH → 500", steps: "choose 'Hotové' in the row", exp: `'${GENERIC}'; select back on 'Otvorené'; no toast; DB OPEN` }, async () => {
  const issue = await db.issue.findFirst({ where: { title: "Podnet pri chybe servera QA" } });
  await hr.route(`**/api/hr/issues/${issue.id}`, fail500);
  const sel = hr.locator("main#main li", { has: hr.getByRole("heading", { name: issue.title }) }).locator('select[aria-label="Stav"]');
  await sel.selectOption("DONE");
  await hr.locator("main#main li", { has: hr.getByRole("heading", { name: issue.title }) }).getByText(GENERIC).waitFor({ timeout: 8000 });
  const v = await sel.inputValue(); const t = await toast(hr, "Podnet je uložený.").count();
  await hr.unroute(`**/api/hr/issues/${issue.id}`);
  const s = (await db.issue.findUnique({ where: { id: issue.id } })).status;
  return [v === "OPEN" && t === 0 && s === "OPEN", `select=${v}, toast=${t}, db=${s}`];
});
await step({ d: "Note with the connection cut: message, text stays; retry stores one note", pre: "HR note form filled; request aborted", steps: "Uložiť poznámku → error → Uložiť poznámku", exp: `'${GENERIC}', text kept; then toast 'Poznámka je uložená.'; 1 note` }, async () => {
  await hr.goto(`${BASE}/hr/notes`, { waitUntil: "networkidle" });
  await hr.fill('input[name="title"]', "Stretnutie pri výpadku QA"); await hr.fill('input[name="meetingDate"]', ymd(new Date())); await hr.fill('textarea[name="text"]', "Text poznámky pri výpadku spojenia.");
  await hr.route("**/api/hr/notes", (r) => (r.request().method() === "POST" ? r.abort("connectionfailed") : r.continue()));
  await hr.getByRole("button", { name: "Uložiť poznámku" }).click();
  await hr.getByText(GENERIC).waitFor({ timeout: 8000 });
  const kept = await hr.inputValue('textarea[name="text"]');
  await hr.unroute("**/api/hr/notes");
  await hr.getByRole("button", { name: "Uložiť poznámku" }).click();
  await toast(hr, "Poznámka je uložená.").waitFor({ timeout: 8000 });
  return [kept !== "" && (await db.meetingNote.count()) === NOTES0 + 1, `text kept=${kept !== ""}, notes ${NOTES0}→${await db.meetingNote.count()}`];
});

// ───── login
await step({ d: "Login answered with 500 or with the connection cut shows a general error, not 'wrong password'", pre: "logged out; POST /api/login → 500, then aborted", steps: "submit valid credentials twice", exp: `'${GENERIC}' both times; stays on /login; then a normal login works` }, async () => {
  const p = await session(null);
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', U.alfa[0]); await p.fill('input[name="password"]', PASSWORD);
  await p.route("**/api/login", fail500);
  await p.click('button[type="submit"]');
  await p.getByText(GENERIC).waitFor({ timeout: 8000 });
  await p.unroute("**/api/login");
  await p.route("**/api/login", (r) => r.abort("connectionfailed"));
  await p.click('button[type="submit"]');
  await p.waitForTimeout(800);
  const msg2 = await p.getByText(GENERIC).isVisible();
  const wrong = await p.getByText("Nesprávny e-mail alebo heslo.").count();
  await p.unroute("**/api/login");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 10000 });
  const ok = msg2 && wrong === 0 && pathOf(p) === "/";
  await p.context().close();
  return [ok, `general error on abort=${msg2}, 'wrong password' shown=${wrong}, final path='/'=${ok}`];
});
await step({ d: "Slow login with a double click logs in once", pre: "logged out; POST /api/login delayed 2 s", steps: "double-click 'Prihlásiť sa'", exp: "button 'Prihlasujem…' disabled; 1 request; lands on '/'" }, async () => {
  const p = await session(null);
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', U.alfa[1]); await p.fill('input[name="password"]', PASSWORD);
  let requests = 0;
  await p.route("**/api/login", async (r) => { requests++; await new Promise((x) => setTimeout(x, 2000)); await r.continue(); });
  await p.locator('button[type="submit"]').dblclick();
  await p.waitForTimeout(500);
  const pending = await p.getByRole("button", { name: /Prihlasujem/ }).isDisabled().catch(() => false);
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 10000 });
  const path = pathOf(p); await p.context().close();
  return [pending && requests === 1 && path === "/", `pending disabled=${pending}, requests=${requests}, path=${path}`];
});

// ───── state after all the failures
await step({ d: "No duplicates and no half-written records after all failed and repeated requests", pre: "all steps above", steps: "count rows", exp: "responses = participations per round; 1 action; 2 kudos; 1 new issue; 1 new note; no duplicate names except the known BUG-037 pair" }, async () => {
  const rounds = await db.round.findMany({ include: { _count: { select: { responses: true, participations: true } } } });
  const bad = rounds.filter((r) => r._count.responses !== r._count.participations).length;
  const names = rounds.map((r) => r.name); const dup = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
  const c = { actions: await db.action.count(), kudos: await db.kudos.count(), issues: await db.issue.count(), notes: await db.meetingNote.count() };
  return [bad === 0 && c.actions === 1 && c.kudos === 2 && c.issues === ISSUES0 + 1 && c.notes === NOTES0 + 1 && dup.join() === "Pulse – stratená odpoveď QA", `rounds with responses≠participations=${bad}; ${JSON.stringify(c)}; duplicate round names=${dup.join(", ")}`];
});
await step({ d: "Server log contains no request bodies (comments, kudos texts, answers) after the error scenarios", pre: "server log of this QA server", steps: "search the log for the texts used above", exp: "none of the comment or kudos texts; only method, path and error type (NFR-01)" }, async () => {
  const file = "testing/reports/2026-11-12_002/evidence/server-e2e.log";
  if (!fs.existsSync(file)) return "BLOCKED: server log not found";
  const log = fs.readFileSync(file, "utf8");
  const needles = ["QA Adam", "QA Emil", "QA Cyril", "ďakujem (QA)", "Komentár", "\"answers\"", "\"comment\""];
  const hits = needles.filter((n) => log.includes(n));
  return [hits.length === 0, `log size=${log.length} bytes, lines=${log.split("\n").length}; needles found=${hits.join(", ") || "none"}`];
});
const errs = [adam, barbora, cyril, dana, emil, mgrA, hr].flatMap((p) => p.errors);
await step({ d: "No uncaught JavaScript error during the error scenarios", pre: "7 sessions above", steps: "collect 'pageerror' events", exp: "none" }, async () => [errs.length === 0, `page errors=${errs.length} ${errs.slice(0, 3).join(" | ")}`]);
await closeBrowser();
