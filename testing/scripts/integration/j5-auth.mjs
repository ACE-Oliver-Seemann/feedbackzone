// Journey 5: authentication workflows end to end (MVP-01, MVP-03, NFR-05). Seed-only start.
import { BASE, U, PASSWORD, db, resetDb, recorder, session, uiLogin, shot, mainText, api, rawCall, ymd, fillWizard, closeBrowser, getBrowser } from "./lib.mjs";

const R = recorder("j5-auth");
const step = async (meta, fn) => {
  try { const [ok, actual, evidence] = await fn(); return R.check({ j: "J5", ...meta }, ok, actual, evidence ?? ""); }
  catch (error) { return R.check({ j: "J5", ...meta }, false, `SCRIPT/RUNTIME ERROR: ${error.message}`); }
};
resetDb(false);
const teamA = await db.team.findFirstOrThrow({ where: { name: "Tím Alfa" } });
const teamB = await db.team.findFirstOrThrow({ where: { name: "Tím Beta" } });
const seedBeta = await db.round.findFirstOrThrow({ where: { teamId: teamB.id } });
// an open round for Alfa, created through the API as HR
const hrApi = await api(U.hr);
const qs = (await hrApi("/api/questions")).json.questions.filter((q) => !q.fixed).slice(0, 3).map((q) => q.id);
const created = await hrApi("/api/rounds", "POST", { name: "QA auth kolo", teamId: teamA.id, closesAt: ymd(new Date(Date.now() + 7 * 864e5)), questionIds: qs });
const roundId = created.json.round.id;
await hrApi(`/api/rounds/${roundId}/open`, "POST");

const anon = await session(null);
await step({ d: "Wrong password shows one generic message and does not log in", pre: "logged out", steps: "login with adam.alfa@example.test + wrong password", exp: "'Nesprávny e-mail alebo heslo.'; URL stays /login; no session cookie (MVP-01)" }, async () => {
  await anon.goto(`${BASE}/login`);
  await anon.getByLabel("E-mail").fill(U.alfa[0]);
  await anon.getByLabel("Heslo").fill("ZleHeslo999");
  await anon.getByRole("button", { name: "Prihlásiť sa" }).click();
  await anon.getByRole("alert").filter({ hasText: "Nesprávny" }).waitFor();
  const msg = await anon.getByRole("alert").filter({ hasText: "Nesprávny" }).innerText();
  const cookies = await anon.context().cookies();
  return [msg === "Nesprávny e-mail alebo heslo." && new URL(anon.url()).pathname === "/login" && !cookies.some((c) => c.name === "fz_session"), `msg='${msg}', cookies=${cookies.map((c) => c.name)}`, await shot(anon, "j5-01-wrong-password")];
});
await step({ d: "Unknown e-mail gives exactly the same message and status as a wrong password", pre: "logged out", steps: "UI login with nobody@example.test; compare API responses of both failures", exp: "same text; API 401 with identical body for both cases (MVP-01: no hint which one is wrong)" }, async () => {
  await anon.getByLabel("E-mail").fill("nobody@example.test");
  await anon.getByLabel("Heslo").fill(PASSWORD);
  await anon.getByRole("button", { name: "Prihlásiť sa" }).click();
  await anon.waitForTimeout(800);
  const msg = await anon.getByRole("alert").filter({ hasText: "Nesprávny" }).innerText();
  const a = await rawCall("/api/login", { method: "POST", body: { email: "nobody@example.test", password: PASSWORD } });
  const b = await rawCall("/api/login", { method: "POST", body: { email: U.alfa[0], password: "bad" } });
  return [msg === "Nesprávny e-mail alebo heslo." && a.status === 401 && b.status === 401 && a.text === b.text, `msg='${msg}'; unknown e-mail → ${a.status} ${a.text}; wrong password → ${b.status} ${b.text}`];
});
await step({ d: "Empty form is not submitted", pre: "logged out", steps: "clear both fields, click 'Prihlásiť sa'", exp: "browser validation blocks the submit; no request to /api/login; stays on /login" }, async () => {
  let calls = 0; const h = (r) => { if (r.url().includes("/api/login")) calls++; };
  anon.on("request", h);
  await anon.getByLabel("E-mail").fill(""); await anon.getByLabel("Heslo").fill("");
  await anon.getByRole("button", { name: "Prihlásiť sa" }).click();
  await anon.waitForTimeout(400);
  anon.off("request", h);
  return [calls === 0 && new URL(anon.url()).pathname === "/login", `login requests=${calls}`];
});
await step({ d: "E-mail is accepted regardless of case and surrounding spaces", pre: "logged out", steps: "API login with '  ADAM.ALFA@EXAMPLE.TEST '", exp: "200 and a session cookie" }, async () => {
  const r = await rawCall("/api/login", { method: "POST", body: { email: "  ADAM.ALFA@EXAMPLE.TEST ", password: PASSWORD } });
  return [r.status === 200 && (r.headers.get("set-cookie") ?? "").startsWith("fz_session="), `HTTP ${r.status}, user=${r.json?.user?.name}`];
});
await step({ d: "Password is case sensitive", pre: "logged out", steps: "API login with 'heslo123'", exp: "401" }, async () => {
  const r = await rawCall("/api/login", { method: "POST", body: { email: U.alfa[0], password: "heslo123" } });
  return [r.status === 401, `HTTP ${r.status}`];
});
await step({ d: "Session cookie attributes", pre: "-", steps: "POST /api/login; read Set-Cookie", exp: "HttpOnly; SameSite=Lax; Path=/; Secure; Max-Age=28800 (NFR-05)" }, async () => {
  const a = await api(U.alfa[0]);
  const c = a.setCookie.toLowerCase();
  return [c.includes("httponly") && c.includes("samesite=lax") && c.includes("path=/") && c.includes("secure") && c.includes("max-age=28800"), a.setCookie.replace(/fz_session=[^;]+/, "fz_session=<token>")];
});
await step({ d: "Login response does not expose the password hash or e-mail list", pre: "-", steps: "POST /api/login; inspect JSON", exp: "only id, name, role, teamId of the user and the home path" }, async () => {
  const r = await rawCall("/api/login", { method: "POST", body: { email: U.alfa[0], password: PASSWORD } });
  const keys = Object.keys(r.json.user).sort().join();
  return [keys === "id,name,role,teamId" && !r.text.includes("$2") && r.json.home === "/", `user keys=${keys}; home=${r.json.home}`];
});

