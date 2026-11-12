// Area C – login form and the questionnaire (MVP-01, MVP-06 to MVP-09), including
// keyboard-only completion (area G). MUTATES the QA database: six people of Tím Alfa
// answer the open round and the round is closed at the end. Reset the database first:
//   DATABASE_URL="file:./qa-frontend.db" npx tsx prisma/seed.ts && DATABASE_URL="file:./qa-frontend.db" npx tsx scripts/demo-data.ts
import { BASE, USERS, launch, makeRecorder, newPage, login, session, shot, discover, overflow } from "./lib.mjs";

const { test } = makeRecorder("03-login-fill");
const browser = await launch();
const ids = await discover(browser);
const C = "C-Forms";
const G = "G-Accessibility";
const fillUrl = `${BASE}/rounds/${ids.openA}/fill`;

/** Counts POST requests whose URL contains `part`. */
function countPosts(page, part) {
  const counter = { count: 0 };
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes(part)) counter.count++;
  });
  return counter;
}
const fail500 = (page, glob) =>
  page.route(glob, (route) =>
    route.request().method() === "GET" ? route.continue() : route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"internal"}' }),
  );
const failAbort = (page, glob) =>
  page.route(glob, (route) => (route.request().method() === "GET" ? route.continue() : route.abort("failed")));
const delay = (page, glob, ms) =>
  page.route(glob, async (route) => {
    if (route.request().method() !== "GET") await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });
const alertText = (page) => page.locator('[role="alert"]:not(#__next-route-announcer__)').allInnerTexts();

