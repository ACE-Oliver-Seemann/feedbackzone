// Areas B/C – forms and components of the manager and HR: new round, open/close, results,
// actions, kudos, issues, notes. MUTATES the QA database (creates rounds, actions, kudos,
// issues and notes with invented content). Independent of 03-login-fill.mjs.
import { BASE, USERS, launch, makeRecorder, session, shot, discover, overflow } from "./lib.mjs";

const { test } = makeRecorder("04-manage-forms");
const browser = await launch();
const ids = await discover(browser);
const B = "B-Components";
const C = "C-Forms";
const F = "F-Visual";
const G = "G-Accessibility";

function countPosts(page, part, method = "POST") {
  const counter = { count: 0 };
  page.on("request", (request) => {
    if (request.method() === method && request.url().includes(part)) counter.count++;
  });
  return counter;
}
const fail500 = (page, glob) =>
  page.route(glob, (route) =>
    route.request().method() === "GET" ? route.continue() : route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"internal"}' }),
  );
const delay = (page, glob, ms) =>
  page.route(glob, async (route) => {
    if (route.request().method() !== "GET") await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });
const alerts = (page) => page.locator('[role="alert"]:not(#__next-route-announcer__)').allInnerTexts();
const flat = (text) => text.replace(/\s+/g, " ").trim();
const LONG = (n, ch = "W") => ch.repeat(n);
const today = new Date();
const iso = (offsetDays) => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const widthCheck = async (page, width, name) => {
  await page.setViewportSize({ width, height: 800 });
  await page.reload();
  const size = await overflow(page);
  const evidence = await shot(page, name);
  return { size, evidence };
};

const manager = await session(browser, USERS.mgrA);
const hr = await session(browser, USERS.hr);

// =====================================================================
// NEW ROUND (manager)
// =====================================================================
const nameInput = (page) => page.locator('input[name="name"]');
const dateInput = (page) => page.locator('input[name="closesAt"]');
const boxes = (page) => page.locator('form details input[type="checkbox"]');
const total = (page) => page.locator("form p[aria-live]").filter({ hasText: "Otázok v kole" }).innerText();
const save = (page) => page.getByRole("button", { name: /Uložiť koncept|Ukladám/ });
const openAll = (page) => page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));

await test(C, "New round: defaults (name, deadline +7 days, 3 preselected questions from different topics)", { pre: "Manager of Tím Alfa", steps: "Open /rounds/new", expected: "Name „Pulse – N. týždeň“, deadline = today + 7, 3 ticked questions in 3 different topics + the fixed question = 4, notice about the preselection", req: "IT-13, IT-04" }, async () => {
  await manager.goto(`${BASE}/rounds/new`);
  const name = await nameInput(manager).inputValue();
  const date = await dateInput(manager).inputValue();
  const checked = await boxes(manager).evaluateAll((els) => els.filter((el) => el.checked).length);
  const topics = await manager.locator("form details").evaluateAll((els) => els.filter((el) => el.querySelector("input:checked")).length);
  const opened = await manager.locator("form details[open]").count();
  const notice = await manager.getByText("Predvybrali sme odporúčané otázky").isVisible();
  const fixed = await manager.getByText("Stála otázka").isVisible();
  return { ok: /^Pulse – \d+\. týždeň$/.test(name) && date === iso(7) && checked === 3 && topics === 3 && notice && fixed && (await total(manager)) === "Otázok v kole: 4 (treba 3 až 5)", actual: `name "${name}"; deadline ${date} (today+7 = ${iso(7)}); ticked ${checked} in ${topics} topics; expanded topics ${opened}; notice ${notice}; fixed question block ${fixed}; "${await total(manager)}"`, evidence: await shot(manager, "newround-defaults-1280") };
});
await test(B, "New round: collapsed topics show how many questions are selected", { pre: "Default form", steps: "Read the topic headers", expected: "Topics with a ticked question say „(vybrané 1 z N)“, others „(N)“ and are collapsed", req: "IT-13" }, async () => {
  const summaries = await manager.locator("form details > summary").allInnerTexts();
  const withSelected = summaries.filter((text) => /\(vybrané 1 z \d+\)/.test(text)).length;
  const collapsed = await manager.locator("form details:not([open])").count();
  return { ok: withSelected === 3 && collapsed === summaries.length - 3, actual: `${summaries.length} topics: ${summaries.map(flat).join(" | ")}; collapsed: ${collapsed}` };
});
await test(C, "New round: fewer than 3 questions is refused in the form", { pre: "Default form", steps: "Untick two preselected questions (total 2), click „Uložiť koncept“", expected: "„Kolo musí mať spolu 3 až 5 otázok.“; no request", req: "MVP-04" }, async () => {
  const posts = countPosts(manager, "/api/rounds");
  const ticked = manager.locator('form details input[type="checkbox"]:checked');
  await ticked.first().uncheck();
  await ticked.first().uncheck();
  const counter = await total(manager);
  await save(manager).click();
  await manager.waitForTimeout(400);
  const text = await alerts(manager);
  return { ok: counter.startsWith("Otázok v kole: 2") && text.join() === "Kolo musí mať spolu 3 až 5 otázok." && posts.count === 0, actual: `"${counter}"; alert: "${text.join()}"; POST count ${posts.count}`, evidence: await shot(manager, "newround-too-few-1280") };
});
await test(C, "New round: the sixth question cannot be ticked", { pre: "Form with 2 questions", steps: "Expand all topics, tick questions until the total is 5", expected: "At 5 every unticked box is disabled; counter „Otázok v kole: 5“", req: "MVP-04" }, async () => {
  await openAll(manager);
  for (let i = 0; i < 3; i++) await manager.locator('form details input[type="checkbox"]:not(:checked)').nth(i * 2).check();
  const counter = await total(manager);
  const enabledUnticked = await manager.locator('form details input[type="checkbox"]:not(:checked):not(:disabled)').count();
  const badges = await manager.locator("form details label span.bg-teal-700").allInnerTexts();
  return { ok: counter.startsWith("Otázok v kole: 5") && enabledUnticked === 0, actual: `"${counter}"; unticked boxes still enabled: ${enabledUnticked}; order badges: ${badges.sort().join(",")}`, evidence: await shot(manager, "newround-five-1280") };
});
await test(C, "New round: the preselection notice after the user replaced the whole selection", { pre: "User unticked preselected questions and ticked own choice", steps: "Read the notice above the questions", expected: "The notice „Predvybrali sme odporúčané otázky…“ no longer claims that the current selection is the recommended one" }, async () => {
  const visible = await manager.getByText("Predvybrali sme odporúčané otázky").isVisible();
  return { ok: !visible, actual: `notice still shown after manual changes: ${visible}` };
});
await test(C, "New round: empty name", { pre: "Valid questions", steps: "Clear the name, save", expected: "„Zadaj názov kola (najviac 120 znakov).“ next to the field", req: "MVP-04" }, async () => {
  await nameInput(manager).fill("");
  await save(manager).click();
  await manager.locator('label [role="alert"]').first().waitFor();
  return { ok: (await alerts(manager)).join() === "Zadaj názov kola (najviac 120 znakov).", actual: `alert: "${(await alerts(manager)).join()}"` };
});
await test(C, "New round: name of spaces only", { pre: "Valid questions", steps: "Name = 5 spaces, save", expected: "Same error as for an empty name", req: "MVP-04" }, async () => {
  await nameInput(manager).fill("     ");
  await save(manager).click();
  await manager.waitForTimeout(600);
  return { ok: (await alerts(manager)).join() === "Zadaj názov kola (najviac 120 znakov).", actual: `alert: "${(await alerts(manager)).join()}"` };
});
await test(C, "New round: deadline in the past", { pre: "Valid name and questions", steps: "Deadline 2020-01-01, save", expected: "„Zadaj dátum uzávierky, ktorý je dnes alebo neskôr.“", req: "MVP-04" }, async () => {
  await nameInput(manager).fill("Kolo s minulým dátumom");
  await dateInput(manager).fill("2020-01-01");
  await save(manager).click();
  await manager.waitForTimeout(600);
  return { ok: (await alerts(manager)).join() === "Zadaj dátum uzávierky, ktorý je dnes alebo neskôr.", actual: `alert: "${(await alerts(manager)).join()}"` };
});
await test(C, "New round: empty deadline", { pre: "Valid name and questions", steps: "Clear the deadline, save", expected: "Error at the deadline field", req: "MVP-04" }, async () => {
  await dateInput(manager).fill("");
  await save(manager).click();
  await manager.waitForTimeout(600);
  return { ok: (await alerts(manager)).join() === "Zadaj dátum uzávierky, ktorý je dnes alebo neskôr.", actual: `alert: "${(await alerts(manager)).join()}"` };
});
await test(C, "New round: name is limited to 120 characters", { pre: "Form", steps: "Type 130 characters into the name", expected: "Field holds 120", req: "MVP-04" }, async () => {
  await nameInput(manager).fill(LONG(130));
  const length = (await nameInput(manager).inputValue()).length;
  return { ok: length === 120, actual: `length ${length}` };
});