// ───── per-role landing + menu
for (const [email, role, name, menu] of [
  [U.alfa[0], "Zamestnanec", "Adam Vzorový", ["Domov", "Môj tím", "Kudos"]],
  [U.mgrA, "Manažér", "Alena Testová", ["Domov", "Prieskumy", "Môj tím", "Kudos"]],
  [U.hr, "HR", "Hana Personálna", ["Domov", "Prieskumy", "Prehľady", "Podnety", "Kudos"]],
]) {
  await step({ d: `Login as ${role}: lands on '/', header shows the name and role, menu matches the role`, pre: "logged out", steps: "log in through the form", exp: `path '/', '${name}', '${role}', menu ${menu.join(", ")} (MVP-01, IT-11, IT-12)` }, async () => {
    const p = await session(email);
    const header = (await p.locator("header").innerText()).replace(/\s+/g, " ");
    const items = await p.locator("header nav a").allInnerTexts();
    const current = await p.locator('header nav a[aria-current="page"]').innerText();
    const ok = new URL(p.url()).pathname === "/" && header.includes(name) && header.includes(role) && JSON.stringify(items) === JSON.stringify(menu) && current === "Domov";
    const s = await shot(p, `j5-02-landing-${role}`);
    await p.context().close();
    return [ok, `header='${header}', menu=${items}, current=${current}`, s];
  });
}

