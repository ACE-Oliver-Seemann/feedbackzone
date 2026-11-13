// Journey 3: kudos end to end (MVP-16, MVP-17, IT-06) with DB verification.
import { BASE, U, db, resetDb, recorder, session, shot, mainText, api, fmtDate, closeBrowser } from "./lib.mjs";

const R = recorder("j3-kudos");
const step = async (meta, fn) => {
  try { const [ok, actual, evidence] = await fn(); return R.check({ j: "J3", ...meta }, ok, actual, evidence ?? ""); }
  catch (error) { return R.check({ j: "J3", ...meta }, false, `SCRIPT/RUNTIME ERROR: ${error.message}`); }
};
resetDb(false);
const user = async (email) => db.user.findUniqueOrThrow({ where: { email } });
const adamU = await user(U.alfa[0]); const barbU = await user(U.alfa[1]); const filipU = await user(U.beta[0]);
const hrU = await user(U.hr); const mgrAU = await user(U.mgrA);
const teamA = await db.team.findFirstOrThrow({ where: { name: "Tím Alfa" } });
const teamB = await db.team.findFirstOrThrow({ where: { name: "Tím Beta" } });

const adam = await session(U.alfa[0], { width: 390, height: 844 });
const form = {
  to: (p, label) => p.locator('select[name="toUserId"]').selectOption({ label }),
  text: (p, v) => p.locator("form textarea").fill(v),
  send: (p) => p.getByRole("button", { name: "Poslať kudos" }).click(),
};
const T20 = "Vďaka za pomoc s QA.";  // exactly 20 characters
const PRIV_TEXT = "QA súkromné kudos – toto smie vidieť iba príjemca.";
const PUB2 = "QA verejné kudos pre kolegu z iného tímu <script>alert(1)</script>.";

