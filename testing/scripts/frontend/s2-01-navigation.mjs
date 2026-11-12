// Section A: navigation. Menus per role (IT-12), every menu item, tabs, direct URLs per role (NFR-03),
// 403/404 pages, active indicators, back/forward, refresh, rapid navigation, navigation while loading,
// redirects, logout. Read-only (logs out and in again). Needs demo data.
import { launch, discover, makeRecorder, newPage, login, session, USERS, BASE, shot, go, nice } from "./s2-lib.mjs";

const { test } = makeRecorder("01-navigation");
const browser = await launch();
const d = await discover(browser);

const visibleNav = (page) =>
  page.evaluate(() => {
    const nav = [...document.querySelectorAll("header nav")].find((n) => n.getBoundingClientRect().width > 0);
    if (!nav) return null;
    return {
      label: nav.getAttribute("aria-label"),
      items: [...nav.querySelectorAll("a")].map((a) => ({
        text: a.textContent.trim(),
        href: a.getAttribute("href"),
        current: a.getAttribute("aria-current"),
      })),
    };
  });
const currentItem = async (page) => (await visibleNav(page))?.items.filter((i) => i.current).map((i) => i.text).join(",") ?? "(no nav)";
const h1 = (page) => page.evaluate(() => [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()).join(" | "));

// ---------- A1: protected routes without a session ----------
{
  const page = await newPage(browser);
  const routes = ["/", "/rounds", "/rounds/new", `/rounds/${d.openA}/fill`, `/rounds/${d.okA}/results`, `/rounds/${d.okA}/report`,
    `/team/${d.teamA}`, `/team/${d.teamA}/trend`, "/kudos", "/kudos/new", "/kudos/me", "/hr/rounds", "/hr/overview", "/hr/heatmap", "/hr/issues", "/hr/notes"];
  for (const r of routes) {
    await test("A", `No session: ${nice(r)} redirects to /login`, { steps: `Open ${nice(r)} without logging in`, expected: "Redirect to /login, no protected content", req: "MVP-01, NFR-03" }, async () => {
      await go(page, r);
      const url = new URL(page.url());
      const hasForm = (await page.locator('input[name="password"]').count()) === 1;
      return { ok: url.pathname === "/login" && hasForm, actual: `ended on ${url.pathname}${url.search}; login form: ${hasForm}` };
    });
  }
  await test("A", "No session: unknown route shows the Slovak 404 page with a link", { steps: "Open /nic-take logged out", expected: "Slovak 404 text and a way back (BUG-013)", req: "NFR-07, BUG-013" }, async () => {
    const res = await go(page, "/nic-take");
    const text = await page.locator("main").last().innerText();
    const links = await page.locator("main a").count();
    return { ok: res.status() === 404 && !/could not be found/i.test(text) && links >= 1, actual: `HTTP ${res.status()}; text "${text.replace(/\s+/g, " ").slice(0, 120)}"; links ${links}; title "${await page.title()}"`, evidence: await shot(page, "nav-404-loggedout") };
  });
  await test("A", "No session: 404 page link 'back home' leads to login", { steps: "Click the button on the 404 page", expected: "/login (no session)" }, async () => {
    await page.locator("main a").last().click();
    await page.waitForURL("**/login");
    return { ok: true, actual: `ended on ${new URL(page.url()).pathname}` };
  });
  await page.context().close();
}

