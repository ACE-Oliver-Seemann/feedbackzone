// Explicit checks for residual parts of session-001 defects (BUG-006, 016, 028, 029, 031) so that each has
// its own recorded result. Needs an open round for Tím Beta (s2-07-extras starts one). Does not submit.
import { launch, makeRecorder, newPage, session, USERS, BASE, shot, go, api } from "./s2-lib.mjs";

const { test } = makeRecorder("10-regression-checks");
const browser = await launch();

const hugo = await session(browser, "hugo.beta@example.test");
const open = (await api(hugo, "/api/rounds")).rounds?.find((r) => r.status === "OPEN");
const blocked = { blocked: true, actual: "no open round for Tím Beta in this data set" };

await test("G", "Questionnaire question step has a heading (BUG-028, known partial)", { pre: "hugo.beta, open Beta round", steps: "Open the questionnaire, click 'Začať'; list headings", expected: "The question is exposed as a heading (h1) or the page keeps one h1", req: "BUG-028; WCAG 2.4.6" }, async () => {
  if (!open) return blocked;
  await go(hugo, `/rounds/${open.id}/fill`);
  await hugo.getByRole("button", { name: "Začať" }).click(); await hugo.waitForTimeout(400);
  const r = await hugo.evaluate(() => ({ headings: [...document.querySelectorAll("main h1, main h2, main h3")].map((h) => h.tagName + ":" + h.innerText.slice(0, 30)), legend: document.querySelector("main fieldset legend")?.innerText.slice(0, 40) }));
  return { ok: r.headings.length > 0, actual: `headings in main: ${r.headings.join(", ") || "none"}; question is a <legend>: "${r.legend}"` };
});
await test("D", "Progress bar does not animate under reduced motion (BUG-031)", { steps: "Set 'Obmedzené' via data-motion=reduce; read the transition of the progress segments", expected: "No transform transition", req: "BUG-031, IT-02" }, async () => {
  if (!open) return blocked;
  await hugo.evaluate(() => document.documentElement.setAttribute("data-motion", "reduce"));
  const tp = await hugo.evaluate(() => { const seg = document.querySelector('main [aria-hidden="true"] span span'); return seg ? getComputedStyle(seg).transitionProperty : null; });
  await hugo.evaluate(() => document.documentElement.setAttribute("data-motion", "full"));
  const full = await hugo.evaluate(() => { const seg = document.querySelector('main [aria-hidden="true"] span span'); return seg ? getComputedStyle(seg).transitionProperty : null; });
  return { ok: !!tp && !/transform|all/.test(tp), actual: `reduce: ${tp}; full: ${full}` };
});
await test("C", "Comment field accepts 1 000 characters when emoji are used (BUG-006 residual)", { steps: "Go to the comment step; type 990 letters followed by 10 emoji", expected: "All 1 000 characters accepted (the counter counts characters, so the limit should too)", req: "MVP-08, BUG-006" }, async () => {
  if (!open) return blocked;
  let n = 0;
  while ((await hugo.getByRole("button", { name: "Ďalej" }).count()) && n++ < 6) { await hugo.locator("main fieldset button[aria-pressed]").nth(2).click(); await hugo.getByRole("button", { name: "Ďalej" }).click(); await hugo.waitForTimeout(150); }
  const ta = hugo.locator("main textarea");
  await ta.fill("a".repeat(990) + "😀".repeat(10));
  const v = await ta.inputValue();
  const counter = (await hugo.locator("main p.tabular-nums").last().innerText()).trim();
  return { ok: [...v].length === 1000, actual: `accepted ${[...v].length} characters (${v.length} UTF-16 units, maxlength=${await ta.getAttribute("maxlength")}); counter "${counter}"`, evidence: await shot(hugo, "fill-comment-emoji-limit", false), defect: "FE2-011" };
});
await test("C", "Kudos text accepts 500 characters when emoji are used (BUG-006 residual)", { steps: "/kudos?tab=send; type 490 letters + 10 emoji", expected: "500 characters accepted", req: "MVP-16, BUG-006" }, async () => {
  await go(hugo, "/kudos?tab=send");
  await hugo.fill("form textarea", "a".repeat(490) + "😀".repeat(10));
  const v = await hugo.inputValue("form textarea");
  return { ok: [...v].length === 500, actual: `accepted ${[...v].length} characters (${v.length} UTF-16 units)`, defect: "FE2-011" };
});
await test("G", "Kudos: focus after a rejected submit stays on a meaningful element (BUG-016 residual)", { steps: "Click 'Poslať kudos' with an empty form using the mouse and using Enter from the keyboard", expected: "Focus is not dropped to <body> (it should stay on the button or move to the first invalid field)", req: "BUG-016; WCAG 2.4.3" }, async () => {
  await go(hugo, "/kudos?tab=send");
  await hugo.locator("form").getByRole("button", { name: "Poslať kudos" }).click(); await hugo.waitForTimeout(800);
  const a = await hugo.evaluate(() => document.activeElement.tagName);
  await go(hugo, "/kudos?tab=send");
  await hugo.locator("form").getByRole("button", { name: "Poslať kudos" }).focus(); await hugo.keyboard.press("Enter"); await hugo.waitForTimeout(800);
  const b = await hugo.evaluate(() => document.activeElement.tagName);
  return { ok: a !== "BODY" && b !== "BODY", actual: `after mouse click: ${a}; after Enter on the button: ${b}`, defect: "FE2-007" };
});
await hugo.context().close();

