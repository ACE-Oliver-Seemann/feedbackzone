// Session 2026-11-12_002, section F: several users at once (separate browser contexts), races on
// the same round, stale tabs and data isolation between teams. Starts from a seed-only database.
import {
  BASE, U, db, resetDb, recorder, stepper, session, shot, mainOnly, api, pathOf, teams, ymd, DAY,
  apiRound, apiRespond, wizard, toast, rowById, closeBrowser,
} from "./lib.mjs";

const R = recorder("m5-multi");
const step = stepper(R, { j: "F" });
resetDb(false);
const { A: teamA, B: teamB } = await teams();
const mgrAApi = await api(U.mgrA); const mgrBApi = await api(U.mgrB); const hrApi = await api(U.hr);
const counts = async (id) => `${await db.response.count({ where: { roundId: id } })}/${await db.participation.count({ where: { roundId: id } })}`;

// ───── simultaneous submissions
const r1 = await apiRound(mgrAApi, { teamId: teamA.id, name: "Pulse – súbeh QA" });
const pages = [];
for (let i = 0; i < 5; i++) pages.push(await session(U.alfa[i], i === 0 ? { width: 360, height: 740 } : { width: 1280, height: 800 }));
const sent = [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 1], [4, 5, 1, 2], [5, 1, 2, 3]];
await step({ d: "Five members press 'Odoslať' at the same moment in five browsers", pre: "round open; each member on the last step with different answers", steps: "click Odoslať in all five within the same tick", exp: "five thank-you screens; 5 responses and 5 participations; the multiset of stored answers equals what was sent (MVP-09)" }, async () => {
  await Promise.all(pages.map((p, i) => wizard(p, r1, sent[i], `Súbežný komentár ${i + 1} (QA).`, { submit: false })));
  await Promise.all(pages.map((p) => p.getByRole("button", { name: "Odoslať" }).click()));
  await Promise.all(pages.map((p) => p.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 15000 })));
  const rows = await db.response.findMany({ where: { roundId: r1 } });
  const stored = rows.map((r) => [r.v1, r.v2, r.v3, r.v4].join("")).sort().join(",");
  const exp = sent.map((a) => a.join("")).sort().join(",");
  return [stored === exp && (await counts(r1)) === "5/5", `responses/participations=${await counts(r1)}; stored=${stored}`, await shot(pages[0], "m5-01-simultaneous")];
});
await step({ d: "NFR-01 after simultaneous submissions: stored order gives no hint who sent what", pre: "5 responses", steps: "SELECT rowid FROM Response; read rows in table order; compare with participation order", exp: "no rowid (WITHOUT ROWID); rows come out ordered by the random UUID" }, async () => {
  let rowid = "available";
  try { await db.$queryRawUnsafe(`SELECT rowid FROM "Response" LIMIT 1`); } catch { rowid = "not available"; }
  let prow = "available";
  try { await db.$queryRawUnsafe(`SELECT rowid FROM "Participation" LIMIT 1`); } catch { prow = "not available"; }
  const ids = (await db.$queryRawUnsafe(`SELECT id FROM "Response" WHERE roundId = '${r1}'`)).map((r) => r.id);
  const sorted = [...ids].sort().join() === ids.join();
  return [rowid === "not available" && prow === "not available" && sorted, `Response.rowid ${rowid}; Participation.rowid ${prow}; table order = UUID order: ${sorted}`];
});
await step({ d: "The manager's list shows the participation of the moment after a reload", pre: "5 of 6 answered", steps: "manager Alfa opens /rounds; HR opens /hr/rounds", exp: "'5 z 6' in both rows" }, async () => {
  const m = await session(U.mgrA); const h = await session(U.hr);
  await m.goto(`${BASE}/rounds`, { waitUntil: "networkidle" }); await h.goto(`${BASE}/hr/rounds`, { waitUntil: "networkidle" });
  const a = (await rowById(m, r1).innerText()).includes("5 z 6"); const b = (await rowById(h, r1).innerText()).includes("5 z 6");
  await m.context().close(); await h.context().close();
  return [a && b, `manager row=${a}, HR row=${b}`];
});
const r2 = await apiRound(mgrAApi, { teamId: teamA.id, name: "Pulse – dve karty QA" });
await step({ d: "The same member submits from two tabs at the same moment", pre: "Adam has the round on the last step in two tabs of one browser", steps: "click Odoslať in both tabs together", exp: "exactly 1 response and 1 participation; one tab thanks, the other says the round is already filled in" }, async () => {
  const t1 = pages[0]; const t2 = await t1.context().newPage();
  await wizard(t1, r2, [1, 1, 1, 1], "", { submit: false }); await wizard(t2, r2, [5, 5, 5, 5], "", { submit: false });
  await Promise.all([t1.getByRole("button", { name: "Odoslať" }).click(), t2.getByRole("button", { name: "Odoslať" }).click()]);
  const res = await Promise.all([t1, t2].map(async (t) => {
    await t.locator("main#main h1", { hasText: /Ďakujeme za odpoveď|Toto kolo už máš vyplnené/ }).waitFor({ timeout: 10000 });
    return (await t.locator("main#main h1").first().innerText());
  }));
  await t2.close();
  return [(await counts(r2)) === "1/1" && res.includes("Ďakujeme za odpoveď") && res.includes("Toto kolo už máš vyplnené"), `responses/participations=${await counts(r2)}; tabs: ${res.join(" | ")}`];
});
await step({ d: "Six parallel API submissions of one member", pre: "Barbora has not answered round 2", steps: "6× POST responses in parallel", exp: "exactly one 201, five 409; 1 new response" }, async () => {
  const call = await api(U.alfa[1]);
  const st = await Promise.all(Array.from({ length: 6 }, () => call(`/api/rounds/${r2}/responses`, "POST", { answers: [3, 3, 3, 3] }).then((r) => r.status)));
  return [st.filter((s) => s === 201).length === 1 && st.filter((s) => s === 409).length === 5 && (await counts(r2)) === "2/2", `statuses=${st.join(",")}; responses/participations=${await counts(r2)}`];
});
await step({ d: "Members submit in the browser while the manager closes the round in another browser", pre: "Cyril, Dana and Emil on the last step; manager on /rounds with the close dialog open", steps: "all three click Odoslať and the manager confirms 'Uzavrieť' at the same moment", exp: "every member sees either the thank-you or 'Kolo je uzavreté'; responses = participations = number of thank-you screens + 2; no 500 (MVP-09, BUG-002)" }, async () => {
  const m = await session(U.mgrA);
  await m.goto(`${BASE}/rounds`, { waitUntil: "networkidle" });
  const three = pages.slice(2, 5);
  await Promise.all(three.map((p) => wizard(p, r2, [2, 2, 2, 2], "", { submit: false })));
  await rowById(m, r2).getByRole("button", { name: "Uzavrieť" }).click();
  const confirm = m.locator("dialog[open]").getByRole("button", { name: "Uzavrieť" });
  await confirm.waitFor();
  await Promise.all([confirm.click(), ...three.map((p) => p.getByRole("button", { name: "Odoslať" }).click())]);
  const res = await Promise.all(three.map(async (p) => { await p.locator("main#main h1", { hasText: /Ďakujeme za odpoveď|Kolo je uzavreté/ }).waitFor({ timeout: 10000 }); return p.locator("main#main h1").first().innerText(); }));
  await toast(m, "Kolo je uzavreté.").waitFor({ timeout: 8000 });
  const thanks = res.filter((x) => x === "Ďakujeme za odpoveď").length;
  const c = await counts(r2);
  const late = await apiRespond(U.mgrA, r2, [1, 1, 1, 1]);
  await m.context().close();
  return [c === `${2 + thanks}/${2 + thanks}` && late.status === 409, `screens=${res.join(" | ")}; responses/participations=${c}; submission after close → HTTP ${late.status}`];
});
await step({ d: "Race repeated on the API: 10 rounds, 5 submissions against a simultaneous close", pre: "10 fresh open rounds", steps: "for each: 5 POST responses and 1 POST close in parallel", exp: "in every round responses = participations = number of 201 answers; no 500" }, async () => {
  const calls = await Promise.all(U.alfa.map((e) => api(e)));
  const bad = []; let five = 0;
  for (let i = 0; i < 10; i++) {
    const id = await apiRound(mgrAApi, { teamId: teamA.id, name: `Pulse – preteky ${i + 1}` });
    const res = await Promise.all([...calls.map((c) => c(`/api/rounds/${id}/responses`, "POST", { answers: [3, 3, 3, 3] })), mgrAApi(`/api/rounds/${id}/close`, "POST")]);
    const ok201 = res.slice(0, 5).filter((r) => r.status === 201).length;
    if (res.some((r) => r.status >= 500) || (await counts(id)) !== `${ok201}/${ok201}`) bad.push(`${i + 1}:${res.map((r) => r.status).join("")}:${await counts(id)}`);
    if (ok201 === 5) five++;
  }
  return [bad.length === 0, `inconsistent rounds=${bad.join("; ") || "none"}; rounds where all 5 got in before the close=${five}/10`];
});

