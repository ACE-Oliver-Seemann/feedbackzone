// Journey 7: error handling — failed, slow, aborted and malformed responses in the middle
// of filling in, creating a round, sending kudos, writing actions and issues.
// Failures are injected in the browser with page.route; the server itself is untouched.
import { BASE, U, db, resetDb, recorder, session, shot, mainText, api, ymd, fillWizard, closeBrowser } from "./lib.mjs";

const R = recorder("j7-errors");
const step = async (meta, fn) => {
  try { const [ok, actual, evidence] = await fn(); return R.check({ j: "J7", ...meta }, ok, actual, evidence ?? ""); }
  catch (error) { return R.check({ j: "J7", ...meta }, false, `SCRIPT/RUNTIME ERROR: ${error.message}`); }
};
const GENERIC = "Niečo sa nepodarilo. Skús to znova.";
resetDb(false);
const teamA = await db.team.findFirstOrThrow({ where: { name: "Tím Alfa" } });
const teamB = await db.team.findFirstOrThrow({ where: { name: "Tím Beta" } });
const seedBeta = await db.round.findFirstOrThrow({ where: { teamId: teamB.id } });
const hrApi = await api(U.hr);
const qs = (await hrApi("/api/questions")).json.questions.filter((q) => !q.fixed).slice(0, 3).map((q) => q.id);
const mk = async (name, teamId) => { const c = await hrApi("/api/rounds", "POST", { name, teamId, closesAt: ymd(new Date(Date.now() + 7 * 864e5)), questionIds: qs }); await hrApi(`/api/rounds/${c.json.round.id}/open`, "POST"); return c.json.round.id; };
const roundId = await mk("QA chybové kolo", teamA.id);
const RESP = `**/api/rounds/${roundId}/responses`;
const counts = async () => `${await db.participation.count({ where: { roundId } })}/${await db.response.count({ where: { roundId } })}`;
const alerts = async (p) => (await p.getByRole("alert").allInnerTexts()).filter(Boolean);

