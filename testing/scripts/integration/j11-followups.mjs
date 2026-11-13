// Journey 11: follow-up checks raised by the earlier journeys — ordering of closed rounds
// when one was closed by hand before its deadline, filter edge cases, seed composition
// (MVP-02, NFR-05, NFR-06) and absence of out-of-scope screens. Seed-only start.
import { BASE, U, db, resetDb, recorder, session, shot, mainText, api, ymd, fmtDate, fillWizard, closeBrowser } from "./lib.mjs";

const R = recorder("j11-followups");
const step = async (meta, fn) => {
  try { const [ok, actual, evidence] = await fn(); return R.check(meta, ok, actual, evidence ?? ""); }
  catch (error) { return R.check(meta, false, `SCRIPT/RUNTIME ERROR: ${error.message}`); }
};
const DAY = 864e5;
resetDb(false);
const teamA = await db.team.findFirstOrThrow({ where: { name: "Tím Alfa" } });
const hrApi = await api(U.hr); const mgrApi = await api(U.mgrA);
const members = await Promise.all(U.alfa.map((e) => api(e)));
const lib = (await hrApi("/api/questions")).json.questions.filter((q) => !q.fixed && q.scale === "AGREEMENT");

// ───── seed composition
await step({ j: "J10", d: "Seed: 2 teams of 6 (1 manager + 5 employees) and 1 HR user", pre: "seed only", steps: "count users per team and role", exp: "13 users; each team 1 MANAGER + 5 EMPLOYEE; HR without a team (MVP-02)" }, async () => {
  const users = await db.user.findMany(); const teams = await db.team.findMany();
  const ok = users.length === 13 && teams.length === 2 && teams.every((t) => users.filter((u) => u.teamId === t.id && u.role === "MANAGER").length === 1 && users.filter((u) => u.teamId === t.id && u.role === "EMPLOYEE").length === 5 && users.find((u) => u.id === t.managerId)?.teamId === t.id) && users.filter((u) => u.role === "HR" && u.teamId === null).length === 1;
  return [ok, `users=${users.length}, teams=${teams.length}, HR=${users.filter((u) => u.role === "HR").length}`];
});
await step({ j: "J10", d: "Seed: question library of IT-03", pre: "seed only", steps: "count questions, topics, starters, fixed", exp: "38 questions = 37 rotating in 8 topics + 1 fixed; 12 starters; scales only AGREEMENT/QUALITY/OVERTIME/FREQUENCY" }, async () => {
  const q = await db.question.findMany();
  const topics = new Set(q.filter((x) => !x.fixed).map((x) => x.topic)); const scales = new Set(q.map((x) => x.scale));
  return [q.length === 38 && q.filter((x) => x.fixed).length === 1 && topics.size === 8 && q.filter((x) => x.starter).length === 12 && [...scales].every((s) => ["AGREEMENT", "QUALITY", "OVERTIME", "FREQUENCY"].includes(s)), `questions=${q.length}, fixed=${q.filter((x) => x.fixed).length}, topics=${topics.size}, starters=${q.filter((x) => x.starter).length}, scales=${[...scales]}`];
});
await step({ j: "J5", d: "Passwords are stored only as bcrypt hashes", pre: "seed only", steps: "read User.passwordHash of all users", exp: "every value starts with $2 and is 60 characters; the plain password does not occur (NFR-05)" }, async () => {
  const users = await db.user.findMany();
  return [users.every((u) => /^\$2[aby]\$\d\d\$/.test(u.passwordHash) && u.passwordHash.length === 60 && !u.passwordHash.includes("Heslo123")), `checked ${users.length} hashes`];
});
await step({ j: "J10", d: "Only invented test accounts exist", pre: "seed only", steps: "read all e-mail addresses", exp: "all in the reserved domain example.test (NFR-06)" }, async () => {
  const users = await db.user.findMany();
  return [users.every((u) => u.email.endsWith("@example.test")), `domains=${[...new Set(users.map((u) => u.email.split("@")[1]))]}`];
});
await step({ j: "J5", d: "No registration, password reset or user administration screens exist", pre: "-", steps: "GET /register, /signup, /forgot-password, /reset-password, /admin, /users, /api/register, /api/users", exp: "404 (or redirect to /login for unknown pages) — MVP-02" }, async () => {
  const out = [];
  for (const p of ["/register", "/signup", "/forgot-password", "/reset-password", "/admin", "/users", "/api/register", "/api/users"]) { const r = await mgrApi(p); out.push(`${p}=${r.status}`); }
  return [out.every((o) => o.endsWith("=404")), out.join("; ")];
});