// =====================================================================
// LOGIN
// =====================================================================
{
  const page = await newPage(browser, { width: 360, height: 740 });
  const email = page.getByLabel("E-mail");
  const password = page.getByLabel("Heslo");
  const submit = page.getByRole("button", { name: /Prihlás|Prihlasujem/ });
  const open = () => page.goto(`${BASE}/login`);

  await test(C, "Login: wrong password shows one generic error", { pre: "Login page", steps: "hr@example.test + wrong password, submit", expected: "„Nesprávny e-mail alebo heslo.“ in role=alert; stays on /login", req: "MVP-01" }, async () => {
    await open();
    await email.fill(USERS.hr);
    await password.fill("ZleHeslo1");
    await submit.click();
    await page.locator('p[role="alert"]').waitFor();
    const text = await alertText(page);
    return { ok: text.join() === "Nesprávny e-mail alebo heslo." && new URL(page.url()).pathname === "/login", actual: `alert: "${text.join()}"; path ${new URL(page.url()).pathname}`, evidence: await shot(page, "login-wrong-password-360") };
  });
  await test(C, "Login: unknown e-mail shows the same message as a wrong password", { pre: "Login page", steps: "nikto@example.test + Heslo123, submit", expected: "Identical message, nothing reveals whether the e-mail exists", req: "MVP-01" }, async () => {
    await open();
    await email.fill("nikto@example.test");
    await password.fill("Heslo123");
    await submit.click();
    await page.locator('p[role="alert"]').waitFor();
    const text = await alertText(page);
    return { ok: text.join() === "Nesprávny e-mail alebo heslo.", actual: `alert: "${text.join()}"` };
  });
  await test(C, "Login: empty form is not sent", { pre: "Login page", steps: "Click „Prihlásiť sa“ with both fields empty", expected: "No request; the browser marks the required field", req: "MVP-01" }, async () => {
    await open();
    const posts = countPosts(page, "/api/login");
    await submit.click();
    await page.waitForTimeout(400);
    const invalid = await email.evaluate((el) => !el.validity.valid && el.validationMessage.length > 0);
    return { ok: posts.count === 0 && invalid, actual: `POST /api/login sent: ${posts.count}; e-mail marked invalid by the browser: ${invalid}` };
  });
  await test(C, "Login: missing password only", { pre: "Login page", steps: "Fill the e-mail, leave the password empty, submit", expected: "No request; password marked as required" }, async () => {
    await open();
    const posts = countPosts(page, "/api/login");
    await email.fill(USERS.hr);
    await submit.click();
    await page.waitForTimeout(400);
    const invalid = await password.evaluate((el) => el.validity.valueMissing);
    return { ok: posts.count === 0 && invalid, actual: `POST sent: ${posts.count}; password valueMissing: ${invalid}` };
  });
  await test(C, "Login: invalid e-mail format", { pre: "Login page", steps: "E-mail „abc“, any password, submit", expected: "No request; the browser reports an invalid e-mail" }, async () => {
    await open();
    const posts = countPosts(page, "/api/login");
    await email.fill("abc");
    await password.fill("Heslo123");
    await submit.click();
    await page.waitForTimeout(400);
    const invalid = await email.evaluate((el) => el.validity.typeMismatch);
    return { ok: posts.count === 0 && invalid, actual: `POST sent: ${posts.count}; typeMismatch: ${invalid}` };
  });
  await test(C, "Login: e-mail typed in capitals", { pre: "Login page", steps: "HR@EXAMPLE.TEST + Heslo123", expected: "Logs in – an e-mail address is not case sensitive for the user" }, async () => {
    await open();
    await email.fill("HR@EXAMPLE.TEST");
    await password.fill("Heslo123");
    await submit.click();
    await page.waitForTimeout(1500);
    const path = new URL(page.url()).pathname;
    const text = await alertText(page);
    if (path === "/") {
      await page.getByRole("button", { name: "Odhlásiť sa" }).click();
      await page.waitForURL("**/login");
    }
    return { ok: path === "/", actual: `path after submit: ${path}; alert: "${text.join()}"` };
  });
  await test(C, "Login: special characters and an injection-like string in the password", { pre: "Login page", steps: "Password: ' OR 1=1 -- <script>alert(1)</script>", expected: "Generic error, no crash, nothing rendered as HTML" }, async () => {
    await open();
    await email.fill(USERS.hr);
    await password.fill("' OR 1=1 -- <script>alert(1)</script>");
    await submit.click();
    await page.locator('p[role="alert"]').waitFor();
    return { ok: (await alertText(page)).join() === "Nesprávny e-mail alebo heslo." && page.errors.filter((e) => !/401/.test(e)).length === 0, actual: `alert: "${(await alertText(page)).join()}"; JS errors: ${page.errors.filter((e) => !/401/.test(e)).length}` };
  });
  await test(C, "Login: very long input (5 000 characters)", { pre: "Login page", steps: "Password of 5 000 characters, submit", expected: "An error message, no crash and no broken layout" }, async () => {
    await open();
    await email.fill(USERS.hr);
    await password.fill("x".repeat(5000));
    await submit.click();
    await page.locator('p[role="alert"]').waitFor();
    const size = await overflow(page);
    return { ok: size.scrollWidth <= size.clientWidth, actual: `alert: "${(await alertText(page)).join()}"; page ${size.scrollWidth}/${size.clientWidth} px` };
  });
  await test(C, "Login: server error 500 gives an understandable message and the form stays usable", { pre: "POST /api/login answered with 500", steps: "Valid data, submit", expected: "„Niečo sa nepodarilo. Skús to znova.“ in role=alert; button enabled again" }, async () => {
    await open();
    await fail500(page, "**/api/login");
    await email.fill(USERS.hr);
    await password.fill("Heslo123");
    await submit.click();
    await page.locator('p[role="alert"]').waitFor();
    const text = await alertText(page);
    const enabled = await submit.isEnabled();
    await page.unroute("**/api/login");
    return { ok: text.join() === "Niečo sa nepodarilo. Skús to znova." && enabled, actual: `alert: "${text.join()}"; button enabled: ${enabled}; label "${await submit.innerText()}"`, evidence: await shot(page, "login-500-360") };
  });
  await test(C, "Login: network failure (request aborted)", { pre: "POST /api/login aborted", steps: "Valid data, submit", expected: "Generic error message, button enabled again" }, async () => {
    await open();
    await failAbort(page, "**/api/login");
    await email.fill(USERS.hr);
    await password.fill("Heslo123");
    await submit.click();
    await page.locator('p[role="alert"]').waitFor();
    const text = await alertText(page);
    const enabled = await submit.isEnabled();
    await page.unroute("**/api/login");
    return { ok: text.join() === "Niečo sa nepodarilo. Skús to znova." && enabled, actual: `alert: "${text.join()}"; button enabled: ${enabled}` };
  });
  await test(C, "Login: loading state and double click", { pre: "POST /api/login delayed by 1.5 s", steps: "Valid data, double-click „Prihlásiť sa“", expected: "Button shows „Prihlasujem…“ and is disabled; exactly one request", req: "MVP-01" }, async () => {
    await open();
    await delay(page, "**/api/login", 1500);
    const posts = countPosts(page, "/api/login");
    await email.fill(USERS.adam);
    await password.fill("Heslo123");
    await submit.dblclick({ noWaitAfter: true });
    await page.waitForTimeout(300);
    const label = await submit.innerText();
    const disabled = await submit.isDisabled();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 8000 });
    await page.unroute("**/api/login");
    return { ok: posts.count === 1 && disabled && label === "Prihlasujem…", actual: `label during the wait: "${label}", disabled: ${disabled}, POST count: ${posts.count}; then landed on /` };
  });
  await page.context().close();
}

// keyboard-only login
await test(G, "Keyboard only: log in with Tab and Enter", { pre: "Login page, no mouse", steps: "Tab → e-mail, type; Tab → password, type; Enter", expected: "Focus order e-mail → password → button; Enter submits; focus is visible on every stop" }, async () => {
  const page = await newPage(browser);
  await page.goto(`${BASE}/login`);
  const stops = [];
  const focusInfo = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      const style = getComputedStyle(el);
      return { name: el.getAttribute("name") || el.innerText || el.tagName, visible: style.outlineStyle !== "none" || style.boxShadow !== "none" };
    });
  await page.keyboard.press("Tab");
  stops.push(await focusInfo());
  await page.keyboard.type(USERS.dana);
  await page.keyboard.press("Tab");
  stops.push(await focusInfo());
  await page.keyboard.type("Heslo123");
  await page.keyboard.press("Tab");
  stops.push(await focusInfo());
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => url.pathname === "/", { timeout: 8000 });
  await page.context().close();
  const order = stops.map((stop) => stop.name).join(" → ");
  return { ok: order === "email → password → Prihlásiť sa" && stops.every((stop) => stop.visible), actual: `focus order: ${order}; visible focus: ${stops.map((stop) => stop.visible).join(", ")}; Enter logged in` };
});