// ───── two people act on the same round
const hr = await session(U.hr); const mgrA = await session(U.mgrA);
await step({ d: "HR and the manager start the same draft at the same moment", pre: "draft visible to both; both have the confirm dialog open", steps: "both confirm 'Spustiť' together", exp: "round OPEN once; one gets the toast, the other the toast or 'Kolo medzitým zmenilo stav. Obnov stránku.'; no generic error" }, async () => {
  const id = await apiRound(mgrAApi, { teamId: teamA.id, name: "Pulse – dvaja spúšťajú QA", open: false });
  await hr.goto(`${BASE}/hr/rounds`, { waitUntil: "networkidle" }); await mgrA.goto(`${BASE}/rounds`, { waitUntil: "networkidle" });
  for (const p of [hr, mgrA]) await rowById(p, id).getByRole("button", { name: "Spustiť" }).click();
  await Promise.all([hr, mgrA].map((p) => p.locator("dialog[open]").getByRole("button", { name: "Spustiť" }).click()));
  await hr.waitForTimeout(2000);
  const out = [];
  for (const p of [hr, mgrA]) out.push({ toast: await toast(p, "Kolo je spustené").count(), stale: await rowById(p, id).getByText("Kolo medzitým zmenilo stav").count(), generic: await rowById(p, id).getByText("Niečo sa nepodarilo").count() });
  const r = await db.round.findUnique({ where: { id } });
  const ok = r.status === "OPEN" && out.every((o) => o.generic === 0 && (o.toast > 0 || o.stale > 0)) && out.some((o) => o.toast > 0);
  return [ok, `db=${r.status}; HR=${JSON.stringify(out[0])}; manager=${JSON.stringify(out[1])}`, await shot(mgrA, "m5-02-both-open")];
});
await step({ d: "HR and the manager close the same round at the same moment", pre: "round open, both lists loaded", steps: "both confirm 'Uzavrieť' together", exp: "CLOSED once with one closedAt; each sees success or the stale-state message; no generic error" }, async () => {
  const id = (await db.round.findFirst({ where: { name: "Pulse – dvaja spúšťajú QA" } })).id;
  await hr.reload({ waitUntil: "networkidle" }); await mgrA.reload({ waitUntil: "networkidle" });
  for (const p of [hr, mgrA]) await rowById(p, id).getByRole("button", { name: "Uzavrieť" }).click();
  await Promise.all([hr, mgrA].map((p) => p.locator("dialog[open]").getByRole("button", { name: "Uzavrieť" }).click()));
  await hr.waitForTimeout(2000);
  const out = [];
  for (const p of [hr, mgrA]) out.push({ toast: await toast(p, "Kolo je uzavreté.").count(), stale: await rowById(p, id).getByText("Kolo medzitým zmenilo stav").count(), generic: await rowById(p, id).getByText("Niečo sa nepodarilo").count() });
  const r = await db.round.findUnique({ where: { id } });
  return [r.status === "CLOSED" && r.closedAt !== null && out.every((o) => o.generic === 0 && (o.toast > 0 || o.stale > 0)), `db=${r.status}; HR=${JSON.stringify(out[0])}; manager=${JSON.stringify(out[1])}`];
});
await step({ d: "Two managers save a round for their own teams at the same moment", pre: "manager Alfa and manager Beta on /rounds/new", steps: "both click 'Uložiť koncept' together", exp: "two drafts, one per team, each with its own team's defaults; each manager sees only the own one" }, async () => {
  const mgrB = await session(U.mgrB);
  await Promise.all([mgrA, mgrB].map((p) => p.goto(`${BASE}/rounds/new`, { waitUntil: "networkidle" })));
  await mgrA.fill('input[name="name"]', "Pulse – naraz Alfa"); await mgrB.fill('input[name="name"]', "Pulse – naraz Beta");
  await Promise.all([mgrA, mgrB].map((p) => p.getByRole("button", { name: "Uložiť koncept" }).click()));
  await Promise.all([mgrA, mgrB].map((p) => p.waitForURL("**/rounds", { timeout: 10000 })));
  const a = await db.round.findFirst({ where: { name: "Pulse – naraz Alfa" } }); const b = await db.round.findFirst({ where: { name: "Pulse – naraz Beta" } });
  const aText = await mainOnly(mgrA); const bText = await mainOnly(mgrB);
  await mgrB.context().close();
  return [a?.teamId === teamA.id && b?.teamId === teamB.id && !aText.includes("naraz Beta") && !bText.includes("naraz Alfa"), `Alfa draft team ok=${a?.teamId === teamA.id}, Beta draft team ok=${b?.teamId === teamB.id}; cross-visibility=${aText.includes("naraz Beta") || bText.includes("naraz Alfa")}`];
});
await step({ d: "A step written by the manager is visible to HR and to a team member after their next page load", pre: "round 1 closed above the threshold; HR has its results open, Adam has the team page open", steps: "manager adds a step in the browser; HR reloads results and the overview; Adam reloads the team page", exp: "HR sees the step (read-only) and the overview counts it; Adam sees it under the round (MVP-13, MVP-14)" }, async () => {
  await mgrAApi(`/api/rounds/${r1}/close`, "POST");
  await hr.goto(`${BASE}/rounds/${r1}/results`, { waitUntil: "networkidle" });
  await pages[0].goto(`${BASE}/team/${teamA.id}`, { waitUntil: "networkidle" });
  await mgrA.goto(`${BASE}/rounds/${r1}/results`, { waitUntil: "networkidle" });
  await mgrA.fill('input[name="topic"]', "Krok pre viacerých divákov QA"); await mgrA.fill('textarea[name="description"]', "Opis kroku, ktorý má vidieť HR aj tím."); await mgrA.fill('input[name="dueDate"]', ymd(new Date(Date.now() + 7 * DAY)));
  await mgrA.getByRole("button", { name: "Pridať krok" }).click();
  await toast(mgrA, "Krok je pridaný.").waitFor({ timeout: 8000 });
  const hrBefore = (await mainOnly(hr)).includes("Krok pre viacerých divákov QA");
  await hr.reload({ waitUntil: "networkidle" }); await pages[0].reload({ waitUntil: "networkidle" });
  const hrAfter = (await mainOnly(hr)).includes("Krok pre viacerých divákov QA");
  const emp = (await mainOnly(pages[0])).includes("Krok pre viacerých divákov QA");
  return [hrAfter && emp, `HR before reload=${hrBefore} (no live update is expected), HR after reload=${hrAfter}, employee after reload=${emp}`];
});

