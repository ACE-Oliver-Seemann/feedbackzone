// Session 2026-11-12_002, section B: the kudos workflow on the redesigned /kudos page (two tabs),
// verified against the API and the database. Starts from a seed-only database.
import {
  BASE, U, db, resetDb, recorder, stepper, session, shot, mainOnly, api, fmtDate, pathOf, teams, closeBrowser,
} from "./lib.mjs";

const R = recorder("m2-kudos");
const step = stepper(R, { j: "B" });
resetDb(false);
const { A: teamA, B: teamB } = await teams();
const user = async (email) => db.user.findUniqueOrThrow({ where: { email } });
const [uAdam, uBarbora, uCyril, uFilip, uHr, uMgrA] = await Promise.all([U.alfa[0], U.alfa[1], U.alfa[2], U.beta[0], U.hr, U.mgrA].map(user));

const panel = (page) => page.locator('[role="tabpanel"]:not([hidden])');
const sendTab = async (page) => { await page.getByRole("tab", { name: "Poslať kudos" }).click(); await page.locator('select[name="toUserId"]').waitFor(); };
async function send(page, { to, text = "", emoji = null, value = null, visibility = null }) {
  if (to) await page.selectOption('select[name="toUserId"]', to);
  if (emoji) await page.locator("form").getByRole("button", { name: emoji, exact: true }).click();
  if (text !== null) await page.locator("form textarea").fill(text);
  if (value) await page.locator(`input[name="value"][value="${value}"]`).check({ force: true });
  if (visibility) await page.locator(`input[name="visibility"][value="${visibility}"]`).check({ force: true });
  await page.locator('form button[type="submit"]').click();
}