await step({ d: "Kudos area opens from the menu; sender is told the kudos is signed", pre: "Adam logged in (390 px)", steps: "click 'Kudos' in the menu", exp: "/kudos/new, heading 'Poslať kudos', 'Kudos je podpísané tvojím menom.', tabs Poslať kudos / Moje kudos (MVP-16, IT-12)" }, async () => {
  await adam.locator("header nav").getByRole("link", { name: "Kudos" }).click();
  await adam.getByRole("heading", { name: "Poslať kudos" }).waitFor();
  const text = await mainText(adam);
  const tabs = await adam.getByRole("navigation", { name: "Kudos" }).getByRole("link").allInnerTexts();
  return [new URL(adam.url()).pathname === "/kudos/new" && text.includes("Kudos je podpísané tvojím menom.") && tabs.join() === "Poslať kudos,Moje kudos", `tabs=${tabs}`, await shot(adam, "j3-01-kudos-form")];
});
await step({ d: "Recipient list contains everyone except the sender, with team names", pre: "form open", steps: "read the options; compare with User table", exp: "12 people (13 users − self), own name absent, e.g. 'Filip Vzorka (Tím Beta)', HR without a team (MVP-16)" }, async () => {
  const options = (await adam.locator('select[name="toUserId"] option').allInnerTexts()).slice(1);
  const users = await db.user.count();
  return [options.length === users - 1 && !options.some((o) => o.includes("Adam Vzorový")) && options.includes("Filip Vzorka (Tím Beta)") && options.includes("Hana Personálna"), `options=${options.length}: ${options.join(", ")}`];
});
await step({ d: "Empty form is refused with field messages", pre: "form untouched", steps: "click 'Poslať kudos'", exp: "'Vyber kolegu (sebe sa kudos poslať nedá).' and 'Napíš 20 až 500 znakov alebo vyber emotikon.'; no Kudos row" }, async () => {
  await form.send(adam);
  await adam.getByText("Vyber kolegu (sebe sa kudos poslať nedá).").waitFor();
  const t = await adam.getByText("Napíš 20 až 500 znakov alebo vyber emotikon.").isVisible();
  const n = await db.kudos.count();
  return [t && n === 0, `text error=${t}, kudos rows=${n}`, await shot(adam, "j3-02-empty-errors")];
});
await step({ d: "Text of 19 characters without an emoji is refused and the typed data stays in the form", pre: "recipient Barbora", steps: "type 19 chars, send", exp: "text error; no row; textarea and recipient keep their values (MVP-16)" }, async () => {
  await form.to(adam, "Barbora Skúšobná (Tím Alfa)");
  await form.text(adam, T20.slice(0, 19));
  await form.send(adam);
  await adam.getByText("Napíš 20 až 500 znakov alebo vyber emotikon.").waitFor();
  const kept = await adam.locator("form textarea").inputValue();
  const to = await adam.locator('select[name="toUserId"]').inputValue();
  const n = await db.kudos.count();
  return [n === 0 && kept === T20.slice(0, 19) && to === barbU.id, `rows=${n}, text kept='${kept}', recipient kept=${to === barbU.id}`];
});
await step({ d: "Public text kudos with exactly 20 characters is sent and stored", pre: "recipient Barbora, value Kvalita, visibility Verejné v tíme", steps: "type 20 chars, pick 'Kvalita', send", exp: "'Kudos je odoslané.'; DB: from Adam, to Barbora, text, QUALITY, TEAM, emoji NULL (MVP-16)" }, async () => {
  await form.text(adam, T20);
  await adam.locator('select[name="value"]').selectOption("QUALITY");
  await form.send(adam);
  await adam.getByText("Kudos je odoslané.").waitFor();
  const k = await db.kudos.findMany();
  const x = k[0];
  return [k.length === 1 && x.fromUserId === adamU.id && x.toUserId === barbU.id && x.text === T20 && x.value === "QUALITY" && x.visibility === "TEAM" && x.emoji === null, JSON.stringify(x), await shot(adam, "j3-03-sent")];
});
await step({ d: "Form is cleared after sending", pre: "kudos just sent", steps: "read the form fields", exp: "text empty, counter '0 / 500', recipient placeholder, no emoji pressed" }, async () => {
  const text = await adam.locator("form textarea").inputValue();
  const to = await adam.locator('select[name="toUserId"]').inputValue();
  const pressed = await adam.locator('form button[aria-pressed="true"]').count();
  const counter = await adam.getByText(/\d+ \/ 500/).innerText();
  return [text === "" && to === "" && pressed === 0 && counter === "0 / 500", `text='${text}', recipient='${to}', pressed emojis=${pressed}, counter='${counter}'`];
});
await step({ d: "Emoji-only private kudos (no text)", pre: "form cleared", steps: "recipient Barbora, click 👏, choose 'Súkromné', send", exp: "hint 'Nepovinné, najviac 500 znakov.'; sent; DB: emoji 👏, text '', PRIVATE (IT-06)" }, async () => {
  await form.to(adam, "Barbora Skúšobná (Tím Alfa)");
  await adam.getByRole("button", { name: "👏" }).click();
  const hint = await adam.getByText("Nepovinné, najviac 500 znakov.").isVisible();
  await adam.locator('input[name="visibility"][value="PRIVATE"]').check();
  await form.send(adam);
  await adam.getByText("Kudos je odoslané.").waitFor();
  const x = await db.kudos.findFirst({ where: { visibility: "PRIVATE" } });
  return [hint && x && x.emoji === "👏" && x.text === "" && x.toUserId === barbU.id && x.fromUserId === adamU.id, `hint=${hint}; row=${JSON.stringify(x)}`];
});
await step({ d: "Private kudos with text", pre: "-", steps: "recipient Barbora, text, 'Súkromné', value 'Pomoc kolegom', send", exp: "DB row PRIVATE with the text" }, async () => {
  await form.to(adam, "Barbora Skúšobná (Tím Alfa)");
  await form.text(adam, PRIV_TEXT);
  await adam.locator('select[name="value"]').selectOption("HELPING");
  await adam.locator('input[name="visibility"][value="PRIVATE"]').check();
  await form.send(adam);
  await adam.getByText("Kudos je odoslané.").waitFor();
  const x = await db.kudos.findFirst({ where: { text: PRIV_TEXT } });
  return [x?.visibility === "PRIVATE" && x.value === "HELPING", JSON.stringify(x)];
});
await step({ d: "Public kudos with emoji + text (incl. HTML-like text) to a colleague in another team", pre: "-", steps: "recipient Filip (Tím Beta), ⭐, text with <script>, value Inovácia, public, send", exp: "DB row TEAM, emoji ⭐, text stored verbatim" }, async () => {
  await form.to(adam, "Filip Vzorka (Tím Beta)");
  await adam.getByRole("button", { name: "⭐" }).click();
  await form.text(adam, PUB2);
  await adam.locator('select[name="value"]').selectOption("INNOVATION");
  await form.send(adam);
  await adam.getByText("Kudos je odoslané.").waitFor();
  const x = await db.kudos.findFirst({ where: { toUserId: filipU.id } });
  return [x?.emoji === "⭐" && x.text === PUB2 && x.visibility === "TEAM" && x.value === "INNOVATION", JSON.stringify(x)];
});
await step({ d: "Text longer than 500 characters cannot be typed; exactly 500 is accepted", pre: "-", steps: "fill 520 characters → read counter; send to Barbora", exp: "counter '500 / 500'; DB row with 500 characters" }, async () => {
  await form.to(adam, "Barbora Skúšobná (Tím Alfa)");
  await form.text(adam, "k".repeat(520));
  const counter = await adam.getByText(/\d+ \/ 500/).innerText();
  await form.send(adam);
  await adam.getByText("Kudos je odoslané.").waitFor();
  const x = await db.kudos.findFirst({ where: { text: { startsWith: "kkkk" } } });
  return [counter === "500 / 500" && x?.text.length === 500, `counter='${counter}', stored length=${x?.text.length}`];
});
await step({ d: "Whitespace-only text (25 spaces) is treated as empty", pre: "-", steps: "recipient Barbora, 25 spaces, send", exp: "text error, no new row" }, async () => {
  const before = await db.kudos.count();
  await form.to(adam, "Barbora Skúšobná (Tím Alfa)");
  await form.text(adam, " ".repeat(25));
  await form.send(adam);
  await adam.getByText("Napíš 20 až 500 znakov alebo vyber emotikon.").waitFor();
  return [(await db.kudos.count()) === before, `rows before=${before}, after=${await db.kudos.count()}`];
});
const adamApi = await api(U.alfa[0]);
await step({ d: "Server refuses kudos to oneself, an unknown emoji, an unknown recipient, 501 characters and an unknown value", pre: "Adam's session", steps: "5× POST /api/kudos with one invalid field each", exp: "400 each with the field name; no new rows (MVP-16, IT-06)" }, async () => {
  const before = await db.kudos.count();
  const base = { toUserId: barbU.id, text: "QA text dlhý aspoň dvadsať znakov.", value: "QUALITY", visibility: "TEAM" };
  const res = [
    await adamApi("/api/kudos", "POST", { ...base, toUserId: adamU.id }),
    await adamApi("/api/kudos", "POST", { ...base, emoji: "🔥" }),
    await adamApi("/api/kudos", "POST", { ...base, toUserId: "no-such-user" }),
    await adamApi("/api/kudos", "POST", { ...base, text: "x".repeat(501) }),
    await adamApi("/api/kudos", "POST", { ...base, value: "MONEY" }),
  ];
  const after = await db.kudos.count();
  return [res.every((r) => r.status === 400) && after === before, res.map((r) => `${r.status} ${JSON.stringify(r.json?.fields)}`).join("; ") + `; rows ${before}→${after}`];
});