// ---------- A2/A3: menus ----------
const MENUS = {
  hr: ["Domov", "Prieskumy", "Prehľady", "Podnety", "Kudos"],
  mgrA: ["Domov", "Prieskumy", "Môj tím", "Kudos"],
  adam: ["Domov", "Môj tím", "Kudos"],
};
const EXPECT_H1 = {}; // filled by observation, reported in actual
for (const [who, expected] of Object.entries(MENUS)) {
  for (const width of [1440, 1280, 360]) {
    const page = await session(browser, USERS[who], { width, height: 800, touch: width < 500 });
    await test("A", `Main menu of ${who} at ${width}px has exactly the IT-12 items`, { pre: USERS[who], steps: "Read the visible main menu in the header", expected: expected.join(", ") + " (max 5, named navigation)", req: "IT-12, MVP-03" }, async () => {
      const nav = await visibleNav(page);
      const got = nav?.items.map((i) => i.text) ?? [];
      const navCount = await page.evaluate(() => [...document.querySelectorAll("header nav")].filter((n) => n.getBoundingClientRect().width > 0).length);
      return { ok: JSON.stringify(got) === JSON.stringify(expected) && navCount === 1 && !!nav.label, actual: `items: ${got.join(", ")}; visible navs: ${navCount}; aria-label "${nav?.label}"`, evidence: await shot(page, `nav-menu-${who}-${width}`, false) };
    });
    if (width !== 1440) {
      for (const label of expected) {
        await test("A", `Menu item "${label}" as ${who} at ${width}px opens its page and is marked active`, { pre: USERS[who], steps: `Click "${label}" in the main menu`, expected: "Page opens (h1 present), item has aria-current=page, exactly one active item, no console error", req: "IT-12" }, async () => {
          page.errors.length = 0;
          const link = page.locator("header nav a:visible", { hasText: new RegExp(`^${label}$`) });
          const href = await link.getAttribute("href");
          await link.click();
          await page.waitForURL((u) => u.pathname === href || u.pathname.startsWith(href), { timeout: 8000 });
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(450);
          const cur = await currentItem(page);
          const head = await h1(page);
          const pill = await page.evaluate(() => {
            const nav = [...document.querySelectorAll("header nav")].find((n) => n.getBoundingClientRect().width > 0);
            const pill = nav.querySelector(".nav-pill"); const a = nav.querySelector('a[aria-current="page"]');
            if (!pill || !a) return "no pill/active";
            const p = pill.getBoundingClientRect(), r = a.getBoundingClientRect();
            return `pill ${Math.round(p.left)}-${Math.round(p.right)} link ${Math.round(r.left)}-${Math.round(r.right)} opacity ${getComputedStyle(pill).opacity}`;
          });
          const m = pill.match(/pill (-?\d+)-(-?\d+) link (-?\d+)-(-?\d+) opacity (\S+)/);
          const pillOk = m && Math.abs(m[1] - m[3]) <= 2 && Math.abs(m[2] - m[4]) <= 2 && m[5] === "1";
          return { ok: cur === label && head.length > 0 && page.errors.length === 0 && !!pillOk, actual: `url ${nice(new URL(page.url()).pathname)}; active "${cur}"; h1 "${head}"; ${pill}; title "${await page.title()}"; errors ${page.errors.length}` };
        });
      }
    }
    await page.context().close();
  }
}