// ───── session lifetime in the browser
const adam = await session(U.alfa[0]);
await step({ d: "The session cookie is not readable from page scripts", pre: "Adam logged in", steps: "evaluate document.cookie", exp: "does not contain fz_session (HttpOnly, NFR-05)" }, async () => {
  const c = await adam.evaluate(() => document.cookie);
  return [!c.includes("fz_session"), `document.cookie='${c}'`];
});
await step({ d: "Session survives a page refresh and a new tab", pre: "Adam logged in", steps: "open /kudos/me, reload; open /team/:id in a second tab of the same browser context", exp: "both pages render for Adam, no redirect to /login" }, async () => {
  await adam.goto(`${BASE}/kudos/me`);
  await adam.reload();
  const a = new URL(adam.url()).pathname;
  const tab2 = await adam.context().newPage();
  await tab2.goto(`${BASE}/team/${teamA.id}`);
  const b = new URL(tab2.url()).pathname;
  const name = (await tab2.locator("header").innerText()).includes("Adam Vzorový");
  await tab2.close();
  return [a === "/kudos/me" && b === `/team/${teamA.id}` && name, `after reload path=${a}; second tab path=${b.replace(teamA.id, ":id")}, shows Adam=${name}`];
});
await step({ d: "A logged-in user who opens /login again", pre: "Adam logged in", steps: "open /login directly", exp: "is sent to the home page (or sees the login form without losing the session)" }, async () => {
  await adam.goto(`${BASE}/login`);
  const path = new URL(adam.url()).pathname;
  const cookies = (await adam.context().cookies()).some((c) => c.name === "fz_session");
  return [path === "/" || cookies, `path after opening /login=${path}; session cookie still present=${cookies}`, await shot(adam, "j5-03-login-while-logged-in")];
});

// ───── protected routes without a session
const PROTECTED = ["/", "/rounds", "/rounds/new", `/rounds/${roundId}/fill`, `/rounds/${roundId}/results`, `/rounds/${roundId}/report`, `/team/${teamA.id}`, `/team/${teamA.id}/trend`, "/kudos/new", "/kudos/me", "/hr/rounds", "/hr/overview", "/hr/heatmap", "/hr/issues", "/hr/notes"];
await step({ d: "Every page redirects an anonymous visitor to /login", pre: "no cookie", steps: `open ${PROTECTED.length} protected URLs`, exp: "each ends on /login and shows no application data (MVP-03)" }, async () => {
  const out = [];
  for (const p of PROTECTED) {
    await anon.goto(`${BASE}${p}`);
    const text = await mainText(anon);
    out.push(`${p.replace(roundId, ":id").replace(teamA.id, ":team")}→${new URL(anon.url()).pathname}${/Čo treba urobiť|Výsledky kola|Povedali ste/.test(text) ? " LEAK" : ""}`);
  }
  return [out.every((o) => o.endsWith("→/login")), out.join("; ")];
});
const API_GET = ["/api/me", "/api/questions", "/api/rounds", `/api/rounds/${roundId}`, `/api/rounds/${roundId}/results`, `/api/rounds/${roundId}/suggestions`, `/api/teams/${teamA.id}/summary`, `/api/teams/${teamA.id}/trend`, "/api/kudos/me", "/api/hr/overview", "/api/hr/heatmap", "/api/hr/issues", "/api/hr/notes"];
await step({ d: "Every API endpoint refuses an anonymous request", pre: "no cookie", steps: `GET ${API_GET.length} endpoints; POST rounds, open, close, responses, actions, kudos, questions, logout; PATCH action`, exp: "401 everywhere, no data in the body (MVP-03)" }, async () => {
  const out = [];
  for (const p of API_GET) out.push((await rawCall(p)).status);
  for (const [m, p] of [["POST", "/api/rounds"], ["POST", `/api/rounds/${roundId}/open`], ["POST", `/api/rounds/${roundId}/close`], ["POST", `/api/rounds/${roundId}/responses`], ["POST", `/api/rounds/${roundId}/actions`], ["POST", "/api/kudos"], ["POST", "/api/questions"], ["POST", "/api/logout"], ["PATCH", "/api/actions/x"], ["POST", "/api/hr/issues"], ["POST", "/api/hr/notes"]]) out.push((await rawCall(p, { method: m, body: {} })).status);
  return [out.every((s) => s === 401), `statuses=${out.join(",")}`];
});