// custom question
const custom = (page) => page.getByLabel("Pridať vlastnú otázku");
const addCustom = (page) => page.getByRole("button", { name: /Pridať otázku|Pridávam/ });
await test(C, "Own question: too short", { pre: "Manager, new round form", steps: "Type „Krátka“, click „Pridať otázku“", expected: "„Otázka musí mať 10 až 200 znakov.“", req: "IT-07" }, async () => {
  await manager.goto(`${BASE}/rounds/new`);
  await custom(manager).fill("Krátka");
  await addCustom(manager).click();
  await manager.waitForTimeout(600);
  return { ok: (await alerts(manager)).join() === "Otázka musí mať 10 až 200 znakov.", actual: `alert: "${(await alerts(manager)).join()}"` };
});
await test(C, "Own question: button disabled while the field is empty; limit 200 characters", { pre: "Form", steps: "Empty field; then type 250 characters", expected: "Button disabled when empty; field holds 200", req: "IT-07" }, async () => {
  await custom(manager).fill("");
  const disabled = await addCustom(manager).isDisabled();
  await custom(manager).fill(LONG(250, "a"));
  const length = (await custom(manager).inputValue()).length;
  await custom(manager).fill("");
  return { ok: disabled && length === 200, actual: `disabled when empty: ${disabled}; length after 250 typed: ${length}` };
});
const ownQuestion = `Na poradách tímu sa dostanem k slovu (${Date.now() % 100000}).`;
await test(C, "Own question: Enter adds the question and does not submit the round", { pre: "Default form (4 questions)", steps: "Type a valid question, press Enter", expected: "Question added and ticked (5 in the round), field cleared, the round is not saved; the new question is visible to the user", req: "IT-07" }, async () => {
  const posts = countPosts(manager, "/api/rounds");
  await custom(manager).fill(ownQuestion);
  await custom(manager).press("Enter");
  await manager.waitForTimeout(900);
  const counter = await total(manager);
  const cleared = (await custom(manager).inputValue()) === "";
  const visible = await manager.getByText(ownQuestion).isVisible();
  const where = await manager.locator("form details", { hasText: ownQuestion }).locator("summary").innerText().catch(() => "(not found)");
  return { ok: counter.startsWith("Otázok v kole: 5") && cleared && posts.count === 0 && visible, actual: `"${counter}"; field cleared: ${cleared}; round POSTs: ${posts.count}; new question visible without expanding anything: ${visible}; it sits in the topic "${flat(where)}"`, evidence: await shot(manager, "newround-own-question-1280") };
});
await test(C, "Own question: duplicate is refused", { pre: "The question from the previous test exists", steps: "Type the same text again, click „Pridať otázku“", expected: "„Takáto otázka už v knižnici je.“", req: "IT-07" }, async () => {
  await custom(manager).fill(ownQuestion);
  await addCustom(manager).click();
  await manager.waitForTimeout(700);
  return { ok: (await alerts(manager)).join() === "Takáto otázka už v knižnici je.", actual: `alert: "${(await alerts(manager)).join()}"` };
});
await test(C, "Own question added while the round is already full (5)", { pre: "Round has 5 questions", steps: "Add another valid own question", expected: "The user learns that the question was saved to the library but is not in this round", req: "IT-07" }, async () => {
  const text = `Viem, na koho sa obrátiť s otázkou (${Date.now() % 100000}).`;
  await custom(manager).fill(text);
  await addCustom(manager).click();
  await manager.waitForTimeout(900);
  const counter = await total(manager);
  const visible = await manager.getByText(text).isVisible();
  const messages = await manager.locator('[role="status"], [role="alert"]:not(#__next-route-announcer__)').allInnerTexts();
  return { ok: visible || messages.length > 0, actual: `"${counter}"; field cleared: ${(await custom(manager).inputValue()) === ""}; new question visible: ${visible}; any message: ${messages.length ? messages.join() : "none"}` };
});
await test(C, "Own question: server error", { pre: "POST /api/questions answered with 500", steps: "Add a valid question", expected: "„Otázku sa nepodarilo pridať. Skús to znova.“; text kept", req: "IT-07" }, async () => {
  await fail500(manager, "**/api/questions");
  await custom(manager).fill("Táto otázka sa neuloží pre chybu servera.");
  await addCustom(manager).click();
  await manager.waitForTimeout(600);
  const text = await alerts(manager);
  const kept = await custom(manager).inputValue();
  await manager.unroute("**/api/questions");
  return { ok: text.join() === "Otázku sa nepodarilo pridať. Skús to znova." && kept.length > 0, actual: `alert: "${text.join()}"; text kept: ${kept.length > 0}` };
});

const SPECIAL_NAME = `<b>Kolo</b> & "test" 'apostrof'`;
await test(C, "New round: server error on save keeps the form", { pre: "Default form; POST /api/rounds answered with 500", steps: "Name with special characters, save", expected: "„Niečo sa nepodarilo. Skús to znova.“; name kept; button enabled", req: "MVP-04" }, async () => {
  await manager.goto(`${BASE}/rounds/new`);
  await nameInput(manager).fill(SPECIAL_NAME);
  await fail500(manager, "**/api/rounds");
  await save(manager).click();
  await manager.locator('p[role="alert"]').waitFor();
  const text = await alerts(manager);
  await manager.unroute("**/api/rounds");
  return { ok: text.join() === "Niečo sa nepodarilo. Skús to znova." && (await nameInput(manager).inputValue()) === SPECIAL_NAME && (await save(manager).isEnabled()), actual: `alert: "${text.join()}"; name kept: ${(await nameInput(manager).inputValue()) === SPECIAL_NAME}` };
});
await test(C, "New round: loading state, double click creates one draft, redirect to the list", { pre: "Default form; POST delayed 1.2 s", steps: "Double-click „Uložiť koncept“", expected: "Button „Ukladám…“ disabled; one POST; /rounds lists the round as „Koncept“ with „Spustiť“, without participation and without „Výsledky“; the name is shown as plain text", req: "MVP-04, MVP-05" }, async () => {
  await delay(manager, "**/api/rounds", 1200);
  const posts = countPosts(manager, "/api/rounds");
  await save(manager).dblclick({ noWaitAfter: true });
  await manager.waitForTimeout(300);
  const label = await save(manager).innerText();
  const disabled = await save(manager).isDisabled();
  await manager.waitForURL("**/rounds", { timeout: 8000 });
  await manager.unroute("**/api/rounds");
  const rows = manager.locator("main ul > li").filter({ hasText: SPECIAL_NAME });
  await rows.first().waitFor();
  const text = flat(await rows.first().innerText());
  const bold = await rows.first().locator("h3 b").count();
  return { ok: posts.count === 1 && disabled && label === "Ukladám…" && (await rows.count()) === 1 && /Koncept/.test(text) && /Spustiť/.test(text) && !/Účasť|Výsledky/.test(text) && bold === 0, actual: `label "${label}", disabled ${disabled}, POSTs ${posts.count}; rows with the name: ${await rows.count()}; row: ${text}; rendered as HTML: ${bold > 0}`, evidence: await shot(manager, "rounds-draft-1280") };
});
const draftRow = () => manager.locator("main ul > li").filter({ hasText: SPECIAL_NAME });
await test(B, "Draft: results URL explains that the round has not started", { pre: "Draft exists", steps: "Open /rounds/:id/results of the draft (direct URL, read from the API)", expected: "„Kolo je koncept a ešte nebolo spustené.“, no participation", req: "MVP-10" }, async () => {
  const list = await manager.evaluate(() => fetch("/api/rounds").then((r) => r.json()));
  const draft = (list.rounds ?? list).find((round) => round.status === "DRAFT");
  await manager.goto(`${BASE}/rounds/${draft.id}/results`);
  const body = flat(await manager.locator("main").innerText());
  manager.draftId = draft.id;
  return { ok: /Kolo je koncept a ešte nebolo spustené\./.test(body) && !/Odpovedalo/.test(body), actual: body.slice(0, 200) };
});
await test(B, "Draft: printable report of a draft", { pre: "Draft exists", steps: "Open /rounds/:id/report of the draft", expected: "Same message as on the results screen („Kolo je koncept…“), no misleading participation", req: "IT-08" }, async () => {
  await manager.goto(`${BASE}/rounds/${manager.draftId}/report`);
  const body = flat(await manager.locator("main").innerText());
  return { ok: /Kolo je koncept/.test(body) && !/Odpovedalo 0 z/.test(body), actual: body.slice(0, 260), evidence: await shot(manager, "report-draft-1280") };
});
await test(B, "„Spustiť“: cancelling the confirm dialog keeps the draft", { pre: "Draft on /rounds", steps: "Click „Spustiť“, cancel", expected: "Dialog „Spustiť kolo? Po spustení sa už nedá upravovať.“; still „Koncept“", req: "MVP-05" }, async () => {
  await manager.goto(`${BASE}/rounds`);
  let message = "";
  manager.once("dialog", (dialog) => { message = dialog.message(); dialog.dismiss(); });
  await draftRow().getByRole("button", { name: "Spustiť" }).click();
  await manager.waitForTimeout(500);
  return { ok: message === "Spustiť kolo? Po spustení sa už nedá upravovať." && /Koncept/.test(await draftRow().innerText()), actual: `dialog: "${message}"; still draft: ${/Koncept/.test(await draftRow().innerText())}` };
});
await test(B, "„Spustiť“: confirming opens the round", { pre: "Draft on /rounds", steps: "Click „Spustiť“, confirm", expected: "Badge „Otvorené“, „Účasť: 0 z 6“, buttons „Výsledky“ and „Uzavrieť“", req: "MVP-05" }, async () => {
  manager.once("dialog", (dialog) => dialog.accept());
  await draftRow().getByRole("button", { name: "Spustiť" }).click();
  await draftRow().getByText("Otvorené").waitFor({ timeout: 8000 });
  const text = flat(await draftRow().innerText());
  return { ok: /Účasť: 0 z 6/.test(text) && /Výsledky/.test(text) && /Uzavrieť/.test(text), actual: text };
});
await test(F, "Employee home shows a round name with special characters as plain text", { pre: "Open round named <b>Kolo</b> & \"test\" 'apostrof'", steps: "Adam opens /", expected: "The name is shown literally in the task and in the list", req: "MVP-06" }, async () => {
  const page = await session(browser, USERS.adam, { width: 360, height: 740 });
  const body = flat(await page.locator("main").innerText());
  const evidence = await shot(page, "home-employee-special-name-360");
  await page.context().close();
  return { ok: body.includes(`Čaká na teba prieskum „${SPECIAL_NAME}“`), actual: body.slice(0, 200), evidence };
});