// ───── ordering of closed rounds
const mk = async (name, days) => { const c = await hrApi("/api/rounds", "POST", { name, teamId: teamA.id, closesAt: ymd(new Date(Date.now() + days * DAY)), questionIds: [lib[0].id, lib[1].id] }); await hrApi(`/api/rounds/${c.json.round.id}/open`, "POST"); return c.json.round.id; };
const X = await mk("QA kolo X (uzavreté ručne skôr)", 10);
const Y = await mk("QA kolo Y (uzavreté neskôr)", 5);
const Z = await mk("QA kolo Z (otvorené)", 7);
for (const id of [X, Y]) for (const m of members) await m(`/api/rounds/${id}/responses`, "POST", { answers: [3, 4, 5] });
await mgrApi(`/api/rounds/${X}/close`, "POST");                                  // X closed by hand first
await new Promise((r) => setTimeout(r, 1500));
const yDeadline = new Date(Date.now() - 500);
await db.round.update({ where: { id: Y }, data: { closesAt: yDeadline } });        // Y's deadline passes afterwards
await mgrApi("/api/rounds");                                                       // first load after the deadline closes Y
await mgrApi(`/api/rounds/${X}/actions`, "POST", { topic: "QA krok kola X", description: "QA", dueDate: ymd(new Date(Date.now() + DAY)) });
await mgrApi(`/api/rounds/${Y}/actions`, "POST", { topic: "QA krok kola Y", description: "QA", dueDate: ymd(new Date(Date.now() + DAY)) });
const rx = await db.round.findUnique({ where: { id: X } }); const ry = await db.round.findUnique({ where: { id: Y } });
const adam = await session(U.alfa[0], { width: 390, height: 844 });
await step({ j: "J6", d: "Team page lists closed rounds newest first when one round was closed by hand before its deadline", pre: `round X: deadline in 10 days, closed by hand at ${rx.closedAt.toISOString()}; round Y: closed by its deadline at ${ry.closedAt.toISOString()} (later)`, steps: "Adam opens 'Môj tím'; read the order of the round cards and their 'Uzavreté' dates", exp: "Y (closed last) above X; each card dated with the day it was really closed (MVP-14 'najnovšie hore')" }, async () => {
  await adam.goto(`${BASE}/team/${teamA.id}`);
  const names = await adam.locator("main > div > ul > li > h2").allInnerTexts();
  const meta = await adam.locator("main > div > ul > li > p:first-of-type").allInnerTexts();
  return [names[0].includes("kolo Y") && meta.every((m) => m.includes(`Uzavreté ${fmtDate(new Date())}`)), `order=${names.join(" | ")}; labels=${meta.map((m) => m.trim()).join(" | ")}; DB closedAt X=${rx.closedAt.toISOString()}, Y=${ry.closedAt.toISOString()}`, await shot(adam, "j11-01-team-order")];
});
await step({ j: "J6", d: "Trend page and team page agree on which round is the newest", pre: "as above", steps: "manager opens 'Vývoj tímu' (newest first) and the team page", exp: "the same round is first on both" }, async () => {
  const mgr = await session(U.mgrA);
  await mgr.goto(`${BASE}/team/${teamA.id}/trend`);
  const trendFirst = (await mgr.locator("table tbody tr").first().locator("th a").innerText()).trim();
  await mgr.goto(`${BASE}/team/${teamA.id}`);
  const teamFirst = (await mgr.locator("main > div > ul > li > h2").first().innerText()).trim();
  const s = await shot(mgr, "j11-02-trend-vs-team");
  await mgr.context().close();
  return [trendFirst === teamFirst, `trend first='${trendFirst}'; team page first='${teamFirst}'`, s];
});
await step({ j: "J1", d: "Thank-you screen shows the actions of the round that was closed last", pre: "as above; open round Z", steps: "Adam fills round Z and submits", exp: "'Čo sa urobilo po kole „QA kolo Y (uzavreté neskôr)“' with 'QA krok kola Y' (MVP-09: 'kroky posledného uzavretého kola')" }, async () => {
  await fillWizard(adam, Z, [4, 4, 4], "");
  await adam.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor();
  const t = await mainText(adam);
  return [t.includes("Čo sa urobilo po kole „QA kolo Y (uzavreté neskôr)“") && t.includes("QA krok kola Y"), t.slice(t.indexOf("Čo sa urobilo"), t.indexOf("Čo sa urobilo") + 140), await shot(adam, "j11-03-thanks-last-closed")];
});