// ───── logout
await adam.goto(`${BASE}/`);
await adam.goto(`${BASE}/kudos/me`);
const cookieBefore = (await adam.context().cookies()).find((c) => c.name === "fz_session");
await step({ d: "Logout ends the session in the browser", pre: "Adam on /kudos/me", steps: "click 'Odhlásiť sa'", exp: "lands on /login; cookie fz_session removed; opening / redirects to /login (MVP-01)" }, async () => {
  await adam.getByRole("button", { name: "Odhlásiť sa" }).click();
  await adam.waitForURL("**/login");
  const cookies = (await adam.context().cookies()).some((c) => c.name === "fz_session");
  await adam.goto(`${BASE}/`);
  const path = new URL(adam.url()).pathname;
  return [!cookies && path === "/login", `cookie present=${cookies}; '/' → ${path}`, await shot(adam, "j5-04-after-logout")];
});
await step({ d: "Back button after logout does not show the previous user's pages", pre: "Adam logged out; history: /, /kudos/me(replaced by /login)", steps: "press browser Back twice; read what is displayed", exp: "login page (or a redirect to it); no name, tasks or kudos of Adam visible" }, async () => {
  await adam.goto(`${BASE}/login`);
  await adam.goBack(); await adam.waitForTimeout(600);
  const t1 = await mainText(adam); const u1 = new URL(adam.url()).pathname;
  await adam.goBack().catch(() => {}); await adam.waitForTimeout(600);
  const t2 = await mainText(adam); const u2 = new URL(adam.url()).pathname;
  const leak = [t1, t2].some((t) => t.includes("Adam Vzorový") || t.includes("Čo treba urobiť teraz") || t.includes("Moje kudos"));
  return [!leak, `after back #1: ${u1} leak=${t1.includes("Adam Vzorový")}; after back #2: ${u2} leak=${t2.includes("Adam Vzorový")}`, await shot(adam, "j5-05-back-after-logout")];
});
await step({ d: "Pages are served with headers that forbid caching", pre: "Adam's valid session", steps: "GET / and /kudos/me with a cookie; read Cache-Control", exp: "no-store (so that Back/shared caches cannot replay private pages)" }, async () => {
  const a = await api(U.alfa[0]);
  const r1 = await a("/"); const r2 = await a("/kudos/me"); const r3 = await a("/api/kudos/me");
  const cc = [r1, r2, r3].map((r) => r.headers.get("cache-control"));
  return [cc.slice(0, 2).every((c) => (c ?? "").includes("no-store")), `'/' → ${cc[0]}; '/kudos/me' → ${cc[1]}; '/api/kudos/me' → ${cc[2]}`];
});
await step({ d: "The old session token is useless after logout", pre: "Adam logged out through the UI; the cookie value was saved before logout", steps: "send GET /api/me and GET /api/kudos/me with the old cookie value", exp: "401 – 'Odhlásenie zruší reláciu' (MVP-01)" }, async () => {
  const cookie = `fz_session=${cookieBefore.value}`;
  const r1 = await rawCall("/api/me", { cookie }); const r2 = await rawCall("/api/kudos/me", { cookie });
  return [r1.status === 401 && r2.status === 401, `GET /api/me → ${r1.status} ${r1.text.slice(0, 120)}; GET /api/kudos/me → ${r2.status}`];
});

// ───── two tabs
const ctxPage = await session(U.alfa[1]);
const tabB = await ctxPage.context().newPage();
tabB.on("dialog", (d) => d.accept());
await step({ d: "Two tabs: logout in one tab, then navigation in the other", pre: "Barbora logged in, two tabs open (home in A, kudos form in B)", steps: "tab A: Odhlásiť sa; tab B: click 'Môj tím' in the menu", exp: "tab B ends on /login, no team data shown" }, async () => {
  await tabB.goto(`${BASE}/kudos/new`);
  await ctxPage.getByRole("button", { name: "Odhlásiť sa" }).click();
  await ctxPage.waitForURL("**/login");
  await tabB.locator("header nav").getByRole("link", { name: "Môj tím" }).click();
  await tabB.waitForURL("**/login", { timeout: 8000 }).catch(() => {});
  const path = new URL(tabB.url()).pathname; const text = await mainText(tabB);
  return [path === "/login" && !text.includes("Povedali ste"), `tab B path=${path}`, await shot(tabB, "j5-06-two-tabs-nav")];
});
await step({ d: "Two tabs: logout in one tab, then a form submit in the other (kudos)", pre: "Barbora logs in again; tab B has a filled kudos form; tab A logs out", steps: "tab B: click 'Poslať kudos'", exp: "the user learns the session ended (message or redirect to login); nothing stored; the typed text is not lost silently" }, async () => {
  await uiLogin(ctxPage, U.alfa[1]);
  await tabB.goto(`${BASE}/kudos/new`);
  await tabB.locator('select[name="toUserId"]').selectOption({ label: "Adam Vzorový (Tím Alfa)" });
  await tabB.locator("form textarea").fill("QA kudos písané pred odhlásením v inej karte.");
  await ctxPage.getByRole("button", { name: "Odhlásiť sa" }).click();
  await ctxPage.waitForURL("**/login");
  await tabB.getByRole("button", { name: "Poslať kudos" }).click();
  await tabB.waitForTimeout(1200);
  const path = new URL(tabB.url()).pathname;
  const alerts = await tabB.getByRole("alert").allInnerTexts();
  const kept = path === "/kudos/new" ? await tabB.locator("form textarea").inputValue() : "(navigated away)";
  const n = await db.kudos.count();
  const informed = path === "/login" || alerts.some((a) => /prihl|relác/i.test(a));
  return [informed && n === 0, `path=${path}; message=${JSON.stringify(alerts)}; text kept='${kept.slice(0, 30)}…'; kudos rows=${n}`, await shot(tabB, "j5-07-two-tabs-submit")];
});