// long unbroken round name
await test(F, "Round with a 120-character name without spaces: list at 360 px", { pre: "Manager creates a draft with such a name", steps: "Create it, open /rounds at 360 px", expected: "Name wraps inside the card; no horizontal page scroll", req: "NFR-07" }, async () => {
  await manager.goto(`${BASE}/rounds/new`);
  await nameInput(manager).fill(LONG(120));
  await save(manager).click();
  await manager.waitForURL("**/rounds", { timeout: 8000 });
  const { size, evidence } = await widthCheck(manager, 360, "rounds-long-name-360");
  await manager.setViewportSize({ width: 1280, height: 800 });
  return { ok: size.scrollWidth <= size.clientWidth, actual: `page ${size.scrollWidth}/${size.clientWidth} px`, evidence };
});

// =====================================================================
// NEW ROUND (HR)
// =====================================================================
await test(C, "New round as HR: team select, no own-question block", { pre: "HR", steps: "Open /rounds/new", expected: "Select with Tím Alfa and Tím Beta; no „Pridať vlastnú otázku“", req: "MVP-04, IT-07" }, async () => {
  await hr.goto(`${BASE}/rounds/new`);
  const options = await hr.locator('select[name="teamId"] option').allInnerTexts();
  const block = await hr.getByText("Pridať vlastnú otázku").count();
  return { ok: options.join() === "Tím Alfa,Tím Beta" && block === 0, actual: `teams: ${options.join(", ")}; own-question block: ${block}` };
});
await test(C, "New round as HR: switching the team switches the preselection and shows it", { pre: "HR on the form", steps: "Select „Tím Beta“", expected: "3 questions ticked for Tím Beta; every topic with a ticked question is expanded so the user sees what is selected", req: "IT-13" }, async () => {
  const before = await hr.locator('form details input[type="checkbox"]:checked').evaluateAll((els) => els.map((el) => el.closest("label").textContent.trim().slice(0, 40)));
  await hr.locator('select[name="teamId"]').selectOption({ label: "Tím Beta" });
  const after = await hr.locator('form details input[type="checkbox"]:checked').evaluateAll((els) => els.map((el) => el.closest("label").textContent.trim().slice(0, 40)));
  const hidden = await hr.locator("form details:not([open])").evaluateAll((els) => els.filter((el) => el.querySelector("input:checked")).map((el) => el.querySelector("summary").textContent.replace(/\s+/g, " ")));
  return { ok: after.length === 3 && hidden.length === 0, actual: `Alfa: ${before.join(" | ")}; Beta: ${after.join(" | ")}; topics that hold a ticked question but stay collapsed: ${hidden.length ? hidden.join(" | ") : "none"}`, evidence: await shot(hr, "newround-hr-beta-1280") };
});
const BETA_ROUND = "QA kolo Beta";
await test(C, "New round as HR: save for Tím Beta and open it", { pre: "HR, Tím Beta selected", steps: "Name „QA kolo Beta“, save; on /hr/rounds click „Spustiť“ and confirm", expected: "Redirect to /hr/rounds; the round is listed with „Tím Beta“; after opening the badge is „Otvorené“", req: "MVP-04, MVP-05, MVP-12" }, async () => {
  await nameInput(hr).fill(BETA_ROUND);
  await save(hr).click();
  await hr.waitForURL("**/hr/rounds", { timeout: 8000 });
  const row = hr.locator("main ul > li").filter({ hasText: BETA_ROUND });
  const team = /Tím Beta/.test(await row.innerText());
  hr.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Spustiť" }).click();
  await row.getByText("Otvorené").waitFor({ timeout: 8000 });
  return { ok: team, actual: flat(await row.innerText()) };
});
await test(C, "Round closed while somebody is filling it in", { pre: "Filip (Tím Beta) is on the comment step; HR closes the round", steps: "Filip answers all questions; HR clicks „Uzavrieť“ and confirms; Filip clicks „Odoslať“", expected: "„Kolo je uzavreté – Do uzavretého kola sa už nedá odpovedať.“ instead of the thank-you", req: "MVP-09" }, async () => {
  const filip = await session(browser, USERS.filip, { width: 360, height: 740 });
  await filip.getByRole("link", { name: "Vyplniť" }).click();
  await filip.getByRole("button", { name: "Začať" }).click();
  for (;;) {
    if (await filip.getByLabel("Komentár").isVisible().catch(() => false)) break;
    await filip.locator("fieldset button[aria-pressed]").nth(2).click();
    await filip.getByRole("button", { name: "Ďalej" }).click();
  }
  const row = hr.locator("main ul > li").filter({ hasText: BETA_ROUND });
  hr.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Uzavrieť" }).click();
  await row.getByText("Uzavreté").waitFor({ timeout: 8000 });
  await filip.getByRole("button", { name: "Odoslať" }).click();
  await filip.getByRole("heading", { name: "Kolo je uzavreté" }).waitFor({ timeout: 8000 });
  const body = flat(await filip.locator("main").innerText());
  const evidence = await shot(filip, "fill-closed-meanwhile-360");
  await filip.context().close();
  return { ok: /Do uzavretého kola sa už nedá odpovedať\./.test(body), actual: body, evidence };
});
await test(B, "Results of a closed round with 0 answers", { pre: "„QA kolo Beta“ closed without answers", steps: "HR opens its results", expected: "„Nedostatok odpovedí“ with a grammatical sentence for 0 („Kolo má 0 odpovedí.“); no averages", req: "MVP-11" }, async () => {
  await hr.locator("main ul > li").filter({ hasText: BETA_ROUND }).getByRole("link", { name: "Výsledky" }).click();
  await hr.waitForURL("**/results");
  const body = flat(await hr.locator("main").innerText());
  return { ok: /Nedostatok odpovedí/.test(body) && /Kolo má 0 odpovedí\./.test(body) && !/Priemer/.test(body), actual: body.slice(0, 330), evidence: await shot(hr, "results-zero-answers-1280") };
});

// =====================================================================
// RESULTS AND ACTIONS (manager, round „Pulse – 46. týždeň“: 5 of 6, no action yet)
// =====================================================================
const resultsUrl = `${BASE}/rounds/${ids.okA}/results`;
const topic = (page) => page.locator('input[name="topic"]');
const description = (page) => page.locator('textarea[name="description"]');
const due = (page) => page.locator('input[name="dueDate"]');
const addAction = (page) => page.getByRole("button", { name: /^Pridať krok$|Ukladám/ });

