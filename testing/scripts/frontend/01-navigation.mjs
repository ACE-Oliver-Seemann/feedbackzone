// Area A – navigation, routes, roles, 403/404, back/forward, refresh, logout.
// Read-only apart from logging in and out.
import { BASE, USERS, launch, makeRecorder, newPage, session, shot, discover, nice } from "./lib.mjs";

const { test } = makeRecorder("01-navigation");
const browser = await launch();
const ids = await discover(browser);

const heading = (page) => page.locator("h1").first().innerText({ timeout: 3000 }).catch(() => "(no h1)");
const menu = (page) => page.locator("header nav a").allInnerTexts();
const active = (page) => page.locator('header nav a[aria-current="page"]').allInnerTexts();
const A = "A-Navigation";

// ---------- unauthenticated
{
  const page = await newPage(browser);
  const protectedRoutes = [
    "/", "/rounds", "/rounds/new", `/rounds/${ids.openA}/fill`, `/rounds/${ids.okA}/results`,
    `/rounds/${ids.okA}/report`, `/team/${ids.teamA}`, `/team/${ids.teamA}/trend`, "/kudos/new", "/kudos/me",
    "/hr/rounds", "/hr/overview", "/hr/heatmap", "/hr/issues", "/hr/notes",
  ];
  for (const route of protectedRoutes) {
    await test(A, `Unauthenticated direct URL ${nice(route)} redirects to /login`, { pre: "No session", steps: `Open ${nice(route)} directly`, expected: "Redirect to /login, no protected content (MVP-01, MVP-03)", req: "MVP-03" }, async () => {
      await page.goto(BASE + route);
      const url = new URL(page.url());
      const body = await page.locator("body").innerText();
      return { ok: url.pathname === "/login" && /Prihlásenie/.test(body), actual: `landed on ${url.pathname}; login form shown: ${/Prihlásenie/.test(body)}` };
    });
  }
  await test(A, "Unauthenticated unknown route /does-not-exist", { pre: "No session", steps: "Open /does-not-exist", expected: "HTTP 404 with Slovak text (NFR-07), no crash", req: "NFR-07" }, async () => {
    const response = await page.goto(`${BASE}/does-not-exist`);
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const evidence = await shot(page, "nav-404-unauth");
    const english = /This page could not be found/i.test(body);
    return { ok: response.status() === 404 && !english, actual: `HTTP ${response.status()}, body: "${body.slice(0, 120)}"; English default text: ${english}`, evidence };
  });
  await page.context().close();
}

