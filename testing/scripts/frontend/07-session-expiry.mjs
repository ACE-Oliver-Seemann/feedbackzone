// Area C – failure state "the session ended while a form was open" (expired or logged out
// in another tab). Run after 04-manage-forms.mjs (needs an open round of Tím Alfa that Adam
// has not answered). Does not create data: every submission is refused by the server.
import { BASE, USERS, launch, makeRecorder, session, shot } from "./lib.mjs";

const { test } = makeRecorder("07-session-expiry");
const browser = await launch();
const C = "C-Forms";
const flat = (text) => text.replace(/\s+/g, " ").trim();
const alerts = (page) => page.locator('[role="alert"]:not(#__next-route-announcer__)').allInnerTexts();

await test(C, "Session ends while the kudos form is open", { pre: "Adam on /kudos/new with a valid kudos typed; session cookie removed (as after expiry or logout in another tab)", steps: "Click „Poslať kudos“", expected: "The user is told that they have to log in again (or is taken to /login); the message must not suggest that trying again will help", req: "MVP-01" }, async () => {
  const page = await session(browser, USERS.adam, { width: 360, height: 740 });
  await page.goto(`${BASE}/kudos/new`);
  const value = await page.locator('select[name="toUserId"] option').nth(2).getAttribute("value");
  await page.locator('select[name="toUserId"]').selectOption(value);
  await page.locator("form textarea").fill("Vďaka za pomoc s testovaním portálu.");
  await page.context().clearCookies();
  const statuses = [];
  page.on("response", (response) => { if (response.url().includes("/api/kudos")) statuses.push(response.status()); });
  await page.locator('form button[type="submit"]').click();
  await page.waitForTimeout(1200);
  const text = (await alerts(page)).join(" | ");
  const path = new URL(page.url()).pathname;
  const evidence = await shot(page, "kudos-session-expired-360");
  await page.context().close();
  return { ok: path === "/login" || /prihlás/i.test(text), actual: `API answered ${statuses.join()}; still on ${path}; message: "${text}"`, evidence };
});

await test(C, "Session ends while the questionnaire is being filled in", { pre: "Adam on the comment step of an open round; session cookie removed", steps: "Click „Odoslať“", expected: "The user learns that the session ended and how to continue without losing the answers; not „Skús to znova“", req: "MVP-09" }, async () => {
  const page = await session(browser, USERS.adam, { width: 360, height: 740 });
  const link = page.getByRole("link", { name: "Vyplniť" });
  if ((await link.count()) === 0) {
    await page.context().close();
    return { blocked: true, actual: "No open round for Adam in the current data (run after 04-manage-forms.mjs)." };
  }
  await link.click();
  await page.getByRole("button", { name: "Začať" }).click();
  for (;;) {
    if (await page.getByLabel("Komentár").isVisible().catch(() => false)) break;
    await page.locator("fieldset button[aria-pressed]").nth(3).click();
    await page.getByRole("button", { name: "Ďalej" }).click();
  }
  await page.getByLabel("Komentár").fill("Komentár pred vypršaním relácie.");
  await page.context().clearCookies();
  const statuses = [];
  page.on("response", (response) => { if (response.url().includes("/responses")) statuses.push(response.status()); });
  await page.getByRole("button", { name: "Odoslať" }).click();
  await page.waitForTimeout(1200);
  const text = (await alerts(page)).join(" | ");
  const path = new URL(page.url()).pathname;
  const evidence = await shot(page, "fill-session-expired-360");
  await page.context().close();
  return { ok: path === "/login" || /prihlás/i.test(text), actual: `API answered ${statuses.join()}; still on the questionnaire: ${path !== "/login"}; message: "${text}"`, evidence };
});

await test(C, "Session ends, then the user clicks a menu link", { pre: "Manager on /rounds; session cookie removed", steps: "Click „Môj tím“", expected: "Redirect to /login", req: "MVP-01, MVP-03" }, async () => {
  const page = await session(browser, USERS.mgrA);
  await page.goto(`${BASE}/rounds`);
  await page.context().clearCookies();
  await page.locator("header nav").getByRole("link", { name: "Môj tím" }).click();
  await page.waitForTimeout(1500);
  const path = new URL(page.url()).pathname;
  const body = flat(await page.locator("body").innerText());
  await page.context().close();
  return { ok: path === "/login", actual: `landed on ${path}; ${body.slice(0, 60)}` };
});

await test(C, "Logout while the server does not answer", { pre: "Manager; POST /api/logout aborted", steps: "Click „Odhlásiť sa“", expected: "The user is not told they are logged out while the session is still valid", req: "MVP-01" }, async () => {
  const page = await session(browser, USERS.mgrA);
  await page.route("**/api/logout", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Odhlásiť sa" }).click();
  await page.waitForTimeout(1500);
  const path = new URL(page.url()).pathname;
  await page.unroute("**/api/logout");
  await page.goto(`${BASE}/rounds`);
  const still = new URL(page.url()).pathname === "/rounds";
  const messages = await alerts(page);
  await page.context().close();
  return { ok: !(path === "/login" && still), actual: `after the failed logout the page shows ${path}; the session is still valid: ${still}; error shown: ${messages.length > 0}` };
});

await browser.close();