// ───── stale tabs of the same person
await step({ d: "Step status changed in one tab is shown correctly in a second tab of the same manager after that tab refreshes its data", pre: "manager has the results page open in tabs T1 and T2; step is 'Plánované'", steps: "T2: set the step to 'Hotové'. T1 (not reloaded): add a second step (the page refreshes its data from the server)", exp: "after the refresh T1 shows the first step as 'Hotové' – the same as the database" }, async () => {
  const t2 = await mgrA.context().newPage();
  await t2.goto(`${BASE}/rounds/${r1}/results`, { waitUntil: "networkidle" });
  await t2.locator('#kroky select[aria-label="Stav"]').first().selectOption("DONE");
  await toast(t2, "Stav kroku je uložený.").waitFor({ timeout: 8000 });
  await mgrA.fill('input[name="topic"]', "Druhý krok QA"); await mgrA.fill('textarea[name="description"]', "Druhý krok z neobnovenej karty."); await mgrA.fill('input[name="dueDate"]', ymd(new Date(Date.now() + 9 * DAY)));
  await mgrA.getByRole("button", { name: "Pridať krok" }).click();
  await toast(mgrA, "Krok je pridaný.").waitFor({ timeout: 8000 });
  await mgrA.locator("#kroky li", { hasText: "Druhý krok QA" }).waitFor({ timeout: 8000 });
  const shown = await mgrA.locator("#kroky li", { hasText: "Krok pre viacerých divákov QA" }).locator('select[aria-label="Stav"]').inputValue();
  const dbStatus = (await db.action.findFirst({ where: { topic: "Krok pre viacerých divákov QA" } })).status;
  const evidence = await shot(mgrA, "m5-03-stale-status-select");
  await t2.close();
  return [shown === dbStatus, `T1 shows '${shown}' for the first step; database has '${dbStatus}'`, evidence];
});
await step({ d: "Issue status changed by one HR session is shown correctly in a second HR session after that session refreshes its data", pre: "two HR browser sessions on /hr/issues with the same two open issues", steps: "session 2: set issue X to 'Rieši sa'. Session 1 (not reloaded): change the owner group of issue Y (the list refreshes from the server)", exp: "after the refresh session 1 shows issue X as 'Rieši sa' – the same as the database" }, async () => {
  const a = await hrApi("/api/hr/issues", "POST", { title: "Podnet X pre dve relácie QA", ownerGroup: "HR", source: "OTHER" });
  const b = await hrApi("/api/hr/issues", "POST", { title: "Podnet Y pre dve relácie QA", ownerGroup: "HR", source: "OTHER" });
  const hr2 = await session(U.hr);
  await hr.goto(`${BASE}/hr/issues`, { waitUntil: "networkidle" }); await hr2.goto(`${BASE}/hr/issues`, { waitUntil: "networkidle" });
  const li = (p, title) => p.locator("main#main li", { has: p.getByRole("heading", { name: title }) });
  await li(hr2, "Podnet X pre dve relácie QA").locator('select[aria-label="Stav"]').selectOption("IN_PROGRESS");
  await toast(hr2, "Podnet je uložený.").waitFor({ timeout: 8000 });
  await li(hr, "Podnet Y pre dve relácie QA").locator('select[aria-label="Zodpovedná skupina"]').selectOption("FACILITY");
  await toast(hr, "Podnet je uložený.").waitFor({ timeout: 8000 });
  await hr.waitForTimeout(1500);
  const shown = await li(hr, "Podnet X pre dve relácie QA").locator('select[aria-label="Stav"]').inputValue();
  const id = a.json.issue?.id ?? (await db.issue.findFirst({ where: { title: "Podnet X pre dve relácie QA" } })).id;
  const dbStatus = (await db.issue.findUnique({ where: { id } })).status;
  const evidence = await shot(hr, "m5-04-stale-issue-select");
  await hr2.context().close();
  return [a.status === 201 && b.status === 201 && shown === dbStatus, `session 1 shows '${shown}' for issue X; database has '${dbStatus}'`, evidence];
});