// ---------- per role: menu, items, tabs
const roleSpecs = [
  {
    key: "hr", email: USERS.hr, menu: ["Domov", "Prieskumy", "Prehľady", "Podnety", "Kudos"],
    items: [["Domov", "/", "Čo treba urobiť teraz"], ["Prieskumy", "/hr/rounds", "Prehľad kôl"], ["Prehľady", "/hr/overview", "Plnenie reakcie"], ["Podnety", "/hr/issues", "Podnety"], ["Kudos", "/kudos/new", "Poslať kudos"]],
    tabs: [
      ["/hr/overview", "Prehľady", "Porovnanie tímov", "/hr/heatmap", "Porovnanie tímov"],
      ["/hr/heatmap", "Prehľady", "Plnenie reakcie", "/hr/overview", "Plnenie reakcie"],
      ["/hr/issues", "Podnety", "Poznámky", "/hr/notes", "Poznámky zo stretnutí"],
      ["/hr/notes", "Podnety", "Podnety", "/hr/issues", "Podnety"],
      ["/kudos/new", "Kudos", "Moje kudos", "/kudos/me", "Moje kudos"],
      ["/kudos/me", "Kudos", "Poslať kudos", "/kudos/new", "Poslať kudos"],
      [`/team/${ids.teamA}`, "Tím Alfa", "Vývoj tímu", `/team/${ids.teamA}/trend`, "Vývoj tímu"],
    ],
  },
  {
    key: "manager", email: USERS.mgrA, menu: ["Domov", "Prieskumy", "Môj tím", "Kudos"],
    items: [["Domov", "/", "Čo treba urobiť teraz"], ["Prieskumy", "/rounds", "Kolá môjho tímu"], ["Môj tím", `/team/${ids.teamA}`, "Povedali ste, urobili sme"], ["Kudos", "/kudos/new", "Poslať kudos"]],
    tabs: [
      [`/team/${ids.teamA}`, "Tím Alfa", "Vývoj tímu", `/team/${ids.teamA}/trend`, "Vývoj tímu"],
      [`/team/${ids.teamA}/trend`, "Tím Alfa", "Povedali ste, urobili sme", `/team/${ids.teamA}`, "Povedali ste, urobili sme"],
      ["/kudos/new", "Kudos", "Moje kudos", "/kudos/me", "Moje kudos"],
    ],
  },
  {
    key: "employee", email: USERS.adam, menu: ["Domov", "Môj tím", "Kudos"],
    items: [["Domov", "/", "Čo treba urobiť teraz"], ["Môj tím", `/team/${ids.teamA}`, "Povedali ste, urobili sme"], ["Kudos", "/kudos/new", "Poslať kudos"]],
    tabs: [["/kudos/new", "Kudos", "Moje kudos", "/kudos/me", "Moje kudos"]],
  },
];

const pages = {};
for (const spec of roleSpecs) {
  const page = await session(browser, spec.email);
  pages[spec.key] = page;
  await test(A, `${spec.key}: lands on / after login and the menu matches IT-12`, { pre: `Logged in as ${spec.email}`, steps: "Log in, read the main menu", expected: `Menu = ${spec.menu.join(", ")}; landing page /`, req: "IT-11, IT-12" }, async () => {
    const items = await menu(page);
    return { ok: new URL(page.url()).pathname === "/" && JSON.stringify(items) === JSON.stringify(spec.menu), actual: `path ${new URL(page.url()).pathname}; menu: ${items.join(", ")}`, evidence: await shot(page, `nav-home-${spec.key}-1280`) };
  });
  for (const [label, path, h1] of spec.items) {
    await test(A, `${spec.key}: menu item "${label}" opens ${nice(path)} and is marked active`, { pre: `Logged in as ${spec.key}`, steps: `Click "${label}" in the main menu`, expected: `URL ${nice(path)}, heading "${h1}", aria-current=page only on "${label}"`, req: "IT-12" }, async () => {
      await page.locator("header nav").getByRole("link", { name: label, exact: true }).click();
      await page.waitForURL((url) => url.pathname === path, { timeout: 8000 });
      await page.getByRole("heading", { level: 1, name: h1, exact: true }).waitFor({ timeout: 8000 });
      const act = await active(page);
      return { ok: act.length === 1 && act[0] === label, actual: `url ${nice(new URL(page.url()).pathname)}; h1 "${await heading(page)}"; active: [${act.join(", ")}]` };
    });
  }
  for (const [from, navLabel, tab, to, h1] of spec.tabs) {
    await test(A, `${spec.key}: tab "${tab}" on ${nice(from)}`, { pre: `Logged in as ${spec.key}`, steps: `Open ${nice(from)}, click the tab "${tab}"`, expected: `URL ${nice(to)}, heading "${h1}", the tab is marked aria-current`, req: "IT-12" }, async () => {
      await page.goto(BASE + from);
      await page.getByRole("navigation", { name: navLabel }).getByRole("link", { name: tab, exact: true }).click();
      await page.waitForURL((url) => url.pathname === to, { timeout: 8000 });
      await page.getByRole("heading", { level: 1, name: h1, exact: true }).waitFor({ timeout: 8000 });
      const current = await page.getByRole("navigation", { name: navLabel }).locator('a[aria-current="page"]').allInnerTexts();
      return { ok: current.length === 1 && current[0] === tab, actual: `url ${nice(new URL(page.url()).pathname)}; active tab: [${current.join(", ")}]` };
    });
  }
}