// =====================================================================
// QUESTIONNAIRE
// =====================================================================
const scaleButtons = (page) => page.locator("fieldset button[aria-pressed]");
const next = (page) => page.getByRole("button", { name: "Ďalej" });
const back = (page) => page.getByRole("button", { name: "Späť" });
const send = (page) => page.getByRole("button", { name: /Odoslať|Odosielam/ });
const comment = (page) => page.getByLabel("Komentár");
const progress = (page) => page.locator('p[aria-live="polite"]').first().innerText();
async function answerAll(page, value = 4) {
  await page.getByRole("button", { name: "Začať" }).click();
  for (let i = 0; i < 4; i++) {
    await scaleButtons(page).nth(value - 1).click();
    await next(page).click();
  }
  await comment(page).waitFor();
}

const adam = await session(browser, USERS.adam, { width: 360, height: 740 });

await test(C, "Home (employee): open round is listed with „Čaká na vyplnenie“ and a „Vyplniť“ button", { pre: "Adam (Tím Alfa), open round not answered", steps: "Open /", expected: "Task with the round name and the button; list „Moje prieskumy“ with the state", req: "MVP-06, IT-11" }, async () => {
  const body = await adam.locator("main").innerText();
  const href = await adam.getByRole("link", { name: "Vyplniť" }).getAttribute("href");
  return { ok: /Čaká na teba prieskum „Pulse – 48\. týždeň“\. Má 4 otázky/.test(body) && /Čaká na vyplnenie/.test(body) && href === `/rounds/${ids.openA}/fill`, actual: body.replace(/\s+/g, " ").slice(0, 220), evidence: await shot(adam, "home-employee-360") };
});
await test(C, "Questionnaire intro shows the exact confidentiality text", { pre: "Adam, open round", steps: "Click „Vyplniť“", expected: "„Tvoje odpovede sú dôverné. Manažér ani tím neuvidia, kto čo napísal, výsledky vidia iba za skupinu aspoň 5 ľudí.“ before the first question", req: "MVP-07, NFR-04" }, async () => {
  await adam.getByRole("link", { name: "Vyplniť" }).click();
  await adam.getByRole("button", { name: "Začať" }).waitFor();
  const body = await adam.locator("main").innerText();
  const exact = body.includes("Tvoje odpovede sú dôverné. Manažér ani tím neuvidia, kto čo napísal, výsledky vidia iba za skupinu aspoň 5 ľudí.");
  return { ok: exact && /4 otázky, zaberie to do 2 minút\./.test(body), actual: `exact text present: ${exact}; duration line: ${/4 otázky, zaberie to do 2 minút\./.test(body)}`, evidence: await shot(adam, "fill-intro-360") };
});
await test(C, "Question step: one question, scale 1–5, progress „1 z 4“, „Ďalej“ disabled until answered", { pre: "Intro", steps: "Click „Začať“", expected: "5 scale buttons, progress 1 z 4, „Ďalej“ disabled", req: "MVP-08" }, async () => {
  await adam.getByRole("button", { name: "Začať" }).click();
  const count = await scaleButtons(adam).count();
  const legends = await adam.locator("fieldset legend").count();
  return { ok: count === 5 && legends === 1 && (await progress(adam)) === "1 z 4" && (await next(adam).isDisabled()), actual: `scale buttons: ${count}; questions on screen: ${legends}; progress "${await progress(adam)}"; Ďalej disabled: ${await next(adam).isDisabled()}` };
});
await test(C, "Question step: choosing a value marks it, shows its meaning and enables „Ďalej“", { pre: "Question 1", steps: "Click 2, then click 4", expected: "Only 4 is pressed; its label is shown; „Ďalej“ enabled", req: "MVP-08, IT-03" }, async () => {
  await scaleButtons(adam).nth(1).click();
  await scaleButtons(adam).nth(3).click();
  const pressed = await scaleButtons(adam).evaluateAll((els) => els.map((el) => el.getAttribute("aria-pressed")).join(","));
  const meaning = await adam.locator("fieldset p[aria-live]").innerText().catch(() => "(none)");
  return { ok: pressed === "false,false,false,true,false" && (await next(adam).isEnabled()) && meaning.length > 0, actual: `aria-pressed: ${pressed}; label shown: "${meaning}"; Ďalej enabled: ${await next(adam).isEnabled()}`, evidence: await shot(adam, "fill-question-selected-360") };
});
await test(C, "„Ďalej“ moves to question 2 and the progress changes", { pre: "Question 1 answered", steps: "Click „Ďalej“", expected: "Progress „2 z 4“, a new question, nothing preselected", req: "MVP-08" }, async () => {
  const first = await adam.locator("fieldset legend").innerText();
  await next(adam).click();
  const second = await adam.locator("fieldset legend").innerText();
  const pressed = await scaleButtons(adam).evaluateAll((els) => els.filter((el) => el.getAttribute("aria-pressed") === "true").length);
  return { ok: (await progress(adam)) === "2 z 4" && first !== second && pressed === 0, actual: `progress "${await progress(adam)}"; question changed: ${first !== second}; preselected: ${pressed}` };
});
await test(C, "„Späť“ returns to question 1 and keeps the chosen answer", { pre: "Question 2", steps: "Click „Späť“", expected: "Progress „1 z 4“, value 4 still pressed", req: "MVP-08" }, async () => {
  await back(adam).click();
  const pressed = await scaleButtons(adam).evaluateAll((els) => els.map((el) => el.getAttribute("aria-pressed")).join(","));
  return { ok: (await progress(adam)) === "1 z 4" && pressed === "false,false,false,true,false", actual: `progress "${await progress(adam)}"; aria-pressed: ${pressed}` };
});
await test(C, "„Späť“ on question 1 returns to the intro; answers survive", { pre: "Question 1", steps: "Click „Späť“, then „Začať“", expected: "Intro is shown; after „Začať“ the answer to question 1 is still selected", req: "MVP-07, MVP-08" }, async () => {
  await back(adam).click();
  const intro = await adam.getByRole("button", { name: "Začať" }).isVisible();
  await adam.getByRole("button", { name: "Začať" }).click();
  const pressed = await scaleButtons(adam).evaluateAll((els) => els.map((el) => el.getAttribute("aria-pressed")).join(","));
  return { ok: intro && pressed === "false,false,false,true,false", actual: `intro shown: ${intro}; aria-pressed after restart: ${pressed}` };
});
await test(C, "All scale types render with labels (numbers with end labels, or five worded options)", { pre: "Adam walks the four questions", steps: "Go through questions 1–4, record how the scale is drawn", expected: "Each question has 5 options and visible labels explaining the scale", req: "IT-03" }, async () => {
  const seen = [];
  for (let i = 0; i < 4; i++) {
    const texts = await scaleButtons(adam).allInnerTexts();
    const ends = await adam.locator("fieldset div.flex.justify-between span").allInnerTexts();
    seen.push(`Q${i + 1}: [${texts.join("|")}]${ends.length ? ` ends: ${ends.join(" … ")}` : ""}`);
    await scaleButtons(adam).nth(3).click();
    await next(adam).click();
  }
  await comment(adam).waitFor();
  return { ok: seen.every((line) => line.split("|").length === 5), actual: seen.join("; ") };
});
await test(C, "Comment step: optional comment, counter and the 1 000 character limit", { pre: "After question 4", steps: "Type 1 100 characters into the comment", expected: "Text stops at 1 000; counter „1000 / 1000“", req: "MVP-08" }, async () => {
  await comment(adam).fill("a".repeat(1100));
  const length = (await comment(adam).inputValue()).length;
  const counter = await adam.locator("p.text-right").innerText();
  return { ok: length === 1000 && counter === "1000 / 1000", actual: `stored length ${length}; counter "${counter}"`, evidence: await shot(adam, "fill-comment-1000-360") };
});
await test(C, "Comment step: typing past the limit gives the user a signal", { pre: "Comment holds 1 000 characters", steps: "Type one more character", expected: "The counter or a message makes it obvious that the limit was reached (colour, text or announcement)" }, async () => {
  const before = await adam.locator("p.text-right").evaluate((el) => getComputedStyle(el).color);
  await comment(adam).press("End");
  await adam.keyboard.type("b");
  const after = await adam.locator("p.text-right").evaluate((el) => getComputedStyle(el).color);
  const alerts = await alertText(adam);
  const live = await adam.locator("p.text-right").getAttribute("aria-live");
  return { ok: before !== after || alerts.length > 0, actual: `counter colour before/after: ${before} / ${after}; alerts: ${alerts.length}; counter aria-live: ${live}` };
});
await test(C, "Comment step: emoji and the counter", { pre: "Comment step", steps: "Replace the comment with a single emoji 😀", expected: "Counter shows 1 / 1000 (one visible character)" }, async () => {
  await comment(adam).fill("😀");
  const counter = await adam.locator("p.text-right").innerText();
  return { ok: counter === "1 / 1000", actual: `counter "${counter}"` };
});
await test(C, "„Späť“ from the comment step returns to question 4 and keeps the comment", { pre: "Comment typed", steps: "Click „Späť“, then „Ďalej“", expected: "Question 4 with its answer; the comment is still there", req: "MVP-08" }, async () => {
  await comment(adam).fill("Poznámka na skúšku");
  await back(adam).click();
  const at = await progress(adam);
  await next(adam).click();
  const value = await comment(adam).inputValue();
  return { ok: at === "4 z 4" && value === "Poznámka na skúšku", actual: `returned to "${at}"; comment after coming back: "${value}"` };
});
await test(C, "Reload in the middle of the questionnaire", { pre: "Answers and a comment entered, not sent", steps: "Reload the page", expected: "MVP keeps answers only in the page (autosave FILL-06 is out of scope): the questionnaire restarts at the intro; ideally the browser warns before the answers are lost" }, async () => {
  let dialog = false;
  adam.once("dialog", (d) => { dialog = true; d.accept(); });
  await adam.reload();
  const intro = await adam.getByRole("button", { name: "Začať" }).isVisible();
  return { ok: intro, actual: `restarted at the intro: ${intro}; unsaved-changes warning shown: ${dialog}` };
});
await test(C, "Submit fails with 500: message, answers kept, retry possible", { pre: "All answered; POST /responses answered with 500", steps: "Click „Odoslať“", expected: "„Niečo sa nepodarilo. Skús to znova.“ in role=alert; still on the comment step; comment kept; button enabled", req: "MVP-09" }, async () => {
  await answerAll(adam, 4);
  await comment(adam).fill("Pokus s chybou servera");
  await fail500(adam, "**/api/rounds/*/responses");
  await send(adam).click();
  await adam.locator('p[role="alert"]').waitFor();
  const text = await alertText(adam);
  const kept = await comment(adam).inputValue();
  const enabled = await send(adam).isEnabled();
  await adam.unroute("**/api/rounds/*/responses");
  return { ok: text.join() === "Niečo sa nepodarilo. Skús to znova." && kept === "Pokus s chybou servera" && enabled, actual: `alert: "${text.join()}"; comment kept: ${kept === "Pokus s chybou servera"}; button enabled: ${enabled}`, evidence: await shot(adam, "fill-submit-500-360") };
});
await test(C, "Submit fails with a network error", { pre: "Same state; request aborted", steps: "Click „Odoslať“", expected: "Generic error, nothing lost", req: "MVP-09" }, async () => {
  await failAbort(adam, "**/api/rounds/*/responses");
  await send(adam).click();
  await adam.waitForTimeout(600);
  const text = await alertText(adam);
  await adam.unroute("**/api/rounds/*/responses");
  return { ok: text.join() === "Niečo sa nepodarilo. Skús to znova." && (await comment(adam).inputValue()) === "Pokus s chybou servera", actual: `alert: "${text.join()}"; comment kept: ${(await comment(adam).inputValue()) === "Pokus s chybou servera"}` };
});
await test(C, "Submit: loading state, double click sends one response, thank-you screen with the latest actions", { pre: "Adam; POST delayed by 1.2 s; comment with special characters", steps: "Comment: <script>alert(1)</script> & \"úvodzovky\" ľščťžýáíé 😀; double-click „Odoslať“", expected: "Button „Odosielam…“, both buttons disabled, exactly one POST; then „Ďakujeme za odpoveď“ and „Čo sa urobilo po kole …“", req: "MVP-09, MVP-14" }, async () => {
  await comment(adam).fill('<script>alert(1)</script> & "úvodzovky" ľščťžýáíé 😀');
  await delay(adam, "**/api/rounds/*/responses", 1200);
  const posts = countPosts(adam, "/responses");
  await send(adam).dblclick({ noWaitAfter: true });
  await adam.waitForTimeout(300);
  const label = await send(adam).innerText();
  const disabled = (await send(adam).isDisabled()) && (await back(adam).isDisabled());
  await adam.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 8000 });
  await adam.unroute("**/api/rounds/*/responses");
  const body = (await adam.locator("main").innerText()).replace(/\s+/g, " ");
  const evidence = await shot(adam, "fill-thanks-360");
  return { ok: posts.count === 1 && disabled && label === "Odosielam…" && /Čo sa urobilo po kole „Pulse – 46\. týždeň“/.test(body), actual: `label "${label}", buttons disabled: ${disabled}, POST count: ${posts.count}; thank-you: "${body.slice(0, 200)}"`, evidence };
});
for (const what of ["Questionnaire confetti after sending", "Animated thank-you (success animation)", "Animated transition between questions (Ďalej / Späť)"]) {
  await test("D-Animations", what, { pre: "Adam on the thank-you screen", steps: "Count canvas elements, animated elements and running animations (document.getAnimations)", expected: "Policy asks to test the animation", req: "IT-02 (paused)" }, async () => {
    const info = await adam.evaluate(() => ({ canvas: document.querySelectorAll("canvas").length, running: document.getAnimations().length, animated: document.querySelectorAll('[class*="animate-"], [class*="confetti"]').length }));
    return { blocked: true, actual: `NOT IMPLEMENTED – IT-02 (animations) is paused and not part of this build. Verified: ${info.canvas} canvas elements, ${info.running} running animations, ${info.animated} animated elements on the thank-you screen; the step changes instantly.` };
  });
}
await test(C, "Thank-you screen: the section about the last closed round makes sense when that round has no action", { pre: "Last closed round of Tím Alfa (Pulse – 46. týždeň) has no action", steps: "Read the section under the thank-you", expected: "Empty state „K poslednému uzavretému kolu zatiaľ nie je zapísaný žiadny krok.“", req: "MVP-09, MVP-14" }, async () => {
  const body = (await adam.locator("main").innerText()).replace(/\s+/g, " ");
  return { ok: body.includes("K poslednému uzavretému kolu zatiaľ nie je zapísaný žiadny krok."), actual: body.slice(body.indexOf("Čo sa urobilo"), body.indexOf("Čo sa urobilo") + 170) };
});
await test(C, "Browser Back after the thank-you screen does not allow a second answer", { pre: "Adam just submitted", steps: "Press Back, then Forward to the fill URL", expected: "Never a usable questionnaire again; „Toto kolo už máš vyplnené“ on the fill URL", req: "MVP-09" }, async () => {
  await adam.goBack();
  await adam.waitForTimeout(800);
  const afterBack = new URL(adam.url()).pathname;
  await adam.goto(fillUrl);
  const body = (await adam.locator("main").innerText()).replace(/\s+/g, " ");
  return { ok: /Toto kolo už máš vyplnené/.test(body), actual: `Back led to ${afterBack === "/" ? "/" : "the fill page"}; fill URL now shows: "${body.slice(0, 90)}"`, evidence: await shot(adam, "fill-already-360") };
});
await test(C, "Home after submitting: state „Odoslané“, no task", { pre: "Adam submitted", steps: "Open /", expected: "„Nič nečaká.“ and the round with the badge „Odoslané“", req: "MVP-06, IT-11" }, async () => {
  await adam.goto(BASE + "/");
  const body = (await adam.locator("main").innerText()).replace(/\s+/g, " ");
  return { ok: /Nič nečaká\./.test(body) && /Odoslané/.test(body) && (await adam.getByRole("link", { name: "Vyplniť" }).count()) === 0, actual: body.slice(0, 260), evidence: await shot(adam, "home-employee-submitted-360") };
});
await adam.context().close();