await test(B, "Results: summary first (best, weakest, suggested step)", { pre: "Manager; closed round above the threshold", steps: "Open the results", expected: "Block „V skratke“ with „Najlepšie“, „Najslabšie“, „Navrhovaný krok“ above the questions; badge „Čaká na krok“", req: "IT-13, MVP-15" }, async () => {
  await manager.goto(resultsUrl);
  const body = flat(await manager.locator("main").innerText());
  const order = body.indexOf("V skratke") < body.indexOf("Otázky");
  return { ok: /Najlepšie: „/.test(body) && /Najslabšie: „/.test(body) && /Navrhovaný krok:/.test(body) && /Čaká na krok/.test(body) && order, actual: body.slice(0, 420), evidence: await shot(manager, "results-ok-1280") };
});
await test(B, "Results: „Prejsť na kroky“ jumps to the actions section", { pre: "Results page", steps: "Click „Prejsť na kroky“", expected: "URL ends with #kroky and the section „Kroky po kole“ is in view", req: "IT-13" }, async () => {
  await manager.getByRole("link", { name: "Prejsť na kroky" }).click();
  await manager.waitForTimeout(400);
  const inView = await manager.locator("#kroky").evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= -5 && r.top < window.innerHeight; });
  return { ok: manager.url().endsWith("#kroky") && inView, actual: `hash: ${new URL(manager.url()).hash}; section in view: ${inView}` };
});
await test(B, "Results: distribution is collapsed and expands per question", { pre: "Results page", steps: "Click „Rozdelenie odpovedí“ on the first question", expected: "Hidden at first; after the click 5 rows whose counts add up to the number of answers (5)", req: "MVP-10, IT-13" }, async () => {
  const first = manager.locator("main section ul > li").first();
  const hiddenBefore = !(await first.locator("details ul").isVisible());
  await first.locator("summary").click();
  const counts = await first.locator("details ul > li > span:last-child").allInnerTexts();
  const sum = counts.reduce((acc, value) => acc + Number(value), 0);
  return { ok: hiddenBefore && counts.length === 5 && sum === 5, actual: `collapsed at first: ${hiddenBefore}; rows: ${counts.length}; counts ${counts.join("+")} = ${sum}`, evidence: await shot(manager, "results-distribution-1280") };
});
await test(B, "Results: two suggestions, marked as rule-based (not AI)", { pre: "Results page", steps: "Read „Návrhy krokov“", expected: "2 suggestions, each with „Použiť ako krok“; the note says „Návrhy podľa pravidiel, nie AI“", req: "IT-09" }, async () => {
  const buttons = await manager.getByRole("button", { name: "Použiť ako krok" }).count();
  const note = await manager.getByText("Návrhy podľa pravidiel, nie AI").isVisible();
  return { ok: buttons === 2 && note, actual: `suggestions with a button: ${buttons}; rules note visible: ${note}` };
});
await test(C, "Action form: empty form", { pre: "Results page, manager", steps: "Click „Pridať krok“ with nothing filled in", expected: "„Vyplň tému, čo sa urobí a platný termín.“ in role=alert", req: "MVP-13" }, async () => {
  await addAction(manager).click();
  await manager.locator('form p[role="alert"]').waitFor();
  return { ok: (await alerts(manager)).join() === "Vyplň tému, čo sa urobí a platný termín.", actual: `alert: "${(await alerts(manager)).join()}"` };
});
await test(C, "Action form: „Použiť ako krok“ fills the topic and the description", { pre: "Results page", steps: "Click „Použiť ako krok“ on the first suggestion", expected: "Topic and description are filled with the suggestion and can be edited; the error disappears", req: "IT-09" }, async () => {
  const card = manager.locator("li", { has: manager.getByRole("button", { name: "Použiť ako krok" }) }).first();
  const suggestionTopic = await card.locator("p").first().innerText();
  await card.getByRole("button", { name: "Použiť ako krok" }).click();
  const filled = (await topic(manager).inputValue()) === suggestionTopic && (await description(manager).inputValue()).length > 10;
  return { ok: filled && (await alerts(manager)).length === 0, actual: `topic "${await topic(manager).inputValue()}"; description length ${(await description(manager).inputValue()).length}; error cleared: ${(await alerts(manager)).length === 0}` };
});
await test(C, "Action form: missing deadline only", { pre: "Topic and description filled", steps: "Click „Pridať krok“ without a date", expected: "The same validation message; nothing saved; the message says which field is wrong", req: "MVP-13" }, async () => {
  await addAction(manager).click();
  await manager.locator('form p[role="alert"]').waitFor();
  const text = (await alerts(manager)).join();
  const marked = await manager.locator('form [aria-invalid="true"]').count();
  return { ok: text === "Vyplň tému, čo sa urobí a platný termín." && marked > 0, actual: `alert: "${text}"; fields marked aria-invalid: ${marked} (one general sentence for three fields)` };
});
await test(C, "Action form: server error keeps what was typed", { pre: "POST /actions answered with 500", steps: "Fill the date, click „Pridať krok“", expected: "„Niečo sa nepodarilo. Skús to znova.“; values kept", req: "MVP-13" }, async () => {
  await due(manager).fill(iso(14));
  await fail500(manager, "**/api/rounds/*/actions");
  await addAction(manager).click();
  await manager.waitForTimeout(600);
  const text = (await alerts(manager)).join();
  await manager.unroute("**/api/rounds/*/actions");
  return { ok: text === "Niečo sa nepodarilo. Skús to znova." && (await topic(manager).inputValue()).length > 0, actual: `alert: "${text}"; topic kept: ${(await topic(manager).inputValue()).length > 0}` };
});
await test(C, "Action form: double click saves one action; list and badge update; form is cleared", { pre: "Valid form; POST delayed 1.2 s", steps: "Double-click „Pridať krok“", expected: "Button „Ukladám…“; one POST; the action appears with the status select; „Čaká na krok“ disappears; fields are empty", req: "MVP-13, MVP-15" }, async () => {
  await delay(manager, "**/api/rounds/*/actions", 1200);
  const posts = countPosts(manager, "/actions");
  await addAction(manager).dblclick({ noWaitAfter: true });
  await manager.waitForTimeout(300);
  const label = await manager.locator('form button[type="submit"]').innerText();
  await manager.locator('select[aria-label="Stav"]').first().waitFor({ timeout: 8000 });
  await manager.unroute("**/api/rounds/*/actions");
  await manager.waitForTimeout(500);
  const items = await manager.locator("#kroky > ul").first().locator("> li").count();
  const badge = await manager.getByText("Čaká na krok").count();
  const cleared = (await topic(manager).inputValue()) === "" && (await description(manager).inputValue()) === "" && (await due(manager).inputValue()) === "";
  return { ok: posts.count === 1 && label === "Ukladám…" && items === 1 && badge === 0 && cleared, actual: `label "${label}"; POSTs ${posts.count}; actions listed ${items}; badge „Čaká na krok“ left: ${badge}; form cleared: ${cleared}`, evidence: await shot(manager, "results-action-added-1280") };
});
await test(C, "Action: success is confirmed to the user", { pre: "Action just saved", steps: "Look for a confirmation", expected: "A status message (as the kudos and issue forms have) or focus moved to the new action" }, async () => {
  const status = await manager.locator('[role="status"]').allInnerTexts();
  return { ok: status.length > 0, actual: `role=status messages: ${status.length ? status.join() : "none"} (the only feedback is the new item above the form)` };
});
await test(B, "Action status: change persists after a reload", { pre: "One action „Plánované“", steps: "Select „Prebieha“, reload", expected: "Select shows „Prebieha“ after the reload", req: "MVP-13" }, async () => {
  const select = manager.locator('select[aria-label="Stav"]').first();
  const patches = countPosts(manager, "/api/actions/", "PATCH");
  await select.selectOption("IN_PROGRESS");
  await manager.waitForTimeout(800);
  await manager.reload();
  const value = await manager.locator('select[aria-label="Stav"]').first().inputValue();
  return { ok: value === "IN_PROGRESS" && patches.count === 1, actual: `value after reload: ${value}; PATCH count ${patches.count}` };
});
await test(B, "Action status: server error reverts the select and tells the user", { pre: "PATCH /api/actions answered with 500", steps: "Select „Hotové“", expected: "Select returns to „Prebieha“; „Niečo sa nepodarilo. Skús to znova.“ in role=alert", req: "MVP-13" }, async () => {
  await fail500(manager, "**/api/actions/*");
  const select = manager.locator('select[aria-label="Stav"]').first();
  await select.selectOption("DONE");
  await manager.waitForTimeout(700);
  const value = await select.inputValue();
  const text = (await alerts(manager)).join();
  await manager.unroute("**/api/actions/*");
  return { ok: value === "IN_PROGRESS" && text === "Niečo sa nepodarilo. Skús to znova.", actual: `value: ${value}; alert: "${text}"`, evidence: await shot(manager, "action-status-500-1280") };
});
await test(C, "Action form: limits of the fields (topic 120, description 1 000)", { pre: "Results page", steps: "Type 130 / 1 100 characters", expected: "Fields hold 120 / 1 000", req: "MVP-13" }, async () => {
  await topic(manager).fill(LONG(130));
  await description(manager).fill(LONG(1100, "b"));
  const a = (await topic(manager).inputValue()).length;
  const b = (await description(manager).inputValue()).length;
  return { ok: a === 120 && b === 1000, actual: `topic ${a}, description ${b}` };
});
await test(C, "Action with special characters and a long word is saved", { pre: "Results page", steps: "Topic: 120 characters without a space; description: <img src=x onerror=alert(1)> plus a 300-character word; date; save", expected: "Saved; shown as plain text", req: "MVP-13" }, async () => {
  await topic(manager).fill(LONG(120));
  await description(manager).fill(`<img src=x onerror=alert(1)> ${LONG(300, "m")}`);
  await due(manager).fill(iso(30));
  await addAction(manager).click();
  await manager.locator("#kroky > ul").first().locator("> li").nth(1).waitFor({ timeout: 8000 });
  const img = await manager.locator("#kroky img").count();
  return { ok: img === 0 && manager.errors.filter((e) => /alert|onerror/.test(e)).length === 0, actual: `saved; <img> elements rendered: ${img}` };
});
for (const width of [1280, 360]) {
  await test(F, `Results: an action with a long word stays inside its card at ${width} px`, { pre: "Action with a 120-character topic and a 300-character word exists", steps: "Open the results", expected: "Text wraps; no horizontal page scroll", req: "NFR-07" }, async () => {
    const { size, evidence } = await widthCheck(manager, width, `results-long-action-${width}`);
    return { ok: size.scrollWidth <= size.clientWidth, actual: `page ${size.scrollWidth}/${size.clientWidth} px`, evidence };
  });
}
await test(F, "Team page („Povedali ste, urobili sme“): the same long action at 360 px", { pre: "Employee of Tím Alfa", steps: "Adam opens the team page at 360 px", expected: "Text wraps; no horizontal page scroll", req: "MVP-14, NFR-07" }, async () => {
  const page = await session(browser, USERS.adam, { width: 360, height: 740 });
  await page.goto(`${BASE}/team/${ids.teamA}`);
  const size = await overflow(page);
  const body = flat(await page.locator("main").innerText());
  const evidence = await shot(page, "team-long-action-360");
  await page.context().close();
  return { ok: size.scrollWidth <= size.clientWidth && body.includes("Prebieha"), actual: `page ${size.scrollWidth}/${size.clientWidth} px; the action with status „Prebieha“ is listed: ${body.includes("Prebieha")}`, evidence };
});
await manager.setViewportSize({ width: 1280, height: 800 });
await test(B, "Results as HR: read-only actions, suggestions without a button, link to create an issue", { pre: "HR; same round", steps: "Open the results", expected: "No action form, no status select (badges instead), 2 suggestions without „Použiť ako krok“, link „Vytvoriť podnet z tohto kola“", req: "permission matrix, IT-09, IT-10" }, async () => {
  await hr.goto(resultsUrl);
  const form = await hr.locator('input[name="topic"]').count();
  const selects = await hr.locator('select[aria-label="Stav"]').count();
  const buttons = await hr.getByRole("button", { name: "Použiť ako krok" }).count();
  const suggestions = await hr.locator("#kroky li.bg-teal-50").count();
  const link = await hr.getByRole("link", { name: "Vytvoriť podnet z tohto kola" }).count();
  return { ok: form === 0 && selects === 0 && buttons === 0 && suggestions === 2 && link === 1, actual: `form ${form}, status selects ${selects}, use-buttons ${buttons}, suggestions ${suggestions}, issue link ${link}`, evidence: await shot(hr, "results-hr-1280") };
});
await test(B, "Results below the threshold (4 answers)", { pre: "Manager; „Pulse – 42. týždeň“ with 4 of 6", steps: "Open its results", expected: "„Nedostatok odpovedí“, „Kolo má 4 odpovede.“, no averages, no comments, no suggestions; the action form is available", req: "MVP-11, NFR-02" }, async () => {
  await manager.goto(`${BASE}/rounds/${ids.lowA}/results`);
  const body = flat(await manager.locator("main").innerText());
  return { ok: /Nedostatok odpovedí/.test(body) && /Kolo má 4 odpovede\. Výsledky sa zobrazujú až od 5/.test(body) && !/Priemer|Komentáre|Návrhy krokov/.test(body) && (await topic(manager).count()) === 1, actual: body.slice(0, 330), evidence: await shot(manager, "results-insufficient-1280") };
});

