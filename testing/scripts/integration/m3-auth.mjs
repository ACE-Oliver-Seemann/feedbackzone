// Session 2026-11-12_002, section C: authentication workflows and protected routes per role,
// through the redesigned UI. Starts from a seed-only database.
import {
  BASE, U, db, resetDb, recorder, stepper, session, uiLogin, shot, mainOnly, api, rawCall, pathOf, teams,
  apiRound, wizard, toast, rowById, closeBrowser, getBrowser, PASSWORD,
} from "./lib.mjs";

const R = recorder("m3-auth");
const step = stepper(R, { j: "C" });
resetDb(false);
const { A: teamA, B: teamB } = await teams();
const seedBeta = await db.round.findFirstOrThrow({ where: { teamId: teamB.id } });
const mgrAApi = await api(U.mgrA);
const roundA = await apiRound(mgrAApi, { teamId: teamA.id, name: "Pulse – auth QA" });
const forbiddenShown = (page) => page.getByRole("heading", { name: "Sem nemáš prístup" }).isVisible().catch(() => false);
const cookieOf = async (page) => (await page.context().cookies()).find((c) => c.name === "fz_session");

// ───── login
const anon = await session(null);
const tryLogin = async (email, password) => {
  await anon.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await anon.fill('input[name="email"]', email); await anon.fill('input[name="password"]', password);
  await anon.click('button[type="submit"]');
  await anon.waitForTimeout(1200);
  const alert = (await anon.locator('[role="alert"]').allInnerTexts()).filter(Boolean);
  return { path: pathOf(anon), alert: alert.join("|"), cookie: !!(await cookieOf(anon)) };
};
let wrongPw;
await step({ d: "Wrong password: one generic message, no session", pre: "logged out", steps: "adam.alfa + wrong password", exp: "'Nesprávny e-mail alebo heslo.'; stays on /login; no cookie (MVP-01)" }, async () => {
  wrongPw = await tryLogin(U.alfa[0], "ZleHeslo1");
  return [wrongPw.alert === "Nesprávny e-mail alebo heslo." && wrongPw.path === "/login" && !wrongPw.cookie, JSON.stringify(wrongPw), await shot(anon, "m3-01-wrong-password")];
});
await step({ d: "Unknown e-mail gives exactly the same message as a wrong password", pre: "logged out", steps: "nikto@example.test + any password", exp: "identical message, no hint which part was wrong (MVP-01)" }, async () => {
  const r = await tryLogin("nikto@example.test", PASSWORD);
  return [r.alert === wrongPw.alert && r.path === "/login" && !r.cookie, JSON.stringify(r)];
});
await step({ d: "Empty form does not log in", pre: "logged out", steps: "submit without e-mail and password", exp: "stays on /login, no cookie" }, async () => {
  await anon.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await anon.click('button[type="submit"]');
  await anon.waitForTimeout(800);
  return [pathOf(anon) === "/login" && !(await cookieOf(anon)), `path=${pathOf(anon)}; alert='${(await anon.locator('[role="alert"]').allInnerTexts()).join("|")}'`];
});
await step({ d: "Injection-like input in the login form is treated as a wrong login", pre: "logged out", steps: "e-mail \"' OR 1=1 --\", password \"' OR '1'='1\"", exp: "generic message or browser validation; no session; no 500" }, async () => {
  const r = await rawCall("/api/login", { method: "POST", body: { email: "' OR 1=1 --", password: "' OR '1'='1" } });
  return [r.status === 401 && !r.headers.get("set-cookie"), `HTTP ${r.status} ${r.text}`];
});
await step({ d: "Login page shows no application menu or data to an anonymous visitor", pre: "logged out", steps: "open /login; read page", exp: "no main navigation, no user name, title 'Prihlásenie'" }, async () => {
  await anon.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const nav = await anon.locator('nav[aria-label="Hlavná navigácia"]').count();
  const text = await anon.locator("body").innerText();
  return [nav === 0 && !/Odhlásiť sa/.test(text) && /Prihlásenie/.test(await anon.title() + text), `nav=${nav}; title='${await anon.title()}'`, await shot(anon, "m3-02-login-page")];
});
for (const [role, email, name] of [["employee", U.alfa[0], "Zamestnanec"], ["manager", U.mgrA, "Manažér"], ["HR", U.hr, "HR"]]) {
  await step({ d: `Correct login as ${role} lands on '/' with the role shown in the header`, pre: "logged out", steps: `log in as ${email}`, exp: `path '/', header shows the user's name and '${name}' (MVP-01)` }, async () => {
    const page = await session(email);
    const header = (await page.locator("header").first().innerText()).replace(/\s+/g, " ");
    const u = await db.user.findUnique({ where: { email } });
    const ok = pathOf(page) === "/" && header.includes(u.name) && header.includes(name);
    await page.context().close();
    return [ok, `path='/' ; header has name=${header.includes(u.name)}, role label=${header.includes(name)}`];
  });
}
await step({ d: "Session cookie attributes", pre: "-", steps: "POST /api/login; read Set-Cookie", exp: "HttpOnly; SameSite=Lax; Path=/; Max-Age 8 h (NFR-05)" }, async () => {
  const r = await rawCall("/api/login", { method: "POST", body: { email: U.alfa[0], password: PASSWORD } });
  const c = r.headers.get("set-cookie") ?? "";
  return [/HttpOnly/i.test(c) && /SameSite=Lax/i.test(c) && /Path=\//.test(c) && /Max-Age=28800/.test(c) && !r.text.includes("passwordHash"), c.replace(/fz_session=[^;]+/, "fz_session=<token>")];
});
const adam = await session(U.alfa[0]);
await step({ d: "Session cookie is not readable by page scripts and /api/me does not expose the password hash", pre: "Adam logged in", steps: "document.cookie; fetch /api/me in the page", exp: "no fz_session in document.cookie; /api/me = name, role, team only" }, async () => {
  const c = await adam.evaluate(() => document.cookie);
  const me = await adam.evaluate(async () => (await fetch("/api/me")).text());
  return [!c.includes("fz_session") && !/hash|password/i.test(me) && me.includes("EMPLOYEE"), `document.cookie='${c}'; /api/me=${me.slice(0, 160)}`];
});
await step({ d: "Refresh and a new tab keep the session", pre: "Adam logged in", steps: "reload '/'; open /kudos in a second tab of the same context", exp: "both stay inside the application" }, async () => {
  await adam.reload({ waitUntil: "networkidle" });
  const p1 = pathOf(adam);
  const tab = await adam.context().newPage();
  await tab.goto(`${BASE}/kudos`, { waitUntil: "networkidle" });
  const p2 = pathOf(tab); await tab.close();
  return [p1 === "/" && p2 === "/kudos", `reload → ${p1}; second tab → ${p2}`];
});
await step({ d: "Opening /login while logged in does not show the form again", pre: "Adam logged in", steps: "open /login", exp: "redirect to '/' (or the session stays valid)" }, async () => {
  await adam.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  return [pathOf(adam) === "/", `path=${pathOf(adam)}`];
});

// ───── anonymous access
const PAGES = ["/", "/rounds", "/rounds/new", `/rounds/${roundA}/fill`, `/rounds/${roundA}/results`, `/rounds/${roundA}/report`, `/team/${teamA.id}`, `/team/${teamA.id}/trend`, "/kudos", "/kudos/new", "/kudos/me", "/hr/rounds", "/hr/overview", "/hr/heatmap", "/hr/issues", "/hr/notes"];
await step({ d: "Every page redirects an anonymous visitor to /login without leaking content", pre: "no cookie", steps: `open ${PAGES.length} protected URLs directly`, exp: "each ends on /login; page text has no round or team name (MVP-03)" }, async () => {
  const bad = [];
  for (const u of PAGES) {
    await anon.goto(BASE + u, { waitUntil: "domcontentloaded" });
    const text = await anon.locator("body").innerText();
    if (pathOf(anon) !== "/login" || /Tím Alfa|Pulse –/.test(text)) bad.push(u);
  }
  return [bad.length === 0, `not redirected or leaking: ${bad.join(", ") || "none"}`];
});
await step({ d: "Every API endpoint refuses an anonymous request", pre: "no cookie", steps: "GET 12 endpoints; POST/PATCH 9 endpoints", exp: "401 everywhere with no data (MVP-03)" }, async () => {
  const gets = ["/api/me", "/api/questions", "/api/rounds", `/api/rounds/${roundA}`, `/api/rounds/${roundA}/results`, `/api/rounds/${roundA}/suggestions`, `/api/teams/${teamA.id}/summary`, `/api/teams/${teamA.id}/trend`, "/api/kudos/me", "/api/hr/overview", "/api/hr/heatmap", "/api/hr/issues", "/api/hr/notes"];
  const posts = [["/api/rounds", "POST"], [`/api/rounds/${roundA}/open`, "POST"], [`/api/rounds/${roundA}/close`, "POST"], [`/api/rounds/${roundA}/responses`, "POST"], [`/api/rounds/${roundA}/actions`, "POST"], ["/api/kudos", "POST"], ["/api/questions", "POST"], ["/api/hr/issues", "POST"], ["/api/hr/notes", "POST"], ["/api/actions/x", "PATCH"]];
  const bad = [];
  for (const u of gets) { const r = await rawCall(u); if (r.status !== 401 || r.text.length > 60) bad.push(`${u}:${r.status}`); }
  for (const [u, m] of posts) { const r = await rawCall(u, { method: m, body: {} }); if (r.status !== 401) bad.push(`${m} ${u}:${r.status}`); }
  return [bad.length === 0, `not 401: ${bad.join(", ") || "none"} (${gets.length} GET, ${posts.length} write)`];
});

// ───── role matrix through direct URLs
const matrix = async (page, urls) => {
  const out = {};
  for (const u of urls) {
    const resp = await page.goto(BASE + u, { waitUntil: "networkidle" });
    out[u] = { http: resp.status(), forbidden: await forbiddenShown(page), path: pathOf(page) };
  }
  return out;
};
await step({ d: "Employee: manager and HR pages opened by direct URL show the 403 page", pre: "Adam (Tím Alfa)", steps: "open /rounds, /rounds/new, results, report, own trend, /hr/rounds, /hr/overview, /hr/heatmap, /hr/issues, /hr/notes, Tím Beta page", exp: "'Sem nemáš prístup' with HTTP 403 on each (MVP-03, IT-08, IT-10)" }, async () => {
  const urls = ["/rounds", "/rounds/new", `/rounds/${seedBeta.id}/results`, `/rounds/${roundA}/results`, `/rounds/${roundA}/report`, `/team/${teamA.id}/trend`, "/hr/rounds", "/hr/overview", "/hr/heatmap", "/hr/issues", "/hr/notes", `/team/${teamB.id}`, `/rounds/${seedBeta.id}/fill`];
  const m = await matrix(adam, urls);
  const bad = urls.filter((u) => !m[u].forbidden || m[u].http !== 403);
  return [bad.length === 0, `not 403: ${bad.map((u) => `${u}→${m[u].http}/${m[u].forbidden}`).join(", ") || "none"} of ${urls.length}`, await shot(adam, "m3-03-employee-403")];
});
await step({ d: "The 403 page keeps the menu, is in Slovak and offers a way back", pre: "Adam on a forbidden page", steps: "open /hr/rounds; read; click 'Späť na úvod'", exp: "menu present; 'Sem nemáš prístup', 'Chyba 403'; link leads to '/'" }, async () => {
  await adam.goto(`${BASE}/hr/rounds`, { waitUntil: "networkidle" });
  const nav = await adam.locator('header nav[aria-label="Hlavná navigácia"]').count();
  const text = await mainOnly(adam);
  await adam.getByRole("link", { name: "Späť na úvod" }).click();
  await adam.waitForURL(`${BASE}/`);
  return [nav >= 1 && text.includes("Chyba 403") && pathOf(adam) === "/", `nav=${nav}; text='${text}'; back → ${pathOf(adam)}`];
});
const mgrA = await session(U.mgrA);
await step({ d: "Manager: HR pages and the other team's pages show the 403 page", pre: "manager Alfa", steps: "open /hr/rounds, /hr/overview, /hr/heatmap, /hr/issues, /hr/notes, Tím Beta page, trend, results, report, fill", exp: "403 on each (matrix, NFR-03)" }, async () => {
  const urls = ["/hr/rounds", "/hr/overview", "/hr/heatmap", "/hr/issues", "/hr/notes", `/team/${teamB.id}`, `/team/${teamB.id}/trend`, `/rounds/${seedBeta.id}/results`, `/rounds/${seedBeta.id}/report`, `/rounds/${seedBeta.id}/fill`];
  const m = await matrix(mgrA, urls);
  const bad = urls.filter((u) => !m[u].forbidden || m[u].http !== 403);
  return [bad.length === 0, `not 403: ${bad.map((u) => `${u}→${m[u].http}/${m[u].forbidden}`).join(", ") || "none"} of ${urls.length}`];
});
await step({ d: "Manager: own pages open", pre: "manager Alfa", steps: "open /rounds, /rounds/new, own results, report, team page, trend, /kudos", exp: "HTTP 200, no 403 page" }, async () => {
  const urls = ["/rounds", "/rounds/new", `/rounds/${roundA}/results`, `/rounds/${roundA}/report`, `/team/${teamA.id}`, `/team/${teamA.id}/trend`, "/kudos", `/rounds/${roundA}/fill`];
  const m = await matrix(mgrA, urls);
  const bad = urls.filter((u) => m[u].forbidden || m[u].http !== 200);
  return [bad.length === 0, `failing: ${bad.map((u) => `${u}→${m[u].http}`).join(", ") || "none"} of ${urls.length}`];
});
const hr = await session(U.hr);
await step({ d: "HR: all teams' pages and HR pages open; the fill page does not", pre: "HR", steps: "open /hr/rounds, /hr/overview, /hr/heatmap, /hr/issues, /hr/notes, both team pages and trends, results of both teams, /rounds/new; then the fill page", exp: "HTTP 200 on all; fill page 403 (matrix)" }, async () => {
  const urls = ["/hr/rounds", "/hr/overview", "/hr/heatmap", "/hr/issues", "/hr/notes", `/team/${teamA.id}`, `/team/${teamB.id}`, `/team/${teamA.id}/trend`, `/team/${teamB.id}/trend`, `/rounds/${seedBeta.id}/results`, `/rounds/${roundA}/results`, `/rounds/${seedBeta.id}/report`, "/rounds/new", "/kudos"];
  const m = await matrix(hr, urls);
  const bad = urls.filter((u) => m[u].forbidden || m[u].http !== 200);
  const f = await matrix(hr, [`/rounds/${roundA}/fill`]);
  return [bad.length === 0 && f[`/rounds/${roundA}/fill`].forbidden, `failing: ${bad.map((u) => `${u}→${m[u].http}`).join(", ") || "none"} of ${urls.length}; fill page 403=${f[`/rounds/${roundA}/fill`].forbidden}`];
});
await step({ d: "HR opening the manager's list /rounds is sent to the HR list", pre: "HR", steps: "open /rounds", exp: "HR list of all teams (redirect to /hr/rounds) or a 403 page, never a broken page" }, async () => {
  const resp = await hr.goto(`${BASE}/rounds`, { waitUntil: "networkidle" });
  const h1 = await hr.locator("main#main h1").first().innerText();
  return [resp.status() < 500 && (pathOf(hr) === "/hr/rounds" || await forbiddenShown(hr)), `path=${pathOf(hr)}, HTTP ${resp.status()}, h1='${h1}'`];
});
await step({ d: "Employee API matrix: write and read endpoints of other roles answer 403", pre: "Adam's API session", steps: "POST rounds, open, close, actions, questions; PATCH action; GET questions, results, hr/*, Beta summary", exp: "403 on each, no data (NFR-03)" }, async () => {
  const call = await api(U.alfa[0]);
  const res = [];
  for (const [u, m, b] of [["/api/rounds", "POST", {}], [`/api/rounds/${roundA}/open`, "POST"], [`/api/rounds/${roundA}/close`, "POST"], [`/api/rounds/${seedBeta.id}/actions`, "POST", {}], ["/api/questions", "POST", { text: "Otázka od zamestnanca QA?" }], ["/api/questions", "GET"], [`/api/rounds/${seedBeta.id}/results`, "GET"], ["/api/hr/overview", "GET"], ["/api/hr/heatmap", "GET"], ["/api/hr/issues", "GET"], ["/api/hr/notes", "GET"], ["/api/hr/issues", "POST", {}], [`/api/teams/${teamB.id}/summary`, "GET"], [`/api/teams/${teamA.id}/trend`, "GET"]]) {
    const r = await call(u, m, b); res.push(`${m} ${u.replace(/c[a-z0-9]{20,}/g, ":id")}=${r.status}`);
  }
  const bad = res.filter((x) => !x.endsWith("=403"));
  const s = (await db.round.findUnique({ where: { id: roundA } })).status;
  return [bad.length === 0 && s === "OPEN", `not 403: ${bad.join(", ") || "none"} of ${res.length}; round still ${s}`];
});
await step({ d: "Unknown address shows a Slovak 404 page with a way back, for a logged-in user", pre: "Adam logged in", steps: "open /neexistuje as an employee and /rounds/neexistuje/results as HR", exp: "HTTP 404, 'Túto stránku sme nenašli', link 'Späť na úvod' (BUG-013)" }, async () => {
  const r1 = await adam.goto(`${BASE}/neexistuje`, { waitUntil: "networkidle" });
  const t1 = await adam.locator("body").innerText();
  const nav1 = await adam.locator('nav[aria-label="Hlavná navigácia"]').count();
  const evidence = await shot(adam, "m3-04-404");
  const m = await session(U.hr); // employees and managers get 403 for any round that is not theirs (existence is not revealed), so HR asks for the unknown round
  const r2 = await m.goto(`${BASE}/rounds/neexistuje/results`, { waitUntil: "networkidle" });
  const t2 = await m.locator("body").innerText();
  const nav2 = await m.locator('nav[aria-label="Hlavná navigácia"]').count();
  await m.context().close();
  const ok = r1.status() === 404 && t1.includes("Túto stránku sme nenašli") && t1.includes("Späť na úvod") && r2.status() === 404 && t2.includes("Túto stránku sme nenašli");
  return [ok, `/neexistuje: HTTP ${r1.status()}, menu=${nav1}; /rounds/neexistuje/results: HTTP ${r2.status()}, menu=${nav2}, text='${t2.replace(/\s+/g, " ").slice(-90)}'`, evidence];
});

// ───── logout
const adam2 = await session(U.alfa[0]);          // second browser of the same user
const before = await cookieOf(adam);
await step({ d: "Logout ends the session in the browser", pre: "Adam on /kudos", steps: "click 'Odhlásiť sa'", exp: "lands on /login; cookie removed; '/' redirects to /login (MVP-01)" }, async () => {
  await adam.goto(`${BASE}/kudos`, { waitUntil: "networkidle" });
  await adam.getByRole("button", { name: "Odhlásiť sa" }).click();
  await adam.waitForURL("**/login", { timeout: 8000 });
  const c = await cookieOf(adam);
  await adam.goto(`${BASE}/`, { waitUntil: "networkidle" });
  return [!c && pathOf(adam) === "/login", `cookie present=${!!c}; '/' → ${pathOf(adam)}`, await shot(adam, "m3-05-after-logout")];
});
await step({ d: "Browser Back after logout does not bring the private page back", pre: "Adam logged out", steps: "press Back twice", exp: "ends on /login or shows no private data" }, async () => {
  await adam.goBack({ waitUntil: "networkidle" }).catch(() => {});
  await adam.goBack({ waitUntil: "networkidle" }).catch(() => {});
  await adam.waitForTimeout(500);
  const text = await adam.locator("body").innerText();
  return [pathOf(adam) === "/login" || !/Odhlásiť sa/.test(text), `path=${pathOf(adam)}; shows logout button=${/Odhlásiť sa/.test(text)}`];
});
await step({ d: "The token copied before logout is useless afterwards", pre: "cookie value saved before logout", steps: "GET /api/me and /api/kudos/me with the old cookie", exp: "401 ×2 (BUG-001)" }, async () => {
  const cookie = `fz_session=${before.value}`;
  const a = await rawCall("/api/me", { cookie }); const b = await rawCall("/api/kudos/me", { cookie });
  return [a.status === 401 && b.status === 401, `HTTP ${a.status}, ${b.status}`];
});
await step({ d: "Logout ends the user's sessions in every browser", pre: "Adam was logged in in a second browser context", steps: "in the second browser: click 'Môj tím'", exp: "redirect to /login (User.sessionsValidAfter)" }, async () => {
  await adam2.goto(`${BASE}/team/${teamA.id}`, { waitUntil: "networkidle" });
  return [pathOf(adam2) === "/login", `second browser → ${pathOf(adam2)}`];
});
await step({ d: "Logout of one user does not end other users' sessions", pre: "Adam logged out; manager and HR sessions open", steps: "manager Alfa and HR reload '/'", exp: "both stay logged in" }, async () => {
  await mgrA.goto(`${BASE}/`, { waitUntil: "networkidle" }); await hr.goto(`${BASE}/`, { waitUntil: "networkidle" });
  return [pathOf(mgrA) === "/" && pathOf(hr) === "/", `manager → ${pathOf(mgrA)}, HR → ${pathOf(hr)}`];
});
await step({ d: "The same user can log in again right after logging out", pre: "Adam logged out everywhere", steps: "log in through the form", exp: "lands on '/', API works" }, async () => {
  await uiLogin(adam, U.alfa[0]);
  const me = await adam.evaluate(async () => (await fetch("/api/me")).status);
  return [pathOf(adam) === "/" && me === 200, `path=${pathOf(adam)}, /api/me=${me}`];
});
await step({ d: "A failed logout tells the user and keeps them logged in", pre: "Adam logged in; POST /api/logout answered with 500 by interception", steps: "click 'Odhlásiť sa'", exp: "'Odhlásenie sa nepodarilo. Skús to znova.'; still on the page; next click (without interception) logs out (BUG-038)" }, async () => {
  await adam.route("**/api/logout", (r) => r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"internal_error"}' }));
  await adam.getByRole("button", { name: "Odhlásiť sa" }).click();
  await adam.waitForTimeout(1000);
  const msg = await adam.getByText("Odhlásenie sa nepodarilo. Skús to znova.").isVisible().catch(() => false);
  const still = pathOf(adam);
  const evidence = await shot(adam, "m3-06-logout-failed");
  await adam.unroute("**/api/logout");
  await adam.getByRole("button", { name: "Odhlásiť sa" }).click();
  await adam.waitForURL("**/login", { timeout: 8000 });
  return [msg && still === "/", `message=${msg}, path after failure=${still}, then → ${pathOf(adam)}`, evidence];
});
await step({ d: "Logout while the network is down tells the user", pre: "Adam logged in; browser offline", steps: "click 'Odhlásiť sa'", exp: "error message, still logged in after going online" }, async () => {
  await uiLogin(adam, U.alfa[0]);
  await adam.context().setOffline(true);
  await adam.getByRole("button", { name: "Odhlásiť sa" }).click();
  await adam.waitForTimeout(1000);
  const msg = await adam.getByText("Odhlásenie sa nepodarilo. Skús to znova.").isVisible().catch(() => false);
  await adam.context().setOffline(false);
  const me = await adam.evaluate(async () => (await fetch("/api/me")).status);
  return [msg && me === 200, `message=${msg}; /api/me after going online=${me}`];
});

// ───── session ends in the middle of a form
const cyril = await session(U.alfa[2]);
await step({ d: "Session ends while filling in a round: clear message, answers stay", pre: "Cyril on the comment step with all answers; cookie removed", steps: "Odoslať", exp: "'Prihlásenie vypršalo' + instruction + link 'Prihlásiť sa v novej karte'; comment still in the textarea; 0 responses (BUG-012)" }, async () => {
  await wizard(cyril, roundA, [4, 3, 5, 2], "Komentár pred vypršaním (QA Cyril).", { submit: false });
  await cyril.context().clearCookies();
  await cyril.getByRole("button", { name: "Odoslať" }).click();
  await cyril.getByText("Prihlásenie vypršalo").first().waitFor({ timeout: 8000 });
  const text = await mainOnly(cyril);
  const link = await cyril.getByRole("link", { name: "Prihlásiť sa v novej karte" }).count();
  const kept = await cyril.locator("textarea").inputValue();
  const n = await db.response.count({ where: { roundId: roundA } });
  return [text.includes("Odpovede sa neodoslali.") && link === 1 && kept.includes("QA Cyril") && n === 0, `message=${text.includes("Odpovede sa neodoslali.")}, link=${link}, comment kept=${kept.includes("QA Cyril")}, responses=${n}`, await shot(cyril, "m3-07-expired-mid-fill")];
});
await step({ d: "After logging in again in a new tab, the same form submits with the kept answers", pre: "previous step", steps: "open the link in a new tab, log in; back in the first tab click Odoslať", exp: "thank-you; DB: 1 response 4,3,5,2 with the comment; 1 participation" }, async () => {
  const tab = await cyril.context().newPage();
  await tab.goto(`${BASE}/login`); await tab.fill('input[name="email"]', U.alfa[2]); await tab.fill('input[name="password"]', PASSWORD);
  await tab.click('button[type="submit"]'); await tab.waitForURL((u) => !u.pathname.startsWith("/login")); await tab.close();
  await cyril.getByRole("button", { name: "Odoslať" }).click();
  await cyril.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 10000 });
  const rows = await db.response.findMany({ where: { roundId: roundA } });
  const r = rows[0];
  return [rows.length === 1 && [r.v1, r.v2, r.v3, r.v4].join() === "4,3,5,2" && r.comment.includes("QA Cyril"), `responses=${rows.length}: ${r?.v1},${r?.v2},${r?.v3},${r?.v4}; comment kept=${r?.comment?.includes("QA Cyril")}`];
});
const dana = await session(U.alfa[3]);
await step({ d: "Session invalidated on the server (logout elsewhere) while writing a kudos: clear message, text stays", pre: "Dana has the kudos form filled; her sessions are ended by a logout from another device (API)", steps: "Poslať kudos", exp: "'Prihlásenie vypršalo. Prihlás sa znova v novej karte…'; text kept; no kudos stored (BUG-012)" }, async () => {
  await dana.goto(`${BASE}/kudos?tab=send`, { waitUntil: "networkidle" });
  const barbora = await db.user.findUnique({ where: { email: U.alfa[1] } });
  await dana.selectOption('select[name="toUserId"]', barbora.id);
  await dana.locator("form textarea").fill("Vďaka za pomoc pred vypršaním relácie (QA Dana).");
  const other = await api(U.alfa[3]); await other("/api/logout", "POST");
  await dana.locator('form button[type="submit"]').click();
  await dana.waitForTimeout(1200);
  const msg = await dana.getByText("Prihlásenie vypršalo. Prihlás sa znova v novej karte a potom to tu skús ešte raz. Čo máš vyplnené, zostane.").isVisible().catch(() => false);
  const kept = await dana.locator("form textarea").inputValue();
  return [msg && kept.includes("QA Dana") && (await db.kudos.count()) === 0, `message=${msg}, text kept=${kept.includes("QA Dana")}, kudos=${await db.kudos.count()}`, await shot(dana, "m3-08-expired-kudos")];
});
await step({ d: "With an ended session any navigation goes to /login", pre: "Dana's session ended", steps: "click 'Domov' in the menu", exp: "/login" }, async () => {
  await dana.locator("header nav").first().getByRole("link", { name: "Domov" }).click();
  await dana.waitForURL("**/login", { timeout: 8000 });
  return [pathOf(dana) === "/login", `path=${pathOf(dana)}`];
});
await step({ d: "Session ends while the manager writes a step: clear message, form content stays", pre: "manager Alfa on results of the closed round with the form filled; cookie removed", steps: "Pridať krok", exp: "session-expired message; topic kept; no Action stored" }, async () => {
  await mgrAApi(`/api/rounds/${roundA}/close`, "POST");
  await mgrA.goto(`${BASE}/rounds/${roundA}/results`, { waitUntil: "networkidle" });
  await mgrA.fill('input[name="topic"]', "Téma pred vypršaním QA");
  await mgrA.fill('textarea[name="description"]', "Opis kroku pred vypršaním.");
  await mgrA.fill('input[name="dueDate"]', "2027-01-20");
  const saved = await mgrA.context().cookies();
  await mgrA.context().clearCookies();
  await mgrA.getByRole("button", { name: "Pridať krok" }).click();
  await mgrA.waitForTimeout(1200);
  const msg = await mgrA.getByText("Prihlásenie vypršalo.", { exact: false }).first().isVisible().catch(() => false);
  const kept = await mgrA.inputValue('input[name="topic"]');
  const n = await db.action.count();
  await mgrA.context().addCookies(saved);
  return [msg && kept === "Téma pred vypršaním QA" && n === 0, `message=${msg}, topic kept='${kept}', actions=${n}`, await shot(mgrA, "m3-09-expired-action")];
});
await step({ d: "Session ends before the manager confirms starting a round: understandable message, no change", pre: "manager Alfa on /rounds with a draft; cookie removed", steps: "Spustiť → confirm", exp: "a message about the ended login (not a silent failure and not a success toast); round stays DRAFT" }, async () => {
  const id = await apiRound(mgrAApi, { teamId: teamA.id, name: "Pulse – koncept pred vypršaním", open: false });
  await mgrA.goto(`${BASE}/rounds`, { waitUntil: "networkidle" });
  const saved = await mgrA.context().cookies();
  await mgrA.context().clearCookies();
  await rowById(mgrA, id).getByRole("button", { name: "Spustiť" }).click();
  await mgrA.locator("dialog[open]").getByRole("button", { name: "Spustiť" }).click();
  await mgrA.waitForTimeout(1500);
  const text = await mgrA.locator("body").innerText();
  const t = await toast(mgrA, "Kolo je spustené").count();
  const s = (await db.round.findUnique({ where: { id } })).status;
  const informed = /Prihlásenie vypršalo/.test(text) || pathOf(mgrA) === "/login";
  const evidence = await shot(mgrA, "m3-10-expired-open");
  await mgrA.context().addCookies(saved);
  return [informed && t === 0 && s === "DRAFT", `informed=${informed} (path=${pathOf(mgrA)}), success toast=${t}, db=${s}; visible message='${(text.match(/[^\n]*(vypršalo|nepodarilo|zmenilo stav)[^\n]*/) ?? [""])[0]}'`, evidence];
});
await step({ d: "Tampered session cookie is refused", pre: "manager Alfa logged in", steps: "change the last 4 characters of the cookie; open '/'", exp: "redirect to /login" }, async () => {
  const b = await getBrowser();
  const ctx = await b.newContext();
  const c = await cookieOf(mgrA);
  await ctx.addCookies([{ ...c, value: c.value.slice(0, -4) + "AAAA" }]);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const path = pathOf(p); await ctx.close();
  return [path === "/login", `path=${path}`];
});
await step({ d: "Forged tokens are refused by the API", pre: "valid tokens of Dana (employee) and HR", steps: "HR payload + employee signature; payload only; empty; 'x.y.z'", exp: "401 for each on /api/me and /api/hr/issues" }, async () => {
  const d = (await api(U.alfa[4])).cookie.split("=")[1]; const h = (await api(U.hr)).cookie.split("=")[1];
  const forged = [`${h.split(".")[0]}.${d.split(".")[1]}`, h.split(".")[0], "", "x.y.z"];
  const out = [];
  for (const f of forged) { out.push((await rawCall("/api/me", { cookie: `fz_session=${f}` })).status); out.push((await rawCall("/api/hr/issues", { cookie: `fz_session=${f}` })).status); }
  return [out.every((s) => s === 401), `statuses=${out.join(",")}`];
});
await step({ d: "Deep link: an anonymous visitor who opens a protected address and logs in ends inside the application", pre: "logged out", steps: `open /team/${"<id>"}; log in as Barbora`, exp: "after login the user is on '/' (MVP-01: 'presmerujú na úvodnú stránku roly') or on the requested page; never an error" }, async () => {
  const p = await session(null);
  await p.goto(`${BASE}/team/${teamA.id}`, { waitUntil: "networkidle" });
  const loginUrl = p.url().replace(BASE, "");
  await p.fill('input[name="email"]', U.alfa[1]); await p.fill('input[name="password"]', PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 10000 });
  const path = pathOf(p); await p.context().close();
  return [path === "/" || path === `/team/${teamA.id}`, `login URL='${loginUrl.replace(/c[a-z0-9]{20,}/g, ":id")}', after login → ${path.replace(/c[a-z0-9]{20,}/g, ":id")}`];
});
await step({ d: "Known BUG-036: after switching accounts in the same browser, a tab opened earlier still shows the old name", pre: "Emil's tab open on the home page; in a second tab of the same browser Barbora logs in", steps: "look at the first tab without reloading; then reload it", exp: "KNOWN open defect BUG-036: the stale tab shows the old user until reload; after reload it shows the new user" }, async () => {
  const emil = await session(U.alfa[4]);
  const tab = await emil.context().newPage();
  await tab.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  let loginForm = await tab.locator('input[name="email"]').count();
  if (!loginForm) { // already logged in → log out is needed to switch; use the API login in the same context instead
    await tab.evaluate(async ([e, p]) => { await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: e, password: p }) }); }, [U.alfa[1], PASSWORD]);
  } else { await tab.fill('input[name="email"]', U.alfa[1]); await tab.fill('input[name="password"]', PASSWORD); await tab.click('button[type="submit"]'); await tab.waitForTimeout(1000); }
  const stale = (await emil.locator("header").first().innerText()).includes("Emil");
  await emil.reload({ waitUntil: "networkidle" });
  const fresh = (await emil.locator("header").first().innerText()).includes("Barbora");
  await emil.context().close();
  return [stale && fresh, `stale tab still shows Emil=${stale} (known BUG-036); after reload shows Barbora=${fresh}`];
});
await step({ d: "Pages of a logged-in user are not cacheable by shared caches", pre: "HR session", steps: "GET '/' and /hr/issues with the cookie; read Cache-Control", exp: "private/no-store (known risk R-4 if missing on API responses)" }, async () => {
  const call = await api(U.hr);
  const a = await call("/"); const b = await call("/hr/issues"); const c = await call("/api/hr/issues");
  const cc = [a, b, c].map((r) => r.headers.get("cache-control"));
  return [/no-store|private/.test(cc[0] ?? "") && /no-store|private/.test(cc[1] ?? ""), `'/'=${cc[0]}; /hr/issues=${cc[1]}; /api/hr/issues=${cc[2]} (API header missing = known risk R-4)`];
});
await closeBrowser();