// ───── who sees what
await step({ d: "Team feed (sender's own team) shows the public kudos, newest first, signed, and no private ones", pre: "Adam sent to Barbora: 1 public text, 1 public 500-char, 2 private", steps: "Adam opens Môj tím", exp: "feed has exactly the 2 public kudos for Alfa members: 'Adam Vzorový → Barbora Skúšobná' with badge 'Kvalita' and today's date; private text and 👏 absent (MVP-17)" }, async () => {
  await adam.goto(`${BASE}/team/${teamA.id}`);
  const section = adam.locator("section", { has: adam.getByRole("heading", { name: "Kudos v tíme" }) });
  const items = await section.locator("ul > li").allInnerTexts();
  const html = await adam.content();
  const dbPublic = await db.kudos.findMany({ where: { visibility: "TEAM", toUser: { teamId: teamA.id } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  const ok = items.length === dbPublic.length && items.length === 2 && items.every((i) => i.includes("Adam Vzorový → Barbora Skúšobná") && i.includes(fmtDate(new Date()))) && items[1].includes(T20) && items[1].includes("Kvalita") && !html.includes("QA súkromné") && !html.includes("👏");
  return [ok, `feed items=${items.length} (DB public for Alfa=${dbPublic.length}); private text in HTML=${html.includes("QA súkromné")}; 👏 in HTML=${html.includes("👏")}`, await shot(adam, "j3-04-team-feed")];
});
await step({ d: "Kudos sent to another team is not in the sender's team feed (it belongs to the recipient's team page)", pre: "Adam sent public kudos to Filip (Beta)", steps: "look for it on Alfa's team page", exp: "absent on Alfa's page (MVP-17: feed = public kudos of the team's members)" }, async () => {
  const html = await adam.content();
  return [!html.includes("QA verejné kudos pre kolegu z iného tímu"), `present on Alfa page=${html.includes("QA verejné kudos pre kolegu z iného tímu")}`];
});
await step({ d: "Sender's own view: 'Moje kudos' lists only received kudos", pre: "Adam sent 5, received 0", steps: "Adam: tab 'Moje kudos'", exp: "'Zatiaľ tu nemáš žiadne kudos.' (the spec has no 'sent' list; see informational note)" }, async () => {
  await adam.goto(`${BASE}/kudos/new`);
  await adam.getByRole("navigation", { name: "Kudos" }).getByRole("link", { name: "Moje kudos" }).click();
  await adam.getByRole("heading", { name: "Moje kudos" }).waitFor();
  const text = await mainText(adam);
  return [text.includes("Zatiaľ tu nemáš žiadne kudos."), text.slice(-120), await shot(adam, "j3-05-sender-my-kudos")];
});
const barb = await session(U.alfa[1], { width: 360, height: 740 });
await step({ d: "Recipient sees all four kudos (public and private) in 'Moje kudos', newest first, with sender, value, visibility and emoji", pre: "Barbora received 2 public + 2 private from Adam", steps: "Barbora (360 px): Kudos → Moje kudos; compare with DB", exp: "4 cards 'Od: Adam Vzorový'; visibility badges 2× 'Verejné v tíme', 2× 'Súkromné'; 👏 shown; order = createdAt desc (MVP-17, IT-06)" }, async () => {
  await barb.goto(`${BASE}/kudos/me`);
  const items = await barb.locator("main ul > li").allInnerTexts();
  const rows = await db.kudos.findMany({ where: { toUserId: barbU.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  const orderOk = rows.every((r, i) => (r.text ? items[i].includes(r.text.slice(0, 30)) : items[i].includes(r.emoji)));
  const pub = items.filter((i) => i.includes("Verejné v tíme")).length; const priv = items.filter((i) => i.includes("Súkromné")).length;
  const overflow = await barb.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  return [items.length === 4 && rows.length === 4 && orderOk && pub === 2 && priv === 2 && items.every((i) => i.includes("Od: Adam Vzorový")), `cards=${items.length}, DB=${rows.length}, order matches DB=${orderOk}, public=${pub}, private=${priv}, horizontal overflow at 360px=${overflow}`, await shot(barb, "j3-06-recipient-my-kudos-360")];
});
await step({ d: "'Moje kudos' at 360 px has no horizontal overflow even with a 500-character unbroken word", pre: "Barbora's list contains a 500-char text without spaces", steps: "compare scrollWidth and clientWidth", exp: "no horizontal page scroll (NFR-07)" }, async () => {
  const m = await barb.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  return [m.s <= m.c, `scrollWidth=${m.s}, clientWidth=${m.c}`, await shot(barb, "j3-07-long-word-360")];
});
const mgrA = await session(U.mgrA);
const hr = await session(U.hr);
await step({ d: "Manager of the recipient's team cannot see the private kudos anywhere", pre: "2 private kudos Adam → Barbora", steps: "manager Alfa: team page, Moje kudos; raw HTML search; GET /api/kudos/me and /api/teams/:id/summary", exp: "private text and 👏 absent from pages and API responses (MVP-17)" }, async () => {
  await mgrA.goto(`${BASE}/team/${teamA.id}`);
  const h1 = await mgrA.content();
  await mgrA.goto(`${BASE}/kudos/me`);
  const h2 = await mgrA.content();
  const a = await api(U.mgrA);
  const me = await a("/api/kudos/me"); const sum = await a(`/api/teams/${teamA.id}/summary`);
  const leak = [h1, h2, me.text, sum.text].map((t) => t.includes("QA súkromné") || t.includes("👏") || t.includes('"PRIVATE"'));
  return [leak.every((l) => !l) && sum.json.kudos.length === 2 && me.json.kudos.length === 0, `leaks [teamPage, myKudos, api me, api summary]=${leak}; summary kudos=${sum.json.kudos.length}; manager's own=${me.json.kudos.length}`, await shot(mgrA, "j3-08-mgr-team-feed")];
});
await step({ d: "HR cannot see the private kudos anywhere", pre: "as above", steps: "HR: team page of Alfa; Moje kudos; API summary of both teams; GET /api/kudos/me", exp: "private text and 👏 absent everywhere (MVP-17)" }, async () => {
  await hr.goto(`${BASE}/team/${teamA.id}`);
  const h1 = await hr.content();
  await hr.goto(`${BASE}/kudos/me`);
  const h2 = await hr.content();
  const a = await api(U.hr);
  const s1 = await a(`/api/teams/${teamA.id}/summary`); const s2 = await a(`/api/teams/${teamB.id}/summary`); const me = await a("/api/kudos/me");
  const leak = [h1, h2, s1.text, s2.text, me.text].map((t) => t.includes("QA súkromné") || t.includes("👏") || t.includes('"PRIVATE"'));
  return [leak.every((l) => !l), `leaks=${leak}`, await shot(hr, "j3-09-hr-my-kudos")];
});
await step({ d: "There is no API through which another user can read someone's received kudos", pre: "-", steps: "Adam: GET /api/kudos/me?userId=<Barbora>, GET /api/kudos, GET /api/kudos/<id>", exp: "own (empty) list / 404 / 405 – never Barbora's private kudos" }, async () => {
  const priv = await db.kudos.findFirst({ where: { text: PRIV_TEXT } });
  const r1 = await adamApi(`/api/kudos/me?userId=${barbU.id}`); const r2 = await adamApi("/api/kudos"); const r3 = await adamApi(`/api/kudos/${priv.id}`);
  const leak = [r1, r2, r3].some((r) => r.text.includes("QA súkromné"));
  return [!leak && r1.json.kudos.length === 0 && [404, 405].includes(r2.status) && r3.status === 404, `me?userId → ${r1.status} (${r1.json?.kudos?.length} items); GET /api/kudos → ${r2.status}; GET /api/kudos/:id → ${r3.status}; leak=${leak}`];
});
const filip = await session(U.beta[0]);
await step({ d: "Recipient in another team sees the kudos in 'Moje kudos' and on the Beta team feed; script text is shown as text", pre: "Adam → Filip public with ⭐ and '<script>' in the text", steps: "Filip: Moje kudos; Môj tím", exp: "card 'Od: Adam Vzorový' with ⭐; Beta feed 'Adam Vzorový → Filip Vzorka'; no script executed, no dialog" }, async () => {
  let dialogs = 0; filip.on("dialog", () => dialogs++);
  await filip.goto(`${BASE}/kudos/me`);
  const mine = await filip.locator("main ul > li").allInnerTexts();
  await filip.goto(`${BASE}/team/${teamB.id}`);
  const feed = await filip.locator("section", { has: filip.getByRole("heading", { name: "Kudos v tíme" }) }).locator("ul > li").allInnerTexts();
  const scripts = await filip.locator("main script").count();
  return [mine.length === 1 && mine[0].includes("Od: Adam Vzorový") && mine[0].includes("⭐") && mine[0].includes("<script>alert(1)</script>") && feed.length === 1 && feed[0].includes("Adam Vzorový → Filip Vzorka") && dialogs === 0 && scripts === 0, `mine=${JSON.stringify(mine)}; feed=${feed.length}; dialogs=${dialogs}`, await shot(filip, "j3-10-beta-feed")];
});
await step({ d: "HR sends public kudos to a manager; it shows on that team's feed", pre: "HR logged in", steps: "HR: Kudos → recipient 'Alena Testová (Tím Alfa)', 🎉, text, send; open team Alfa", exp: "DB row from HR; feed shows 'Hana Personálna → Alena Testová' first (matrix: everyone can send)" }, async () => {
  await hr.goto(`${BASE}/kudos/new`);
  await form.to(hr, "Alena Testová (Tím Alfa)");
  await hr.getByRole("button", { name: "🎉" }).click();
  await form.text(hr, "QA: ďakujem za rýchly krok po kole.");
  await form.send(hr);
  await hr.getByText("Kudos je odoslané.").waitFor();
  await hr.goto(`${BASE}/team/${teamA.id}`);
  const first = await hr.locator("section", { has: hr.getByRole("heading", { name: "Kudos v tíme" }) }).locator("ul > li").first().innerText();
  const x = await db.kudos.findFirst({ where: { fromUserId: hrU.id } });
  return [x?.toUserId === mgrAU.id && first.includes("Hana Personálna → Alena Testová") && first.includes("🎉"), `row=${JSON.stringify(x)}; first feed item='${first.replace(/\s+/g, " ")}'`, await shot(hr, "j3-11-hr-kudos-in-feed")];
});
await step({ d: "Public kudos sent to HR (who has no team): is it shown on any 'team page of the recipient' as the form promises?", pre: "HR has teamId NULL", steps: "Adam sends public kudos to 'Hana Personálna' (form hint: 'Zobrazí sa na stránke tímu príjemcu.'); check both team feeds and HR's Moje kudos", exp: "the kudos is visible on a team page as the hint says, or the form does not offer 'public' for a recipient without a team" }, async () => {
  await adam.goto(`${BASE}/kudos/new`);
  await form.to(adam, "Hana Personálna");
  await form.text(adam, "QA verejné kudos pre HR bez tímu.");
  const hint = await adam.getByText("Zobrazí sa na stránke tímu príjemcu.").isVisible();
  await form.send(adam);
  await adam.getByText("Kudos je odoslané.").waitFor();
  const a = await api(U.hr);
  const s1 = await a(`/api/teams/${teamA.id}/summary`); const s2 = await a(`/api/teams/${teamB.id}/summary`); const me = await a("/api/kudos/me");
  const onFeed = s1.text.includes("QA verejné kudos pre HR") || s2.text.includes("QA verejné kudos pre HR");
  const inMine = me.text.includes("QA verejné kudos pre HR");
  const row = await db.kudos.findFirst({ where: { toUserId: hrU.id } });
  return [onFeed, `hint shown=${hint}; stored visibility=${row.visibility}; on any team feed=${onFeed}; in HR 'Moje kudos'=${inMine} (labelled 'Verejné v tíme')`, await shot(adam, "j3-12-public-to-hr")];
});
await step({ d: "Kudos total in DB equals the number of successful sends (no duplicates, no lost rows)", pre: "7 successful sends in this journey", steps: "count Kudos rows", exp: "7" }, async () => {
  const n = await db.kudos.count();
  return [n === 7, `rows=${n}`];
});
await step({ d: "Unauthenticated request cannot send or read kudos", pre: "no cookie", steps: "POST /api/kudos, GET /api/kudos/me without a session", exp: "401 for both" }, async () => {
  const r1 = await fetch(`${BASE}/api/kudos`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const r2 = await fetch(`${BASE}/api/kudos/me`);
  return [r1.status === 401 && r2.status === 401, `POST ${r1.status}, GET ${r2.status}`];
});

console.log(`\nJ3 done: ${R.rows.length} checks, ${R.rows.filter((r) => r.status === "FAIL").length} failed`);
await closeBrowser();