// =====================================================================
// KUDOS (employee, 360 px)
// =====================================================================
const adam = await session(browser, USERS.adam, { width: 360, height: 740 });
const recipient = (page) => page.locator('select[name="toUserId"]');
const kudosText = (page) => page.locator("form textarea");
const emoji = (page) => page.locator("form fieldset button[aria-pressed]");
const sendKudos = (page) => page.locator('form button[type="submit"]');
const counter = (page) => page.locator("form label span.flex span").last().innerText();
const pick = async (page, name) => {
  const value = await recipient(page).locator("option", { hasText: name }).getAttribute("value");
  await recipient(page).selectOption(value);
};

await test(C, "Kudos: empty form", { pre: "Adam, /kudos/new", steps: "Click „Poslať kudos“", expected: "Errors at the recipient and at the text, both role=alert; nothing sent to other users", req: "MVP-16" }, async () => {
  await adam.goto(`${BASE}/kudos/new`);
  await sendKudos(adam).click();
  await adam.locator('form [role="alert"]').first().waitFor();
  const text = await alerts(adam);
  return { ok: text.join("|") === "Vyber kolegu (sebe sa kudos poslať nedá).|Napíš 20 až 500 znakov alebo vyber emotikon.", actual: `alerts: ${text.join(" | ")}`, evidence: await shot(adam, "kudos-empty-360") };
});
await test(C, "Kudos: recipient list excludes the sender and names the team", { pre: "Adam", steps: "Read the options of „Komu“", expected: "12 colleagues, not „Adam Vzorový“; each with the team in brackets (HR without)", req: "MVP-16" }, async () => {
  const options = await recipient(adam).locator("option").allInnerTexts();
  return { ok: options.length === 13 && !options.some((option) => /Adam Vzorový/.test(option)) && options.filter((option) => /\(Tím (Alfa|Beta)\)/.test(option)).length === 11, actual: `${options.length - 1} recipients; self listed: ${options.some((option) => /Adam Vzorový/.test(option))}; e.g. ${options.slice(1, 4).join(", ")}` };
});
await test(C, "Kudos: 19 characters is refused, counter shows 19 / 500", { pre: "Recipient chosen", steps: "Text of 19 characters, send", expected: "„Napíš 20 až 500 znakov alebo vyber emotikon.“", req: "MVP-16" }, async () => {
  await pick(adam, "Barbora");
  await kudosText(adam).fill("a".repeat(19));
  const count = await counter(adam);
  await sendKudos(adam).click();
  await adam.waitForTimeout(600);
  const text = await alerts(adam);
  return { ok: count === "19 / 500" && text.join() === "Napíš 20 až 500 znakov alebo vyber emotikon.", actual: `counter "${count}"; alert: "${text.join()}"` };
});
await test(C, "Kudos: recipient stays selected after a validation error", { pre: "Previous test ended with a text error", steps: "Look at „Komu“", expected: "Barbora is still selected", req: "MVP-16" }, async () => {
  const selected = await recipient(adam).evaluate((el) => el.selectedOptions[0].textContent);
  return { ok: /Barbora/.test(selected), actual: `selected: ${selected}` };
});
await test(C, "Kudos: exactly 20 characters is sent; confirmation and reset", { pre: "Recipient Barbora", steps: "Text of 20 characters with special characters, send", expected: "„Kudos je odoslané.“ (role=status); recipient, text and counter reset", req: "MVP-16" }, async () => {
  await kudosText(adam).fill('<i>Ďakujem</i> & "o"');
  const length = (await kudosText(adam).inputValue()).length;
  await sendKudos(adam).click();
  await adam.locator('form [role="status"]').waitFor({ timeout: 8000 });
  const status = await adam.locator('form [role="status"]').innerText();
  const reset = (await recipient(adam).inputValue()) === "" && (await kudosText(adam).inputValue()) === "" && (await counter(adam)) === "0 / 500";
  return { ok: length === 20 && status === "Kudos je odoslané." && reset && (await alerts(adam)).length === 0, actual: `text length ${length}; status "${status}"; form reset: ${reset}`, evidence: await shot(adam, "kudos-sent-360") };
});
await test("D-Animations", "Kudos animation after sending", { pre: "Kudos just sent", steps: "Count canvas elements, animated elements and running animations", expected: "Policy asks to test the animation", req: "IT-02 (paused)" }, async () => {
  const info = await adam.evaluate(() => ({ canvas: document.querySelectorAll("canvas").length, running: document.getAnimations().length, animated: document.querySelectorAll('[class*="animate-"]').length }));
  return { blocked: true, actual: `NOT IMPLEMENTED – IT-02 (animations) is paused. Verified: ${info.canvas} canvas elements, ${info.running} running animations, ${info.animated} animated elements; the confirmation is a static text.` };
});
await test(C, "Kudos: confirmation disappears when the next attempt fails validation", { pre: "„Kudos je odoslané.“ is shown", steps: "Click „Poslať kudos“ on the empty form", expected: "Errors are shown and the old confirmation is gone", req: "MVP-16" }, async () => {
  await sendKudos(adam).click();
  await adam.locator('form [role="alert"]').first().waitFor();
  const status = await adam.locator('form [role="status"]').count();
  return { ok: status === 0, actual: `confirmation still visible: ${status > 0}; alerts: ${(await alerts(adam)).length}` };
});
await test(C, "Kudos: emoji toggles, changes the hint and makes the text optional", { pre: "Empty form", steps: "Click 🎉 (pressed), click it again (released), click 👏; send with recipient Cyril and no text", expected: "aria-pressed follows; hint „Nepovinné, najviac 500 znakov.“; sent without text", req: "IT-06" }, async () => {
  await emoji(adam).nth(3).click();
  const on = await emoji(adam).nth(3).getAttribute("aria-pressed");
  const hint = await adam.locator("form label span.flex span").first().innerText();
  await emoji(adam).nth(3).click();
  const off = await emoji(adam).nth(3).getAttribute("aria-pressed");
  await emoji(adam).nth(0).click();
  await pick(adam, "Cyril");
  await sendKudos(adam).click();
  await adam.locator('form [role="status"]').waitFor({ timeout: 8000 });
  const pressedAfter = await emoji(adam).evaluateAll((els) => els.filter((el) => el.getAttribute("aria-pressed") === "true").length);
  return { ok: on === "true" && off === "false" && hint === "Nepovinné, najviac 500 znakov." && pressedAfter === 0, actual: `pressed ${on} → ${off}; hint "${hint}"; sent; emoji reset after sending: ${pressedAfter === 0}` };
});
await test(F, "Kudos: the selected emoji is clearly distinguishable", { pre: "Form", steps: "Select 💪, compare its style with an unselected emoji", expected: "A visible difference that does not rely on a faint tint only (border ≥ 3:1 against the neighbours)" }, async () => {
  await emoji(adam).nth(2).click();
  const styles = await emoji(adam).evaluateAll((els) => els.slice(1, 3).map((el) => { const s = getComputedStyle(el); return `${s.borderColor} / ${s.backgroundColor} / ${s.borderWidth}`; }));
  const evidence = await shot(adam, "kudos-emoji-selected-360", false);
  await emoji(adam).nth(2).click();
  return { ok: styles[0] !== styles[1], actual: `unselected: ${styles[0]}; selected: ${styles[1]}`, evidence };
});
await test(C, "Kudos: text limited to 500 characters", { pre: "Form", steps: "Type 520 characters", expected: "Field holds 500; counter „500 / 500“", req: "MVP-16" }, async () => {
  await kudosText(adam).fill("k".repeat(520));
  const length = (await kudosText(adam).inputValue()).length;
  return { ok: length === 500 && (await counter(adam)) === "500 / 500", actual: `length ${length}; counter "${await counter(adam)}"` };
});
await test(C, "Kudos: spaces only do not count", { pre: "Recipient chosen", steps: "30 spaces as the text, send", expected: "Counter „0 / 500“ and the text error", req: "MVP-16" }, async () => {
  await pick(adam, "Dana");
  await kudosText(adam).fill(" ".repeat(30));
  const count = await counter(adam);
  await sendKudos(adam).click();
  await adam.waitForTimeout(600);
  return { ok: count === "0 / 500" && (await alerts(adam)).join() === "Napíš 20 až 500 znakov alebo vyber emotikon.", actual: `counter "${count}"; alert: "${(await alerts(adam)).join()}"` };
});
await test(C, "Kudos: server error keeps the form", { pre: "POST /api/kudos answered with 500", steps: "Valid kudos, send", expected: "„Niečo sa nepodarilo. Skús to znova.“; text and recipient kept", req: "MVP-16" }, async () => {
  await kudosText(adam).fill("Vďaka za pomoc s nasadením v piatok.");
  await fail500(adam, "**/api/kudos");
  await sendKudos(adam).click();
  await adam.locator('form p[role="alert"]').waitFor();
  const text = (await alerts(adam)).join();
  await adam.unroute("**/api/kudos");
  return { ok: text === "Niečo sa nepodarilo. Skús to znova." && (await kudosText(adam).inputValue()).length > 0 && (await recipient(adam).inputValue()) !== "", actual: `alert: "${text}"; text kept: ${(await kudosText(adam).inputValue()).length > 0}; recipient kept: ${(await recipient(adam).inputValue()) !== ""}` };
});
await test(C, "Kudos: network failure", { pre: "POST /api/kudos aborted", steps: "Send", expected: "Generic error; form kept", req: "MVP-16" }, async () => {
  await adam.route("**/api/kudos", (route) => route.abort("failed"));
  await sendKudos(adam).click();
  await adam.waitForTimeout(600);
  const text = (await alerts(adam)).join();
  await adam.unroute("**/api/kudos");
  return { ok: text === "Niečo sa nepodarilo. Skús to znova.", actual: `alert: "${text}"` };
});
await test(C, "Kudos: private kudos with a long word, double click sends one", { pre: "Recipient Dana, visibility „Súkromné“; POST delayed 1.2 s", steps: "Text = 300 characters without a space; double-click „Poslať kudos“", expected: "Button „Posielam…“ disabled; one POST; confirmation", req: "MVP-16" }, async () => {
  await kudosText(adam).fill(LONG(300, "Q"));
  await adam.locator('input[name="visibility"][value="PRIVATE"]').check();
  await delay(adam, "**/api/kudos", 1200);
  const posts = countPosts(adam, "/api/kudos");
  await sendKudos(adam).dblclick({ noWaitAfter: true });
  await adam.waitForTimeout(300);
  const label = await sendKudos(adam).innerText();
  const disabled = await sendKudos(adam).isDisabled();
  await adam.locator('form [role="status"]').waitFor({ timeout: 8000 });
  await adam.unroute("**/api/kudos");
  const visibilityReset = await adam.locator('input[name="visibility"][value="TEAM"]').isChecked();
  return { ok: posts.count === 1 && label === "Posielam…" && disabled, actual: `label "${label}", disabled ${disabled}, POSTs ${posts.count}; visibility back to „Verejné v tíme“: ${visibilityReset}` };
});
await test(C, "Kudos: public kudos with emoji and a long word to a colleague", { pre: "Recipient Emil", steps: "Emoji ⭐, text with a 300-character word, visibility „Verejné v tíme“, send", expected: "Confirmation", req: "MVP-16, IT-06" }, async () => {
  await pick(adam, "Emil");
  await emoji(adam).nth(5).click();
  await kudosText(adam).fill(`Vďaka ${LONG(300, "Z")}`);
  await sendKudos(adam).click();
  await adam.locator('form [role="status"]').waitFor({ timeout: 8000 });
  return { ok: true, actual: "sent" };
});
await test(B, "Team feed: public kudos newest first, with the sender, the recipient, emoji and value; private kudos absent", { pre: "Adam sent 3 public and 1 private kudos", steps: "Open „Môj tím“", expected: "Newest on top: „Adam Vzorový → Emil …“ with ⭐; the HTML-like text shown literally; the private one (QQQ…) is not in the feed", req: "MVP-17" }, async () => {
  await adam.goto(`${BASE}/team/${ids.teamA}`);
  const cards = await adam.locator("section ul > li").allInnerTexts();
  const first = flat(cards[0] ?? "");
  const all = cards.join(" ");
  const italics = await adam.locator("section ul > li i").count();
  return { ok: /^Adam Vzorový → Emil/.test(first) && first.includes("⭐") && all.includes('<i>Ďakujem</i> & "o"') && !all.includes("QQQQ") && italics === 0, actual: `first card: ${first.slice(0, 80)}…; literal HTML text present: ${all.includes('<i>Ďakujem</i> & "o"')}; private kudos in feed: ${all.includes("QQQQ")}; cards: ${cards.length}` };
});
await test(F, "Team feed: kudos with a 300-character word at 360 px", { pre: "Such a public kudos exists", steps: "Team page at 360 px", expected: "Text wraps inside the card; no horizontal page scroll", req: "NFR-07" }, async () => {
  const size = await overflow(adam);
  const card = await adam.locator("section ul > li").first().evaluate((el) => { const p = el.querySelector("p.whitespace-pre-line"); return p.scrollWidth - el.clientWidth; });
  return { ok: card <= 0, actual: `the kudos text is ${card} px wider than its card; page ${size.scrollWidth}/${size.clientWidth} px (the page also holds the long action)`, evidence: await shot(adam, "team-long-kudos-360") };
});
let danaSize = { scrollWidth: 0, clientWidth: 0 };
await test(B, "„Moje kudos“ of the recipient: private kudos visible only there, with the badge „Súkromné“", { pre: "Dana received a private kudos from Adam", steps: "Dana opens Kudos → Moje kudos at 360 px", expected: "Card „Od: Adam Vzorový“ with „Súkromné“; layout intact", req: "MVP-17" }, async () => {
  const dana = await session(browser, USERS.dana, { width: 360, height: 740 });
  await dana.goto(`${BASE}/kudos/me`);
  const body = flat(await dana.locator("main").innerText());
  const size = await overflow(dana);
  const evidence = await shot(dana, "kudos-me-long-360");
  await dana.context().close();
  danaSize = size;
  return { ok: /Od: Adam Vzorový/.test(body) && /Súkromné/.test(body), actual: `card present: ${/Od: Adam Vzorový/.test(body)}; badge: ${/Súkromné/.test(body)}`, evidence };
});
await test(F, "„Moje kudos“: a kudos with a 300-character word at 360 px", { pre: "Dana received such a kudos", steps: "Dana opens /kudos/me at 360 px", expected: "Text wraps inside the card; no horizontal page scroll", req: "NFR-07" }, async () => {
  return { ok: danaSize.scrollWidth <= danaSize.clientWidth, actual: `page ${danaSize.scrollWidth}/${danaSize.clientWidth} px`, evidence: "shots/kudos-me-long-360.png" };
});
await test(B, "Manager does not see the private kudos of a team member", { pre: "Private kudos Adam → Dana", steps: "Manager opens the team page and own „Moje kudos“", expected: "The private text is nowhere", req: "MVP-17" }, async () => {
  await manager.goto(`${BASE}/team/${ids.teamA}`);
  const team = await manager.locator("main").innerText();
  await manager.goto(`${BASE}/kudos/me`);
  const mine = await manager.locator("main").innerText();
  return { ok: !team.includes("QQQQ") && !mine.includes("QQQQ"), actual: `on the team page: ${team.includes("QQQQ")}; in manager's „Moje kudos“: ${mine.includes("QQQQ")}` };
});
await test(B, "„Moje kudos“: empty state", { pre: "Manager has received no kudos", steps: "Open /kudos/me", expected: "„Zatiaľ tu nemáš žiadne kudos.“", req: "MVP-17" }, async () => {
  const body = flat(await manager.locator("main").innerText());
  return { ok: body.includes("Zatiaľ tu nemáš žiadne kudos."), actual: body };
});
await test(G, "Keyboard only: send a kudos without a mouse", { pre: "Adam on /kudos/new, 1280 px", steps: "Tab to „Komu“, choose with the arrow keys; Tab to an emoji, Space; Tab to the text, type; Tab to „Poslať kudos“, Enter", expected: "Sent; every stop has a visible focus indicator", req: "MVP-16 / WCAG 2.1.1, 2.4.7" }, async () => {
  const page = await session(browser, USERS.adam);
  await page.goto(`${BASE}/kudos/new`);
  const info = () => page.evaluate(() => { const el = document.activeElement; const s = getComputedStyle(el); return { tag: el.tagName, name: el.getAttribute("name") || el.getAttribute("aria-label") || el.innerText.slice(0, 20), ring: s.outlineStyle !== "none" || s.boxShadow !== "none" }; });
  const stops = [];
  const tabUntil = async (predicate) => {
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      const current = await info();
      stops.push(current);
      if (predicate(current)) return;
    }
    throw new Error("target not reached");
  };
  await tabUntil((current) => current.name === "toUserId");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await tabUntil((current) => current.name === "👏");
  await page.keyboard.press("Space");
  await tabUntil((current) => current.tag === "TEXTAREA");
  await page.keyboard.type("Poslané iba klávesnicou, ďakujem.");
  await tabUntil((current) => current.name === "Poslať kudos" && current.tag === "BUTTON");
  await page.keyboard.press("Enter");
  await page.locator('form [role="status"]').waitFor({ timeout: 8000 });
  const noRing = stops.filter((stop) => !stop.ring).map((stop) => stop.name);
  await page.context().close();
  return { ok: noRing.length === 0, actual: `sent with ${stops.length} Tab presses; stops without a visible focus indicator: ${noRing.length ? noRing.join(", ") : "none"}` };
});

