// Journey 4: HR — issues from a round and from a meeting note, filters, status changes,
// and home tasks that follow the real state (IT-10, IT-11, IT-13). Seed-only start.
import { BASE, U, db, resetDb, recorder, session, shot, mainText, api, ymd, fmtDate, closeBrowser } from "./lib.mjs";

const R = recorder("j4-hr");
const step = async (meta, fn) => {
  try { const [ok, actual, evidence] = await fn(); return R.check({ j: "J4", ...meta }, ok, actual, evidence ?? ""); }
  catch (error) { return R.check({ j: "J4", ...meta }, false, `SCRIPT/RUNTIME ERROR: ${error.message}`); }
};
const DAY = 864e5;
resetDb(false);
const teamA = await db.team.findFirstOrThrow({ where: { name: "Tím Alfa" } });
const teamB = await db.team.findFirstOrThrow({ where: { name: "Tím Beta" } });
const seedBeta = await db.round.findFirstOrThrow({ where: { teamId: teamB.id } });
const hr = await session(U.hr);
const hrApi = await api(U.hr);
const issueCards = (p) => p.locator("main section > ul > li");

await step({ d: "Issues list opens with only unfinished issues by default", pre: "seed: 2 issues (OPEN, IN_PROGRESS)", steps: "HR: menu 'Podnety'", exp: "status filter preset to 'Nevybavené'; list = DB issues with status OPEN/IN_PROGRESS, newest first; form hidden until the button is used (IT-13)" }, async () => {
  await hr.locator("header nav").getByRole("link", { name: "Podnety" }).click();
  await hr.getByRole("heading", { name: "Podnety", exact: true }).waitFor();
  const titles = await issueCards(hr).locator("h2").allInnerTexts();
  const rows = await db.issue.findMany({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  const sel = await hr.locator('select[name="status"]').inputValue();
  const formVisible = await hr.locator("form#new").isVisible();
  return [JSON.stringify(titles) === JSON.stringify(rows.map((r) => r.title)) && sel === "ACTIVE" && !formVisible, `UI=${JSON.stringify(titles)}; DB=${rows.length}; filter=${sel}; form visible=${formVisible}`, await shot(hr, "j4-01-issues-default")];
});
await step({ d: "'Vytvoriť podnet z tohto kola' opens the issue form prefilled with the round and its team", pre: "seeded closed Beta round", steps: "HR: results of the Beta round → click the link", exp: "URL /hr/issues?round=<id>#new; form open; 'Podnet z kola „…“ (Tím Beta).'; source 'Prieskum'; no team select; warning not to copy comments (IT-10)" }, async () => {
  await hr.goto(`${BASE}/rounds/${seedBeta.id}/results`);
  await hr.getByRole("link", { name: "Vytvoriť podnet z tohto kola" }).click();
  await hr.locator("form#new").waitFor();
  const text = await hr.locator("form#new").innerText();
  const source = await hr.locator('form#new select[name="source"]').inputValue();
  const teamSel = await hr.locator('form#new select[name="teamId"]').count();
  const ok = hr.url().includes(`/hr/issues?round=${seedBeta.id}`) && text.includes(`Podnet z kola „${seedBeta.name}“ (Tím Beta).`) && source === "SURVEY" && teamSel === 0 && text.includes("Komentáre z prieskumu neprepisuj doslova.");
  return [ok, `url=${hr.url().replace(seedBeta.id, ":id")}; source=${source}; team select=${teamSel}`, await shot(hr, "j4-02-issue-from-round")];
});
await step({ d: "Issue with a 2-character title is refused and the typed data stays", pre: "form from round open", steps: "title 'ab', description text, submit", exp: "message 'Vyplň názov (3 až 120 znakov)…'; no new row; description still in the form" }, async () => {
  const before = await db.issue.count();
  await hr.locator('form#new input[name="title"]').fill("ab");
  await hr.locator('form#new textarea[name="description"]').fill("QA opis, ktorý má zostať.");
  await hr.getByRole("button", { name: "Pridať podnet" }).click();
  await hr.getByText("Vyplň názov (3 až 120 znakov), skupinu a zdroj.").waitFor();
  const kept = await hr.locator('form#new textarea[name="description"]').inputValue();
  return [(await db.issue.count()) === before && kept === "QA opis, ktorý má zostať.", `rows ${before}→${await db.issue.count()}; description kept='${kept}'`];
});
await step({ d: "HR creates an issue from the round", pre: "form from round open", steps: "title 'QA podnet z kola', group 'Vedenie', due date +10 d, submit", exp: "'Podnet je pridaný.'; it appears first in the list with team and round links; DB: roundId, teamId = team of the round, source SURVEY, status OPEN, no reference to any response (IT-10)" }, async () => {
  const due = ymd(new Date(Date.now() + 10 * DAY));
  await hr.locator('form#new input[name="title"]').fill("QA podnet z kola");
  await hr.locator('form#new select[name="ownerGroup"]').selectOption("MANAGEMENT");
  await hr.locator('form#new input[name="dueDate"]').fill(due);
  await hr.getByRole("button", { name: "Pridať podnet" }).click();
  await hr.getByText("Podnet je pridaný.").waitFor();
  await issueCards(hr).locator("h2", { hasText: "QA podnet z kola" }).waitFor();
  const x = await db.issue.findFirst({ where: { title: "QA podnet z kola" } });
  const first = await issueCards(hr).first().innerText();
  const cols = (await db.$queryRawUnsafe(`PRAGMA table_info("Issue")`)).map((c) => c.name);
  const ok = x.roundId === seedBeta.id && x.teamId === teamB.id && x.source === "SURVEY" && x.status === "OPEN" && x.ownerGroup === "MANAGEMENT" && ymd(x.dueDate) === due && first.includes("QA podnet z kola") && first.includes("Tím Beta") && first.includes(seedBeta.name) && !cols.some((c) => /response/i.test(c));
  return [ok, `row=${JSON.stringify({ ...x, createdById: "…" })}; Issue columns=${cols.join(",")}`, await shot(hr, "j4-03-issue-created")];
});
// notes
await step({ d: "Notes tab lists the seeded note; empty note form is refused", pre: "seed: 1 note", steps: "tab 'Poznámky'; submit the empty form", exp: "'Vyplň názov (3 až 120 znakov), dátum stretnutia a text.'; still 1 note" }, async () => {
  await hr.goto(`${BASE}/hr/issues`);
  await hr.getByRole("navigation", { name: "Podnety" }).getByRole("link", { name: "Poznámky" }).click();
  await hr.getByRole("heading", { name: "Poznámky zo stretnutí" }).waitFor();
  await hr.getByRole("button", { name: "Uložiť poznámku" }).click();
  await hr.getByText("Vyplň názov (3 až 120 znakov), dátum stretnutia a text.").waitFor();
  const n = await db.meetingNote.count();
  return [n === 1, `notes=${n}`, await shot(hr, "j4-04-note-empty")];
});
const noteDate = ymd(new Date(Date.now() - 1 * DAY));
await step({ d: "HR writes a meeting note", pre: "Notes tab", steps: "title, date yesterday, 2-line text, save", exp: "note listed first (newest meeting first) with 'Stretnutie <date>' and line break kept; DB row created by HR; form cleared (IT-10)" }, async () => {
  await hr.locator('input[name="title"]').fill("QA stretnutie s Tímom Alfa");
  await hr.locator('input[name="meetingDate"]').fill(noteDate);
  await hr.locator('textarea[name="text"]').fill("QA: tlačiareň na 2. poschodí netlačí.\nQA: chýbajú monitory.");
  await hr.getByRole("button", { name: "Uložiť poznámku" }).click();
  await hr.locator("main ul > li h3", { hasText: "QA stretnutie s Tímom Alfa" }).waitFor();
  const first = await hr.locator("main section > ul > li").first().innerText();
  const x = await db.meetingNote.findFirst({ where: { title: "QA stretnutie s Tímom Alfa" }, include: { createdBy: true } });
  const titleAfter = await hr.locator('input[name="title"]').inputValue();
  return [first.includes("QA stretnutie s Tímom Alfa") && first.includes(`Stretnutie ${fmtDate(noteDate)}`) && x.createdBy.email === U.hr && x.text.includes("\n") && titleAfter === "", `first='${first.replace(/\s+/g, " ").slice(0, 160)}'; createdBy=${x.createdBy.email}; title field after save='${titleAfter}'`, await shot(hr, "j4-05-note-saved")];
});
const note = await db.meetingNote.findFirstOrThrow({ where: { title: "QA stretnutie s Tímom Alfa" } });
const pastDue = ymd(new Date(Date.now() - 2 * DAY));
await step({ d: "HR creates an issue from the note, with a team and a due date in the past", pre: "note saved", steps: "click 'Vytvoriť podnet' on the note; title, group 'IT podpora', team 'Tím Alfa', due date 2 days ago; submit", exp: "form open with 'Podnet z poznámky „…“.' and source 'Stretnutie'; DB: noteId, teamId Alfa, source MEETING, IT_SUPPORT; note text is NOT copied into the issue automatically (IT-10)" }, async () => {
  await hr.locator("main section > ul > li", { hasText: "QA stretnutie s Tímom Alfa" }).getByRole("link", { name: "Vytvoriť podnet" }).click();
  await hr.locator("form#new").waitFor();
  const text = await hr.locator("form#new").innerText();
  const source = await hr.locator('form#new select[name="source"]').inputValue();
  const desc = await hr.locator('form#new textarea[name="description"]').inputValue();
  await hr.locator('form#new input[name="title"]').fill("QA nefunkčná tlačiareň");
  await hr.locator('form#new select[name="ownerGroup"]').selectOption("IT_SUPPORT");
  await hr.locator('form#new select[name="teamId"]').selectOption({ label: "Tím Alfa" });
  await hr.locator('form#new input[name="dueDate"]').fill(pastDue);
  await hr.getByRole("button", { name: "Pridať podnet" }).click();
  await hr.getByText("Podnet je pridaný.").waitFor();
  const x = await db.issue.findFirst({ where: { title: "QA nefunkčná tlačiareň" } });
  const ok = text.includes("Podnet z poznámky „QA stretnutie s Tímom Alfa“.") && source === "MEETING" && desc === "" && x.noteId === note.id && x.teamId === teamA.id && x.source === "MEETING" && x.ownerGroup === "IT_SUPPORT" && x.description === "" && x.roundId === null;
  return [ok, `source=${source}; description prefilled='${desc}'; row noteId ok=${x.noteId === note.id}, team ok=${x.teamId === teamA.id}, description='${x.description}'`, await shot(hr, "j4-06-issue-from-note")];
});
await step({ d: "The note lists the issue created from it with its status", pre: "issue created from the note", steps: "open Poznámky", exp: "'Podnety z tejto poznámky': 'QA nefunkčná tlačiareň (Otvorené)'" }, async () => {
  await hr.goto(`${BASE}/hr/notes`);
  const t = await hr.locator("main section > ul > li", { hasText: "QA stretnutie s Tímom Alfa" }).innerText();
  return [t.includes("Podnety z tejto poznámky") && t.includes("QA nefunkčná tlačiareň (Otvorené)"), t.replace(/\s+/g, " ").slice(0, 300)];
});
await step({ d: "HR home shows the overdue issue as a task", pre: "1 issue with due date 2 days ago, status Otvorené", steps: "HR opens /", exp: "task '1 podnet je po termíne.' with button 'Otvoriť podnety' → /hr/issues; count equals DB (IT-11)" }, async () => {
  await hr.goto(`${BASE}/`);
  const tasks = await hr.locator("main ol > li").allInnerTexts();
  const n = await db.issue.count({ where: { status: { not: "DONE" }, dueDate: { lt: new Date() } } });
  const t = tasks.find((x) => x.includes("po termíne"));
  const href = await hr.locator("main ol > li", { hasText: "po termíne" }).getByRole("link").getAttribute("href");
  return [n === 1 && t?.includes("1 podnet je po termíne.") && t.includes("Otvoriť podnety") && href === "/hr/issues", `DB overdue=${n}; tasks=${JSON.stringify(tasks.map((x) => x.replace(/\s+/g, " ")))}`, await shot(hr, "j4-07-home-overdue-issue")];
});
// filters
const filt = async (group, status) => {
  await hr.goto(`${BASE}/hr/issues`);
  await hr.locator('select[name="group"]').selectOption(group);
  await hr.locator('select[name="status"]').selectOption(status);
  await hr.getByRole("button", { name: "Filtrovať" }).click();
  await hr.waitForURL(/status=/);
  return (await issueCards(hr).locator("h2").allInnerTexts()).sort();
};
for (const [group, status, where, label] of [
  ["IT_SUPPORT", "ACTIVE", { ownerGroup: "IT_SUPPORT", status: { in: ["OPEN", "IN_PROGRESS"] } }, "group 'IT podpora' + Nevybavené"],
  ["", "ALL", {}, "all groups + Všetko"],
  ["", "IN_PROGRESS", { status: "IN_PROGRESS" }, "status 'Rieši sa'"],
  ["", "DONE", { status: "DONE" }, "status 'Hotové' (none yet)"],
  ["MANAGEMENT", "OPEN", { ownerGroup: "MANAGEMENT", status: "OPEN" }, "group 'Vedenie' + Otvorené"],
]) {
  await step({ d: `Filter: ${label}`, pre: "4 issues in DB", steps: "choose the values, click 'Filtrovať'", exp: "list equals the DB query; with no match: 'Žiadny podnet nezodpovedá výberu.'; filter is in the URL (IT-10)" }, async () => {
    const ui = await filt(group, status);
    const rows = (await db.issue.findMany({ where })).map((r) => r.title).sort();
    const empty = await hr.getByText("Žiadny podnet nezodpovedá výberu.").count();
    return [JSON.stringify(ui) === JSON.stringify(rows) && (rows.length > 0 || empty === 1) && hr.url().includes(`status=${status}`), `UI=${JSON.stringify(ui)}; DB=${JSON.stringify(rows)}; url=${hr.url().split("?")[1]}`, await shot(hr, `j4-08-filter-${group || "all"}-${status}`)];
  });
}
await step({ d: "Status change in place: the overdue issue is set to 'Hotové'", pre: "default filter", steps: "open /hr/issues; in the card 'QA nefunkčná tlačiareň' choose Stav = Hotové", exp: "DB status DONE; the card leaves the default list after the refresh (IT-10, IT-13)" }, async () => {
  await hr.goto(`${BASE}/hr/issues`);
  await issueCards(hr).filter({ hasText: "QA nefunkčná tlačiareň" }).getByLabel("Stav").selectOption("DONE");
  await issueCards(hr).filter({ hasText: "QA nefunkčná tlačiareň" }).waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
  const x = await db.issue.findFirst({ where: { title: "QA nefunkčná tlačiareň" } });
  const still = await issueCards(hr).filter({ hasText: "QA nefunkčná tlačiareň" }).count();
  return [x.status === "DONE" && still === 0, `DB=${x.status}; still in default list=${still}`, await shot(hr, "j4-09-issue-done")];
});
await step({ d: "HR home: the overdue-issue task disappears once the issue is done", pre: "issue set to Hotové", steps: "HR opens /", exp: "no 'po termíne' task (IT-11)" }, async () => {
  await hr.goto(`${BASE}/`);
  const tasks = await hr.locator("main ol > li").allInnerTexts();
  return [!tasks.some((t) => t.includes("po termíne")), JSON.stringify(tasks.map((x) => x.replace(/\s+/g, " ")))];
});
await step({ d: "Owner group change in place", pre: "issue 'QA podnet z kola' (Vedenie)", steps: "choose 'Správa budovy' in its card; reload", exp: "DB ownerGroup FACILITY; select shows it after reload" }, async () => {
  await hr.goto(`${BASE}/hr/issues`);
  await issueCards(hr).filter({ hasText: "QA podnet z kola" }).getByLabel("Zodpovedná skupina").selectOption("FACILITY");
  await hr.waitForTimeout(700);
  const x = await db.issue.findFirst({ where: { title: "QA podnet z kola" } });
  await hr.reload();
  const v = await issueCards(hr).filter({ hasText: "QA podnet z kola" }).getByLabel("Zodpovedná skupina").inputValue();
  return [x.ownerGroup === "FACILITY" && v === "FACILITY", `DB=${x.ownerGroup}; UI=${v}`];
});
await step({ d: "The done issue is reachable through the 'Hotové' filter and the note shows the new status", pre: "issue done", steps: "filter Hotové; open Poznámky", exp: "the issue is listed under Hotové; note shows '(Hotové)'" }, async () => {
  const ui = await filt("", "DONE");
  await hr.goto(`${BASE}/hr/notes`);
  const t = await hr.locator("main section > ul > li", { hasText: "QA stretnutie s Tímom Alfa" }).innerText();
  return [ui.includes("QA nefunkčná tlačiareň") && t.includes("QA nefunkčná tlačiareň (Hotové)"), `filter=${JSON.stringify(ui)}; note has (Hotové)=${t.includes("(Hotové)")}`];
});
// permissions
await step({ d: "Managers and employees cannot read or change issues and notes", pre: "sessions of manager Beta and Filip", steps: "GET/POST /api/hr/issues, PATCH /api/hr/issues/:id, GET/POST /api/hr/notes, GET /api/hr/overview, /api/hr/heatmap", exp: "403 on all 14 calls; DB unchanged (IT-10)" }, async () => {
  const issue = await db.issue.findFirst();
  const before = [await db.issue.count(), await db.meetingNote.count()];
  const out = [];
  for (const email of [U.mgrB, U.beta[0]]) {
    const a = await api(email);
    for (const [m, p, b] of [["GET", "/api/hr/issues"], ["POST", "/api/hr/issues", { title: "x y z", source: "OTHER", ownerGroup: "HR" }], ["PATCH", `/api/hr/issues/${issue.id}`, { status: "DONE" }], ["GET", "/api/hr/notes"], ["POST", "/api/hr/notes", { title: "abc", meetingDate: noteDate, text: "x" }], ["GET", "/api/hr/overview"], ["GET", "/api/hr/heatmap"]]) {
      out.push((await a(p, m, b)).status);
    }
  }
  const after = [await db.issue.count(), await db.meetingNote.count()];
  return [out.every((s) => s === 403) && String(before) === String(after), `statuses=${out}; rows ${before}→${after}`];
});

// ───── low participation task
const closeToday = ymd(new Date());
const qs = (await hrApi("/api/questions")).json.questions.filter((q) => !q.fixed).slice(0, 3).map((q) => q.id);
await step({ d: "HR creates a round that closes today through the form (deadline = today is allowed)", pre: "HR on /rounds/new", steps: "team Tím Beta, deadline today, save, start", exp: "round OPEN with closesAt today 23:59:59 (MVP-04)" }, async () => {
  await hr.goto(`${BASE}/rounds/new`);
  await hr.locator('select[name="teamId"]').selectOption({ label: "Tím Beta" });
  await hr.locator('input[name="name"]').fill("QA kolo končí dnes");
  await hr.locator('input[name="closesAt"]').fill(closeToday);
  await hr.getByRole("button", { name: "Uložiť koncept" }).click();
  await hr.waitForURL("**/hr/rounds");
  const row = hr.locator("main li", { has: hr.getByRole("heading", { name: "QA kolo končí dnes", exact: true }) });
  await row.getByRole("button", { name: "Spustiť" }).click();
  await row.getByText("Otvorené").waitFor();
  const r = await db.round.findFirst({ where: { name: "QA kolo končí dnes" } });
  return [r.status === "OPEN" && ymd(r.closesAt) === closeToday && r.teamId === teamB.id, `status=${r.status}, closesAt=${r.closesAt.toISOString()}`];
});
const soon = await db.round.findFirstOrThrow({ where: { name: "QA kolo končí dnes" } });
await step({ d: "HR home warns about an open round closing soon with under half of the team in", pre: "round closes today, 0 of 6 answered", steps: "HR opens /", exp: "task 'Kolo „QA kolo končí dnes“ (Tím Beta) sa uzavrie do zajtra a odpovedalo iba 0 z 6.' with 'Pozrieť účasť' → results of that round (IT-11)" }, async () => {
  await hr.goto(`${BASE}/`);
  const li = hr.locator("main ol > li", { hasText: "QA kolo končí dnes" });
  const text = await li.locator("p").innerText();
  const href = await li.getByRole("link").getAttribute("href");
  return [text === "Kolo „QA kolo končí dnes“ (Tím Beta) sa uzavrie do zajtra a odpovedalo iba 0 z 6." && href === `/rounds/${soon.id}/results`, `text='${text}', href ok=${href === `/rounds/${soon.id}/results`}`, await shot(hr, "j4-10-home-low-participation")];
});
await step({ d: "The warning follows participation: 2 of 6 still warns, 3 of 6 does not", pre: "round open", steps: "2 Beta members answer (API) → HR home; a third answers → HR home", exp: "after 2: '…odpovedalo iba 2 z 6.'; after 3: task gone (IT-11: under half)" }, async () => {
  const answer = async (email) => (await (await api(email))(`/api/rounds/${soon.id}/responses`, "POST", { answers: [3, 4, 3, 4] })).status;
  const s1 = [await answer(U.beta[0]), await answer(U.beta[1])];
  await hr.goto(`${BASE}/`);
  const t2 = await hr.locator("main ol > li", { hasText: "QA kolo končí dnes" }).allInnerTexts();
  const s2 = await answer(U.beta[2]);
  await hr.goto(`${BASE}/`);
  const t3 = await hr.locator("main ol > li", { hasText: "QA kolo končí dnes" }).count();
  return [s1.join() === "201,201" && s2 === 201 && t2[0]?.includes("odpovedalo iba 2 z 6.") && t3 === 0, `submit statuses=${s1},${s2}; after 2='${t2[0]?.replace(/\s+/g, " ")}'; after 3 tasks=${t3}`];
});
await step({ d: "HR home never shows more than 3 tasks and orders them: rounds awaiting action, overdue issues, closing soon", pre: "state built directly in the QA DB: 1 awaiting round, 1 overdue issue, 2 open rounds closing soon with 0 answers", steps: "create the overdue issue and two more rounds via API; HR opens /", exp: "exactly 3 tasks in that order (IT-11)" }, async () => {
  await hrApi("/api/hr/issues", "POST", { title: "QA podnet po termíne", source: "OTHER", ownerGroup: "HR", dueDate: pastDue });
  for (const [name, team] of [["QA končí dnes 2", teamA.id], ["QA končí dnes 3", teamA.id]]) {
    const c = await hrApi("/api/rounds", "POST", { name, teamId: team, closesAt: closeToday, questionIds: qs });
    await hrApi(`/api/rounds/${c.json.round.id}/open`, "POST");
  }
  await hr.goto(`${BASE}/`);
  const tasks = (await hr.locator("main ol > li p").allInnerTexts());
  const ok = tasks.length === 3 && tasks[0].includes("čaká na krok manažéra") && tasks[1].includes("podnet je po termíne") && tasks[2].includes("sa uzavrie do zajtra");
  return [ok, JSON.stringify(tasks), await shot(hr, "j4-11-home-max-3")];
});

// ───── manager tasks
const mgrB = await session(U.mgrB);
const mgrBApi = await api(U.mgrB);
await step({ d: "Manager home: closed round without an action, with the right number of days and wording", pre: "seeded Beta round closed 3 days ago, no action", steps: "manager Beta opens /", exp: "first task 'Kolo „…“ je uzavreté 3 dni a tím čaká…' (correct Slovak plural for 2–4: 'dni') (IT-11)" }, async () => {
  await mgrB.goto(`${BASE}/`);
  const days = Math.floor((Date.now() - seedBeta.closedAt.getTime()) / DAY);
  const text = await mgrB.locator("main ol > li").first().locator("p").innerText();
  const plural = days === 1 ? "1 deň" : days >= 2 && days <= 4 ? `${days} dni` : `${days} dní`;
  return [text.startsWith(`Kolo „${seedBeta.name}“ je uzavreté ${plural} a tím čaká`), `days=${days}; UI='${text}'`, await shot(mgrB, "j4-12-mgr-home-days")];
});
await step({ d: "Manager home: an action past its due date becomes a task and disappears when done", pre: "manager Beta", steps: "add an action with a due date 5 days ago on the results page; open /; set it to Hotové; open /", exp: "task '1 krok je po termíne. Dokonči ho alebo uprav stav.' → link to the round's results; gone after 'Hotové'; the 'awaiting action' task is gone as well (IT-11)" }, async () => {
  await mgrB.goto(`${BASE}/rounds/${seedBeta.id}/results`);
  await mgrB.locator('input[name="topic"]').fill("QA krok po termíne");
  await mgrB.locator('textarea[name="description"]').fill("QA: mal byť hotový minulý týždeň.");
  await mgrB.locator('input[name="dueDate"]').fill(ymd(new Date(Date.now() - 5 * DAY)));
  await mgrB.getByRole("button", { name: "Pridať krok" }).click();
  await mgrB.locator("#kroky ul > li h3", { hasText: "QA krok po termíne" }).waitFor();
  await mgrB.goto(`${BASE}/`);
  const t1 = await mgrB.locator("main ol > li p").allInnerTexts();
  const href = await mgrB.locator("main ol > li", { hasText: "po termíne" }).getByRole("link").getAttribute("href");
  await mgrB.goto(`${BASE}/rounds/${seedBeta.id}/results`);
  await mgrB.locator("#kroky > ul > li", { hasText: "QA krok po termíne" }).getByLabel("Stav").selectOption("DONE");
  await mgrB.waitForTimeout(700);
  await mgrB.goto(`${BASE}/`);
  const t2 = await mgrB.locator("main ol > li p").allInnerTexts();
  const ok = t1.some((t) => t === "1 krok je po termíne. Dokonči ho alebo uprav stav.") && href === `/rounds/${seedBeta.id}/results` && !t1.some((t) => t.includes("je uzavreté")) && !t2.some((t) => t.includes("po termíne"));
  return [ok, `before=${JSON.stringify(t1)}; after=${JSON.stringify(t2)}`, await shot(mgrB, "j4-13-mgr-home-after-done")];
});
await step({ d: "HR overview counts the overdue action while it is not done (recomputed from DB)", pre: "Beta action due 5 days ago is DONE now; set back to Prebieha through the UI", steps: "manager sets status Prebieha; HR opens /hr/overview and expands 'Podrobné čísla' of Tím Beta", exp: "'Po termíne' = DB count of not-done actions with dueDate < now (1) (IT-05)" }, async () => {
  await mgrB.goto(`${BASE}/rounds/${seedBeta.id}/results`);
  await mgrB.locator("#kroky > ul > li", { hasText: "QA krok po termíne" }).getByLabel("Stav").selectOption("IN_PROGRESS");
  await mgrB.waitForTimeout(700);
  await hr.goto(`${BASE}/hr/overview`);
  const card = hr.locator("main ul > li", { hasText: "Tím Beta" }).first();
  await card.locator("summary").click();
  const text = (await card.innerText()).replace(/\s+/g, " ");
  const n = await db.action.count({ where: { round: { teamId: teamB.id }, status: { not: "DONE" }, dueDate: { lt: new Date() } } });
  return [n === 1 && /Po termíne 1/.test(text) && text.includes("Plánované: 0, Prebieha: 1, Hotové: 0"), `DB overdue=${n}; card='${text.slice(0, 300)}'`, await shot(hr, "j4-14-overview-overdue")];
});
await step({ d: "Manager home: 'start a new round' appears after 14 quiet days", pre: "Team Beta: open QA round closed directly in the QA DB and all Beta rounds dated 15+ days back (simulated time)", steps: "manager Beta opens /", exp: "task 'Posledné kolo sa skončilo pred 15 dňami a žiadne ďalšie nebeží. Vytvor nové.' with 'Nové kolo' → /rounds/new (IT-11)" }, async () => {
  const d15 = new Date(Date.now() - 15 * DAY - 60000);
  await db.round.updateMany({ where: { teamId: teamB.id }, data: { status: "CLOSED", closedAt: d15, closesAt: d15 } });
  await mgrB.goto(`${BASE}/`);
  const tasks = await mgrB.locator("main ol > li p").allInnerTexts();
  const t = tasks.find((x) => x.includes("Posledné kolo"));
  const href = t ? await mgrB.locator("main ol > li", { hasText: "Posledné kolo" }).getByRole("link").getAttribute("href") : null;
  return [t === "Posledné kolo sa skončilo pred 15 dňami a žiadne ďalšie nebeží. Vytvor nové." && href === "/rounds/new", `tasks=${JSON.stringify(tasks)}; href=${href}`, await shot(mgrB, "j4-15-mgr-home-start-round")];
});
await step({ d: "Home tasks of a manager never mention the other team", pre: "Alfa has two open rounds closing today; Beta manager logged in", steps: "read all tasks of manager Beta", exp: "no task mentions Alfa rounds (IT-11: only own team)" }, async () => {
  const tasks = await mgrB.locator("main ol > li p").allInnerTexts();
  return [!tasks.some((t) => t.includes("QA končí dnes")), JSON.stringify(tasks)];
});
await step({ d: "HR reaches both team pages and trends from 'Prehľady'", pre: "HR on /hr/overview", steps: "click 'Tím Alfa' → team page; tab 'Vývoj tímu'; same for Beta via heatmap link", exp: "HTTP 200 pages with the team name; no 403 (matrix: HR sees every team)" }, async () => {
  await hr.goto(`${BASE}/hr/overview`);
  await hr.getByRole("link", { name: "Tím Alfa" }).first().click();
  await hr.getByRole("heading", { name: "Povedali ste, urobili sme" }).waitFor();
  const a = (await mainText(hr)).includes("Tím Alfa");
  await hr.getByRole("link", { name: "Vývoj tímu" }).click();
  await hr.getByRole("heading", { name: "Vývoj tímu" }).waitFor();
  const res = await hr.goto(`${BASE}/team/${teamB.id}/trend`);
  return [a && res.status() === 200, `Alfa team page ok=${a}; Beta trend HTTP ${res.status()}`];
});

console.log(`\nJ4 done: ${R.rows.length} checks, ${R.rows.filter((r) => r.status === "FAIL").length} failed`);
await closeBrowser();