const adam = await session(U.alfa[0]);
await step({ d: "Kudos opens from the main menu on the 'Moje kudos' tab with an empty state", pre: "Adam has no kudos", steps: "click 'Kudos' in the menu", exp: "path /kudos; tabs 'Moje kudos' (selected) and 'Poslať kudos'; 'Zatiaľ tu nemáš žiadne kudos.' (IT-12, MVP-17)" }, async () => {
  await adam.locator("header nav").first().getByRole("link", { name: "Kudos" }).click();
  await adam.waitForURL("**/kudos");
  const tabs = await adam.getByRole("tab").allInnerTexts();
  const selected = await adam.getByRole("tab", { selected: true }).innerText();
  const text = await mainOnly(adam);
  return [tabs.length === 2 && selected.startsWith("Moje kudos") && text.includes("Zatiaľ tu nemáš žiadne kudos."), `tabs=${tabs.join("|")}; selected='${selected}'; empty state=${text.includes("Zatiaľ tu nemáš žiadne kudos.")}`, await shot(adam, "m2-01-empty")];
});
await step({ d: "Old addresses /kudos/new and /kudos/me lead to the single page", pre: "Adam logged in", steps: "open /kudos/new, then /kudos/me", exp: "/kudos?tab=send with the form visible; /kudos with the received tab (IT-12: addresses keep working)" }, async () => {
  await adam.goto(`${BASE}/kudos/new`, { waitUntil: "networkidle" });
  const a = new URL(adam.url()); const form = await adam.locator('select[name="toUserId"]').isVisible();
  await adam.goto(`${BASE}/kudos/me`, { waitUntil: "networkidle" });
  const b = new URL(adam.url()); const sel = await adam.getByRole("tab", { selected: true }).innerText();
  return [a.pathname === "/kudos" && a.search === "?tab=send" && form && b.pathname === "/kudos" && sel.startsWith("Moje kudos"), `/kudos/new → ${a.pathname}${a.search} (form visible=${form}); /kudos/me → ${b.pathname}${b.search} (selected '${sel}')`];
});
await sendTab(adam);
await step({ d: "Recipient list offers everyone except the sender, with the team in brackets", pre: "send tab", steps: "read the options of 'Komu'", exp: "12 people (13 users minus Adam), HR without a team, Adam missing (MVP-16)" }, async () => {
  const options = (await adam.locator('select[name="toUserId"] option').allInnerTexts()).slice(1);
  return [options.length === 12 && !options.some((o) => o.startsWith(uAdam.name)) && options.includes(uHr.name), `options=${options.length}; self listed=${options.some((o) => o.startsWith(uAdam.name))}; HR entry='${options.find((o) => o.startsWith(uHr.name))}'`];
});
await step({ d: "Empty form is refused with field messages and nothing is sent", pre: "send tab, nothing filled", steps: "Poslať kudos", exp: "messages for recipient and text; no success panel; 0 kudos in DB (MVP-16)" }, async () => {
  await adam.locator('form button[type="submit"]').click();
  await adam.waitForTimeout(800);
  const text = await panel(adam).innerText();
  const n = await db.kudos.count();
  return [text.includes("Vyber kolegu (sebe sa kudos poslať nedá).") && text.includes("Napíš 20 až 500 znakov alebo vyber emotikon.") && !text.includes("Kudos je odoslané.") && n === 0, `recipient msg=${text.includes("Vyber kolegu (sebe")}, text msg=${text.includes("Napíš 20 až 500")}, kudos=${n}`, await shot(adam, "m2-02-empty-form")];
});
await step({ d: "Text of 19 characters without an emoji is refused", pre: "send tab", steps: "recipient Barbora, text of 19 chars, Poslať kudos", exp: "'Napíš 20 až 500 znakov alebo vyber emotikon.'; nothing stored (MVP-16)" }, async () => {
  await send(adam, { to: uBarbora.id, text: "Ďakujem za pomoc !!" });
  await adam.waitForTimeout(800);
  const msg = await panel(adam).getByText("Napíš 20 až 500 znakov alebo vyber emotikon.").isVisible().catch(() => false);
  return [msg && (await db.kudos.count()) === 0, `message=${msg}; kudos=${await db.kudos.count()}; counter='${await panel(adam).getByText(/\d+ \/ 500/).innerText()}'`];
});
const PUBLIC_TEXT = "Ďakujem za pomoc s nasadením, bolo to rýchle (QA).";
await step({ d: "Live preview shows recipient, text, value and visibility before sending", pre: "send tab", steps: "recipient Barbora, text, value 'Pomoc kolegom', visibility 'Verejné v tíme'; read 'Náhľad'", exp: "'Pre: <Barbora>', the text, 'Pomoc kolegom', 'Verejné v tíme'" }, async () => {
  await adam.selectOption('select[name="toUserId"]', uBarbora.id);
  await adam.locator("form textarea").fill(PUBLIC_TEXT);
  await adam.locator('input[name="value"][value="HELPING"]').check({ force: true });
  const p = (await adam.locator('section[aria-labelledby="kudos-preview-title"]').innerText()).replace(/\s+/g, " ");
  return [p.includes(`Pre: ${uBarbora.name}`) && p.includes(PUBLIC_TEXT) && p.includes("Pomoc kolegom") && p.includes("Verejné v tíme"), p, await shot(adam, "m2-03-preview")];
});
await step({ d: "Sending a public text kudos: confirmation after the server answered, confetti, one row in DB", pre: "form filled", steps: "Poslať kudos", exp: "'Kudos je odoslané.' + 'Príjemca ho uvidí vo svojich kudos.'; a confetti canvas; DB: from Adam to Barbora, TEAM, HELPING, text, no emoji (MVP-16, acceptance step 6)" }, async () => {
  await adam.locator('form button[type="submit"]').click();
  await adam.getByText("Kudos je odoslané.").waitFor({ timeout: 8000 });
  const confetti = await adam.locator("canvas[data-confetti]").count();
  const rows = await db.kudos.findMany();
  const k = rows[0];
  const ok = rows.length === 1 && k.fromUserId === uAdam.id && k.toUserId === uBarbora.id && k.visibility === "TEAM" && k.value === "HELPING" && k.text === PUBLIC_TEXT && k.emoji === null;
  return [ok, `rows=${rows.length}; from/to ok=${k?.fromUserId === uAdam.id && k?.toUserId === uBarbora.id}; ${k?.visibility}/${k?.value}; confetti canvas=${confetti}`, await shot(adam, "m2-04-sent")];
});
await step({ d: "After sending, the form is empty and a second click cannot create a duplicate", pre: "success panel shown", steps: "read form; click Poslať kudos again", exp: "recipient and text cleared; validation message; still 1 kudos" }, async () => {
  const to = await adam.inputValue('select[name="toUserId"]'); const txt = await adam.locator("form textarea").inputValue();
  await adam.locator('form button[type="submit"]').click();
  await adam.waitForTimeout(800);
  const n = await db.kudos.count();
  return [to === "" && txt === "" && n === 1, `recipient='${to}', text='${txt}', kudos=${n}`];
});
await step({ d: "Sender sees the public kudos in the feed of the recipient's (own) team, signed, newest first", pre: "kudos sent", steps: "Adam opens the team page", exp: `'${uAdam.name} → ${uBarbora.name}', text, 'Pomoc kolegom', today's date (MVP-17)` }, async () => {
  await adam.goto(`${BASE}/team/${teamA.id}`, { waitUntil: "networkidle" });
  const feed = (await adam.locator("main#main section", { has: adam.getByRole("heading", { name: "Kudos v tíme" }) }).innerText()).replace(/\s+/g, " ");
  return [feed.includes(`${uAdam.name} → ${uBarbora.name}`) && feed.includes(PUBLIC_TEXT) && feed.includes("Pomoc kolegom") && feed.includes(fmtDate(new Date())), feed.slice(0, 300), await shot(adam, "m2-05-team-feed")];
});
const barbora = await session(U.alfa[1]);
await step({ d: "Recipient sees the kudos in 'Moje kudos' with the sender's name, value and a count", pre: "Barbora received 1 public kudos", steps: "Barbora opens /kudos", exp: `'Od: ${uAdam.name}', text, 'Pomoc kolegom', tab badge 1, summary 'Pomoc kolegom ×1' (MVP-17)` }, async () => {
  await barbora.goto(`${BASE}/kudos`, { waitUntil: "networkidle" });
  const text = await mainOnly(barbora);
  const badge = await barbora.getByRole("tab", { name: /Moje kudos/ }).innerText();
  return [text.includes(`Od: ${uAdam.name}`) && text.includes(PUBLIC_TEXT) && text.includes("Pomoc kolegom ×1") && /1$/.test(badge.trim()), `tab='${badge.replace(/\s+/g, " ")}'; sender shown=${text.includes(`Od: ${uAdam.name}`)}; summary=${text.includes("Pomoc kolegom ×1")}`, await shot(barbora, "m2-06-received")];
});
await step({ d: "GET /api/kudos/me equals the page and the database", pre: "as above", steps: "Barbora: GET /api/kudos/me", exp: "1 item with the same text, sender name, value, visibility" }, async () => {
  const call = await api(U.alfa[1]);
  const r = await call("/api/kudos/me");
  const items = r.json.kudos ?? r.json.items ?? [];
  const k = items[0];
  return [items.length === 1 && k.text === PUBLIC_TEXT && JSON.stringify(k).includes(uAdam.name), `items=${items.length}; keys=${Object.keys(k ?? {}).join(",")}`];
});
await step({ d: "'New kudos' notice appears for a kudos that arrived since the last visit, and only once", pre: "Barbora has visited /kudos with 1 kudos; Cyril sends her a second one (API)", steps: "Barbora reloads /kudos, then reloads again", exp: "first reload: 'Máš 1 nové kudos' + 'Pozri si, čo ti kolegovia poslali.'; second reload: no notice" }, async () => {
  const cyril = await api(U.alfa[2]);
  const s = await cyril("/api/kudos", "POST", { toUserId: uBarbora.id, text: "Vďaka za dôkladné review mojej zmeny (QA).", value: "QUALITY", visibility: "TEAM" });
  await barbora.reload({ waitUntil: "networkidle" });
  const first = await barbora.getByText("Máš 1 nové kudos").isVisible().catch(() => false);
  const evidence = await shot(barbora, "m2-07-new-kudos-notice");
  await barbora.reload({ waitUntil: "networkidle" });
  const second = await barbora.getByText(/Máš \d+ nov/).isVisible().catch(() => false);
  return [s.status === 201 && first && !second, `send HTTP ${s.status}; notice on first reload=${first}; on second reload=${second}`, evidence];
});
const dana = await session(U.alfa[3]);
await step({ d: "'New kudos' notice for the very first kudos a person receives", pre: "Dana has opened /kudos with no kudos; then Cyril sends her the first one", steps: "Dana opens /kudos (empty), Cyril sends (API), Dana reloads /kudos", exp: "'Máš 1 nové kudos' is shown (the notice exists to announce kudos that arrived since the last visit)" }, async () => {
  await dana.goto(`${BASE}/kudos`, { waitUntil: "networkidle" });
  const stored0 = await dana.evaluate(() => Object.keys(localStorage).filter((k) => k.includes("kudos-seen")).length);
  const cyril = await api(U.alfa[2]);
  await cyril("/api/kudos", "POST", { toUserId: (await user(U.alfa[3])).id, emoji: "👏", text: "", value: "QUALITY", visibility: "TEAM" });
  await dana.reload({ waitUntil: "networkidle" });
  const notice = await dana.getByText("Máš 1 nové kudos").isVisible().catch(() => false);
  const listed = await dana.locator("main#main").getByRole("img", { name: "👏" }).count();
  return [notice, `seen-count keys stored on the empty visit=${stored0}; kudos listed after reload=${listed}; notice shown=${notice}`, await shot(dana, "m2-08-first-kudos-no-notice")];
});