// ───── expired / tampered session mid-form
const cyril = await session(U.alfa[2], { width: 390, height: 844 });
await step({ d: "Session expires while a member is filling in a round (cookie removed before the final submit)", pre: "Cyril on the comment step of the wizard with all answers chosen", steps: "delete the session cookie; click Odoslať; click Odoslať again", exp: "the user is told to log in again (or redirected to /login); nothing stored" }, async () => {
  await fillWizard(cyril, roundId, [4, 4, 3, 5], "QA komentár pred vypršaním relácie.", { stopBeforeSubmit: true });
  await cyril.context().clearCookies();
  await cyril.getByRole("button", { name: "Odoslať" }).click();
  await cyril.waitForTimeout(1000);
  const alerts1 = await cyril.getByRole("alert").allInnerTexts();
  await cyril.getByRole("button", { name: "Odoslať" }).click().catch(() => {});
  await cyril.waitForTimeout(800);
  const path = new URL(cyril.url()).pathname;
  const alerts2 = await cyril.getByRole("alert").allInnerTexts();
  const rc = await db.response.count({ where: { roundId } });
  const informed = path === "/login" || [...alerts1, ...alerts2].some((a) => /prihl|relác/i.test(a));
  return [informed && rc === 0, `path=${path}; message after 1st try=${JSON.stringify(alerts1)}; after retry=${JSON.stringify(alerts2)}; responses=${rc}`, await shot(cyril, "j5-08-expired-mid-fill")];
});
await step({ d: "After the session expired mid-form, the member can log in again and fill the round (answers must be re-entered)", pre: "previous step", steps: "log in again; open the round", exp: "wizard starts from the intro (no server-side draft, NFR-01); submit works; 1 response" }, async () => {
  await uiLogin(cyril, U.alfa[2]);
  await fillWizard(cyril, roundId, [4, 4, 3, 5], "QA komentár po opätovnom prihlásení.");
  await cyril.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor();
  const rc = await db.response.count({ where: { roundId } });
  return [rc === 1, `responses=${rc}`];
});
const dana = await session(U.alfa[3]);
await step({ d: "Tampered session cookie (signature changed) is refused in the browser", pre: "Dana logged in", steps: "replace the last 4 characters of the cookie; open /", exp: "redirect to /login" }, async () => {
  const c = (await dana.context().cookies()).find((x) => x.name === "fz_session");
  const bad = c.value.slice(0, -4) + (c.value.endsWith("AAAA") ? "BBBB" : "AAAA");
  await dana.context().clearCookies();
  await dana.context().addCookies([{ name: "fz_session", value: bad, url: BASE, httpOnly: true, sameSite: "Lax" }]);
  await dana.goto(`${BASE}/`);
  return [new URL(dana.url()).pathname === "/login", `path=${new URL(dana.url()).pathname}`];
});
await step({ d: "Forged payload: another user's id with one's own signature is refused", pre: "valid tokens of Dana and of HR", steps: "combine HR's payload with Dana's signature; also payload only; also empty value; also 'x.y.z'", exp: "401 for each on /api/me and on /api/hr/issues" }, async () => {
  const d = (await api(U.alfa[3])).cookie.split("=")[1]; const h = (await api(U.hr)).cookie.split("=")[1];
  const forged = [`${h.split(".")[0]}.${d.split(".")[1]}`, h.split(".")[0], "", "x.y.z", `${h}.extra`];
  const out = [];
  for (const f of forged) { out.push((await rawCall("/api/me", { cookie: `fz_session=${f}` })).status); out.push((await rawCall("/api/hr/issues", { cookie: `fz_session=${f}` })).status); }
  return [out.every((s) => s === 401), `statuses=${out}`];
});
await step({ d: "Switching accounts in the same browser: the second login replaces the first identity in every tab", pre: "tab A: Emil on the comment step of the wizard; tab B (same browser): Emil logs out and Dana logs in", steps: "tab A: click Odoslať", exp: "the response must not be stored silently under a different person than the one tab A shows" }, async () => {
  const emil = await session(U.alfa[4]);
  await fillWizard(emil, roundId, [2, 2, 2, 2], "", { stopBeforeSubmit: true });
  const tab = await emil.context().newPage();
  await tab.goto(`${BASE}/`);
  await tab.getByRole("button", { name: "Odhlásiť sa" }).click();
  await tab.waitForURL("**/login");
  await uiLogin(tab, U.alfa[3]);
  const shown = (await emil.locator("header").innerText()).includes("Emil Pokusný");
  await emil.getByRole("button", { name: "Odoslať" }).click();
  await emil.waitForTimeout(1200);
  const text = await mainText(emil);
  const emilU = await db.user.findUniqueOrThrow({ where: { email: U.alfa[4] } }); const danaU = await db.user.findUniqueOrThrow({ where: { email: U.alfa[3] } });
  const pe = await db.participation.count({ where: { roundId, userId: emilU.id } }); const pd = await db.participation.count({ where: { roundId, userId: danaU.id } });
  const s = await shot(emil, "j5-09-account-switch");
  await emil.context().close();
  return [!(pd === 1 && pe === 0 && text.includes("Ďakujeme za odpoveď")), `tab A header still shows Emil=${shown}; after submit tab A says thank-you=${text.includes("Ďakujeme za odpoveď")}; participation Emil=${pe}, Dana=${pd}`, s];
});