// ---------- A4: tabs inside areas ----------
{
  const hr = await session(browser, USERS.hr);
  const mgr = await session(browser, USERS.mgrA);
  const emp = await session(browser, USERS.adam);
  const tabCases = [
    [hr, "hr", "/hr/overview", ["Plnenie reakcie", "Porovnanie tímov"], "Porovnanie tímov", "/hr/heatmap", "Prehľady"],
    [hr, "hr", "/hr/heatmap", ["Plnenie reakcie", "Porovnanie tímov"], "Plnenie reakcie", "/hr/overview", "Prehľady"],
    [hr, "hr", "/hr/issues", ["Podnety", "Poznámky"], "Poznámky", "/hr/notes", "Podnety"],
    [hr, "hr", "/hr/notes", ["Podnety", "Poznámky"], "Podnety", "/hr/issues", "Podnety"],
    [mgr, "manager", `/team/${d.teamA}`, ["Povedali ste, urobili sme", "Vývoj tímu"], "Vývoj tímu", `/team/${d.teamA}/trend`, "Môj tím"],
    [mgr, "manager", `/team/${d.teamA}/trend`, ["Povedali ste, urobili sme", "Vývoj tímu"], "Povedali ste, urobili sme", `/team/${d.teamA}`, "Môj tím"],
    [hr, "hr", `/team/${d.teamB}`, ["Povedali ste, urobili sme", "Vývoj tímu"], "Vývoj tímu", `/team/${d.teamB}/trend`, "Prehľady"],
  ];
  for (const [page, who, from, tabs, click, to, area] of tabCases) {
    await test("A", `Tabs on ${nice(from)} (${who}): "${click}" opens ${nice(to)}`, { steps: `Open ${nice(from)}, read the tabs, click "${click}"`, expected: `Tabs ${tabs.join(" + ")} always visible; target opens; clicked tab aria-current; menu area "${area}" stays active`, req: "IT-12" }, async () => {
      await go(page, from);
      const got = await page.locator("main nav a").allTextContents();
      await page.locator("main nav a", { hasText: click }).click();
      await page.waitForURL(`**${to}`);
      await page.waitForLoadState("networkidle");
      const cur = await page.locator('main nav a[aria-current="page"]').allTextContents();
      const menu = await currentItem(page);
      return { ok: tabs.every((x) => got.map((g) => g.trim()).includes(x)) && cur.join() === click && menu === area, actual: `tabs: ${got.join(", ")}; after click current tab "${cur.join()}", menu "${menu}"` };
    });
  }
  await test("A", "Employee team page has no tabs to the trend (manager/HR only)", { steps: "Open own /team/:id as employee", expected: "No 'Vývoj tímu' tab (trend is manager/HR only)", req: "IT-12, IT-08" }, async () => {
    await go(emp, `/team/${d.teamA}`);
    const n = await emp.locator("main a", { hasText: "Vývoj tímu" }).count();
    return { ok: n === 0, actual: `links to trend: ${n}` };
  });
  // Kudos tabs
  for (const [page, who] of [[emp, "employee"], [hr, "hr"]]) {
    await test("A", `Kudos tabs (${who}): received / send switch and keep the URL in sync`, { steps: "Open /kudos, click the send tab, then the received tab", expected: "Two tabs; content switches; URL reflects the tab so refresh keeps it", req: "IT-12, MVP-16, MVP-17" }, async () => {
      await go(page, "/kudos");
      const tabs = await page.locator('main [role="tab"], main nav a, main [role="tablist"] button').allTextContents();
      const sendTab = page.locator("main").getByRole("tab", { name: /Poslať/ }).or(page.locator("main a", { hasText: /^Poslať/ })).first();
      await sendTab.click();
      await page.waitForTimeout(500);
      const url1 = new URL(page.url());
      const formVisible = await page.locator('select[name="toUserId"]').isVisible();
      await page.reload({ waitUntil: "networkidle" });
      const formAfterReload = await page.locator('select[name="toUserId"]').isVisible();
      return { ok: formVisible && formAfterReload && /tab=send/.test(url1.search), actual: `tabs: ${tabs.map((x) => x.trim()).join(", ")}; after click url ${url1.pathname}${url1.search}; form visible ${formVisible}; after reload ${formAfterReload}`, evidence: await shot(page, `nav-kudos-send-${who}`) };
    });
  }
  for (const [from, to] of [["/kudos/new", "/kudos?tab=send"], ["/kudos/me", "/kudos"]]) {
    await test("A", `Old address ${from} redirects to ${to}`, { steps: `Open ${from} as employee`, expected: `Ends on ${to}`, req: "IT-12" }, async () => {
      await go(emp, from);
      const u = new URL(emp.url());
      return { ok: u.pathname + u.search === to, actual: `ended on ${u.pathname}${u.search}` };
    });
  }
  await hr.context().close(); await mgr.context().close(); await emp.context().close();
}