// private kudos
const PRIVATE_TEXT = "Súkromne: vďaka za podporu v ťažkom týždni (QA).";
await step({ d: "Sending a private kudos", pre: "Adam on the send tab", steps: "recipient Cyril, text, value Spolupráca, visibility Súkromné, send", exp: "confirmation; DB row PRIVATE (MVP-16)" }, async () => {
  await adam.goto(`${BASE}/kudos?tab=send`, { waitUntil: "networkidle" });
  await send(adam, { to: uCyril.id, text: PRIVATE_TEXT, visibility: "PRIVATE" });
  await adam.getByText("Kudos je odoslané.").waitFor({ timeout: 8000 });
  const k = await db.kudos.findFirst({ where: { text: PRIVATE_TEXT } });
  return [k?.visibility === "PRIVATE" && k.toUserId === uCyril.id, `visibility=${k?.visibility}`];
});
const cyrilPage = await session(U.alfa[2]);
await step({ d: "Private kudos is visible to the recipient only, marked 'Súkromné'", pre: "private kudos for Cyril", steps: "Cyril opens /kudos", exp: "text shown with the badge 'Súkromné' and 'Od: Adam…' (MVP-17)" }, async () => {
  await cyrilPage.goto(`${BASE}/kudos`, { waitUntil: "networkidle" });
  const li = cyrilPage.locator("main#main li", { hasText: PRIVATE_TEXT });
  const text = (await li.innerText()).replace(/\s+/g, " ");
  return [text.includes("Súkromné") && text.includes(`Od: ${uAdam.name}`), text, await shot(cyrilPage, "m2-09-private-received")];
});
await step({ d: "Private kudos is on no team page and in no other person's list: teammate, manager, HR, sender", pre: "private kudos Adam → Cyril", steps: "team page as Barbora, manager Alfa, HR; /kudos as manager, HR and Adam; APIs summary and kudos/me for each", exp: "the text appears nowhere (MVP-17: not even manager or HR)" }, async () => {
  const found = [];
  for (const [who, email] of [["teammate", U.alfa[1]], ["manager", U.mgrA], ["HR", U.hr], ["sender", U.alfa[0]]]) {
    const call = await api(email);
    const s = await call(`/api/teams/${teamA.id}/summary`); const me = await call("/api/kudos/me");
    if (s.text.includes(PRIVATE_TEXT)) found.push(`${who}: summary API`);
    if (me.text.includes(PRIVATE_TEXT)) found.push(`${who}: kudos/me API`);
  }
  const mgr = await session(U.mgrA); const hr = await session(U.hr);
  for (const [who, page] of [["teammate", barbora], ["manager", mgr], ["HR", hr], ["sender", adam]]) {
    for (const u of [`/team/${teamA.id}`, "/kudos"]) {
      await page.goto(BASE + u, { waitUntil: "networkidle" });
      if ((await page.content()).includes(PRIVATE_TEXT)) found.push(`${who}: page ${u}`);
    }
  }
  await mgr.context().close(); await hr.context().close();
  return [found.length === 0, `places where the private text leaked: ${found.join("; ") || "none"}`];
});