// ---- two tabs: second submission is refused (409)
await test(C, "Second submission from another tab is refused with a clear screen", { pre: "Barbora has the questionnaire open in two tabs", steps: "Fill and send in tab A, then send in tab B", expected: "Tab B shows „Toto kolo už máš vyplnené – Do každého kola sa dá odpovedať iba raz.“", req: "MVP-09" }, async () => {
  const tabA = await session(browser, USERS.barbora, { width: 360, height: 740 });
  const tabB = await tabA.context().newPage();
  await tabA.goto(fillUrl);
  await tabB.goto(fillUrl);
  await answerAll(tabA, 3);
  await answerAll(tabB, 5);
  await send(tabA).click();
  await tabA.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor();
  await send(tabB).click();
  await tabB.getByRole("heading", { name: "Toto kolo už máš vyplnené" }).waitFor({ timeout: 8000 });
  const body = (await tabB.locator("main").innerText()).replace(/\s+/g, " ");
  const evidence = await shot(tabB, "fill-second-tab-409-360");
  await tabA.context().close();
  return { ok: /Do každého kola sa dá odpovedať iba raz\./.test(body), actual: body.slice(0, 140), evidence };
});

// ---- long unbroken comment (used later on the results screen)
await test(C, "Comment of 1 000 characters without a space is accepted", { pre: "Cyril, open round", steps: "Answer all, paste 1 000 × „W“ as the comment, send", expected: "Thank-you screen; no horizontal scroll on the comment step at 360 px", req: "MVP-08, NFR-07" }, async () => {
  const page = await session(browser, USERS.cyril, { width: 360, height: 740 });
  await page.goto(fillUrl);
  await answerAll(page, 2);
  await comment(page).fill("W".repeat(1000));
  const size = await overflow(page);
  await send(page).click();
  await page.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor();
  await page.context().close();
  return { ok: size.scrollWidth <= size.clientWidth, actual: `comment step ${size.scrollWidth}/${size.clientWidth} px; sent` };
});