// =====================================================================
// ISSUES AND NOTES (HR)
// =====================================================================
const issueForm = (page) => page.locator("form#new");
const issueSubmit = (page) => issueForm(page).locator('button[type="submit"]');
await test(B, "Issues: default filter „Nevybavené“, form closed until asked for", { pre: "HR", steps: "Open /hr/issues", expected: "Status filter = Nevybavené; the form is hidden behind „Pridať podnet“", req: "IT-13" }, async () => {
  await hr.goto(`${BASE}/hr/issues`);
  const status = await hr.locator('select[name="status"]').inputValue();
  const hidden = !(await issueForm(hr).isVisible());
  return { ok: status === "ACTIVE" && hidden, actual: `status filter: ${status}; form hidden: ${hidden}` };
});
await test(C, "Issue form: empty", { pre: "Form opened", steps: "Click „Pridať podnet“ (summary), then the submit button with nothing filled in", expected: "„Vyplň názov (3 až 120 znakov), skupinu a zdroj. Termín musí byť platný dátum.“", req: "IT-10" }, async () => {
  await hr.locator("summary", { hasText: "Pridať podnet" }).click();
  await issueSubmit(hr).click();
  await issueForm(hr).locator('[role="alert"]').waitFor();
  return { ok: (await alerts(hr)).join() === "Vyplň názov (3 až 120 znakov), skupinu a zdroj. Termín musí byť platný dátum.", actual: `alert: "${(await alerts(hr)).join()}"`, evidence: await shot(hr, "issues-form-empty-1280") };
});
await test(C, "Issue form: title of 2 characters", { pre: "Form opened", steps: "Title „ab“, submit", expected: "Validation message", req: "IT-10" }, async () => {
  await issueForm(hr).locator('input[name="title"]').fill("ab");
  await issueSubmit(hr).click();
  await hr.waitForTimeout(600);
  return { ok: (await alerts(hr)).join().startsWith("Vyplň názov"), actual: `alert: "${(await alerts(hr)).join()}"` };
});
await test(C, "Issue form: server error", { pre: "POST /api/hr/issues answered with 500", steps: "Valid issue, submit", expected: "Generic error; title kept", req: "IT-10" }, async () => {
  await issueForm(hr).locator('input[name="title"]').fill("Pomalé pripojenie v zasadačke");
  await fail500(hr, "**/api/hr/issues");
  await issueSubmit(hr).click();
  await hr.waitForTimeout(600);
  const text = (await alerts(hr)).join();
  await hr.unroute("**/api/hr/issues");
  return { ok: text === "Niečo sa nepodarilo. Skús to znova." && (await issueForm(hr).locator('input[name="title"]').inputValue()) !== "", actual: `alert: "${text}"` };
});
await test(C, "Issue form: valid issue (IT podpora, overdue date) is saved and listed", { pre: "Form opened", steps: "Title, description, group „IT podpora“, deadline yesterday, submit twice quickly", expected: "„Podnet je pridaný.“; exactly one new card in the list; form cleared", req: "IT-10" }, async () => {
  const posts = countPosts(hr, "/api/hr/issues");
  await issueForm(hr).locator('textarea[name="description"]').fill("Videohovory sa sekajú.\nDruhý riadok opisu.");
  await issueForm(hr).locator('select[name="ownerGroup"]').selectOption("IT_SUPPORT");
  await issueForm(hr).locator('input[name="dueDate"]').fill(iso(-1));
  await issueSubmit(hr).dblclick({ noWaitAfter: true });
  await issueForm(hr).locator('[role="status"]').waitFor({ timeout: 8000 });
  await hr.waitForTimeout(600);
  const cards = await hr.locator("main ul > li", { hasText: "Pomalé pripojenie v zasadačke" }).count();
  const cleared = (await issueForm(hr).locator('input[name="title"]').inputValue()) === "";
  return { ok: cards === 1 && cleared && posts.count === 1, actual: `status "${await issueForm(hr).locator('[role="status"]').innerText()}"; cards ${cards}; POSTs ${posts.count}; form cleared ${cleared}`, evidence: await shot(hr, "issues-saved-1280") };
});
await test(B, "HR home: overdue issue appears as a task with correct grammar (1)", { pre: "One issue is past its deadline", steps: "Open /", expected: "„1 podnet je po termíne.“ with the button „Otvoriť podnety“", req: "IT-11" }, async () => {
  await hr.goto(`${BASE}/`);
  const body = flat(await hr.locator("main").innerText());
  return { ok: body.includes("1 podnet je po termíne."), actual: body.slice(0, 300), evidence: await shot(hr, "home-hr-overdue-issue-1280") };
});
await test(B, "Issues: filter by group", { pre: "Issues of two groups exist", steps: "Group „IT podpora“, click „Filtrovať“", expected: "Only IT issues; URL carries the filter; selects keep the chosen values", req: "IT-10" }, async () => {
  await hr.goto(`${BASE}/hr/issues`);
  await hr.locator('select[name="group"]').selectOption("IT_SUPPORT");
  await hr.getByRole("button", { name: "Filtrovať" }).click();
  await hr.waitForURL(/group=IT_SUPPORT/);
  const titles = await hr.locator("main ul > li h2").allInnerTexts();
  const kept = await hr.locator('select[name="group"]').inputValue();
  return { ok: titles.join() === "Pomalé pripojenie v zasadačke" && kept === "IT_SUPPORT", actual: `titles: ${titles.join(" | ")}; select keeps: ${kept}; url ${new URL(hr.url()).search}` };
});
await test(B, "Issues: filter with no match shows the empty state", { pre: "No finished issue", steps: "Status „Hotové“, „Filtrovať“", expected: "„Žiadny podnet nezodpovedá výberu.“", req: "IT-10" }, async () => {
  await hr.locator('select[name="status"]').selectOption("DONE");
  await hr.getByRole("button", { name: "Filtrovať" }).click();
  await hr.waitForURL(/status=DONE/);
  const body = flat(await hr.locator("main").innerText());
  return { ok: body.includes("Žiadny podnet nezodpovedá výberu."), actual: body.slice(body.indexOf("Filtrovať"), body.indexOf("Filtrovať") + 80) };
});
await test(B, "Issues: unknown filter values in the URL", { pre: "HR", steps: "Open /hr/issues?status=XYZ&group=FOO", expected: "No crash; an empty or unfiltered list; selects in a defined state", req: "IT-10" }, async () => {
  const response = await hr.goto(`${BASE}/hr/issues?status=XYZ&group=FOO`);
  const body = flat(await hr.locator("main").innerText());
  const cards = await hr.locator("main ul > li h2").count();
  return { ok: response.status() === 200, actual: `HTTP ${response.status()}; cards ${cards}; status select shows "${await hr.locator('select[name="status"]').evaluate((el) => el.selectedOptions[0]?.textContent)}"; empty state: ${body.includes("Žiadny podnet nezodpovedá výberu.")}` };
});
await test(B, "Issues: changing the status to „Hotové“ removes the card from „Nevybavené“", { pre: "Default filter", steps: "Set the status of „Pomalé pripojenie…“ to „Hotové“", expected: "Card disappears from the default list; it is under the filter „Hotové“", req: "IT-10, IT-13" }, async () => {
  await hr.goto(`${BASE}/hr/issues`);
  const card = hr.locator("main ul > li", { hasText: "Pomalé pripojenie v zasadačke" });
  await card.locator('select[aria-label="Stav"]').selectOption("DONE");
  await card.waitFor({ state: "detached", timeout: 8000 });
  await hr.goto(`${BASE}/hr/issues?status=DONE`);
  const done = await hr.locator("main ul > li h2").allInnerTexts();
  return { ok: done.includes("Pomalé pripojenie v zasadačke"), actual: `under „Hotové“: ${done.join(" | ")}` };
});
await test(B, "Issues: failed status change reverts and tells the user", { pre: "PATCH answered with 500", steps: "Change the group of the first issue", expected: "Select returns to the previous value; role=alert message", req: "IT-10" }, async () => {
  await hr.goto(`${BASE}/hr/issues`);
  await fail500(hr, "**/api/hr/issues/*");
  const select = hr.locator('main ul > li select[aria-label="Zodpovedná skupina"]').first();
  const before = await select.inputValue();
  await select.selectOption("OTHER");
  await hr.waitForTimeout(700);
  const after = await select.inputValue();
  const text = (await alerts(hr)).join();
  await hr.unroute("**/api/hr/issues/*");
  return { ok: after === before && text === "Niečo sa nepodarilo. Skús to znova.", actual: `value ${before} → ${after}; alert: "${text}"` };
});
await test(B, "Issue from a round: link on the results opens the prefilled form", { pre: "HR on the results of „Pulse – 46. týždeň“", steps: "Click „Vytvoriť podnet z tohto kola“", expected: "Form open, note „Podnet z kola „Pulse – 46. týždeň“ (Tím Alfa).“, source „Prieskum“, no team select; warning not to copy comments", req: "IT-10" }, async () => {
  await hr.goto(resultsUrl);
  await hr.getByRole("link", { name: "Vytvoriť podnet z tohto kola" }).click();
  await hr.waitForURL(/\/hr\/issues\?round=/);
  const visible = await issueForm(hr).isVisible();
  const body = flat(await issueForm(hr).innerText());
  const source = await issueForm(hr).locator('select[name="source"]').inputValue();
  const team = await issueForm(hr).locator('select[name="teamId"]').count();
  const inView = await issueForm(hr).evaluate((el) => { const r = el.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; });
  return { ok: visible && body.includes("Podnet z kola „Pulse – 46. týždeň“ (Tím Alfa).") && source === "SURVEY" && team === 0 && body.includes("Komentáre z prieskumu neprepisuj doslova"), actual: `form visible ${visible}; in the viewport after the jump: ${inView}; source ${source}; team select ${team}; note present ${body.includes("Podnet z kola")}`, evidence: await shot(hr, "issues-from-round-1280", false) };
});
await test(C, "Issue from a round with a 120-character title without spaces", { pre: "Prefilled form", steps: "Title = 120 × W, submit; view the list at 360 px", expected: "Saved with a link to the round; no horizontal page scroll at 360 px", req: "IT-10, NFR-07" }, async () => {
  await issueForm(hr).locator('input[name="title"]').fill(LONG(120));
  await issueSubmit(hr).click();
  await issueForm(hr).locator('[role="status"]').waitFor({ timeout: 8000 });
  await hr.goto(`${BASE}/hr/issues`);
  const link = await hr.locator("main ul > li", { hasText: LONG(120) }).getByRole("link", { name: "Pulse – 46. týždeň" }).count();
  const { size, evidence } = await widthCheck(hr, 360, "issues-long-title-360");
  await hr.setViewportSize({ width: 1280, height: 800 });
  return { ok: link === 1 && size.scrollWidth <= size.clientWidth, actual: `round link on the card: ${link}; page ${size.scrollWidth}/${size.clientWidth} px`, evidence };
});
await test(B, "Issues: unknown round in the URL", { pre: "HR", steps: "Open /hr/issues?round=unknown#new", expected: "No crash: the form without the prefill, or a 404 page", req: "IT-10" }, async () => {
  const response = await hr.goto(`${BASE}/hr/issues?round=unknown#new`);
  const body = flat(await hr.locator("body").innerText());
  return { ok: [200, 404].includes(response.status()), actual: `HTTP ${response.status()}; ${body.slice(0, 120)}` };
});