// ───── filters and query strings
const hr = await session(U.hr);
await step({ j: "J4", d: "Issues list with an unknown status in the URL", pre: "seed issues: 1 Otvorené, 1 Rieši sa; one more set to Hotové", steps: "create and finish an issue; open /hr/issues?status=NEZNAMY", exp: "the visible filter and the list agree (either default 'Nevybavené' with unfinished issues only, or 'Všetko' with all)" }, async () => {
  const c = await hrApi("/api/hr/issues", "POST", { title: "QA hotový podnet", source: "OTHER", ownerGroup: "HR" });
  await hrApi(`/api/hr/issues/${c.json.issue?.id ?? c.json.id}`, "PATCH", { status: "DONE" });
  await hr.goto(`${BASE}/hr/issues?status=NEZNAMY`);
  const selected = await hr.locator('select[name="status"] option:checked').innerText();
  const titles = await hr.locator("main section > ul > li h2").allInnerTexts();
  const showsDone = titles.includes("QA hotový podnet");
  return [(selected === "Nevybavené" && !showsDone) || (selected === "Všetko" && showsDone), `filter shows '${selected}'; list has ${titles.length} issues, includes the finished one=${showsDone}`, await shot(hr, "j11-04-filter-unknown-status")];
});
await step({ j: "J4", d: "Issue form opened with an unknown round id in the URL", pre: "-", steps: "open /hr/issues?round=neexistuje#new", exp: "page renders (200) without a prefill notice and without an error" }, async () => {
  const res = await hr.goto(`${BASE}/hr/issues?round=neexistuje#new`);
  const t = await mainText(hr);
  return [res.status() === 200 && !t.includes("Podnet z kola"), `HTTP ${res.status()}; prefill notice=${t.includes("Podnet z kola")}`];
});
await step({ j: "J4", d: "Issues filter keeps working together with the 'from round' link", pre: "closed round X", steps: "open /hr/issues?round=<X>&status=DONE", exp: "form open with the round notice; list shows only finished issues" }, async () => {
  await hr.goto(`${BASE}/hr/issues?round=${X}&status=DONE`);
  const notice = await hr.getByText("Podnet z kola „QA kolo X (uzavreté ručne skôr)“ (Tím Alfa).").count();
  const titles = await hr.locator("main section > ul > li h2").allInnerTexts();
  return [notice === 1 && titles.join() === "QA hotový podnet", `notice=${notice}; list=${JSON.stringify(titles)}`];
});
await step({ j: "J9", d: "Result and summary APIs do not send caching headers that would allow storing confidential data", pre: "closed round X", steps: "read Cache-Control of GET /api/rounds/:id/results and /api/teams/:id/summary", exp: "no-store (informational: without a header browsers do not cache XHR responses by default, shared proxies might)" }, async () => {
  const a = await mgrApi(`/api/rounds/${X}/results`); const b = await mgrApi(`/api/teams/${teamA.id}/summary`);
  const cc = [a.headers.get("cache-control"), b.headers.get("cache-control")];
  return [cc.every((c) => (c ?? "").includes("no-store")), `results: ${cc[0]}; summary: ${cc[1]}`];
});

console.log(`\nJ11 done: ${R.rows.length} checks, ${R.rows.filter((r) => r.status === "FAIL").length} failed`);
await closeBrowser();