// ---------- A5: direct URL access per role ----------
{
  // [route, hr, manager A, employee A]
  const M = [
    ["/", 200, 200, 200],
    ["/rounds", "redirect:/hr/rounds", 200, 403],
    ["/rounds/new", 200, 200, 403],
    [`/rounds/${d.openA}/fill`, 403, 200, 200],
    [`/rounds/${d.okA}/results`, 200, 200, 403],
    [`/rounds/${d.okB}/results`, 200, 403, 403],
    [`/rounds/${d.okA}/report`, 200, 200, 403],
    [`/rounds/${d.okB}/report`, 200, 403, 403],
    [`/team/${d.teamA}`, 200, 200, 200],
    [`/team/${d.teamB}`, 200, 403, 403],
    [`/team/${d.teamA}/trend`, 200, 200, 403],
    [`/team/${d.teamB}/trend`, 200, 403, 403],
    ["/kudos", 200, 200, 200],
    ["/hr/rounds", 200, 403, 403],
    ["/hr/overview", 200, 403, 403],
    ["/hr/heatmap", 200, 403, 403],
    ["/hr/issues", 200, 403, 403],
    ["/hr/notes", 200, 403, 403],
    ["/rounds/neexistuje/results", "403|404", "403|404", 403],
  ];
  const pages = { hr: await session(browser, USERS.hr), mgrA: await session(browser, USERS.mgrA), adam: await session(browser, USERS.adam) };
  for (const row of M) {
    for (const [i, who] of ["hr", "mgrA", "adam"].entries()) {
      const exp = row[i + 1];
      await test("A", `Direct URL ${nice(row[0])} as ${who} -> ${exp}`, { pre: USERS[who], steps: `Type ${nice(row[0])} into the address bar`, expected: `${exp} per the permission matrix; a 403 shows the Slovak forbidden page without data`, req: "NFR-03, MVP-03" }, async () => {
        const page = pages[who];
        const res = await go(page, row[0]);
        const u = new URL(page.url());
        const status = res.status();
        const head = await h1(page);
        let ok;
        if (String(exp).startsWith("redirect:")) ok = u.pathname === exp.slice(9) && status === 200;
        else if (typeof exp === "string") ok = exp.split("|").includes(String(status));
        else ok = status === exp;
        if (status === 403) ok = ok && /nemáš prístup/i.test(head);
        return { ok, actual: `HTTP ${status}; url ${nice(u.pathname)}; h1 "${head}"` };
      });
    }
  }

  // 403 / 404 page content
  await test("A", "403 page (manager on /hr/overview): Slovak text, link home works", { steps: "Open /hr/overview as manager, click the button", expected: "Slovak 403 page, button leads to /", req: "NFR-03, NFR-07" }, async () => {
    const page = pages.mgrA;
    await go(page, "/hr/overview");
    const text = (await page.locator("main").last().innerText()).replace(/\s+/g, " ");
    const evidence = await shot(page, "nav-403-manager");
    const hasHeader = await page.locator("header").count();
    await page.locator("main a").last().click();
    await page.waitForURL(`${BASE}/`);
    return { ok: /nemáš prístup/i.test(text), actual: `text "${text.slice(0, 140)}"; app header present: ${hasHeader}; title before click checked separately; button -> ${new URL(page.url()).pathname}`, evidence };
  });
  await test("A", "404 page (logged in, unknown route): Slovak text, link home works", { steps: "Open /hr/nic as HR, click the button", expected: "Slovak 404 page with a way back (BUG-013)", req: "NFR-07, BUG-013" }, async () => {
    const page = pages.hr;
    const res = await go(page, "/hr/nic");
    const text = (await page.locator("main").last().innerText()).replace(/\s+/g, " ");
    const title = await page.title();
    const evidence = await shot(page, "nav-404-hr");
    const hasHeader = await page.locator("header").count();
    await page.locator("main a").last().click();
    await page.waitForURL(`${BASE}/`);
    return { ok: res.status() === 404 && !/could not be found/i.test(text), actual: `HTTP ${res.status()}; title "${title}"; text "${text.slice(0, 140)}"; app header present: ${hasHeader}`, evidence };
  });
  await test("A", "404 for an unknown team id as HR", { steps: "Open /team/neexistuje as HR", expected: "Slovak 404 page", req: "BUG-013" }, async () => {
    const res = await go(pages.hr, "/team/neexistuje");
    const text = (await pages.hr.locator("main").last().innerText()).replace(/\s+/g, " ");
    return { ok: res.status() === 404 && !/could not be found/i.test(text), actual: `HTTP ${res.status()}; "${text.slice(0, 100)}"` };
  });

  // ---------- A7: active area on nested pages ----------
  const ACTIVE = [
    ["hr", `/rounds/${d.okA}/results`, "Prieskumy"], ["hr", "/rounds/new", "Prieskumy"], ["hr", `/rounds/${d.okA}/report`, "Prieskumy"],
    ["hr", "/hr/heatmap", "Prehľady"], ["hr", `/team/${d.teamA}`, "Prehľady"], ["hr", `/team/${d.teamA}/trend`, "Prehľady"],
    ["hr", "/hr/notes", "Podnety"], ["hr", "/kudos?tab=send", "Kudos"],
    ["mgrA", `/rounds/${d.okA}/results`, "Prieskumy"], ["mgrA", "/rounds/new", "Prieskumy"], ["mgrA", `/team/${d.teamA}/trend`, "Môj tím"],
    ["mgrA", `/rounds/${d.openA}/fill`, "Prieskumy"], ["adam", `/rounds/${d.openA}/fill`, "Domov"], ["adam", "/kudos?tab=send", "Kudos"],
  ];
  for (const [who, url, area] of ACTIVE) {
    await test("A", `Active menu item on ${nice(url)} as ${who} is "${area}"`, { steps: `Open ${nice(url)}`, expected: `"${area}" has aria-current=page (IT-12)`, req: "IT-12, BUG-022" }, async () => {
      await go(pages[who], url);
      await pages[who].waitForTimeout(200);
      const cur = await currentItem(pages[who]);
      return { ok: cur === area, actual: `active: "${cur}"` };
    });
  }

  // ---------- A8: back / forward / refresh ----------
  await test("A", "Browser back/forward through four pages (HR)", { steps: "/ -> Prieskumy -> Prehľady -> Podnety via menu; Back x3; Forward x2", expected: "Each step shows the right page and the right active menu item", req: "IT-12" }, async () => {
    const page = pages.hr;
    await go(page, "/");
    const trail = [];
    for (const label of ["Prieskumy", "Prehľady", "Podnety"]) {
      await page.locator("header nav a:visible", { hasText: new RegExp(`^${label}$`) }).click();
      await page.waitForTimeout(700);
    }
    for (const dir of ["back", "back", "back", "forward", "forward"]) {
      dir === "back" ? await page.goBack() : await page.goForward();
      await page.waitForTimeout(600);
      trail.push(`${dir}:${new URL(page.url()).pathname}[${await currentItem(page)}]`);
    }
    const exp = "back:/hr/overview[Prehľady],back:/hr/rounds[Prieskumy],back:/[Domov],forward:/hr/rounds[Prieskumy],forward:/hr/overview[Prehľady]";
    return { ok: trail.join(",") === exp, actual: trail.join(", ") };
  });
  await test("A", "Back from results returns to the rounds list (manager)", { steps: "/rounds -> click 'Výsledky' of a closed round -> Back", expected: "/rounds list again, no error", req: "MVP-05" }, async () => {
    const page = pages.mgrA;
    await go(page, "/rounds");
    await page.locator("main a", { hasText: "Výsledky" }).first().click();
    await page.waitForURL("**/results");
    await page.goBack();
    await page.waitForTimeout(600);
    const rows = await page.locator("[data-round-row]").count();
    return { ok: new URL(page.url()).pathname === "/rounds" && rows > 0, actual: `url ${new URL(page.url()).pathname}; rows ${rows}` };
  });
  await test("A", "Issue filter survives refresh and Back (HR)", { steps: "/hr/issues -> pick filter 'all' -> reload -> Back", expected: "Filter in the URL; reload keeps it; Back returns to the default list", req: "IT-10, IT-13" }, async () => {
    const page = pages.hr;
    await go(page, "/hr/issues");
    const before = await page.locator("main h3").count();
    await go(page, "/hr/issues?filter=all");
    await page.reload({ waitUntil: "networkidle" });
    const all = await page.locator("main h3").count();
    await page.goBack();
    await page.waitForTimeout(600);
    return { ok: all >= before && new URL(page.url()).search === "", actual: `default list ${before} issues; filter=all after reload ${all}; after Back url ${new URL(page.url()).pathname}${new URL(page.url()).search}` };
  });
  for (const [who, url] of [["hr", `/rounds/${d.doneA}/results`], ["mgrA", `/team/${d.teamA}/trend`], ["adam", "/kudos"]]) {
    await test("A", `Refresh keeps ${nice(url)} (${who})`, { steps: `Open ${nice(url)}, press F5`, expected: "Same page, same h1, still logged in", req: "MVP-01" }, async () => {
      await go(pages[who], url);
      const a = await h1(pages[who]);
      await pages[who].reload({ waitUntil: "networkidle" });
      const b = await h1(pages[who]);
      return { ok: a === b && a.length > 0 && !pages[who].url().includes("/login"), actual: `h1 before "${a}", after "${b}"` };
    });
  }

  // ---------- A9: rapid navigation ----------
  for (const who of ["hr", "mgrA"]) {
    await test("A", `Rapid clicking through the whole menu (${who})`, { steps: "Click every menu item one after another with 40 ms pauses, twice", expected: "Ends on the last clicked page, one active item, pill under it, no console error", req: "IT-12, IT-02" }, async () => {
      const page = pages[who];
      await go(page, "/");
      page.errors.length = 0;
      const labels = MENUS[who];
      for (let round = 0; round < 2; round++) for (const label of labels) {
        await page.locator("header nav a:visible", { hasText: new RegExp(`^${label}$`) }).click({ noWaitAfter: true });
        await page.waitForTimeout(40);
      }
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1200);
      const cur = await currentItem(page);
      const path = new URL(page.url()).pathname;
      return { ok: cur === "Kudos" && path === "/kudos" && page.errors.length === 0, actual: `ended on ${path}, active "${cur}", errors: ${page.errors.join("; ").slice(0, 200) || "none"}`, evidence: await shot(page, `nav-rapid-${who}`, false) };
    });
  }
  await test("A", "Double click on a menu item", { steps: "Double-click 'Prieskumy' as manager", expected: "Page opens once, no error", req: "IT-12" }, async () => {
    const page = pages.mgrA;
    await go(page, "/");
    page.errors.length = 0;
    await page.locator("header nav a:visible", { hasText: /^Prieskumy$/ }).dblclick();
    await page.waitForTimeout(900);
    return { ok: new URL(page.url()).pathname === "/rounds" && page.errors.length === 0, actual: `url ${new URL(page.url()).pathname}; errors ${page.errors.length}` };
  });

  // ---------- A10: navigation while loading ----------
  await test("A", "Slow navigation shows a pending hint on the clicked menu item (BUG-034)", { steps: "Delay every RSC/page response by 2 s; click 'Podnety' as HR; look at the link after 600 ms", expected: "A visible loading hint within 1 s (BUG-034 was open in session 001)", req: "BUG-034" }, async () => {
    const page = pages.hr;
    await go(page, "/");
    await page.route("**/hr/issues*", async (route) => { await new Promise((r) => setTimeout(r, 2000)); await route.continue(); });
    await page.locator("header nav a:visible", { hasText: /^Podnety$/ }).click({ noWaitAfter: true });
    await page.waitForTimeout(700);
    const hint = await page.evaluate(() => {
      const nav = [...document.querySelectorAll("header nav")].find((n) => n.getBoundingClientRect().width > 0);
      const a = [...nav.querySelectorAll("a")].find((x) => x.textContent.trim() === "Podnety");
      const span = a.querySelector("span[aria-hidden]");
      const cs = span ? getComputedStyle(span) : null;
      return { opacity: cs?.opacity, h: span?.getBoundingClientRect().height, w: span?.getBoundingClientRect().width, busy: document.querySelector("[aria-busy=true]") ? "aria-busy present" : "no aria-busy", stillOn: location.pathname };
    });
    const evidence = await shot(page, "nav-slow-pending-hint", false);
    await page.waitForURL("**/hr/issues", { timeout: 8000 });
    await page.unroute("**/hr/issues*");
    return { ok: Number(hint.opacity) > 0.3 && hint.h > 0, actual: `after 700 ms still on ${hint.stillOn}; hint bar opacity ${hint.opacity}, size ${Math.round(hint.w)}x${hint.h}px; ${hint.busy}`, evidence };
  });
  await test("A", "Clicking another item while a slow page loads wins", { steps: "Delay /hr/issues by 2 s; click 'Podnety' then 'Kudos' after 300 ms", expected: "Ends on /kudos; no error; active item Kudos", req: "IT-12" }, async () => {
    const page = pages.hr;
    await go(page, "/");
    page.errors.length = 0;
    await page.route("**/hr/issues*", async (route) => { await new Promise((r) => setTimeout(r, 2000)); await route.continue().catch(() => {}); });
    await page.locator("header nav a:visible", { hasText: /^Podnety$/ }).click({ noWaitAfter: true });
    await page.waitForTimeout(300);
    await page.locator("header nav a:visible", { hasText: /^Kudos$/ }).click({ noWaitAfter: true });
    await page.waitForTimeout(3200);
    await page.unroute("**/hr/issues*");
    const cur = await currentItem(page);
    return { ok: new URL(page.url()).pathname === "/kudos" && cur === "Kudos", actual: `url ${new URL(page.url()).pathname}; active "${cur}"; errors ${page.errors.filter((e) => !/ERR_|Failed to fetch/.test(e)).length}` };
  });

  // ---------- brand link, login redirect ----------
  await test("A", "Logo in the header leads home", { steps: "On /hr/notes click the logo", expected: "/", req: "IT-01" }, async () => {
    const page = pages.hr;
    await go(page, "/hr/notes");
    const name = await page.locator("header a").first().evaluate((a) => a.getAttribute("aria-label") || a.textContent.trim() || a.querySelector("img,svg")?.getAttribute("aria-label") || a.querySelector("img")?.alt || "");
    await page.locator("header a").first().click();
    await page.waitForURL(`${BASE}/`);
    return { ok: name.length > 0, actual: `accessible name "${name}"; ended on /` };
  });
  await test("A", "/login while logged in redirects home", { steps: "Open /login as employee", expected: "Redirect to /", req: "MVP-01" }, async () => {
    await go(pages.adam, "/login");
    return { ok: new URL(pages.adam.url()).pathname === "/", actual: `ended on ${new URL(pages.adam.url()).pathname}` };
  });

  // ---------- mobile nav scrolling ----------
  await pages.hr.context().close();
  const m = await session(browser, USERS.hr, { width: 320, height: 640, touch: true });
  await test("A", "Mobile menu (HR, 320px): active item is scrolled into view on a deep page", { steps: "Open /kudos at 320px (last menu item)", expected: "The active item is fully inside the visible part of the scrolling menu", req: "IT-12, NFR-07" }, async () => {
    await go(m, "/kudos");
    await m.waitForTimeout(600);
    const r = await m.evaluate(() => {
      const nav = [...document.querySelectorAll("header nav")].find((n) => n.getBoundingClientRect().width > 0);
      const a = nav.querySelector('a[aria-current="page"]').getBoundingClientRect();
      return { left: Math.round(a.left), right: Math.round(a.right), vw: innerWidth, scrollW: nav.scrollWidth, clientW: nav.clientWidth, scrollLeft: Math.round(nav.scrollLeft) };
    });
    return { ok: r.left >= 0 && r.right <= r.vw, actual: JSON.stringify(r), evidence: await shot(m, "nav-mobile-320-kudos", false) };
  });
  await test("A", "Mobile menu (HR, 320px): hidden items are discoverable (first screen)", { steps: "Open / at 320px; measure which items are visible without scrolling", expected: "All 5 items reachable by horizontal scroll; a visual hint that more follow", req: "IT-12, NFR-07" }, async () => {
    await go(m, "/");
    await m.waitForTimeout(400);
    const r = await m.evaluate(() => {
      const nav = [...document.querySelectorAll("header nav")].find((n) => n.getBoundingClientRect().width > 0);
      return { items: [...nav.querySelectorAll("a")].map((a) => { const b = a.getBoundingClientRect(); return `${a.textContent.trim()}:${Math.round(b.left)}-${Math.round(b.right)}`; }), scrollW: nav.scrollWidth, clientW: nav.clientWidth, mask: getComputedStyle(nav).maskImage.slice(0, 60) };
    });
    return { ok: r.scrollW > r.clientW ? r.mask !== "none" : true, actual: JSON.stringify(r), evidence: await shot(m, "nav-mobile-320-home", false) };
  });
  await m.context().close();

  // ---------- logout ----------
  await test("A", "Logout ends the session; Back does not show protected content", { steps: "As employee click 'Odhlásiť sa', then browser Back", expected: "Ends on /login; Back leads to /login again", req: "MVP-01, BUG-001" }, async () => {
    const page = pages.adam;
    await go(page, "/kudos");
    await page.getByRole("button", { name: "Odhlásiť sa" }).click();
    await page.waitForURL("**/login");
    await page.goBack();
    await page.waitForTimeout(1200);
    const path = new URL(page.url()).pathname;
    const protectedVisible = await page.locator("header nav").count();
    return { ok: path === "/login" || protectedVisible === 0, actual: `after Back: ${path}; app menu elements: ${protectedVisible}` };
  });
  await pages.mgrA.context().close(); await pages.adam.context().close();
}

await browser.close();