// ---- keyboard only
await test(G, "Keyboard only: complete the questionnaire without a mouse", { pre: "Dana logged in, viewport 1280", steps: "Tab to „Vyplniť“, Enter; Tab to „Začať“, Enter; per question: reach a scale button, Space, reach „Ďalej“, Enter; comment; Tab to „Odoslať“, Enter", expected: "Completable; after each step the focus lands in the new content (not back at the top of the page); focus is always visible", req: "MVP-08 / WCAG 2.1.1, 2.4.3, 2.4.7" }, async () => {
  const page = await session(browser, USERS.dana);
  const focused = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      const style = getComputedStyle(el);
      return { tag: el.tagName, text: (el.getAttribute("aria-label") || el.innerText || "").trim().slice(0, 30), disabled: el.disabled === true, ring: style.outlineStyle !== "none" || style.boxShadow !== "none" };
    });
  let presses = 0;
  const log = [];
  let invisible = 0;
  const tabTo = async (pattern, max = 40) => {
    const seen = [];
    for (let i = 0; i < max; i++) {
      await page.keyboard.press("Tab");
      presses++;
      const info = await focused();
      seen.push(info.text || info.tag);
      if (info.tag !== "BODY" && !info.ring) invisible++;
      const hit = pattern === "TEXTAREA" ? info.tag === "TEXTAREA" : pattern.test(info.text);
      if (hit && !info.disabled) return i + 1;
    }
    throw new Error(`never focused ${pattern}; saw: ${seen.slice(0, 12).join(" > ")}`);
  };
  log.push(`Vyplniť after ${await tabTo(/^Vyplniť$/)} Tab`);
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Začať" }).waitFor();
  log.push(`Začať after ${await tabTo(/^Začať$/)} Tab`);
  await page.keyboard.press("Enter");
  await page.locator("fieldset").waitFor();
  const afterStart = await focused();
  log.push(`focus after „Začať“: ${afterStart.tag}${afterStart.text ? ` "${afterStart.text}"` : ""}`);
  const perQuestion = [];
  for (let i = 0; i < 4; i++) {
    const toScale = await tabTo(/^(3 – |Občas|Každý týždeň|Ani tak|Priemerné)/);
    await page.keyboard.press("Space");
    const toNext = await tabTo(/^Ďalej$/);
    await page.keyboard.press("Enter");
    const after = await focused();
    perQuestion.push(`Q${i + 1}: ${toScale} Tab to the scale, ${toNext} Tab to Ďalej, focus after: ${after.tag}${after.disabled ? " (disabled button)" : ""}`);
  }
  await page.getByLabel("Komentár").waitFor();
  const toComment = await tabTo("TEXTAREA", 40).catch(() => -1);
  const active = await page.evaluate(() => document.activeElement.tagName);
  log.push(`comment field after ${toComment} Tab (active: ${active})`);
  if (active === "TEXTAREA") await page.keyboard.type("Vyplnené iba klávesnicou.");
  log.push(`Odoslať after ${await tabTo(/^Odoslať$/)} Tab`);
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor({ timeout: 8000 });
  const end = await focused();
  await page.context().close();
  const focusKept = afterStart.tag !== "BODY";
  return { ok: focusKept && invisible === 0, actual: `completed with ${presses} Tab presses; ${log.join("; ")}; ${perQuestion.join("; ")}; focus after sending: ${end.tag}; stops without a visible focus ring: ${invisible}` };
});