const noteForm = (page) => page.locator("main form").first();
await test(C, "Note form: empty", { pre: "HR on /hr/notes", steps: "Click „Uložiť poznámku“ with nothing filled in", expected: "„Vyplň názov (3 až 120 znakov), dátum stretnutia a text.“", req: "IT-10" }, async () => {
  await hr.goto(`${BASE}/hr/notes`);
  await hr.getByRole("button", { name: "Uložiť poznámku" }).click();
  await noteForm(hr).locator('[role="alert"]').waitFor();
  return { ok: (await alerts(hr)).join() === "Vyplň názov (3 až 120 znakov), dátum stretnutia a text.", actual: `alert: "${(await alerts(hr)).join()}"` };
});
await test(C, "Note form: missing date only", { pre: "Title and text filled", steps: "Submit without the date", expected: "Validation message; nothing saved", req: "IT-10" }, async () => {
  await noteForm(hr).locator('input[name="title"]').fill("QA stretnutie s Tímom Alfa");
  await noteForm(hr).locator('textarea[name="text"]').fill(`Prvý riadok poznámky.\nDruhý riadok. <b>tučné</b>\n${LONG(200, "N")}`);
  await hr.getByRole("button", { name: "Uložiť poznámku" }).click();
  await hr.waitForTimeout(600);
  return { ok: (await alerts(hr)).join().startsWith("Vyplň názov"), actual: `alert: "${(await alerts(hr)).join()}"` };
});
await test(C, "Note form: server error", { pre: "POST /api/hr/notes answered with 500", steps: "Fill the date, submit", expected: "Generic error; text kept", req: "IT-10" }, async () => {
  await noteForm(hr).locator('input[name="meetingDate"]').fill(iso(-2));
  await fail500(hr, "**/api/hr/notes");
  await hr.getByRole("button", { name: "Uložiť poznámku" }).click();
  await hr.waitForTimeout(600);
  const text = (await alerts(hr)).join();
  await hr.unroute("**/api/hr/notes");
  return { ok: text === "Niečo sa nepodarilo. Skús to znova." && (await noteForm(hr).locator('textarea[name="text"]').inputValue()).length > 0, actual: `alert: "${text}"` };
});
await test(C, "Note form: valid note is saved, listed first, form cleared", { pre: "Valid form", steps: "Submit", expected: "New card with the title, date, line breaks kept and HTML shown as text; form empty; a confirmation for the user", req: "IT-10" }, async () => {
  await hr.getByRole("button", { name: "Uložiť poznámku" }).click();
  const card = hr.locator("main ul > li", { hasText: "QA stretnutie s Tímom Alfa" });
  await card.waitFor({ timeout: 8000 });
  const text = await card.locator("p.whitespace-pre-line").innerText();
  const bold = await card.locator("b").count();
  const cleared = (await noteForm(hr).locator('input[name="title"]').inputValue()) === "";
  const status = await hr.locator('[role="status"]').count();
  return { ok: text.includes("Prvý riadok poznámky.\nDruhý riadok. <b>tučné</b>") && bold === 0 && cleared, actual: `line breaks and literal HTML kept: ${text.includes("Prvý riadok poznámky.\nDruhý riadok. <b>tučné</b>")}; form cleared: ${cleared}; confirmation message (role=status): ${status > 0 ? "yes" : "none"}`, evidence: await shot(hr, "notes-saved-1280") };
});
await test(F, "Notes: a 200-character word at 360 px", { pre: "Such a note exists", steps: "Open /hr/notes at 360 px", expected: "Text wraps; no horizontal page scroll", req: "NFR-07" }, async () => {
  const { size, evidence } = await widthCheck(hr, 360, "notes-long-word-360");
  await hr.setViewportSize({ width: 1280, height: 800 });
  return { ok: size.scrollWidth <= size.clientWidth, actual: `page ${size.scrollWidth}/${size.clientWidth} px`, evidence };
});
await test(B, "Issue from a note: prefilled form", { pre: "Note saved", steps: "Click „Vytvoriť podnet“ on the note", expected: "Form open with „Podnet z poznámky „QA stretnutie s Tímom Alfa“.“ and source „Stretnutie“", req: "IT-10" }, async () => {
  await hr.locator("main ul > li", { hasText: "QA stretnutie s Tímom Alfa" }).getByRole("link", { name: "Vytvoriť podnet" }).click();
  await hr.waitForURL(/note=/);
  const body = flat(await issueForm(hr).innerText());
  const source = await issueForm(hr).locator('select[name="source"]').inputValue();
  return { ok: body.includes("Podnet z poznámky „QA stretnutie s Tímom Alfa“.") && source === "MEETING", actual: `note line present: ${body.includes("Podnet z poznámky")}; source ${source}` };
});
await test(B, "JS errors and console errors during the forms run", { pre: "Manager, HR and employee sessions", steps: "Collect pageerror and console.error (messages caused by the injected 4xx/5xx/aborted requests excluded)", expected: "None" }, async () => {
  const all = [...manager.errors, ...hr.errors, ...adam.errors].filter((e) => !/status of (4|5)\d\d|Failed to load resource|net::ERR_FAILED/.test(e));
  return { ok: all.length === 0, actual: all.length ? [...new Set(all)].slice(0, 5).join(" | ") : "none" };
});

await browser.close();