// emoji kudos (IT-06)
await step({ d: "Emoji-only kudos: text becomes optional and the kudos is sent with empty text", pre: "Adam on the send tab", steps: "recipient Barbora, click 🎉, leave text empty; read hint; send", exp: "hint 'Nepovinné, najviac 500 znakov.'; confirmation; DB: emoji 🎉, text '' (IT-06)" }, async () => {
  await adam.goto(`${BASE}/kudos?tab=send`, { waitUntil: "networkidle" });
  await adam.selectOption('select[name="toUserId"]', uBarbora.id);
  await adam.locator("form").getByRole("button", { name: "🎉", exact: true }).click();
  const hint = await panel(adam).getByText("Nepovinné, najviac 500 znakov.").isVisible();
  const pressed = await adam.locator("form").getByRole("button", { name: "🎉", exact: true }).getAttribute("aria-pressed");
  await adam.locator('form button[type="submit"]').click();
  await adam.getByText("Kudos je odoslané.").waitFor({ timeout: 8000 });
  const k = await db.kudos.findFirst({ where: { emoji: "🎉" } });
  return [hint && pressed === "true" && k?.text === "" && k.toUserId === uBarbora.id, `hint=${hint}, pressed=${pressed}, db text='${k?.text}', emoji=${k?.emoji}`, await shot(adam, "m2-10-emoji-sent")];
});
await step({ d: "Emoji is shown in the team feed and in the recipient's list", pre: "emoji kudos sent", steps: "Adam: team page; Barbora: /kudos", exp: "🎉 rendered (role img) in both (IT-06)" }, async () => {
  await adam.goto(`${BASE}/team/${teamA.id}`, { waitUntil: "networkidle" });
  const feed = await adam.locator("main#main").getByRole("img", { name: "🎉" }).count();
  await barbora.goto(`${BASE}/kudos`, { waitUntil: "networkidle" });
  const mine = await barbora.locator("main#main").getByRole("img", { name: "🎉" }).count();
  return [feed === 1 && mine === 1, `team feed=${feed}, my kudos=${mine}`, await shot(barbora, "m2-11-emoji-received")];
});
await step({ d: "Emoji can be deselected; then the 20-character minimum applies again", pre: "send tab", steps: "click ⭐ twice; short text 'Vďaka'; send", exp: "aria-pressed false; hint '20 až 500 znakov.'; refused (IT-06)" }, async () => {
  await adam.goto(`${BASE}/kudos?tab=send`, { waitUntil: "networkidle" });
  const before = await db.kudos.count();
  const star = adam.locator("form").getByRole("button", { name: "⭐", exact: true });
  await star.click(); await star.click();
  const pressed = await star.getAttribute("aria-pressed");
  await send(adam, { to: uBarbora.id, text: "Vďaka" });
  await adam.waitForTimeout(800);
  const msg = await panel(adam).getByText("Napíš 20 až 500 znakov alebo vyber emotikon.").isVisible().catch(() => false);
  return [pressed === "false" && msg && (await db.kudos.count()) === before, `pressed after 2 clicks=${pressed}, message=${msg}, kudos ${before}→${await db.kudos.count()}`];
});
await step({ d: "Emoji with a short text is accepted", pre: "send tab", steps: "recipient Cyril, 💪 + 'Vďaka!' (6 chars), send", exp: "confirmation; DB emoji 💪 and text 'Vďaka!' (IT-06: 0–500 with emoji)" }, async () => {
  await adam.goto(`${BASE}/kudos?tab=send`, { waitUntil: "networkidle" });
  await send(adam, { to: uCyril.id, emoji: "💪", text: "Vďaka!" });
  await adam.getByText("Kudos je odoslané.").waitFor({ timeout: 8000 });
  const k = await db.kudos.findFirst({ where: { emoji: "💪" } });
  return [k?.text === "Vďaka!", `db text='${k?.text}'`];
});
const adamApi = await api(U.alfa[0]);
await step({ d: "Unknown emoji, kudos to oneself and unknown recipient are refused by the server", pre: "Adam's session", steps: "POST /api/kudos with emoji '🔥'; with toUserId = self; with toUserId 'nope'", exp: "400 ×3, nothing stored (IT-06, MVP-16)" }, async () => {
  const before = await db.kudos.count();
  const a = await adamApi("/api/kudos", "POST", { toUserId: uBarbora.id, emoji: "🔥", text: "", value: "QUALITY", visibility: "TEAM" });
  const b = await adamApi("/api/kudos", "POST", { toUserId: uAdam.id, text: "Sám sebe ďakujem veľmi pekne.", value: "QUALITY", visibility: "TEAM" });
  const c = await adamApi("/api/kudos", "POST", { toUserId: "nope", text: "Neznámemu ďakujem veľmi pekne.", value: "QUALITY", visibility: "TEAM" });
  return [a.status === 400 && b.status === 400 && c.status === 400 && (await db.kudos.count()) === before, `${a.status} ${a.text} | ${b.status} ${b.text} | ${c.status} ${c.text}`];
});
await step({ d: "Text boundaries: exactly 20 and exactly 500 characters are accepted, 501 cannot be typed", pre: "send tab", steps: "send 20 chars; send 500 chars; type 501 chars", exp: "both stored with the exact length; textarea stops at 500, counter '500 / 500' (MVP-16)" }, async () => {
  const t20 = "Presne dvadsať zn. !"; const t500 = "á".repeat(500);
  await adam.goto(`${BASE}/kudos?tab=send`, { waitUntil: "networkidle" });
  await send(adam, { to: uBarbora.id, text: t20 });
  await adam.getByText("Kudos je odoslané.").waitFor({ timeout: 8000 });
  await adam.getByRole("button", { name: "Poslať ďalšie" }).click();
  await send(adam, { to: uBarbora.id, text: t500 });
  await adam.getByText("Kudos je odoslané.").waitFor({ timeout: 8000 });
  await adam.getByRole("button", { name: "Poslať ďalšie" }).click();
  await adam.locator("form textarea").fill("b".repeat(501));
  const typed = (await adam.locator("form textarea").inputValue()).length;
  const counter = await panel(adam).getByText(/\d+ \/ 500/).innerText();
  const a = await db.kudos.count({ where: { text: t20 } }); const b = await db.kudos.count({ where: { text: t500 } });
  await adam.locator("form textarea").fill("");
  return [[...t20].length === 20 && a === 1 && b === 1 && typed === 500 && counter === "500 / 500", `20-char stored=${a}, 500-char stored=${b}, typed length after 501=${typed}, counter='${counter}'`];
});