{
  const page = await newPage(browser);
  await test("G", "Login: focus after a rejected login stays on a meaningful element", { steps: "Tab to 'Prihlásiť sa' with a wrong password and press Enter", expected: "Focus not dropped to <body>", req: "MVP-01; WCAG 2.4.3" }, async () => {
    await go(page, "/login");
    await page.fill('input[name="email"]', USERS.adam); await page.fill('input[name="password"]', "zle");
    await page.locator('button[type="submit"]').focus(); await page.keyboard.press("Enter");
    await page.locator('form [role="alert"]').first().waitFor();
    const a = await page.evaluate(() => document.activeElement.tagName);
    return { ok: a !== "BODY", actual: `focus after the error: ${a}`, defect: "FE2-007" };
  });
  await page.context().close();
}

const hr = await session(browser, USERS.hr);
await test("G", "Issue and note forms: error is linked to the invalid field (BUG-029, known open)", { steps: "Submit the empty issue form and the empty note form; read aria-invalid / aria-describedby of the fields", expected: "Invalid fields carry aria-invalid and reference the message", req: "BUG-029; WCAG 3.3.1" }, async () => {
  await go(hr, "/hr/issues");
  await hr.locator("main summary", { hasText: "Pridať podnet" }).click();
  await hr.locator("form").getByRole("button", { name: "Pridať podnet" }).click(); await hr.waitForTimeout(700);
  const i = await hr.evaluate(() => { const e = document.querySelector('input[name="title"]'); return `issue title: aria-invalid=${e.getAttribute("aria-invalid")} describedby=${e.getAttribute("aria-describedby")}`; });
  await go(hr, "/hr/notes");
  await hr.getByRole("button", { name: "Uložiť poznámku" }).click(); await hr.waitForTimeout(700);
  const n = await hr.evaluate(() => ["title", "meetingDate", "text"].map((x) => { const e = document.querySelector(`main [name="${x}"]`); return `note ${x}: aria-invalid=${e.getAttribute("aria-invalid")}`; }).join("; "));
  return { ok: /aria-invalid=true/.test(i) && /aria-invalid=true/.test(n), actual: `${i}; ${n}`, defect: "FE2-013" };
});
await test("G", "Required fields are marked as required (BUG-029, known open)", { steps: "Read required / aria-required on the fields of the new round, action, kudos, issue and note forms", expected: "Mandatory fields expose 'required' to assistive technology or show a visible mark", req: "BUG-029; WCAG 3.3.2" }, async () => {
  const out = [];
  for (const [url, names] of [["/rounds/new", ["name", "closesAt"]], ["/kudos?tab=send", ["toUserId"]], ["/hr/notes", ["title", "meetingDate", "text"]]]) {
    await go(hr, url);
    out.push(...(await hr.evaluate(([url, names]) => names.map((n) => { const e = document.querySelector(`main [name="${n}"]`); return `${url} ${n}: required=${e.required || e.getAttribute("aria-required") === "true"}`; }), [url, names])));
  }
  return { ok: out.every((o) => /required=true/.test(o)), actual: out.join("; "), defect: "FE2-013" };
});
await hr.context().close();
await browser.close();