// ───── isolation between teams
const r3 = await apiRound(mgrBApi, { teamId: teamB.id, name: "Pulse – iba Beta QA" });
const r4 = await apiRound(mgrAApi, { teamId: teamA.id, name: "Pulse – iba Alfa QA" });
await step({ d: "With rounds open in both teams, each member sees only the own team's round", pre: "one open round per team", steps: "Adam (Alfa) and Filip (Beta) open the home page", exp: "Adam: only 'Pulse – iba Alfa QA'; Filip: only 'Pulse – iba Beta QA'" }, async () => {
  const filip = await session(U.beta[0]);
  await pages[0].goto(`${BASE}/`, { waitUntil: "networkidle" }); await filip.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const a = await mainOnly(pages[0]); const b = await mainOnly(filip);
  await filip.context().close();
  return [a.includes("iba Alfa QA") && !a.includes("iba Beta QA") && b.includes("iba Beta QA") && !b.includes("iba Alfa QA"), `Adam sees Alfa=${a.includes("iba Alfa QA")}, Beta=${a.includes("iba Beta QA")}; Filip sees Beta=${b.includes("iba Beta QA")}, Alfa=${b.includes("iba Alfa QA")}`];
});
await step({ d: "A member cannot answer the other team's round even with its address", pre: "as above", steps: "Filip: open the fill page of the Alfa round; POST responses", exp: "403 page; API 403; nothing stored" }, async () => {
  const filip = await session(U.beta[0]);
  await filip.goto(`${BASE}/rounds/${r4}/fill`, { waitUntil: "networkidle" });
  const f = await filip.getByRole("heading", { name: "Sem nemáš prístup" }).isVisible().catch(() => false);
  const r = await apiRespond(U.beta[0], r4, [1, 1, 1, 1]);
  await filip.context().close();
  return [f && r.status === 403 && (await counts(r4)) === "0/0", `403 page=${f}; API HTTP ${r.status}; responses/participations=${await counts(r4)}`];
});
await step({ d: "A manager cannot start, close or write a step on the other team's round", pre: "Beta round open; Alfa round 1 closed", steps: "manager Alfa: POST close on the Beta round; manager Beta: POST action on Alfa round 1 and open/close on Alfa rounds", exp: "403 each; states unchanged (matrix, NFR-03)" }, async () => {
  const a = await mgrAApi(`/api/rounds/${r3}/close`, "POST");
  const b = await mgrBApi(`/api/rounds/${r1}/actions`, "POST", { topic: "Cudzí krok", description: "x", dueDate: ymd(new Date(Date.now() + DAY)), status: "PLANNED" });
  const c = await mgrBApi(`/api/rounds/${r4}/close`, "POST");
  const s3 = (await db.round.findUnique({ where: { id: r3 } })).status; const s4 = (await db.round.findUnique({ where: { id: r4 } })).status;
  return [a.status === 403 && b.status === 403 && c.status === 403 && s3 === "OPEN" && s4 === "OPEN", `${a.status},${b.status},${c.status}; Beta round ${s3}, Alfa round ${s4}`];
});
await step({ d: "Each manager's list and home tasks contain only the own team", pre: "rounds and tasks exist in both teams", steps: "manager Beta opens '/' and /rounds", exp: "no Alfa round name on either page" }, async () => {
  const mgrB = await session(U.mgrB);
  await mgrB.goto(`${BASE}/`, { waitUntil: "networkidle" }); const home = await mainOnly(mgrB);
  await mgrB.goto(`${BASE}/rounds`, { waitUntil: "networkidle" }); const list = await mainOnly(mgrB);
  const alfaNames = (await db.round.findMany({ where: { teamId: teamA.id } })).map((r) => r.name);
  const betaOnly = (await db.round.findMany({ where: { teamId: teamB.id } })).map((r) => r.name);
  const leak = alfaNames.filter((n) => !betaOnly.includes(n) && (home.includes(n) || list.includes(n)));
  await mgrB.context().close();
  return [leak.length === 0, `Alfa round names visible to manager Beta: ${leak.join(", ") || "none"}`];
});
await step({ d: "HR sees the rounds of both teams in one list with the right team on each row", pre: "rounds in both teams", steps: "HR opens /hr/rounds; compare every row with the database", exp: "row count = number of rounds; each row links to its team" }, async () => {
  await hr.goto(`${BASE}/hr/rounds`, { waitUntil: "networkidle" });
  const rows = await hr.locator("[data-round-row]").evaluateAll((els) => els.map((e) => ({ id: e.getAttribute("data-round-row"), team: e.querySelector('a[href^="/team/"]')?.textContent })));
  const all = await db.round.findMany({ include: { team: true } });
  const bad = all.filter((r) => rows.find((x) => x.id === r.id)?.team !== r.team.name);
  return [rows.length === all.length && bad.length === 0, `rows=${rows.length}, DB rounds=${all.length}, wrong team label=${bad.length}`];
});