// ───── role restrictions via direct URLs (roles not covered in J1)
const hr = await session(U.hr);
await step({ d: "HR cannot fill in a round", pre: "open round of Alfa", steps: "HR opens /rounds/:id/fill; POST /api/rounds/:id/responses; GET /api/rounds/:id", exp: "403 page; API 403; no row (matrix: HR does not fill)" }, async () => {
  const res = await hr.goto(`${BASE}/rounds/${roundId}/fill`);
  const r1 = await hrApi(`/api/rounds/${roundId}/responses`, "POST", { answers: [3, 3, 3, 3] }); const r2 = await hrApi(`/api/rounds/${roundId}`);
  return [res.status() === 403 && r1.status === 403 && r2.status === 403, `page ${res.status()}, POST ${r1.status}, GET ${r2.status}`, await shot(hr, "j5-10-hr-fill-403")];
});
await step({ d: "HR opening the manager's list /rounds is taken to the HR list", pre: "HR logged in", steps: "open /rounds", exp: "redirect to /hr/rounds" }, async () => {
  await hr.goto(`${BASE}/rounds`);
  return [new URL(hr.url()).pathname === "/hr/rounds", new URL(hr.url()).pathname];
});
const mgrA = await session(U.mgrA);
await step({ d: "Manager cannot open any HR page", pre: "manager Alfa logged in", steps: "open /hr/rounds, /hr/overview, /hr/heatmap, /hr/issues, /hr/notes", exp: "403 page on each, with a link back home" }, async () => {
  const out = [];
  for (const p of ["/hr/rounds", "/hr/overview", "/hr/heatmap", "/hr/issues", "/hr/notes"]) out.push(`${p}=${(await mgrA.goto(`${BASE}${p}`)).status()}`);
  const text = await mainText(mgrA);
  await mgrA.getByRole("link", { name: "Späť na úvod" }).click();
  await mgrA.waitForURL(`${BASE}/`);
  return [out.every((o) => o.endsWith("=403")) && text.includes("Sem nemáš prístup"), out.join("; ") + "; 'Späť na úvod' works", await shot(mgrA, "j5-11-mgr-home")];
});
await step({ d: "Manager cannot create, open or close a round of another team", pre: "manager Alfa; closed Beta round", steps: "POST /api/rounds with teamId=Beta; POST open/close on the Beta round; open its fill page", exp: "403 each; no new round for Beta (matrix)" }, async () => {
  const a = await api(U.mgrA);
  const before = await db.round.count({ where: { teamId: teamB.id } });
  const r1 = await a("/api/rounds", "POST", { name: "QA cudzí tím", teamId: teamB.id, closesAt: ymd(new Date(Date.now() + 864e5)), questionIds: qs });
  const r2 = await a(`/api/rounds/${seedBeta.id}/open`, "POST"); const r3 = await a(`/api/rounds/${seedBeta.id}/close`, "POST");
  const page = await mgrA.goto(`${BASE}/rounds/${seedBeta.id}/fill`);
  return [r1.status === 403 && r2.status === 403 && r3.status === 403 && page.status() === 403 && (await db.round.count({ where: { teamId: teamB.id } })) === before, `create ${r1.status}, open ${r2.status}, close ${r3.status}, fill page ${page.status()}`];
});
await step({ d: "Unknown ids: manager gets 403 (cannot probe), HR gets 404, unknown route gets 404", pre: "-", steps: "open /rounds/does-not-exist/results as manager and HR; /team/does-not-exist; /no-such-page", exp: "manager 403, HR 404, missing route 404; no stack trace" }, async () => {
  const m1 = (await mgrA.goto(`${BASE}/rounds/does-not-exist/results`)).status();
  const m2 = (await mgrA.goto(`${BASE}/team/does-not-exist`)).status();
  const h1 = (await hr.goto(`${BASE}/rounds/does-not-exist/results`)).status();
  const h2 = (await hr.goto(`${BASE}/team/does-not-exist`)).status();
  const n = await hr.goto(`${BASE}/no-such-page`);
  const text = await mainText(hr);
  return [m1 === 403 && m2 === 403 && h1 === 404 && h2 === 404 && n.status() === 404 && !/at .*\.js|Error:/.test(text), `manager ${m1}/${m2}; HR ${h1}/${h2}; route ${n.status()}`, await shot(hr, "j5-12-404")];
});
await step({ d: "Menu links are not the protection: employee calls manager/HR APIs directly", pre: "Filip (Beta employee)", steps: "POST /api/rounds, POST /api/questions, POST close on Beta round, POST action, PATCH action, GET questions, GET results of own team's round", exp: "403 on all (NFR-03)" }, async () => {
  const f = await api(U.beta[0]);
  const out = [
    (await f("/api/rounds", "POST", { name: "x", teamId: teamB.id, closesAt: ymd(new Date(Date.now() + 864e5)), questionIds: qs })).status,
    (await f("/api/questions", "POST", { text: "QA otázka zamestnanca navyše." })).status,
    (await f(`/api/rounds/${seedBeta.id}/close`, "POST")).status,
    (await f(`/api/rounds/${seedBeta.id}/actions`, "POST", { topic: "x", description: "y", dueDate: ymd(new Date()) })).status,
    (await f("/api/actions/whatever", "PATCH", { status: "DONE" })).status,
    (await f("/api/questions")).status,
    (await f(`/api/rounds/${seedBeta.id}/results`)).status,
    (await f(`/api/rounds/${seedBeta.id}/suggestions`)).status,
    (await f(`/api/teams/${teamB.id}/trend`)).status,
  ];
  return [out.every((s) => s === 403), `statuses=${out}`];
});
await step({ d: "GET /api/me returns the logged-in user, role and team and nothing else", pre: "sessions of the three roles", steps: "GET /api/me as employee, manager, HR", exp: "role EMPLOYEE/MANAGER/HR, own teamId (null for HR), no passwordHash/e-mail of others" }, async () => {
  const out = [];
  for (const [e, role] of [[U.alfa[0], "EMPLOYEE"], [U.mgrA, "MANAGER"], [U.hr, "HR"]]) { const r = await (await api(e))("/api/me"); out.push(`${r.json.user.role}:${r.json.user.teamId === (role === "HR" ? null : teamA.id)}:${/passwordHash|\$2[aby]\$/.test(r.text)}`); }
  return [out.join() === "EMPLOYEE:true:false,MANAGER:true:false,HR:true:false", out.join(" | ")];
});

console.log(`\nJ5 done: ${R.rows.length} checks, ${R.rows.filter((r) => r.status === "FAIL").length} failed`);
await closeBrowser();