// ───── fill wizard
const adam = await session(U.alfa[0], { width: 360, height: 740 });
await fillWizard(adam, roundId, [4, 2, 5, 3], "QA komentár, ktorý má prežiť chybu.", { stopBeforeSubmit: true });
await step({ d: "Fill: request aborted (network interruption) on submit", pre: "Adam on the comment step, 360 px", steps: "abort POST …/responses; click Odoslať", exp: `message '${GENERIC}'; still on the comment step with the comment kept; button usable again; nothing stored` }, async () => {
  await adam.route(RESP, (r) => r.abort("connectionreset"));
  await adam.getByRole("button", { name: "Odoslať" }).click();
  await adam.getByRole("alert").filter({ hasText: GENERIC }).waitFor();
  const kept = await adam.locator("textarea").inputValue();
  const enabled = await adam.getByRole("button", { name: "Odoslať" }).isEnabled();
  await adam.unroute(RESP);
  return [kept === "QA komentár, ktorý má prežiť chybu." && enabled && (await counts()) === "0/0", `alert shown; comment kept=${kept.length > 0}; submit enabled=${enabled}; DB participations/responses=${await counts()}`, await shot(adam, "j7-01-fill-abort-360")];
});
await step({ d: "Fill: the answers chosen before the failure are still there", pre: "after the failed submit", steps: "click Späť four times and read the pressed buttons, then Ďalej back to the comment", exp: "answers 4,2,5,3 still selected; comment still there" }, async () => {
  const seen = [];
  for (let i = 0; i < 4; i++) {
    await adam.getByRole("button", { name: "Späť" }).click();
    const pressed = await adam.locator('fieldset button[aria-pressed="true"]').count();
    const idx = await adam.locator("fieldset button[aria-pressed]").evaluateAll((els) => els.findIndex((e) => e.getAttribute("aria-pressed") === "true") + 1);
    seen.unshift(pressed === 1 ? idx : 0);
  }
  for (let i = 0; i < 4; i++) await adam.getByRole("button", { name: "Ďalej" }).click();
  const kept = await adam.locator("textarea").inputValue();
  return [seen.join() === "4,2,5,3" && kept.startsWith("QA komentár"), `answers=${seen}; comment kept=${kept.length > 0}`];
});
await step({ d: "Fill: server error 500 on submit", pre: "Adam on the comment step", steps: "answer POST with HTTP 500; click Odoslať", exp: `'${GENERIC}'; data kept; nothing stored` }, async () => {
  await adam.route(RESP, (r) => r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"internal_error"}' }));
  await adam.getByRole("button", { name: "Odoslať" }).click();
  await adam.getByRole("alert").filter({ hasText: GENERIC }).waitFor();
  await adam.unroute(RESP);
  return [(await counts()) === "0/0" && (await adam.locator("textarea").inputValue()).length > 0, `alert shown; DB=${await counts()}`];
});
await step({ d: "Fill: invalid (non-JSON) body with status 409", pre: "Adam on the comment step", steps: "answer POST with 409 and body '<html>oops'; click Odoslať", exp: "no crash / blank page; an understandable message; data kept" }, async () => {
  await adam.route(RESP, (r) => r.fulfill({ status: 409, contentType: "text/html", body: "<html>oops" }));
  await adam.getByRole("button", { name: "Odoslať" }).click();
  await adam.waitForTimeout(700);
  const a = await alerts(adam);
  const stillForm = await adam.locator("textarea").count();
  await adam.unroute(RESP);
  return [a.includes(GENERIC) && stillForm === 1 && adam.errors.length === 0, `alerts=${JSON.stringify(a)}; form still shown=${stillForm === 1}; page errors=${adam.errors.length}`];
});
await step({ d: "Fill: unexpected success status 200 with an empty body", pre: "Adam on the comment step", steps: "answer POST with 200 and ''; click Odoslať", exp: "not treated as success (the app expects 201); message shown; nothing stored" }, async () => {
  await adam.route(RESP, (r) => r.fulfill({ status: 200, body: "" }));
  await adam.getByRole("button", { name: "Odoslať" }).click();
  await adam.waitForTimeout(600);
  const a = await alerts(adam);
  const thanks = await adam.getByRole("heading", { name: "Ďakujeme za odpoveď" }).count();
  await adam.unroute(RESP);
  return [a.includes(GENERIC) && thanks === 0 && (await counts()) === "0/0", `alerts=${JSON.stringify(a)}; thank-you shown=${thanks}`];
});
await step({ d: "Fill: browser goes offline, then online again", pre: "Adam on the comment step", steps: "set offline; Odoslať → error; set online; Odoslať", exp: "error while offline; after reconnecting the same form submits successfully; exactly 1 response with the original values" }, async () => {
  await adam.context().setOffline(true);
  await adam.getByRole("button", { name: "Odoslať" }).click();
  await adam.getByRole("alert").filter({ hasText: GENERIC }).waitFor();
  const off = await counts();
  await adam.context().setOffline(false);
  await adam.getByRole("button", { name: "Odoslať" }).click();
  await adam.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor();
  const r = await db.response.findFirst({ where: { roundId } });
  return [off === "0/0" && (await counts()) === "1/1" && [r.v1, r.v2, r.v3, r.v4].join() === "4,2,5,3" && r.comment === "QA komentár, ktorý má prežiť chybu.", `offline DB=${off}; after retry DB=${await counts()}; values=${[r.v1, r.v2, r.v3, r.v4]}; comment kept=${r.comment !== null}`, await shot(adam, "j7-02-fill-retry-ok-360")];
});
const barb = await session(U.alfa[1]);
await step({ d: "Fill: slow response (3 s)", pre: "Barbora on the comment step", steps: "delay POST by 3 s; click Odoslať; click it again during the wait", exp: "button shows 'Odosielam…' and is disabled, 'Späť' disabled; only one request; then thank-you; 1 new response" }, async () => {
  await fillWizard(barb, roundId, [3, 3, 3, 3], "", { stopBeforeSubmit: true });
  let calls = 0;
  await barb.route(RESP, async (r) => { calls++; await new Promise((res) => setTimeout(res, 3000)); await r.continue(); });
  await barb.getByRole("button", { name: "Odoslať" }).click();
  const pendingBtn = barb.getByRole("button", { name: "Odosielam…" });
  await pendingBtn.waitFor();
  const disabled = await pendingBtn.isDisabled(); const backDisabled = await barb.getByRole("button", { name: "Späť" }).isDisabled();
  await pendingBtn.click({ force: true, timeout: 1000 }).catch(() => {});
  const s = await shot(barb, "j7-03-fill-slow");
  await barb.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 10000 });
  await barb.unroute(RESP);
  return [disabled && backDisabled && calls === 1 && (await counts()) === "2/2", `pending label shown, disabled=${disabled}, back disabled=${backDisabled}, requests=${calls}, DB=${await counts()}`, s];
});
const cyril = await session(U.alfa[2]);
await step({ d: "Fill: the server stored the answer but the reply was lost (connection dropped after processing)", pre: "Cyril on the comment step", steps: "let the POST reach the server, then abort the response; click Odoslať; click Odoslať again", exp: "first click: error; retry: the user is told the round is already filled in (no duplicate, no endless error); exactly 1 new response" }, async () => {
  await fillWizard(cyril, roundId, [5, 5, 4, 4], "QA komentár pri stratenej odpovedi.", { stopBeforeSubmit: true });
  let first = true;
  await cyril.route(RESP, async (r) => { if (first) { first = false; await r.fetch(); await r.abort("connectionreset"); } else await r.continue(); });
  await cyril.getByRole("button", { name: "Odoslať" }).click();
  await cyril.getByRole("alert").filter({ hasText: GENERIC }).waitFor();
  const afterFirst = await counts();
  await cyril.getByRole("button", { name: "Odoslať" }).click();
  await cyril.getByRole("heading", { name: "Toto kolo už máš vyplnené" }).waitFor();
  await cyril.unroute(RESP);
  return [afterFirst === "3/3" && (await counts()) === "3/3", `after lost reply DB=${afterFirst}; after retry UI='Toto kolo už máš vyplnené', DB=${await counts()}`, await shot(cyril, "j7-04-fill-lost-reply")];
});
await step({ d: "Fill: reloading the page in the middle of the wizard", pre: "Dana on question 3 with two answers chosen", steps: "press F5", exp: "wizard restarts from the intro (answers are kept only in the browser memory by design, NFR-01); nothing stored; no error" }, async () => {
  const dana = await session(U.alfa[3]);
  await dana.goto(`${BASE}/rounds/${roundId}/fill`);
  await dana.getByRole("button", { name: "Začať" }).click();
  for (const v of [2, 4]) { await dana.locator("fieldset button[aria-pressed]").nth(v - 1).click(); await dana.getByRole("button", { name: "Ďalej" }).click(); }
  await dana.reload();
  const intro = await dana.getByRole("button", { name: "Začať" }).count();
  const c = await counts();
  await dana.context().close();
  return [intro === 1 && c === "3/3", `intro shown again=${intro === 1}; DB=${c} (unchanged)`];
});
await step({ d: "Fill: leaving the wizard through the browser Back button and returning", pre: "Emil on question 2", steps: "Back (to home), Forward", exp: "no crash; wizard is usable (restart from intro is acceptable); nothing stored" }, async () => {
  const emil = await session(U.alfa[4]);
  await emil.goto(`${BASE}/`);
  await emil.getByRole("link", { name: "Vyplniť" }).first().click();
  await emil.getByRole("button", { name: "Začať" }).click();
  await emil.locator("fieldset button[aria-pressed]").nth(2).click();
  await emil.getByRole("button", { name: "Ďalej" }).click();
  await emil.goBack(); await emil.waitForTimeout(500);
  const home = new URL(emil.url()).pathname;
  await emil.goForward(); await emil.waitForTimeout(700);
  const usable = (await emil.getByRole("button", { name: "Začať" }).count()) + (await emil.getByRole("button", { name: "Ďalej" }).count());
  const errs = emil.errors.length; const c = await counts();
  await emil.context().close();
  return [home === "/" && usable >= 1 && errs === 0 && c === "3/3", `back → ${home}; forward → wizard usable=${usable >= 1}; page errors=${errs}; DB=${c}`];
});