// ---- manager answers as a member of the team
const manager = await session(browser, USERS.mgrA);
await test(C, "Manager home offers a way to fill in the open round of the own team", { pre: "Manager of Tím Alfa: 2 closed rounds without an action, 1 overdue action and 1 open round not answered (demo data)", steps: "Open /; look for a link to the questionnaire on the home page and on /rounds", expected: "A „Vyplniť“ link for „Pulse – 48. týždeň“ – the manager fills in the round of the own team (permission matrix, MVP-06); the home list says the button is in the task above", req: "MVP-06, IT-11" }, async () => {
  await manager.goto(BASE + "/");
  const home = (await manager.locator("main").innerText()).replace(/\s+/g, " ");
  const homeLinks = await manager.locator(`a[href="/rounds/${ids.openA}/fill"]`).count();
  const tasks = await manager.locator("main ol > li").count();
  const evidence = await shot(manager, "home-manager-no-fill-link-1280");
  await manager.goto(BASE + "/rounds");
  const roundsLinks = await manager.locator(`a[href="/rounds/${ids.openA}/fill"]`).count();
  return { ok: homeLinks + roundsLinks > 0, actual: `home lists the round as „Čaká na vyplnenie“: ${/Pulse – 48\. týždeň Čaká na vyplnenie/.test(home)}; links to the questionnaire on home: ${homeLinks}, on /rounds: ${roundsLinks}; tasks shown on home: ${tasks} (limit 3, none of them is the questionnaire)`, evidence };
});
await test(C, "Manager can answer through the direct URL; multi-line comment", { pre: "Manager of Tím Alfa", steps: "Open /rounds/:id/fill directly, answer, comment on two lines, send", expected: "Thank-you screen", req: "MVP-09 (matrix: manager fills in the own team's round)" }, async () => {
  await manager.goto(fillUrl);
  await answerAll(manager, 5);
  await comment(manager).fill("Prvý riadok komentára\nDruhý riadok komentára");
  await send(manager).click();
  await manager.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor();
  return { ok: true, actual: "thank-you screen shown" };
});