// ───── concurrent writes of other kinds
await step({ d: "Five identical own questions sent at once are stored once", pre: "manager Alfa", steps: "5× POST /api/questions with the same text in parallel", exp: "one 201, the rest 400/409 duplicate; 1 row (BUG-005)" }, async () => {
  const text = "Na poradách sa dostanem k slovu (QA súbeh).";
  const st = await Promise.all(Array.from({ length: 5 }, () => mgrAApi("/api/questions", "POST", { text }).then((r) => r.status)));
  const n = await db.question.count({ where: { text } });
  return [n === 1 && st.filter((s) => s === 201).length === 1 && !st.some((s) => s >= 500), `statuses=${st.join(",")}; rows=${n}`];
});
await step({ d: "Five people send a kudos to the same colleague at once", pre: "five senders", steps: "5× POST /api/kudos in parallel; recipient opens /kudos", exp: "5 rows; the recipient's tab shows 5" }, async () => {
  const to = await db.user.findUnique({ where: { email: U.beta[4] } });
  const senders = await Promise.all([U.alfa[0], U.alfa[1], U.alfa[2], U.beta[0], U.hr].map((e) => api(e)));
  const st = await Promise.all(senders.map((c, i) => c("/api/kudos", "POST", { toUserId: to.id, text: `Súbežné kudos číslo ${i + 1}, ďakujem (QA).`, value: "COLLABORATION", visibility: i === 4 ? "PRIVATE" : "TEAM" }).then((r) => r.status)));
  const p = await session(U.beta[4]);
  await p.goto(`${BASE}/kudos`, { waitUntil: "networkidle" });
  const tab = (await p.getByRole("tab", { name: /Moje kudos/ }).innerText()).replace(/\s+/g, " ");
  const items = await p.locator('[role="tabpanel"]:not([hidden]) > ul > li').count();
  await p.context().close();
  return [st.every((s) => s === 201) && items === 5 && tab.endsWith("5"), `statuses=${st.join(",")}; list items=${items}; tab='${tab}'`];
});
await step({ d: "Round closes once when several people load pages at its deadline", pre: "open Beta round with closesAt shifted 1 minute into the past (time simulation)", steps: "manager Beta, HR and two members request their pages/API in parallel", exp: "CLOSED with closedAt = closesAt; no 500 from any request" }, async () => {
  const past = new Date(Date.now() - 60000);
  await db.round.update({ where: { id: r3 }, data: { closesAt: past } });
  const calls = await Promise.all([api(U.beta[0]), api(U.beta[1])]);
  const res = await Promise.all([mgrBApi("/api/rounds"), hrApi("/api/rounds"), calls[0]("/api/rounds"), calls[1](`/api/rounds/${r3}`), mgrBApi("/"), hrApi("/hr/rounds")]);
  const r = await db.round.findUnique({ where: { id: r3 } });
  return [r.status === "CLOSED" && r.closedAt.getTime() === past.getTime() && !res.some((x) => x.status >= 500), `statuses=${res.map((x) => x.status).join(",")}; db=${r.status}; closedAt==closesAt: ${r.closedAt?.getTime() === past.getTime()}`];
});
await step({ d: "Database integrity after all concurrent scenarios", pre: "all steps above", steps: "count rows per round; look for duplicates", exp: "responses = participations everywhere; no duplicate participation; no response in a draft" }, async () => {
  const rounds = await db.round.findMany({ include: { _count: { select: { responses: true, participations: true } } } });
  const bad = rounds.filter((r) => r._count.responses !== r._count.participations || (r.status === "DRAFT" && r._count.responses > 0));
  return [bad.length === 0, `rounds=${rounds.length}; inconsistent=${bad.map((r) => r.name).join(", ") || "none"}`];
});
const errs = [...pages, hr, mgrA].flatMap((p) => p.errors);
await step({ d: "No uncaught JavaScript error in any of the parallel sessions", pre: "sessions above", steps: "collect 'pageerror' events", exp: "none" }, async () => [errs.length === 0, `page errors=${errs.length} ${errs.slice(0, 3).join(" | ")}`]);
await closeBrowser();