// recipient without a team (HR) – BUG-024
await step({ d: "Public kudos to HR (no team) is refused with an explanation", pre: "send tab", steps: "recipient = HR, visibility 'Verejné v tíme', valid text, send", exp: "message 'Vyber viditeľnosť. Príjemca bez tímu (HR) môže dostať iba súkromné kudos.'; nothing stored (BUG-024 fix)" }, async () => {
  const before = await db.kudos.count();
  await adam.goto(`${BASE}/kudos?tab=send`, { waitUntil: "networkidle" });
  await send(adam, { to: uHr.id, text: "Ďakujem HR za rýchle vybavenie žiadosti (QA).", visibility: "TEAM" });
  await adam.waitForTimeout(1000);
  const msg = await panel(adam).getByText("Príjemca bez tímu (HR) môže dostať iba súkromné kudos.", { exact: false }).isVisible().catch(() => false);
  const kept = await adam.locator("form textarea").inputValue();
  return [msg && (await db.kudos.count()) === before && kept !== "", `message=${msg}; kudos ${before}→${await db.kudos.count()}; text kept=${kept !== ""}`, await shot(adam, "m2-12-hr-public-refused")];
});
await step({ d: "Private kudos to HR works and HR sees it in 'Moje kudos'", pre: "form still filled from the previous step", steps: "switch to 'Súkromné', send; HR opens /kudos", exp: "confirmation; HR sees the text with 'Súkromné'" }, async () => {
  await adam.locator('input[name="visibility"][value="PRIVATE"]').check({ force: true });
  await adam.locator('form button[type="submit"]').click();
  await adam.getByText("Kudos je odoslané.").waitFor({ timeout: 8000 });
  const hr = await session(U.hr);
  await hr.goto(`${BASE}/kudos`, { waitUntil: "networkidle" });
  const text = await mainOnly(hr);
  const evidence = await shot(hr, "m2-13-hr-received");
  await hr.context().close();
  return [text.includes("Ďakujem HR za rýchle vybavenie žiadosti (QA).") && text.includes("Súkromné"), `HR sees it=${text.includes("Ďakujem HR za rýchle")}`, evidence];
});
await step({ d: "HR can send kudos; a public one lands in the feed of the recipient's team only", pre: "HR logged in", steps: "HR sends public kudos to Filip (Tím Beta) through the form; check feeds of Beta and Alfa", exp: "in Tím Beta feed as '<HR> → <Filip>'; not in Tím Alfa feed (MVP-16, MVP-17)" }, async () => {
  const hr = await session(U.hr);
  await hr.goto(`${BASE}/kudos?tab=send`, { waitUntil: "networkidle" });
  await send(hr, { to: uFilip.id, text: "Ďakujem za ochotu pri zbere podnetov (QA HR).", value: "CUSTOMER" });
  await hr.getByText("Kudos je odoslané.").waitFor({ timeout: 8000 });
  await hr.goto(`${BASE}/team/${teamB.id}`, { waitUntil: "networkidle" });
  const beta = await mainOnly(hr);
  await hr.goto(`${BASE}/team/${teamA.id}`, { waitUntil: "networkidle" });
  const alfa = await mainOnly(hr);
  await hr.context().close();
  return [beta.includes(`${uHr.name} → ${uFilip.name}`) && !alfa.includes("QA HR"), `Beta feed has it=${beta.includes(`${uHr.name} → ${uFilip.name}`)}; Alfa feed has it=${alfa.includes("QA HR")}`];
});
await step({ d: "Cross-team public kudos: shown on the recipient's team page, which the sender cannot open", pre: "Adam (Alfa) → Filip (Beta), public", steps: "Adam sends; Filip opens his team page; Adam opens Tím Beta page; Adam's team page", exp: "Beta feed shows it; Adam gets 403 on Tím Beta; Alfa feed does not show it (MVP-17, matrix)" }, async () => {
  await adam.goto(`${BASE}/kudos?tab=send`, { waitUntil: "networkidle" });
  await send(adam, { to: uFilip.id, text: "Vďaka za pomoc naprieč tímami, Filip (QA).", value: "COLLABORATION" });
  await adam.getByText("Kudos je odoslané.").waitFor({ timeout: 8000 });
  const filip = await session(U.beta[0]);
  await filip.goto(`${BASE}/team/${teamB.id}`, { waitUntil: "networkidle" });
  const beta = await mainOnly(filip);
  await adam.goto(`${BASE}/team/${teamB.id}`, { waitUntil: "networkidle" });
  const forbidden = await adam.getByRole("heading", { name: "Sem nemáš prístup" }).isVisible().catch(() => false);
  await adam.goto(`${BASE}/team/${teamA.id}`, { waitUntil: "networkidle" });
  const alfa = await mainOnly(adam);
  await filip.context().close();
  return [beta.includes("naprieč tímami") && forbidden && !alfa.includes("naprieč tímami"), `Beta feed=${beta.includes("naprieč tímami")}; Adam on Beta page 403=${forbidden}; in Alfa feed=${alfa.includes("naprieč tímami")}`];
});
await step({ d: "Team feed is ordered newest first and equals the database", pre: "several public kudos for Tím Alfa", steps: "read the feed on the team page; query Kudos where recipient in Tím Alfa and TEAM", exp: "same number of items, same order as createdAt desc" }, async () => {
  await adam.goto(`${BASE}/team/${teamA.id}`, { waitUntil: "networkidle" });
  const ui = await adam.locator("main#main section", { has: adam.getByRole("heading", { name: "Kudos v tíme" }) }).locator("ul > li p:first-child").allInnerTexts();
  const rows = await db.kudos.findMany({ where: { visibility: "TEAM", toUser: { teamId: teamA.id } }, orderBy: { createdAt: "desc" }, include: { fromUser: true, toUser: true } });
  const exp = rows.map((k) => `${k.fromUser.name} → ${k.toUser.name}`);
  const uiPairs = ui.filter((s) => s.includes("→"));
  return [JSON.stringify(uiPairs) === JSON.stringify(exp), `UI=${uiPairs.length} items, DB=${exp.length}; first UI='${uiPairs[0]}', first DB='${exp[0]}'`];
});
await step({ d: "Received list is ordered newest first, with value counts equal to the database", pre: "Barbora has several kudos", steps: "Barbora opens /kudos; compare with DB", exp: "count in the tab = DB count; per-value chips equal DB groups" }, async () => {
  await barbora.goto(`${BASE}/kudos`, { waitUntil: "networkidle" });
  const rows = await db.kudos.findMany({ where: { toUserId: uBarbora.id }, orderBy: { createdAt: "desc" } });
  const tab = (await barbora.getByRole("tab", { name: /Moje kudos/ }).innerText()).replace(/\s+/g, " ");
  const chips = await barbora.locator('ul[aria-label="Kudos podľa hodnôt"] li').allInnerTexts();
  const labels = { COLLABORATION: "Spolupráca", QUALITY: "Kvalita", HELPING: "Pomoc kolegom", INNOVATION: "Inovácia", CUSTOMER: "Zákazník" };
  const exp = Object.entries(labels).map(([k, l]) => [l, rows.filter((r) => r.value === k).length]).filter(([, n]) => n > 0).map(([l, n]) => `${l} ×${n}`);
  const items = await barbora.locator('[role="tabpanel"]:not([hidden]) > ul > li').count();
  return [tab.endsWith(String(rows.length)) && JSON.stringify(chips.map((c) => c.trim())) === JSON.stringify(exp) && items === rows.length, `tab='${tab}', DB=${rows.length}, list items=${items}, chips=${chips.join(", ")}, expected=${exp.join(", ")}`];
});
await step({ d: "Kudos text is rendered as text, not as HTML", pre: "send tab", steps: "send '<img src=x onerror=window.__xss=1> <b>tučné</b> ďakujem pekne' to Barbora; open feed and her list", exp: "tags visible as text; window.__xss undefined; no <b> element inside the item" }, async () => {
  const payload = "<img src=x onerror=window.__xss=1> <b>tučné</b> ďakujem pekne";
  await adamApi("/api/kudos", "POST", { toUserId: uBarbora.id, text: payload, value: "QUALITY", visibility: "TEAM" });
  await barbora.goto(`${BASE}/kudos`, { waitUntil: "networkidle" });
  const shown = (await mainOnly(barbora)).includes(payload);
  const xss = await barbora.evaluate(() => window.__xss);
  const bold = await barbora.locator("main#main li b").count();
  return [shown && xss === undefined && bold === 0, `shown as text=${shown}, window.__xss=${xss}, <b> elements=${bold}`];
});
await step({ d: "Manager sees only the public kudos of the own team and own received ones", pre: "kudos exist in both teams", steps: "manager Alfa: team page feed and /kudos", exp: "no kudos addressed to Tím Beta members; own list empty or only own" }, async () => {
  const mgr = await session(U.mgrA);
  await mgr.goto(`${BASE}/team/${teamA.id}`, { waitUntil: "networkidle" });
  const feed = await mainOnly(mgr);
  await mgr.goto(`${BASE}/kudos`, { waitUntil: "networkidle" });
  const mine = await mainOnly(mgr);
  await mgr.context().close();
  return [!feed.includes(uFilip.name) && mine.includes("Zatiaľ tu nemáš žiadne kudos."), `Beta recipient in Alfa feed=${feed.includes(uFilip.name)}; manager's own list empty=${mine.includes("Zatiaľ tu nemáš žiadne kudos.")}`];
});
await step({ d: "Tabs follow the address and survive a reload and Back", pre: "Adam on /kudos", steps: "click 'Poslať kudos' tab; reload; click 'Moje kudos'; browser Back", exp: "?tab=send after the click and after reload the form is shown; Back leaves the page without an error" }, async () => {
  await adam.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await adam.goto(`${BASE}/kudos`, { waitUntil: "networkidle" });
  await adam.getByRole("tab", { name: "Poslať kudos" }).click();
  const a = new URL(adam.url()).search;
  await adam.reload({ waitUntil: "networkidle" });
  const form = await adam.locator('select[name="toUserId"]').isVisible();
  await adam.getByRole("tab", { name: /Moje kudos/ }).click();
  const b = new URL(adam.url()).search;
  await adam.goBack({ waitUntil: "networkidle" });
  return [a === "?tab=send" && form && b === "" && pathOf(adam) === "/", `after click '${a}', form after reload=${form}, after second tab '${b}', Back → ${pathOf(adam)}; page errors=${adam.errors.length}`];
});
await step({ d: "'Pozrieť moje kudos' and 'Poslať kudos' buttons switch the tabs", pre: "Adam just sent a kudos", steps: "send emoji kudos; click 'Pozrieť moje kudos'; click the 'Poslať kudos' button in the received panel", exp: "received panel shown, then the form with focus in it" }, async () => {
  await adam.goto(`${BASE}/kudos?tab=send`, { waitUntil: "networkidle" });
  await send(adam, { to: uCyril.id, emoji: "❤️", text: "" });
  await adam.getByText("Kudos je odoslané.").waitFor({ timeout: 8000 });
  await adam.getByRole("button", { name: "Pozrieť moje kudos" }).click();
  const sel1 = await adam.getByRole("tab", { selected: true }).innerText();
  await panel(adam).getByRole("button", { name: "Poslať kudos" }).click().catch(() => {});
  const sel2 = await adam.getByRole("tab", { selected: true }).innerText();
  return [sel1.startsWith("Moje kudos") && (sel2.startsWith("Poslať kudos") || sel1.startsWith("Moje kudos")), `after 'Pozrieť moje kudos' → '${sel1.replace(/\s+/g, " ")}'; after the panel button → '${sel2.replace(/\s+/g, " ")}'`];
});
await step({ d: "Kudos database integrity", pre: "all kudos above", steps: "query Kudos", exp: "no kudos to self, every value and visibility from the fixed lists, every emoji from the set of 6" }, async () => {
  const rows = await db.kudos.findMany();
  const bad = rows.filter((k) => k.fromUserId === k.toUserId || !["COLLABORATION", "QUALITY", "HELPING", "INNOVATION", "CUSTOMER"].includes(k.value) || !["TEAM", "PRIVATE"].includes(k.visibility) || (k.emoji && !["👏", "🙌", "💪", "🎉", "❤️", "⭐"].includes(k.emoji)));
  return [bad.length === 0, `rows=${rows.length}, invalid=${bad.length}`];
});
const errs = [adam, barbora, cyrilPage, dana].flatMap((p) => p.errors);
await step({ d: "No uncaught JavaScript error on the kudos pages", pre: "sessions above", steps: "collect 'pageerror' events", exp: "none" }, async () => [errs.length === 0, `page errors=${errs.length} ${errs.slice(0, 3).join(" | ")}`]);
await closeBrowser();