// ---- emil: scale boundaries 1 and 5, empty comment
await test(C, "Minimum values and an empty comment are accepted", { pre: "Emil, open round", steps: "Answer 1 everywhere, leave the comment empty, send", expected: "Thank-you screen (the comment is optional)", req: "MVP-08" }, async () => {
  const page = await session(browser, USERS.emil, { width: 360, height: 740 });
  await page.goto(fillUrl);
  await answerAll(page, 1);
  await send(page).click();
  await page.getByRole("heading", { name: "Ďakujeme za odpoveď" }).waitFor();
  await page.context().close();
  return { ok: true, actual: "thank-you screen shown" };
});

// =====================================================================
// CLOSING THE ROUND (confirm dialog) AND THE RESULT OF THE INPUTS ABOVE
// =====================================================================
const openRow = () => manager.locator("main ul > li").filter({ hasText: "Pulse – 48. týždeň" });
await test("B-Components", "Round list: participation of the open round counts all six answers", { pre: "6 of 6 answered", steps: "Open /rounds", expected: "„Účasť: 6 z 6“ on the open round", req: "MVP-10" }, async () => {
  await manager.goto(BASE + "/rounds");
  const text = (await openRow().innerText()).replace(/\s+/g, " ");
  return { ok: /Účasť: 6 z 6/.test(text), actual: text };
});
await test("B-Components", "Open round: results page shows only the participation", { pre: "Round still open", steps: "Click „Výsledky“ on the open round", expected: "„Odpovedalo 6 z 6 členov tímu“ and the note that results come after closing; no averages, no comments", req: "MVP-10" }, async () => {
  await openRow().getByRole("link", { name: "Výsledky" }).click();
  await manager.waitForURL("**/results");
  const body = (await manager.locator("main").innerText()).replace(/\s+/g, " ");
  return { ok: /Odpovedalo 6 z 6 členov tímu/.test(body) && /Výsledky sa zobrazia až po uzavretí kola/.test(body) && !/Priemer/.test(body) && !/Komentáre/.test(body), actual: body.slice(0, 260), evidence: await shot(manager, "results-open-round-1280") };
});
await test("B-Components", "„Uzavrieť“: cancelling the confirm dialog changes nothing", { pre: "Manager on /rounds", steps: "Click „Uzavrieť“, cancel the dialog", expected: "Dialog „Uzavrieť kolo? Potom sa do neho už nedá odpovedať.“; the round stays open; no request", req: "MVP-05" }, async () => {
  await manager.goto(BASE + "/rounds");
  const posts = countPosts(manager, "/close");
  let message = "";
  manager.once("dialog", (dialog) => { message = dialog.message(); dialog.dismiss(); });
  await openRow().getByRole("button", { name: "Uzavrieť" }).click();
  await manager.waitForTimeout(500);
  const text = (await openRow().innerText()).replace(/\s+/g, " ");
  return { ok: message === "Uzavrieť kolo? Potom sa do neho už nedá odpovedať." && /Otvorené/.test(text) && posts.count === 0, actual: `dialog: "${message}"; row: ${text.slice(0, 60)}; POST count ${posts.count}` };
});
await test("B-Components", "„Uzavrieť“: server error is reported next to the button", { pre: "POST /close answered with 500", steps: "Click „Uzavrieť“, confirm", expected: "„Niečo sa nepodarilo. Skús to znova.“ in role=alert; the round stays open; button enabled", req: "MVP-05" }, async () => {
  await fail500(manager, "**/api/rounds/*/close");
  manager.once("dialog", (dialog) => dialog.accept());
  await openRow().getByRole("button", { name: "Uzavrieť" }).click();
  await openRow().locator('[role="alert"]').waitFor();
  const text = await openRow().locator('[role="alert"]').innerText();
  await manager.unroute("**/api/rounds/*/close");
  return { ok: text === "Niečo sa nepodarilo. Skús to znova." && (await openRow().getByRole("button", { name: "Uzavrieť" }).isEnabled()), actual: `alert: "${text}"`, evidence: await shot(manager, "round-close-500-1280") };
});
await test("B-Components", "„Uzavrieť“: conflict 409 is explained", { pre: "POST /close answered with 409 invalid_state", steps: "Click „Uzavrieť“, confirm", expected: "„Kolo medzitým zmenilo stav. Obnov stránku.“", req: "MVP-05" }, async () => {
  await manager.route("**/api/rounds/*/close", (route) => route.fulfill({ status: 409, contentType: "application/json", body: '{"error":"invalid_state"}' }));
  manager.once("dialog", (dialog) => dialog.accept());
  await openRow().getByRole("button", { name: "Uzavrieť" }).click();
  await manager.waitForTimeout(600);
  const text = await openRow().locator('[role="alert"]').innerText();
  await manager.unroute("**/api/rounds/*/close");
  return { ok: text === "Kolo medzitým zmenilo stav. Obnov stránku.", actual: `alert: "${text}"` };
});
await test("B-Components", "„Uzavrieť“: confirming closes the round and the list updates without a reload", { pre: "Manager on /rounds", steps: "Click „Uzavrieť“, confirm", expected: "Badge „Uzavreté“ and „Čaká na krok“; the button disappears", req: "MVP-05, MVP-15" }, async () => {
  manager.once("dialog", (dialog) => dialog.accept());
  await openRow().getByRole("button", { name: "Uzavrieť" }).click();
  await openRow().getByText("Uzavreté").waitFor({ timeout: 8000 });
  const text = (await openRow().innerText()).replace(/\s+/g, " ");
  return { ok: /Čaká na krok/.test(text) && (await openRow().getByRole("button", { name: "Uzavrieť" }).count()) === 0, actual: text, evidence: await shot(manager, "round-closed-1280") };
});
await test("B-Components", "Results: comments are collapsed with the count and render as plain text", { pre: "Closed round with 6 answers, 4 comments (script tag, multi-line, 1 000 unbroken characters, keyboard run)", steps: "Open results, expand „Komentáre“", expected: "Heading „Komentáre (4)“; the script tag is shown as text and not executed; line break preserved", req: "MVP-10, IT-13" }, async () => {
  await manager.goto(`${BASE}/rounds/${ids.openA}/results`);
  const summary = manager.locator("summary", { hasText: "Komentáre" });
  const label = await summary.innerText();
  const collapsed = !(await manager.getByText("V náhodnom poradí, bez mien.").isVisible());
  await summary.click();
  const items = await manager.locator("details ul > li.whitespace-pre-line").allInnerTexts();
  const script = items.some((text) => text.includes("<script>alert(1)</script>"));
  const multi = items.some((text) => text.includes("Prvý riadok komentára\nDruhý riadok komentára"));
  const injected = await manager.locator("main script").count();
  return { ok: label === "Komentáre (4)" && collapsed && script && multi && manager.errors.filter((e) => /alert/.test(e)).length === 0, actual: `summary "${label}"; collapsed at first: ${collapsed}; script tag shown as text: ${script}; line break kept: ${multi}; comments: ${items.length}`, evidence: await shot(manager, "results-comments-1280") };
});
for (const width of [1280, 360]) {
  await test("F-Visual", `Results: a long comment without spaces stays inside its card at ${width} px`, { pre: "Comment of 1 000 characters without a space exists", steps: "Open results, expand „Komentáre“", expected: "The text wraps inside the card; no horizontal page scroll", req: "NFR-07" }, async () => {
    await manager.setViewportSize({ width, height: 800 });
    await manager.goto(`${BASE}/rounds/${ids.openA}/results`);
    await manager.locator("summary", { hasText: "Komentáre" }).click();
    const size = await overflow(manager);
    const card = await manager.locator("details ul > li.whitespace-pre-line").evaluateAll((els) => Math.max(...els.map((el) => el.scrollWidth - el.clientWidth)));
    const evidence = await shot(manager, `results-long-comment-${width}`);
    return { ok: size.scrollWidth <= size.clientWidth && card <= 1, actual: `page ${size.scrollWidth}/${size.clientWidth} px; text wider than its card by ${card} px`, evidence };
  });
}
await manager.setViewportSize({ width: 1280, height: 800 });
await test(C, "Closed round: the questionnaire URL explains that the round is closed", { pre: "Round closed; Adam already answered", steps: "Adam opens the fill URL", expected: "A notice instead of the questionnaire (already answered / closed)", req: "MVP-09" }, async () => {
  const page = await session(browser, USERS.adam);
  await page.goto(fillUrl);
  const body = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  await page.context().close();
  return { ok: /Toto kolo už máš vyplnené|Kolo je uzavreté/.test(body) && !/Začať/.test(body), actual: body.slice(0, 120) };
});

await browser.close();