// ───── new round form
const mgrA = await session(U.mgrA);
await step({ d: "New round: request fails with 500", pre: "manager on /rounds/new, name changed, 3 preselected questions", steps: "answer POST /api/rounds with 500; click 'Uložiť koncept'", exp: `'${GENERIC}'; name and ticked questions kept; no round created` }, async () => {
  await mgrA.goto(`${BASE}/rounds/new`);
  await mgrA.locator('input[name="name"]').fill("QA kolo po chybe");
  const before = await db.round.count();
  await mgrA.route("**/api/rounds", (r) => (r.request().method() === "POST" ? r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"internal_error"}' }) : r.continue()));
  await mgrA.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgrA.getByRole("alert").filter({ hasText: GENERIC }).waitFor();
  const name = await mgrA.locator('input[name="name"]').inputValue();
  const ticked = await mgrA.locator('input[type="checkbox"]:checked').count();
  await mgrA.unroute("**/api/rounds");
  return [name === "QA kolo po chybe" && ticked === 3 && (await db.round.count()) === before, `name kept='${name}', ticked=${ticked}, rounds ${before}→${await db.round.count()}`, await shot(mgrA, "j7-05-round-500")];
});
await step({ d: "New round: retry after the failure works and creates exactly one draft", pre: "after the 500", steps: "click 'Uložiť koncept' again", exp: "redirect to /rounds; one new DRAFT 'QA kolo po chybe'" }, async () => {
  await mgrA.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgrA.waitForURL("**/rounds");
  const n = await db.round.count({ where: { name: "QA kolo po chybe" } });
  return [n === 1, `drafts named 'QA kolo po chybe'=${n}`];
});
await step({ d: "New round: the server created the round but the reply was lost; the user retries", pre: "manager on /rounds/new", steps: "let POST reach the server, abort the response; error shown; click save again", exp: "ideally one round; a duplicate draft is the observed risk" }, async () => {
  await mgrA.goto(`${BASE}/rounds/new`);
  await mgrA.locator('input[name="name"]').fill("QA kolo stratená odpoveď");
  let first = true;
  await mgrA.route("**/api/rounds", async (r) => { if (r.request().method() === "POST" && first) { first = false; await r.fetch(); await r.abort("connectionreset"); } else await r.continue(); });
  await mgrA.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgrA.getByRole("alert").filter({ hasText: GENERIC }).waitFor();
  await mgrA.getByRole("button", { name: "Uložiť koncept" }).click();
  await mgrA.waitForURL("**/rounds");
  await mgrA.unroute("**/api/rounds");
  const n = await db.round.count({ where: { name: "QA kolo stratená odpoveď" } });
  return [n === 1, `drafts with that name after retry=${n} (the list shows both; a draft cannot be deleted in the UI)`, await shot(mgrA, "j7-06-round-duplicate-after-lost-reply")];
});
await step({ d: "New round: adding an own question fails with 500", pre: "manager on /rounds/new", steps: "answer POST /api/questions with 500; type a question; 'Pridať otázku'", exp: "'Otázku sa nepodarilo pridať. Skús to znova.'; typed text kept; no Question row" }, async () => {
  await mgrA.goto(`${BASE}/rounds/new`);
  await mgrA.route("**/api/questions", (r) => (r.request().method() === "POST" ? r.fulfill({ status: 500, body: "{}" }) : r.continue()));
  await mgrA.getByLabel("Pridať vlastnú otázku").fill("QA otázka pri chybe servera je tu.");
  await mgrA.getByRole("button", { name: "Pridať otázku" }).click();
  await mgrA.getByText("Otázku sa nepodarilo pridať. Skús to znova.").waitFor();
  const kept = await mgrA.getByLabel("Pridať vlastnú otázku").inputValue();
  await mgrA.unroute("**/api/questions");
  return [kept.startsWith("QA otázka") && (await db.question.count({ where: { teamId: { not: null } } })) === 0, `text kept=${kept.length > 0}; custom questions=${await db.question.count({ where: { teamId: { not: null } } })}`];
});
await step({ d: "Round list: 'Spustiť' fails with 500, then succeeds", pre: "draft 'QA kolo po chybe'", steps: "answer POST …/open with 500; click Spustiť; remove the fault; click again", exp: `'${GENERIC}' under the button, status stays Koncept; second click opens the round` }, async () => {
  await mgrA.goto(`${BASE}/rounds`);
  const row = mgrA.locator("main li", { has: mgrA.getByRole("heading", { name: "QA kolo po chybe", exact: true }) });
  await mgrA.route("**/api/rounds/*/open", (r) => r.fulfill({ status: 500, body: "{}" }));
  await row.getByRole("button", { name: "Spustiť" }).click();
  await row.getByRole("alert").filter({ hasText: GENERIC }).waitFor();
  const s1 = (await db.round.findFirst({ where: { name: "QA kolo po chybe" } })).status;
  await mgrA.unroute("**/api/rounds/*/open");
  await row.getByRole("button", { name: "Spustiť" }).click();
  await row.getByText("Otvorené").waitFor();
  const s2 = (await db.round.findFirst({ where: { name: "QA kolo po chybe" } })).status;
  return [s1 === "DRAFT" && s2 === "OPEN", `after failure=${s1}; after retry=${s2}`];
});
await step({ d: "Round list: 'Uzavrieť' on a round that somebody else closed meanwhile (stale list)", pre: "manager's list shows 'QA kolo po chybe' as open; HR closes it through the API", steps: "manager clicks Uzavrieť in the stale list", exp: "'Kolo medzitým zmenilo stav. Obnov stránku.'; DB closed once" }, async () => {
  const r = await db.round.findFirst({ where: { name: "QA kolo po chybe" } });
  await hrApi(`/api/rounds/${r.id}/close`, "POST");
  const row = mgrA.locator("main li", { has: mgrA.getByRole("heading", { name: "QA kolo po chybe", exact: true }) });
  await row.getByRole("button", { name: "Uzavrieť" }).click();
  await row.getByRole("alert").waitFor();
  const msg = await row.getByRole("alert").innerText();
  return [msg === "Kolo medzitým zmenilo stav. Obnov stránku." && (await db.round.findUnique({ where: { id: r.id } })).status === "CLOSED", `message='${msg}'`, await shot(mgrA, "j7-07-stale-close")];
});
await step({ d: "Round list: a draft whose deadline has passed cannot be started", pre: "draft with the deadline moved to yesterday directly in the QA DB (simulated time)", steps: "click Spustiť", exp: "'Uzávierka kola už prešla, kolo sa nedá spustiť.'; stays DRAFT" }, async () => {
  const r = await db.round.findFirst({ where: { name: "QA kolo stratená odpoveď", status: "DRAFT" } });
  await db.round.update({ where: { id: r.id }, data: { closesAt: new Date(Date.now() - 864e5) } });
  await mgrA.goto(`${BASE}/rounds`);
  const row = mgrA.locator("main li", { has: mgrA.getByRole("heading", { name: "QA kolo stratená odpoveď", exact: true }) }).filter({ hasText: fmtYesterday() });
  await row.first().getByRole("button", { name: "Spustiť" }).click();
  await row.first().getByRole("alert").waitFor();
  const msg = await row.first().getByRole("alert").innerText();
  return [msg === "Uzávierka kola už prešla, kolo sa nedá spustiť." && (await db.round.findUnique({ where: { id: r.id } })).status === "DRAFT", `message='${msg}'`, await shot(mgrA, "j7-08-deadline-passed")];
});
function fmtYesterday() { return new Intl.DateTimeFormat("sk-SK", { dateStyle: "medium" }).format(new Date(Date.now() - 864e5)); }

// ───── kudos
await step({ d: "Kudos: request aborted on send, then retried", pre: "Adam on the kudos form with recipient, emoji and text", steps: "abort POST /api/kudos; send; remove the fault; send", exp: `'${GENERIC}'; recipient, emoji and text kept; after retry 'Kudos je odoslané.' and exactly 1 row` }, async () => {
  await adam.goto(`${BASE}/kudos/new`);
  await adam.locator('select[name="toUserId"]').selectOption({ label: "Barbora Skúšobná (Tím Alfa)" });
  await adam.getByRole("button", { name: "💪" }).click();
  await adam.locator("form textarea").fill("QA kudos, ktoré má prežiť výpadok siete.");
  await adam.route("**/api/kudos", (r) => r.abort("internetdisconnected"));
  await adam.getByRole("button", { name: "Poslať kudos" }).click();
  await adam.getByRole("alert").filter({ hasText: GENERIC }).waitFor();
  const kept = [await adam.locator("form textarea").inputValue(), await adam.locator('select[name="toUserId"] option:checked').innerText(), await adam.getByRole("button", { name: "💪" }).getAttribute("aria-pressed")];
  const s = await shot(adam, "j7-09-kudos-abort-360");
  await adam.unroute("**/api/kudos");
  await adam.getByRole("button", { name: "Poslať kudos" }).click();
  await adam.getByText("Kudos je odoslané.").waitFor();
  const n = await db.kudos.count();
  return [kept[0].startsWith("QA kudos") && kept[1].startsWith("Barbora") && kept[2] === "true" && n === 1, `kept text=${kept[0].length > 0}, recipient='${kept[1]}', emoji pressed=${kept[2]}; rows after retry=${n}`, s];
});
await step({ d: "Kudos: slow response (2.5 s)", pre: "Adam on the kudos form", steps: "delay POST; click send", exp: "button 'Posielam…' disabled during the wait; one row added" }, async () => {
  await adam.locator('select[name="toUserId"]').selectOption({ label: "Cyril Ukážkový (Tím Alfa)" });
  await adam.locator("form textarea").fill("QA kudos pri pomalej odpovedi servera.");
  await adam.route("**/api/kudos", async (r) => { await new Promise((res) => setTimeout(res, 2500)); await r.continue(); });
  await adam.getByRole("button", { name: "Poslať kudos" }).click();
  const b = adam.getByRole("button", { name: "Posielam…" });
  await b.waitFor();
  const disabled = await b.isDisabled();
  await adam.getByText("Kudos je odoslané.").waitFor({ timeout: 10000 });
  await adam.unroute("**/api/kudos");
  return [disabled && (await db.kudos.count()) === 2, `pending button disabled=${disabled}; rows=${await db.kudos.count()}`];
});
await step({ d: "Kudos: success message disappears when the next send fails", pre: "'Kudos je odoslané.' is shown from the previous send", steps: "send again with a forced 500", exp: "only the error is shown, not both messages at once" }, async () => {
  await adam.locator('select[name="toUserId"]').selectOption({ label: "Cyril Ukážkový (Tím Alfa)" });
  await adam.locator("form textarea").fill("QA druhé kudos, ktoré zlyhá na serveri.");
  await adam.route("**/api/kudos", (r) => r.fulfill({ status: 500, body: "{}" }));
  await adam.getByRole("button", { name: "Poslať kudos" }).click();
  await adam.getByRole("alert").filter({ hasText: GENERIC }).waitFor();
  const ok = await adam.getByText("Kudos je odoslané.").count();
  await adam.unroute("**/api/kudos");
  return [ok === 0 && (await db.kudos.count()) === 2, `success message still visible=${ok}; rows=${await db.kudos.count()}`];
});

// ───── actions
const mgrB = await session(U.mgrB);
await mgrB.goto(`${BASE}/rounds/${seedBeta.id}/results`);
await step({ d: "Action form: 500 on save, then retry", pre: "manager Beta on results of the closed round, form filled", steps: "answer POST …/actions with 500; save; remove fault; save", exp: `'${GENERIC}'; topic/description/date kept; after retry exactly 1 action` }, async () => {
  await mgrB.locator('input[name="topic"]').fill("QA krok pri chybe");
  await mgrB.locator('textarea[name="description"]').fill("QA: opis kroku, ktorý má zostať.");
  await mgrB.locator('input[name="dueDate"]').fill(ymd(new Date(Date.now() + 5 * 864e5)));
  await mgrB.route("**/api/rounds/*/actions", (r) => r.fulfill({ status: 500, body: "{}" }));
  await mgrB.getByRole("button", { name: "Pridať krok" }).click();
  await mgrB.getByRole("alert").filter({ hasText: GENERIC }).waitFor();
  const kept = [await mgrB.locator('input[name="topic"]').inputValue(), await mgrB.locator('textarea[name="description"]').inputValue(), await mgrB.locator('input[name="dueDate"]').inputValue()];
  await mgrB.unroute("**/api/rounds/*/actions");
  await mgrB.getByRole("button", { name: "Pridať krok" }).click();
  await mgrB.locator("#kroky ul > li h3", { hasText: "QA krok pri chybe" }).waitFor();
  const n = await db.action.count({ where: { roundId: seedBeta.id } });
  return [kept[0] === "QA krok pri chybe" && kept[1].length > 0 && kept[2].length === 10 && n === 1, `kept=${JSON.stringify(kept)}; actions after retry=${n}`, await shot(mgrB, "j7-10-action-retry")];
});
await step({ d: "Action status: change fails → the select returns to the stored value and says so", pre: "action 'QA krok pri chybe' is Plánované", steps: "answer PATCH with 500; choose 'Hotové'", exp: `select back on 'Plánované', '${GENERIC}' next to it; DB still PLANNED` }, async () => {
  await mgrB.route("**/api/actions/*", (r) => r.fulfill({ status: 500, body: "{}" }));
  const row = mgrB.locator("#kroky > ul > li", { hasText: "QA krok pri chybe" });
  await row.getByLabel("Stav").selectOption("DONE");
  await row.getByRole("alert").waitFor();
  const v = await row.getByLabel("Stav").inputValue();
  const s = await shot(mgrB, "j7-11-status-revert");
  await mgrB.unroute("**/api/actions/*");
  const a = await db.action.findFirst({ where: { roundId: seedBeta.id } });
  return [v === "PLANNED" && a.status === "PLANNED", `select=${v}; DB=${a.status}`, s];
});
await step({ d: "Action status: the manager's session ended (401) while changing the status", pre: "manager Beta on results; cookie removed", steps: "choose 'Prebieha'", exp: "select reverts; the user is told to log in again or is redirected" }, async () => {
  const saved = await mgrB.context().cookies();
  await mgrB.context().clearCookies();
  const row = mgrB.locator("#kroky > ul > li", { hasText: "QA krok pri chybe" });
  await row.getByLabel("Stav").selectOption("IN_PROGRESS");
  await mgrB.waitForTimeout(1000);
  const path = new URL(mgrB.url()).pathname;
  const a = path === "/login" ? [] : await alerts(mgrB);
  const informed = path === "/login" || a.some((x) => /prihl|relác/i.test(x));
  await mgrB.context().addCookies(saved);
  const dbs = (await db.action.findFirst({ where: { roundId: seedBeta.id } })).status;
  return [informed && dbs === "PLANNED", `path=${path}; message=${JSON.stringify(a)}; DB=${dbs}`, await shot(mgrB, "j7-12-status-401")];
});

// ───── HR issue / note forms
const hr = await session(U.hr);
await step({ d: "Issue form: request aborted, then retried", pre: "HR on /hr/issues with the form open and filled", steps: "abort POST /api/hr/issues; submit; remove the fault; submit", exp: `'${GENERIC}'; title kept; after retry 'Podnet je pridaný.' and exactly 1 new issue` }, async () => {
  await hr.goto(`${BASE}/hr/issues`);
  await hr.locator("details > summary", { hasText: "Pridať podnet" }).click();
  await hr.locator('form#new input[name="title"]').fill("QA podnet pri výpadku");
  const before = await db.issue.count();
  await hr.route("**/api/hr/issues", (r) => (r.request().method() === "POST" ? r.abort() : r.continue()));
  await hr.locator("form#new").getByRole("button", { name: "Pridať podnet" }).click();
  await hr.getByRole("alert").filter({ hasText: GENERIC }).waitFor();
  const kept = await hr.locator('form#new input[name="title"]').inputValue();
  await hr.unroute("**/api/hr/issues");
  await hr.locator("form#new").getByRole("button", { name: "Pridať podnet" }).click();
  await hr.getByText("Podnet je pridaný.").waitFor();
  return [kept === "QA podnet pri výpadku" && (await db.issue.count()) === before + 1, `title kept='${kept}'; issues ${before}→${await db.issue.count()}`, await shot(hr, "j7-13-issue-retry")];
});
await step({ d: "Issue status select: failure reverts the value", pre: "issue 'QA podnet pri výpadku' is Otvorené", steps: "answer PATCH with 500; choose 'Rieši sa'", exp: "select back on 'Otvorené' with an error; DB OPEN" }, async () => {
  const card = hr.locator("main section > ul > li", { hasText: "QA podnet pri výpadku" });
  await hr.route("**/api/hr/issues/*", (r) => r.fulfill({ status: 500, body: "{}" }));
  await card.getByLabel("Stav").selectOption("IN_PROGRESS");
  await card.getByRole("alert").waitFor();
  const v = await card.getByLabel("Stav").inputValue();
  await hr.unroute("**/api/hr/issues/*");
  const x = await db.issue.findFirst({ where: { title: "QA podnet pri výpadku" } });
  return [v === "OPEN" && x.status === "OPEN", `select=${v}; DB=${x.status}`];
});
await step({ d: "Note form: 500 on save keeps the long text", pre: "HR on /hr/notes with title, date and a 3-line text", steps: "answer POST /api/hr/notes with 500; save", exp: `'${GENERIC}'; all three fields kept; no row` }, async () => {
  await hr.goto(`${BASE}/hr/notes`);
  const before = await db.meetingNote.count();
  await hr.locator('input[name="title"]').fill("QA poznámka pri chybe");
  await hr.locator('input[name="meetingDate"]').fill(ymd(new Date()));
  await hr.locator('textarea[name="text"]').fill("riadok 1\nriadok 2\nriadok 3");
  await hr.route("**/api/hr/notes", (r) => (r.request().method() === "POST" ? r.fulfill({ status: 500, body: "{}" }) : r.continue()));
  await hr.getByRole("button", { name: "Uložiť poznámku" }).click();
  await hr.getByRole("alert").filter({ hasText: GENERIC }).waitFor();
  const kept = await hr.locator('textarea[name="text"]').inputValue();
  await hr.unroute("**/api/hr/notes");
  return [kept === "riadok 1\nriadok 2\nriadok 3" && (await db.meetingNote.count()) === before, `text kept=${kept === "riadok 1\nriadok 2\nriadok 3"}; notes ${before}→${await db.meetingNote.count()}`];
});

// ───── login / logout failures
await step({ d: "Login: network failure, then retry", pre: "logged out", steps: "abort POST /api/login; submit; remove the fault; submit", exp: `'${GENERIC}' (not 'wrong password'); e-mail kept; retry logs in` }, async () => {
  const p = await session(null);
  await p.goto(`${BASE}/login`);
  await p.getByLabel("E-mail").fill(U.alfa[3]); await p.getByLabel("Heslo").fill("Heslo123");
  await p.route("**/api/login", (r) => r.abort());
  await p.getByRole("button", { name: "Prihlásiť sa" }).click();
  await p.getByRole("alert").filter({ hasText: GENERIC }).waitFor();
  const kept = await p.getByLabel("E-mail").inputValue();
  const s = await shot(p, "j7-14-login-network-error");
  await p.unroute("**/api/login");
  await p.getByRole("button", { name: "Prihlásiť sa" }).click();
  await p.waitForURL(`${BASE}/`);
  await p.context().close();
  return [kept === U.alfa[3], `e-mail kept=${kept === U.alfa[3]}; retry reached '/'`, s];
});
await step({ d: "Logout: the logout request fails (network) — is the user really logged out?", pre: "Dana logged in", steps: "abort POST /api/logout; click 'Odhlásiť sa'; then open /", exp: "either the user is told that logout failed, or the session is really gone; the app must not show the login page while the session is still valid" }, async () => {
  const p = await session(U.alfa[3]);
  await p.route("**/api/logout", (r) => r.abort());
  await p.getByRole("button", { name: "Odhlásiť sa" }).click();
  await p.waitForTimeout(1500);
  const after = new URL(p.url()).pathname;
  const cookie = (await p.context().cookies()).some((c) => c.name === "fz_session");
  await p.unroute("**/api/logout");
  await p.goto(`${BASE}/`);
  const still = (await mainText(p)).includes("Dana Príkladná");
  const s = await shot(p, "j7-15-logout-failed");
  await p.context().close();
  return [!(cookie && still), `after click path=${after}; session cookie still present=${cookie}; opening '/' afterwards shows Dana's home=${still}`, s];
});
await step({ d: "Server-rendered page when the backend/database is down", pre: "-", steps: "would require stopping the QA server or its database", exp: "friendly error page", }, async () => ["BLOCKED", "Not executed: the QA server on :3303 is shared for the whole session and must not be stopped; client-side failures were simulated with page.route instead."]);

console.log(`\nJ7 done: ${R.rows.length} checks, ${R.rows.filter((r) => r.status === "FAIL").length} failed`);
await closeBrowser();