// ---------- direct URL access matrix (role x route): status code and page
const routes = [
  ["/", { hr: 200, manager: 200, employee: 200 }],
  ["/rounds", { hr: 200, manager: 200, employee: 403 }], // HR is redirected to /hr/rounds
  ["/rounds/new", { hr: 200, manager: 200, employee: 403 }],
  [`/rounds/${ids.openA}/fill`, { hr: 403, manager: 200, employee: 200 }],
  [`/rounds/${ids.okA}/results`, { hr: 200, manager: 200, employee: 403 }],
  [`/rounds/${ids.okA}/report`, { hr: 200, manager: 200, employee: 403 }],
  [`/team/${ids.teamA}`, { hr: 200, manager: 200, employee: 200 }],
  [`/team/${ids.teamA}/trend`, { hr: 200, manager: 200, employee: 403 }],
  ["/kudos/new", { hr: 200, manager: 200, employee: 200 }],
  ["/kudos/me", { hr: 200, manager: 200, employee: 200 }],
  ["/hr/rounds", { hr: 200, manager: 403, employee: 403 }],
  ["/hr/overview", { hr: 200, manager: 403, employee: 403 }],
  ["/hr/heatmap", { hr: 200, manager: 403, employee: 403 }],
  ["/hr/issues", { hr: 200, manager: 403, employee: 403 }],
  ["/hr/notes", { hr: 200, manager: 403, employee: 403 }],
  // the other team (Tím Beta) as seen by people of Tím Alfa
  [`/team/${ids.teamB}`, { hr: 200, manager: 403, employee: 403 }],
  [`/team/${ids.teamB}/trend`, { hr: 200, manager: 403, employee: 403 }],
  [`/rounds/${ids.okB}/results`, { hr: 200, manager: 403, employee: 403 }],
  [`/rounds/${ids.okB}/report`, { hr: 200, manager: 403, employee: 403 }],
];
const label = (route) =>
  route.replace(ids.teamB, ":teamBeta").replace(ids.teamA, ":teamAlfa").replace(ids.okB, ":roundBeta").replace(/c[a-z0-9]{20,}/, ":roundAlfa");
let shot403 = false;
for (const [route, expected] of routes) {
  for (const key of ["hr", "manager", "employee"]) {
    const page = pages[key];
    await test(A, `Direct URL ${label(route)} as ${key} → ${expected[key]}`, { pre: `Logged in as ${key} (Tím Alfa where it applies)`, steps: `Open ${label(route)} directly`, expected: expected[key] === 403 ? "HTTP 403 and the Slovak page „Sem nemáš prístup“" : "HTTP 200 and the page content", req: "MVP-03, NFR-03" }, async () => {
      const response = await page.goto(BASE + route);
      const status = response.status();
      const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
      const forbiddenShown = /Sem nemáš prístup/.test(body);
      let evidence = "";
      if (expected[key] === 403 && !shot403) { evidence = await shot(page, `nav-403-${key}`); shot403 = true; }
      const ok = expected[key] === 403 ? status === 403 && forbiddenShown : status === 200 && !forbiddenShown;
      return { ok, actual: `HTTP ${status}; final path ${nice(new URL(page.url()).pathname)}; 403 page shown: ${forbiddenShown}; h1 "${await heading(page)}"`, evidence };
    });
  }
}

// ---------- 403 page quality
await test(A, "403 page: link „Späť na úvod“ works", { pre: "Employee on a forbidden page", steps: "Open /hr/rounds as employee, click „Späť na úvod“", expected: "Home page opens", req: "MVP-03" }, async () => {
  const page = pages.employee;
  await page.goto(`${BASE}/hr/rounds`);
  await page.getByRole("link", { name: "Späť na úvod" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  return { ok: true, actual: "link leads to /" };
});
await test(A, "403 page keeps the application header (who is logged in, menu, logout)", { pre: "Employee", steps: "Open /hr/rounds as employee", expected: "Header with the menu and „Odhlásiť sa“ stays visible so the user keeps orientation" }, async () => {
  const page = pages.employee;
  await page.goto(`${BASE}/hr/rounds`);
  const nav = await page.locator("header nav a").count();
  const logout = await page.getByRole("button", { name: "Odhlásiť sa" }).count();
  return { ok: nav > 0 && logout > 0, actual: `menu links: ${nav}, logout button: ${logout}` };
});

// ---------- 404
for (const [key, route, what] of [
  ["employee", "/does-not-exist", "unknown route"],
  ["manager", "/rounds/unknown-round-id/results", "unknown round id (results)"],
  ["employee", "/rounds/unknown-round-id/fill", "unknown round id (fill)"],
  ["hr", "/team/unknown-team", "unknown team id"],
  ["hr", "/hr/unknown", "unknown HR sub-route"],
]) {
  await test(A, `404: ${what} as ${key}`, { pre: `Logged in as ${key}`, steps: `Open ${route}`, expected: "HTTP 404 (or 403 for an id the role cannot see, so that existence is not revealed) with an understandable Slovak message and a link back (NFR-07: UI is Slovak)", req: "NFR-07" }, async () => {
    const page = pages[key];
    const response = await page.goto(BASE + route);
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const english = /This page could not be found/i.test(body);
    const links = await page.locator("a").count();
    const evidence = await shot(page, `nav-404-${key}-${what.replace(/[^a-z]+/g, "-")}`);
    return { ok: [403, 404].includes(response.status()) && !english && links > 0, actual: `HTTP ${response.status()}; text: "${body.slice(0, 140)}"; English default text: ${english}; links on page: ${links}`, evidence };
  });
}

// ---------- active indicator on nested pages
for (const [key, route, expectedActive] of [
  ["manager", "/rounds/new", "Prieskumy"],
  ["manager", `/rounds/${ids.okA}/results`, "Prieskumy"],
  ["manager", `/rounds/${ids.okA}/report`, "Prieskumy"],
  ["manager", `/team/${ids.teamA}/trend`, "Môj tím"],
  ["manager", "/kudos/me", "Kudos"],
  ["manager", `/rounds/${ids.openA}/fill`, "Prieskumy"],
  ["hr", "/rounds/new", "Prieskumy"],
  ["hr", `/rounds/${ids.okA}/results`, "Prieskumy"],
  ["hr", "/hr/notes", "Podnety"],
  ["hr", "/hr/heatmap", "Prehľady"],
  ["hr", `/team/${ids.teamA}`, "Prehľady"],
  ["employee", "/kudos/me", "Kudos"],
  ["employee", `/rounds/${ids.openA}/fill`, "Domov"],
]) {
  await test(A, `Active menu item on ${nice(route)} as ${key}`, { pre: `Logged in as ${key}`, steps: `Open ${nice(route)}`, expected: `Exactly one menu item is highlighted: "${expectedActive}" (the area the user came from)`, req: "IT-12" }, async () => {
    const page = pages[key];
    await page.goto(BASE + route);
    const act = await active(page);
    return { ok: act.length === 1 && act[0] === expectedActive, actual: `active: [${act.join(", ")}]` };
  });
}

// ---------- back / forward / refresh / rapid navigation
await test(A, "Browser Back and Forward between sections (manager)", { pre: "Manager", steps: "Home → Prieskumy → Môj tím → Back → Back → Forward", expected: "URL, heading and the active menu item follow the history" }, async () => {
  const page = pages.manager;
  await page.goto(BASE + "/");
  await page.locator("header nav").getByRole("link", { name: "Prieskumy" }).click();
  await page.waitForURL("**/rounds");
  await page.locator("header nav").getByRole("link", { name: "Môj tím" }).click();
  await page.waitForURL("**/team/**");
  await page.goBack();
  await page.waitForURL("**/rounds");
  const a1 = `${await heading(page)}|${(await active(page)).join()}`;
  await page.goBack();
  await page.waitForURL((u) => u.pathname === "/");
  const a2 = `${await heading(page)}|${(await active(page)).join()}`;
  await page.goForward();
  await page.waitForURL("**/rounds");
  const a3 = `${await heading(page)}|${(await active(page)).join()}`;
  return { ok: a1 === "Kolá môjho tímu|Prieskumy" && a2 === "Čo treba urobiť teraz|Domov" && a3 === "Kolá môjho tímu|Prieskumy", actual: [a1, a2, a3].join(" → ") };
});
for (const [key, route, h1] of [
  ["hr", "/hr/overview", "Plnenie reakcie"],
  ["manager", `/rounds/${ids.okA}/results`, "Pulse – 46. týždeň"],
  ["employee", `/team/${ids.teamA}`, "Povedali ste, urobili sme"],
]) {
  await test(A, `Refresh keeps the session and the page: ${nice(route)} as ${key}`, { pre: `Logged in as ${key}`, steps: `Open ${nice(route)}, reload`, expected: "Same page, still logged in" }, async () => {
    const page = pages[key];
    await page.goto(BASE + route);
    await page.reload();
    const h = await heading(page);
    return { ok: h === h1 && new URL(page.url()).pathname === route, actual: `after reload: path ${nice(new URL(page.url()).pathname)}, h1 "${h}"` };
  });
}
await test(A, "Rapid navigation: 5 menu clicks without waiting (HR)", { pre: "HR", steps: "Click Prieskumy, Prehľady, Podnety, Kudos, Domov as fast as possible", expected: "Ends on the last clicked page, no JS errors, menu marks the last item" }, async () => {
  const page = pages.hr;
  await page.goto(BASE + "/");
  page.errors.length = 0;
  for (const name of ["Prieskumy", "Prehľady", "Podnety", "Kudos", "Domov"]) {
    await page.locator("header nav").getByRole("link", { name, exact: true }).click({ noWaitAfter: true });
  }
  await page.waitForURL((u) => u.pathname === "/", { timeout: 10000 });
  await page.waitForTimeout(800);
  const act = await active(page);
  return { ok: act.join() === "Domov" && page.errors.length === 0 && (await heading(page)) === "Čo treba urobiť teraz", actual: `final path ${new URL(page.url()).pathname}; active [${act.join()}]; errors: ${page.errors.length ? page.errors.join(" | ") : "none"}` };
});
const slow = async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await route.continue();
};
await test(A, "Navigation while a page is still loading (slow response, then another click)", { pre: "HR; responses for /hr/overview delayed by 2 s", steps: "Click Prehľady (slow) and immediately Podnety", expected: "Ends on Podnety; no error, the slow page does not replace it later" }, async () => {
  const page = pages.hr;
  await page.goto(BASE + "/");
  page.errors.length = 0;
  await page.route("**/hr/overview**", slow);
  await page.locator("header nav").getByRole("link", { name: "Prehľady", exact: true }).click({ noWaitAfter: true });
  await page.waitForTimeout(200);
  await page.locator("header nav").getByRole("link", { name: "Podnety", exact: true }).click({ noWaitAfter: true });
  await page.waitForURL("**/hr/issues", { timeout: 10000 });
  await page.waitForTimeout(2500);
  await page.unroute("**/hr/overview**");
  const h = await heading(page);
  return { ok: h === "Podnety" && new URL(page.url()).pathname === "/hr/issues" && page.errors.length === 0, actual: `final path ${new URL(page.url()).pathname}; h1 "${h}"; errors: ${page.errors.length ? page.errors.join(" | ") : "none"}` };
});
await test(A, "Slow navigation shows that something is loading", { pre: "HR; the target page is delayed by 2 s", steps: "Click Prehľady, observe the page 1 s into the wait", expected: "Some loading indication (spinner, skeleton, progress bar or a pending state of the link)" }, async () => {
  const page = pages.hr;
  await page.goto(BASE + "/");
  await page.waitForTimeout(500);
  await page.route("**/hr/overview**", slow);
  const before = await page.locator("body").innerHTML();
  await page.locator("header nav").getByRole("link", { name: "Prehľady", exact: true }).click({ noWaitAfter: true });
  await page.waitForTimeout(1000);
  const during = await page.locator("body").innerHTML();
  const busy = await page.locator('[aria-busy="true"], [role="progressbar"], [class*="animate-"]').count();
  const evidence = await shot(page, "nav-slow-no-indicator", false);
  await page.waitForURL("**/hr/overview", { timeout: 10000 });
  await page.unroute("**/hr/overview**");
  return { ok: busy > 0 || before !== during, actual: `DOM changed during the wait: ${before !== during}; busy/progress/animated elements: ${busy}`, evidence };
});
await test(A, "/login while logged in redirects to home", { pre: "Employee logged in", steps: "Open /login", expected: "Redirect to /", req: "MVP-01" }, async () => {
  const page = pages.employee;
  await page.goto(`${BASE}/login`);
  return { ok: new URL(page.url()).pathname === "/", actual: `landed on ${new URL(page.url()).pathname}` };
});
await test(A, "HR opening /rounds is redirected to /hr/rounds", { pre: "HR", steps: "Open /rounds", expected: "Redirect to /hr/rounds", req: "IT-12" }, async () => {
  const page = pages.hr;
  await page.goto(`${BASE}/rounds`);
  return { ok: new URL(page.url()).pathname === "/hr/rounds", actual: `landed on ${new URL(page.url()).pathname}` };
});

// ---------- logout
await test(A, "Logout ends the session and shows the login page", { pre: "Manager logged in", steps: "Click „Odhlásiť sa“, then open /rounds", expected: "Login page; the protected URL redirects to /login", req: "MVP-01" }, async () => {
  const page = pages.manager;
  await page.goto(BASE + "/rounds");
  await page.getByRole("button", { name: "Odhlásiť sa" }).click();
  await page.waitForURL("**/login", { timeout: 8000 });
  await page.goto(BASE + "/rounds");
  return { ok: new URL(page.url()).pathname === "/login", actual: `after logout /rounds → ${new URL(page.url()).pathname}` };
});
await test(A, "Browser Back after logout does not reveal the previous protected page", { pre: "Employee logged in on the team page", steps: "Open the team page, click „Odhlásiť sa“, press Back", expected: "Login page or a redirect; no team content visible", req: "MVP-01" }, async () => {
  const page = pages.employee;
  await page.goto(`${BASE}/team/${ids.teamA}`);
  await page.getByRole("button", { name: "Odhlásiť sa" }).click();
  await page.waitForURL("**/login", { timeout: 8000 });
  await page.goBack();
  await page.waitForTimeout(1500);
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const leaked = /Povedali ste, urobili sme/.test(body);
  const evidence = await shot(page, "nav-back-after-logout");
  return { ok: !leaked, actual: `after Back: path ${nice(new URL(page.url()).pathname)}; team content visible: ${leaked}`, evidence };
});
await test(A, "JS errors and console errors during the whole navigation run", { pre: "All three sessions", steps: "Collect pageerror and console.error events over the run", expected: "None (messages about the expected 403/404 documents excluded)" }, async () => {
  const all = Object.entries(pages).flatMap(([key, page]) =>
    page.errors.filter((e) => !/status of 40[34]/.test(e)).map((e) => `${key}: ${e}`),
  );
  return { ok: all.length === 0, actual: all.length ? [...new Set(all)].slice(0, 6).join(" | ") : "none" };
});

await browser.close();
