// Session 2026-11-12_002, sections D + G: what the UI shows vs the API vs the database on the demo
// data (8 closed rounds), HR workflows (issues, notes, overview, comparison), home tasks per role
// incl. the cap of 3, menus and tabs, and regression checks of the session-001 defects.
import {
  BASE, U, db, resetDb, recorder, stepper, session, shot, mainOnly, api, sk, fmtDate, round2, ymd, DAY, pathOf, teams,
  apiRound, toast, rowById, closeBrowser, PROJECT, EVIDENCE,
} from "./lib.mjs";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const R = recorder("m6-consistency");
const step = stepper(R);
resetDb(true); // seed + demo data
const { A: teamA, B: teamB } = await teams();
const LOWER = ["OVERTIME", "FREQUENCY"];
const hrApi = await api(U.hr); const mgrAApi = await api(U.mgrA);
const closedTime = (r) => (r.closedAt ?? r.closesAt).getTime();
const allRounds = () => db.round.findMany({ include: { team: true, actions: true, responses: true, questions: { include: { question: true }, orderBy: { position: "asc" } }, _count: { select: { participations: true } } } });
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
/** Independent recomputation of a round's scores from raw Response rows. */
const score = (round) => {
  if (round.responses.length < 5) return null;
  const topics = {}; let fixed = null;
  for (const q of round.questions) {
    const avg = mean(round.responses.map((r) => r[`v${q.position}`]));
    const s = LOWER.includes(q.question.scale) ? 6 - avg : avg;
    if (q.question.fixed) fixed = s; else (topics[q.question.topic] ??= []).push(s);
  }
  return { fixed, topics: Object.fromEntries(Object.entries(topics).map(([k, v]) => [k, mean(v)])) };
};

const hr = await session(U.hr); const mgrA = await session(U.mgrA); const adam = await session(U.alfa[0]);

// ───────────────────────── D: numbers on the demo data
await step({ j: "D", d: "HR list of rounds: every row's status and participation equals the database", pre: "demo data: 9 rounds", steps: "open /hr/rounds; compare each row with Round + Participation", exp: "9 rows; 'n z 6' = participations / team size; status label per row; 'Čaká na krok' exactly on closed rounds without a step (MVP-12, MVP-15)" }, async () => {
  await hr.goto(`${BASE}/hr/rounds`, { waitUntil: "networkidle" });
  const rounds = await allRounds(); const bad = [];
  const label = { DRAFT: "Koncept", OPEN: "Otvorené", CLOSED: "Uzavreté" };
  for (const r of rounds) {
    const text = (await rowById(hr, r.id).innerText()).replace(/\s+/g, " ");
    const awaiting = r.status === "CLOSED" && r.actions.length === 0;
    if (!text.includes(`${r._count.participations} z 6`) || !text.includes(label[r.status]) || text.includes("Čaká na krok") !== awaiting || !text.includes(r.team.name)) bad.push(r.name);
  }
  const rows = await hr.locator("[data-round-row]").count();
  return [rows === rounds.length && bad.length === 0, `rows=${rows}, DB=${rounds.length}, mismatching rows=${bad.join(", ") || "none"}`, await shot(hr, "m6-01-hr-rounds")];
});
await step({ j: "D", d: "HR list summary tiles equal the database", pre: "demo data", steps: "read 'Súhrn kôl'", exp: "open rounds, rounds awaiting a step and all rounds counted from DB" }, async () => {
  const rounds = await allRounds();
  const exp = `Otvorené kolá ${rounds.filter((r) => r.status === "OPEN").length} Čakajú na krok ${rounds.filter((r) => r.status === "CLOSED" && !r.actions.length).length} Všetky kolá ${rounds.length}`;
  const ui = (await hr.locator('dl[aria-label="Súhrn kôl"]').innerText()).replace(/\s+/g, " ");
  return [ui === exp, `UI='${ui}' expected='${exp}'`];
});
await step({ j: "D", d: "GET /api/rounds for HR equals the list on the page", pre: "demo data", steps: "compare ids, status and participation from the API with the rows", exp: "same set of rounds, same order as the page" }, async () => {
  const apiRounds = (await hrApi("/api/rounds")).json.rounds;
  const uiIds = await hr.locator("[data-round-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-round-row")));
  return [JSON.stringify(apiRounds.map((r) => r.id)) === JSON.stringify(uiIds), `API=${apiRounds.length}, UI=${uiIds.length}, same order=${JSON.stringify(apiRounds.map((r) => r.id)) === JSON.stringify(uiIds)}`];
});
await step({ j: "D", d: "HR overview: totals recomputed from the database", pre: "demo data", steps: "open /hr/overview; recompute closed rounds, rounds with a step, share, median days to the first step, steps by status, overdue steps", exp: "all figures of 'Všetky tímy' equal the recomputation (IT-05)" }, async () => {
  await hr.goto(`${BASE}/hr/overview`, { waitUntil: "networkidle" });
  const rounds = (await allRounds()).filter((r) => r.status === "CLOSED");
  const withAction = rounds.filter((r) => r.actions.length);
  const days = withAction.map((r) => Math.max(0, Math.min(...r.actions.map((a) => a.createdAt.getTime())) - closedTime(r)) / DAY).sort((a, b) => a - b);
  const med = days.length % 2 ? days[(days.length - 1) / 2] : (days[days.length / 2 - 1] + days[days.length / 2]) / 2;
  const med1 = Math.round(med * 10) / 10;
  const actions = rounds.flatMap((r) => r.actions);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = actions.filter((a) => a.status !== "DONE" && a.dueDate.getTime() < today.getTime()).length;
  const dayWord = !Number.isInteger(med1) ? "dňa" : med1 === 1 ? "deň" : med1 >= 2 && med1 <= 4 ? "dni" : "dní";
  const exp = [`Uzavreté kolá ${rounds.length}`, `So zapísaným krokom ${withAction.length} (${Math.round((withAction.length / rounds.length) * 100)} %)`, `Čas do prvého kroku ${med1.toLocaleString("sk-SK")} ${dayWord}`,
    `Kroky Plánované: ${actions.filter((a) => a.status === "PLANNED").length}, Prebieha: ${actions.filter((a) => a.status === "IN_PROGRESS").length}, Hotové: ${actions.filter((a) => a.status === "DONE").length}`, `Po termíne ${overdue}`];
  const ui = (await hr.locator("main#main dl").first().innerText()).replace(/\s+/g, " ");
  const miss = exp.filter((e) => !ui.includes(e));
  return [miss.length === 0, `UI='${ui}'; not matching: ${miss.join(" | ") || "none"}`, await shot(hr, "m6-02-overview")];
});
await step({ j: "D", d: "HR overview: headline, per-team line and the list of waiting rounds equal the database", pre: "demo data", steps: "read the headline, each team's line and waiting rounds; expand 'Podrobné čísla'", exp: "'N z M uzavretých kôl čakajú na krok. Najdlhšie <tím>, D dní.'; per team 'Krok má x z y…'; waiting rounds = closed rounds without a step with 'uzavreté pred D dňami' (IT-13)" }, async () => {
  const rounds = (await allRounds()).filter((r) => r.status === "CLOSED");
  const waiting = rounds.filter((r) => !r.actions.length).sort((a, b) => closedTime(a) - closedTime(b));
  const d0 = Math.floor((Date.now() - closedTime(waiting[0])) / DAY);
  const text = await mainOnly(hr);
  const head = `${waiting.length} z ${rounds.length} uzavretých kôl ${waiting.length === 1 ? "čaká" : waiting.length <= 4 ? "čakajú" : "čaká"} na krok. Najdlhšie ${waiting[0].team.name}, ${d0} ${d0 === 1 ? "deň" : d0 >= 2 && d0 <= 4 ? "dni" : "dní"}.`;
  const bad = [];
  if (!text.includes(head)) bad.push(`headline (expected '${head}')`);
  for (const team of [teamA, teamB]) {
    const tr = rounds.filter((r) => r.teamId === team.id);
    const line = `Krok má ${tr.filter((r) => r.actions.length).length} z ${tr.length} ${tr.length === 1 ? "uzavretého kola" : "uzavretých kôl"}.`;
    const li = (await hr.locator("main#main > div > ul > li", { hasText: team.name }).innerText()).replace(/\s+/g, " ");
    if (!li.includes(line)) bad.push(`${team.name} line`);
    for (const w of waiting.filter((r) => r.teamId === team.id)) {
      const d = Math.floor((Date.now() - closedTime(w)) / DAY);
      const exp = `${w.name} (${d === 0 ? "uzavreté dnes" : `uzavreté pred ${d} ${d === 1 ? "dňom" : "dňami"}`})`;
      if (!li.includes(exp)) bad.push(`waiting '${exp}'`);
    }
  }
  const details = await hr.locator("main#main details", { hasText: "Podrobné čísla" }).first().evaluate((e) => e.open);
  return [bad.length === 0 && !details, `mismatches: ${bad.join("; ") || "none"}; team numbers collapsed by default=${!details}`];
});
await step({ j: "D", d: "GET /api/hr/overview equals the page", pre: "demo data", steps: "compare API totals with the page figures", exp: "closed rounds, with action, share and overdue identical" }, async () => {
  const o = (await hrApi("/api/hr/overview")).json;
  const ui = (await hr.locator("main#main dl").first().innerText()).replace(/\s+/g, " ");
  const t = o.total;
  const keys = Object.keys(t).join(",");
  const closed = t.closedRounds ?? t.closed; const withA = t.withAction ?? t.roundsWithAction;
  return [ui.includes(`Uzavreté kolá ${closed}`) && ui.includes(`So zapísaným krokom ${withA} (${t.sharePercent} %)`) && ui.includes(`Po termíne ${t.actions.overdue}`), `API total keys=${keys}; closed=${closed}, withAction=${withA}, share=${t.sharePercent}, overdue=${t.actions.overdue}`];
});
await step({ j: "D", d: "Comparison of teams: every cell recomputed from raw responses (no rounding of intermediate values)", pre: "demo data; rounds closed in the last 90 days with ≥ 5 responses", steps: "open /hr/heatmap; recompute every team × topic cell from Response rows", exp: "every cell equals the recomputation to 2 decimals; rounds below the threshold contribute nothing; number of rounds per team correct (IT-08, BUG-035)" }, async () => {
  await hr.goto(`${BASE}/hr/heatmap`, { waitUntil: "networkidle" });
  const rounds = (await allRounds()).filter((r) => r.status === "CLOSED" && closedTime(r) >= Date.now() - 90 * DAY);
  const headers = (await hr.locator("thead th").allInnerTexts()).slice(1);
  const bad = []; let cells = 0;
  for (const team of [teamA, teamB]) {
    const scored = rounds.filter((r) => r.teamId === team.id).map(score).filter(Boolean);
    const tr = hr.locator("tbody tr", { hasText: team.name });
    const ui = await tr.locator("td").allInnerTexts();
    const head = (await tr.locator("th").innerText()).replace(/\s+/g, " ");
    const word = scored.length === 1 ? "kolo" : scored.length <= 4 ? "kolá" : "kôl";
    if (!head.includes(`${scored.length} ${word}`)) bad.push(`${team.name}: rounds counted '${head}' vs ${scored.length}`);
    headers.forEach((h, i) => {
      const vals = scored.map((s) => (h === "Stála otázka" ? s.fixed : s.topics[h])).filter((v) => v !== undefined && v !== null);
      const exp = vals.length ? sk(round2(mean(vals))) : "–";
      cells++;
      if (ui[i] !== exp) bad.push(`${team.name}/${h}: UI ${ui[i]} vs ${exp}`);
    });
  }
  return [bad.length === 0, `cells compared=${cells}; mismatches: ${bad.join("; ") || "none"}`, await shot(hr, "m6-03-heatmap")];
});
await step({ j: "D", d: "GET /api/hr/heatmap equals the table", pre: "demo data", steps: "compare API cells with the table", exp: "identical values and topics order" }, async () => {
  const h = (await hrApi("/api/hr/heatmap")).json;
  const headers = (await hr.locator("thead th").allInnerTexts()).slice(1);
  const bad = [];
  for (const t of h.teams) {
    const ui = await hr.locator("tbody tr", { hasText: t.teamName }).locator("td").allInnerTexts();
    headers.forEach((topic, i) => { const exp = t.cells[topic] === undefined ? "–" : sk(t.cells[topic]); if (ui[i] !== exp) bad.push(`${t.teamName}/${topic}`); });
  }
  return [JSON.stringify(h.topics) === JSON.stringify(headers) && bad.length === 0, `topics equal=${JSON.stringify(h.topics) === JSON.stringify(headers)}; mismatching cells=${bad.join(", ") || "none"}`];
});
await step({ j: "D", d: "Team trend table: every round row recomputed from raw responses; round below the threshold is a gap", pre: "Tím Alfa: 5 closed rounds, one with 4 responses", steps: "manager Alfa opens /team/:id/trend; recompute each row", exp: "row order oldest → newest or newest → oldest consistently; responses count; fixed and topic scores to 2 decimals; the 4-response round has no value (IT-08)" }, async () => {
  await mgrA.goto(`${BASE}/team/${teamA.id}/trend`, { waitUntil: "networkidle" });
  const rounds = (await allRounds()).filter((r) => r.status === "CLOSED" && r.teamId === teamA.id);
  const headers = (await mgrA.locator("thead th").allInnerTexts()).slice(2);
  const bad = [];
  for (const r of rounds) {
    const tr = mgrA.locator("tbody tr", { has: mgrA.locator(`a[href="/rounds/${r.id}/results"]`) });
    const cells = await tr.locator("td").allInnerTexts();
    const s = score(r);
    if (cells[0] !== String(r.responses.length)) bad.push(`${r.name}: responses ${cells[0]}`);
    if (!s) { if (/\d,\d/.test(cells.slice(1).join("|"))) bad.push(`${r.name}: value below threshold '${cells.slice(1).join("|")}'`); continue; }
    headers.forEach((h, i) => { const v = h === "Stála otázka" ? s.fixed : s.topics[h]; const exp = v === undefined || v === null ? "–" : sk(round2(v)); if (cells[i + 1] !== exp) bad.push(`${r.name}/${h}: UI ${cells[i + 1]} vs ${exp}`); });
  }
  const gapRow = (await mgrA.locator("tbody tr", { hasText: "Pulse – 42. týždeň" }).innerText()).replace(/\s+/g, " ");
  return [bad.length === 0, `rows=${rounds.length}; mismatches: ${bad.join("; ") || "none"}; gap row='${gapRow}'`, await shot(mgrA, "m6-04-trend")];
});
await step({ j: "D", d: "Trend chart has a point for every round above the threshold and a gap marker for the one below; no 'few rounds' note with 4 valid rounds", pre: "as above", steps: "inspect the chart figure and its accessible description", exp: "4 values, 1 'bez hodnoty'; no 'Graf vychádza iba z…' (IT-08)" }, async () => {
  const fig = mgrA.locator("main#main figure");
  const html = await fig.innerHTML();
  const text = await mainOnly(mgrA);
  const noValue = (html.match(/bez hodnoty/g) ?? []).length;
  const few = text.includes("Graf vychádza iba z");
  return [noValue >= 1 && !few, `'bez hodnoty' occurrences in the chart=${noValue}; few-rounds note=${few}`];
});
await step({ j: "D", d: "GET /api/teams/:id/trend equals the table and has no values for the round below the threshold", pre: "as above", steps: "manager Alfa: GET trend", exp: "5 points; the 4-response point has status insufficient_responses and no scores" }, async () => {
  const t = (await mgrAApi(`/api/teams/${teamA.id}/trend`)).json;
  const low = t.points.find((p) => p.responded < 5);
  return [t.points.length === 5 && low.status === "insufficient_responses" && low.fixed === undefined && low.topics === undefined, `points=${t.points.length}; low point=${JSON.stringify(low).replace(/c[a-z0-9]{20,}/g, ":id")}`];
});
await step({ j: "D", d: "Team page: every closed round's participation, date and question averages recomputed from raw responses", pre: "Adam (employee) on the team page; 5 closed rounds", steps: "compare each round block with the database", exp: "newest first by closing time; 'Odpovedalo n z 6'; averages to 2 decimals (raw, not reversed); the 4-response round shows only 'Nedostatok odpovedí'; lower-is-better note where applicable (MVP-14, IT-03)" }, async () => {
  await adam.goto(`${BASE}/team/${teamA.id}`, { waitUntil: "networkidle" });
  const rounds = (await allRounds()).filter((r) => r.status === "CLOSED" && r.teamId === teamA.id).sort((a, b) => closedTime(b) - closedTime(a));
  const blocks = adam.locator("main#main ol > li");
  const bad = [];
  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    const text = (await blocks.nth(i).innerText()).replace(/\s+/g, " ");
    if (!text.startsWith(r.name)) { bad.push(`position ${i + 1}: '${text.slice(0, 30)}' vs '${r.name}'`); continue; }
    if (!text.includes(`Uzavreté ${fmtDate(closedTime(r))}`) || !text.includes(`Odpovedalo ${r.responses.length} z 6`)) bad.push(`${r.name}: header`);
    if (r.responses.length < 5) { if (!text.includes("Nedostatok odpovedí") || text.includes("Priemer")) bad.push(`${r.name}: threshold`); continue; }
    for (const q of r.questions) {
      const avg = sk(round2(mean(r.responses.map((x) => x[`v${q.position}`]))));
      const note = LOWER.includes(q.question.scale) ? "Pri tejto otázke je nižšia hodnota lepšia." : "";
      if (!text.includes(`${q.question.text}${note ? " " + note : ""} Priemer ${avg}`) && !text.includes(`${q.question.text}${note} Priemer ${avg}`)) bad.push(`${r.name}/q${q.position} (${avg})`);
    }
    for (const a of r.actions) if (!text.includes(a.topic) || !text.includes(`Termín ${fmtDate(a.dueDate)}`)) bad.push(`${r.name}: action ${a.topic}`);
  }
  return [bad.length === 0 && (await blocks.count()) === rounds.length, `blocks=${await blocks.count()}, DB closed rounds=${rounds.length}; mismatches: ${bad.join("; ") || "none"}`, await shot(adam, "m6-05-team-page")];
});
await step({ j: "D", d: "Team summary API equals the page and holds no comment text and no values below the threshold", pre: "as above", steps: "Adam: GET /api/teams/:id/summary", exp: "5 rounds; the low round without averages; none of the stored comments in the body" }, async () => {
  const r = await (await api(U.alfa[0]))(`/api/teams/${teamA.id}/summary`);
  const comments = (await db.response.findMany({ where: { teamId: teamA.id, comment: { not: null } } })).map((x) => x.comment);
  const leak = comments.filter((c) => r.text.includes(c)).length;
  const low = r.json.rounds.find((x) => (x.responded ?? x.responseCount ?? x.participation?.responded) === 4);
  const lowHasValues = /"average":\s*[\d.]+/.test(JSON.stringify(low ?? {}));
  return [r.json.rounds.length === 5 && leak === 0 && !lowHasValues, `rounds=${r.json.rounds.length}; comments in DB=${comments.length}, leaked=${leak}; low round has averages=${lowHasValues}; low round keys=${Object.keys(low ?? {}).join(",")}`];
});
await step({ j: "D", d: "Results page of every closed round of Tím Alfa: averages, participation and comment count equal the database", pre: "manager Alfa; 5 closed rounds", steps: "open each results page", exp: "above the threshold: 'Odpovedalo n z 6', averages, 'Komentáre (k)' with k = stored comments; below: only 'Nedostatok odpovedí' (MVP-10, MVP-11)" }, async () => {
  const rounds = (await allRounds()).filter((r) => r.status === "CLOSED" && r.teamId === teamA.id);
  const bad = [];
  for (const r of rounds) {
    await mgrA.goto(`${BASE}/rounds/${r.id}/results`, { waitUntil: "networkidle" });
    const text = await mainOnly(mgrA);
    if (!text.includes(`Odpovedalo ${r.responses.length} z 6 členov tímu`)) bad.push(`${r.name}: participation`);
    if (r.responses.length < 5) { if (!text.includes("Nedostatok odpovedí") || /Priemer|Komentáre|V skratke/.test(text)) bad.push(`${r.name}: threshold`); continue; }
    for (const q of r.questions) if (!text.includes(`${q.question.text}`) || !text.includes(`Priemer ${sk(round2(mean(r.responses.map((x) => x[`v${q.position}`]))))}`)) bad.push(`${r.name}/q${q.position}`);
    const k = r.responses.filter((x) => x.comment).length;
    if (k > 0 && !text.includes(`Komentáre (${k})`)) bad.push(`${r.name}: comments (${k})`);
    if (k === 0 && !text.includes("Nikto nepridal komentár.") && !text.includes("Komentáre (0)")) bad.push(`${r.name}: empty comments`);
  }
  return [bad.length === 0, `rounds checked=${rounds.length}; mismatches: ${bad.join("; ") || "none"}`];
});
await step({ j: "D", d: "Lower-is-better questions are flagged on the results page and reversed only in suggestions/trend, not in the shown average", pre: "round 'Pulse – 44. týždeň' of Tím Alfa has an overtime question", steps: "open its results; read the question's average and note", exp: "raw average (e.g. 2,17) with the note 'Pri tejto otázke je nižšia hodnota lepšia.' (IT-03)" }, async () => {
  const r = (await allRounds()).find((x) => x.teamId === teamA.id && x.questions.some((q) => LOWER.includes(q.question.scale)) && x.responses.length >= 5);
  await mgrA.goto(`${BASE}/rounds/${r.id}/results`, { waitUntil: "networkidle" });
  const q = r.questions.find((x) => LOWER.includes(x.question.scale));
  const li = (await mgrA.locator("main#main li", { has: mgrA.getByRole("heading", { name: q.question.text }) }).first().innerText()).replace(/\s+/g, " ");
  const avg = sk(round2(mean(r.responses.map((x) => x[`v${q.position}`]))));
  return [li.includes("Pri tejto otázke je nižšia hodnota lepšia.") && li.includes(`Priemer ${avg}`), li.slice(0, 260)];
});

// ───────────────────────── G: home tasks per role and the cap of 3
await step({ j: "G", d: "Manager home: at most 3 tasks, most urgent first, and the own survey stays reachable below", pre: "demo data: manager Alfa has 2 closed rounds without a step, 1 overdue step and 1 unfilled survey (4 candidates)", steps: "open '/'", exp: "exactly 3 tasks; the survey is listed in 'Moje prieskumy' with 'Vyplniť' (IT-11, BUG-004)" }, async () => {
  await mgrA.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const tasks = await mgrA.locator("main#main ul[role=list] > li p").allInnerTexts();
  const fill = await mgrA.locator("main#main section", { has: mgrA.getByRole("heading", { name: "Moje prieskumy" }) }).getByRole("link", { name: "Vyplniť" }).count();
  const kinds = tasks.map((t) => (t.includes("je uzavreté") ? "awaiting" : t.includes("po termíne") ? "overdue" : t.includes("Čaká na teba") ? "fill" : "other"));
  return [tasks.length === 3 && fill === 1, `tasks=${tasks.length} (${kinds.join(", ")}); 'Vyplniť' in 'Moje prieskumy'=${fill}`, await shot(mgrA, "m6-06-mgr-home-cap")];
});
await step({ j: "G", d: "Manager home tasks lead to the exact place", pre: "as above", steps: "read each task's link; follow the 'Otvoriť kroky' link", exp: "'Výsledky a krok' → results of that round; 'Otvoriť kroky' → results of the round with the overdue step" }, async () => {
  const links = await mgrA.locator("main#main ul[role=list] > li a").evaluateAll((els) => els.map((e) => `${e.textContent}→${e.getAttribute("href")}`));
  const overdue = (await db.action.findMany({ where: { status: { not: "DONE" }, dueDate: { lt: new Date(new Date().setHours(0, 0, 0, 0)) }, round: { teamId: teamA.id } } }))[0];
  const ok = links.some((l) => l === `Otvoriť kroky→/rounds/${overdue.roundId}/results`) && links.filter((l) => l.startsWith("Výsledky a krok→/rounds/")).length === 2;
  return [ok, links.map((l) => l.replace(/c[a-z0-9]{20,}/g, ":id")).join(" | ")];
});
await step({ j: "G", d: "Employee home: only the own unfilled survey; no manager or HR task", pre: "demo data: 1 open Alfa round", steps: "Adam opens '/'", exp: "1 task 'Čaká na teba prieskum…'; no word about steps, issues or other teams (IT-11)" }, async () => {
  await adam.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const tasks = await adam.locator("main#main ul[role=list] > li p").allInnerTexts();
  return [tasks.length === 1 && tasks[0].startsWith("Čaká na teba prieskum") && !/krok|podnet|Tím Beta/.test(tasks.join(" ")), tasks.join(" | ")];
});
await step({ j: "G", d: "Employee without an open round sees 'Nič nečaká.'", pre: "Filip (Tím Beta) has no open round", steps: "open '/'", exp: "'Nič nečaká.' + hint about 'Môj tím'; no task list (IT-11)" }, async () => {
  const filip = await session(U.beta[0]);
  const text = await mainOnly(filip);
  const tasks = await filip.locator("main#main ul[role=list] > li").count();
  await filip.context().close();
  return [text.includes("Nič nečaká.") && tasks === 0, text.slice(0, 220)];
});
await step({ j: "G", d: "HR home with all three kinds of tasks: 3 tasks in the order of urgency, each with its link", pre: "demo data + an issue with a due date in the past + the open round's deadline shifted to 2 days from now with 0 of 6 answers (time simulation in the QA database)", steps: "HR opens '/'", exp: "(1) closed rounds without a step → /hr/overview, (2) '1 podnet je po termíne.' → /hr/issues, (3) 'Kolo „…“ (Tím Alfa) sa uzavrie o 2 dni a odpovedalo iba 0 z 6.' → results (IT-11)" }, async () => {
  const open = await db.round.findFirst({ where: { status: "OPEN" } });
  await db.round.update({ where: { id: open.id }, data: { closesAt: new Date(Date.now() + 2 * DAY - 3600e3) } });
  const i = await hrApi("/api/hr/issues", "POST", { title: "Podnet po termíne QA", ownerGroup: "FACILITY", source: "OTHER", dueDate: ymd(new Date(Date.now() + 2 * DAY)) });
  const id = i.json.issue?.id ?? (await db.issue.findFirst({ where: { title: "Podnet po termíne QA" } })).id;
  await db.issue.update({ where: { id }, data: { dueDate: new Date(Date.now() - 3 * DAY) } });
  await hr.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const items = await hr.locator("main#main ul[role=list] > li").evaluateAll((els) => els.map((e) => `${e.querySelector("p").textContent} [${e.querySelector("a").textContent}→${e.querySelector("a").getAttribute("href")}]`));
  const ok = items.length === 3 && /čakajú na krok manažéra.*→\/hr\/overview\]$/.test(items[0]) && items[1].startsWith("1 podnet je po termíne.") && items[1].endsWith("→/hr/issues]") && /sa uzavrie o 2 dni a odpovedalo iba 0 z 6\./.test(items[2]) && items[2].includes(`/rounds/${open.id}/results`);
  return [ok, items.map((x) => x.replace(/c[a-z0-9]{20,}/g, ":id")).join(" || "), await shot(hr, "m6-07-hr-home-three")];
});
await step({ j: "G", d: "Home tasks contain no content of answers", pre: "home pages of the three roles", steps: "search the three home pages for any stored comment text", exp: "none (IT-11)" }, async () => {
  const comments = (await db.response.findMany({ where: { comment: { not: null } } })).map((x) => x.comment);
  const leaks = [];
  for (const [n, p] of [["HR", hr], ["manager", mgrA], ["employee", adam]]) { await p.goto(`${BASE}/`, { waitUntil: "networkidle" }); const html = await p.content(); if (comments.some((c) => html.includes(c))) leaks.push(n); }
  return [leaks.length === 0, `comments in DB=${comments.length}; home pages containing one: ${leaks.join(", ") || "none"}`];
});

// ───────────────────────── G: menus, tabs, highlighting
await step({ j: "G", d: "Sub-navigation tabs per area (IT-12)", pre: "HR and manager sessions", steps: "read tabs on /hr/overview, /hr/issues, team page (HR, manager, employee)", exp: "Prehľady: Plnenie reakcie + Porovnanie tímov; Podnety: Podnety + Poznámky; team page: two tabs for manager and HR, none for the employee" }, async () => {
  const tabs = async (p, url) => { await p.goto(BASE + url, { waitUntil: "networkidle" }); return (await p.locator("main#main > div > nav a").allInnerTexts()).join("+"); };
  const a = await tabs(hr, "/hr/overview"); const b = await tabs(hr, "/hr/issues"); const c = await tabs(hr, `/team/${teamA.id}`); const d = await tabs(mgrA, `/team/${teamA.id}`); const e = await tabs(adam, `/team/${teamA.id}`);
  return [a === "Plnenie reakcie+Porovnanie tímov" && b === "Podnety+Poznámky" && c === "Povedali ste, urobili sme+Vývoj tímu" && d === c && e === "", `overview='${a}'; issues='${b}'; team HR='${c}'; team manager='${d}'; team employee='${e}'`];
});
await step({ j: "G", d: "The current area is highlighted in the main menu on inner pages", pre: "sessions of the three roles", steps: "read aria-current on /hr/heatmap, /hr/notes, /rounds/new (manager), results (manager), fill page (employee), trend (manager)", exp: "Prehľady, Podnety, Prieskumy, Prieskumy, Domov, Môj tím (IT-12, BUG-022)" }, async () => {
  const open = await db.round.findFirst({ where: { status: "OPEN" } }); const closed = await db.round.findFirst({ where: { status: "CLOSED", teamId: teamA.id } });
  const cur = async (p, url) => { await p.goto(BASE + url, { waitUntil: "networkidle" }); return (await p.locator('header nav a[aria-current="page"]').first().innerText().catch(() => "none")).trim(); };
  const got = [await cur(hr, "/hr/heatmap"), await cur(hr, "/hr/notes"), await cur(mgrA, "/rounds/new"), await cur(mgrA, `/rounds/${closed.id}/results`), await cur(adam, `/rounds/${open.id}/fill`), await cur(mgrA, `/team/${teamA.id}/trend`)];
  return [got.join(",") === "Prehľady,Podnety,Prieskumy,Prieskumy,Domov,Môj tím", got.join(",")];
});
await step({ j: "G", d: "NFR-04: the forbidden word does not appear on any page of any role", pre: "demo data", steps: "open 24 pages across the three roles and search the HTML for 'anonym'", exp: "no occurrence; the fill intro uses 'dôverné'" }, async () => {
  const open = await db.round.findFirst({ where: { status: "OPEN" } }); const closed = await db.round.findFirst({ where: { status: "CLOSED", teamId: teamA.id } });
  const sets = [[hr, ["/", "/hr/rounds", "/hr/overview", "/hr/heatmap", "/hr/issues", "/hr/notes", "/rounds/new", `/rounds/${closed.id}/results`, `/rounds/${closed.id}/report`, `/team/${teamA.id}`, `/team/${teamA.id}/trend`, "/kudos"]],
    [mgrA, ["/", "/rounds", "/rounds/new", `/rounds/${closed.id}/results`, `/rounds/${closed.id}/report`, `/team/${teamA.id}/trend`, `/rounds/${open.id}/fill`]], [adam, ["/", `/team/${teamA.id}`, "/kudos", "/kudos?tab=send", `/rounds/${open.id}/fill`]]];
  const hits = []; let n = 0;
  for (const [p, urls] of sets) for (const u of urls) { await p.goto(BASE + u, { waitUntil: "networkidle" }); n++; if (/anonym/i.test(await p.content())) hits.push(u); }
  return [hits.length === 0, `pages checked=${n}; pages with the word: ${hits.join(", ") || "none"}`];
});
await step({ j: "G", d: "Generated Slovak sentences on the demo pages use correct plural forms", pre: "demo data", steps: "search home, overview and lists for wrong forms ('1 dní', '2 dní', '5 dni', '0 dňami', '1 uzavretých', '1 kôl' …)", exp: "no wrong form (BUG-015)" }, async () => {
  const wrong = /\b1 dní\b|\b[234] dní\b|\b([5-9]|\d\d) dni\b|pred 0 dň|\b1 uzavretých kôl\b|\b1 kôl\b|\b[234] kôl\b|\b1 kolá\b|\b1 otázok\b|\b[234] otázok\b|\b([5-9]) otázky\b|\b1 odpovede\b|\b[234] odpovedí\b/;
  const hits = [];
  for (const [p, urls] of [[hr, ["/", "/hr/overview", "/hr/rounds", "/hr/heatmap"]], [mgrA, ["/", "/rounds", `/team/${teamA.id}/trend`]], [adam, ["/"]]]) for (const u of urls) { await p.goto(BASE + u, { waitUntil: "networkidle" }); const m = (await mainOnly(p)).match(wrong); if (m) hits.push(`${u}: '${m[0]}'`); }
  return [hits.length === 0, `wrong forms: ${hits.join("; ") || "none"}`];
});

// ───────────────────────── G: HR issues and notes (IT-10, IT-13)
const closedA = (await allRounds()).find((r) => r.teamId === teamA.id && r.status === "CLOSED" && r.responses.length >= 5 && r.responses.some((x) => x.comment));
const ISSUES0 = await db.issue.count();
await step({ j: "G", d: "Issues list: by default only unresolved issues; the form opens on a button", pre: "demo data + the overdue issue", steps: "open /hr/issues", exp: "status filter 'Nevybavené'; listed = issues with status ≠ DONE; the new-issue form is collapsed (IT-13)" }, async () => {
  await hr.goto(`${BASE}/hr/issues`, { waitUntil: "networkidle" });
  const filter = await hr.inputValue('select[name="status"]');
  const titles = await hr.locator("main#main > div > div > ul > li > h2").allInnerTexts();
  const active = (await db.issue.findMany({ where: { status: { not: "DONE" } } })).map((i) => i.title);
  const formVisible = await hr.locator('form#new input[name="title"]').isVisible();
  return [filter === "ACTIVE" && JSON.stringify([...titles].sort()) === JSON.stringify([...active].sort()) && !formVisible, `filter=${filter}; listed=${titles.length}, DB unresolved=${active.length}; form visible=${formVisible}`, await shot(hr, "m6-08-issues")];
});
await step({ j: "G", d: "From the results of a round: 'Vytvoriť podnet z tohto kola' opens the form with the round and team prefilled, without any comment text", pre: "HR on results of a closed Alfa round with comments", steps: "click the link", exp: "/hr/issues?round=…#new; form open; note 'Podnet z kola „…“ (Tím Alfa).'; source 'Prieskum'; team Tím Alfa; description empty; warning not to copy comments (IT-10)" }, async () => {
  await hr.goto(`${BASE}/rounds/${closedA.id}/results`, { waitUntil: "networkidle" });
  await hr.getByRole("link", { name: "Vytvoriť podnet z tohto kola" }).click();
  await hr.waitForURL("**/hr/issues?round=*");
  await hr.locator('form#new input[name="title"]').waitFor({ state: "visible", timeout: 8000 });
  const form = hr.locator("form#new");
  const text = (await form.innerText()).replace(/\s+/g, " ");
  const source = await form.locator('select[name="source"]').inputValue(); const team = (await form.locator('select[name="teamId"]').count()) === 0 ? teamA.id : "select shown"; // the team is fixed by the round, no select
  const desc = await form.locator('textarea[name="description"]').inputValue(); const title = await form.locator('input[name="title"]').inputValue();
  const ok = text.includes(`Podnet z kola „${closedA.name}“ (Tím Alfa).`) && source === "SURVEY" && team === teamA.id && desc === "" && title === "" && text.includes("Komentáre z prieskumu neprepisuj doslova.");
  return [ok, `note=${text.includes(`Podnet z kola „${closedA.name}“ (Tím Alfa).`)}, source=${source}, team prefilled=${team === teamA.id}, description empty=${desc === ""}, warning=${text.includes("Komentáre z prieskumu neprepisuj doslova.")}`, await shot(hr, "m6-09-issue-from-round")];
});
await step({ j: "G", d: "Invalid issue (title of 2 characters) is refused with a message", pre: "form open from the round", steps: "title 'ab'; Pridať podnet", exp: "'Vyplň názov (3 až 120 znakov), skupinu a zdroj. Termín musí byť platný dátum.'; nothing stored" }, async () => {
  await hr.fill('form#new input[name="title"]', "ab");
  await hr.locator("form#new").getByRole("button", { name: "Pridať podnet" }).click();
  await hr.waitForTimeout(800);
  const msg = await hr.getByText("Vyplň názov (3 až 120 znakov), skupinu a zdroj. Termín musí byť platný dátum.").isVisible().catch(() => false);
  return [msg && (await db.issue.count()) === ISSUES0, `message=${msg}; issues ${ISSUES0}→${await db.issue.count()}`];
});
await step({ j: "G", d: "HR creates the issue from the round", pre: "form open from the round", steps: "title, description, group 'IT podpora', due date; Pridať podnet", exp: "toast 'Podnet je pridaný.'; listed with links to the team and the round; DB: SURVEY, roundId, teamId, IT_SUPPORT, OPEN, due date; no link to any response (IT-10)" }, async () => {
  const due = ymd(new Date(Date.now() + 14 * DAY));
  await hr.fill('form#new input[name="title"]', "Pomalé notebooky v tíme QA");
  await hr.fill('form#new textarea[name="description"]', "Tím opakovane spomína pomalé zariadenia (vlastnými slovami).");
  await hr.selectOption('form#new select[name="ownerGroup"]', "IT_SUPPORT");
  await hr.fill('form#new input[name="dueDate"]', due);
  await hr.locator("form#new").getByRole("button", { name: "Pridať podnet" }).click();
  await toast(hr, "Podnet je pridaný.").waitFor({ timeout: 8000 });
  const li = hr.locator("main#main li", { has: hr.getByRole("heading", { name: "Pomalé notebooky v tíme QA" }) });
  await li.waitFor({ timeout: 8000 });
  const text = (await li.innerText()).replace(/\s+/g, " ");
  const i = await db.issue.findFirst({ where: { title: "Pomalé notebooky v tíme QA" } });
  const cols = (await db.$queryRawUnsafe(`PRAGMA table_info("Issue")`)).map((c) => c.name);
  const ok = i.source === "SURVEY" && i.roundId === closedA.id && i.teamId === teamA.id && i.ownerGroup === "IT_SUPPORT" && i.status === "OPEN" && ymd(i.dueDate) === due && text.includes("Zdroj: Prieskum") && text.includes(`Kolo: ${closedA.name}`) && text.includes("Tím: Tím Alfa") && !cols.includes("responseId");
  return [ok, `row='${text.slice(0, 200)}'; db source=${i.source}, round ok=${i.roundId === closedA.id}, group=${i.ownerGroup}; Issue columns=${cols.join(",")}`, await shot(hr, "m6-10-issue-added")];
});
await step({ j: "G", d: "Changing the owner group and the status of an issue is saved after the server confirmed", pre: "the new issue is listed", steps: "group → 'Vedenie'; status → 'Rieši sa'", exp: "toast 'Podnet je uložený.' twice; DB MANAGEMENT / IN_PROGRESS; values survive a reload" }, async () => {
  const li = hr.locator("main#main li", { has: hr.getByRole("heading", { name: "Pomalé notebooky v tíme QA" }) });
  await li.locator('select[aria-label="Zodpovedná skupina"]').selectOption("MANAGEMENT");
  await toast(hr, "Podnet je uložený.").first().waitFor({ timeout: 8000 });
  await hr.waitForTimeout(600);
  await li.locator('select[aria-label="Stav"]').selectOption("IN_PROGRESS");
  await hr.waitForTimeout(1500);
  const i = await db.issue.findFirst({ where: { title: "Pomalé notebooky v tíme QA" } });
  await hr.goto(`${BASE}/hr/issues`, { waitUntil: "networkidle" });
  const li2 = hr.locator("main#main li", { has: hr.getByRole("heading", { name: "Pomalé notebooky v tíme QA" }) });
  const g = await li2.locator('select[aria-label="Zodpovedná skupina"]').inputValue(); const s = await li2.locator('select[aria-label="Stav"]').inputValue();
  return [i.ownerGroup === "MANAGEMENT" && i.status === "IN_PROGRESS" && g === "MANAGEMENT" && s === "IN_PROGRESS", `db=${i.ownerGroup}/${i.status}; after reload=${g}/${s}`];
});
await step({ j: "G", d: "An issue set to 'Hotové' leaves the default list and is found under 'Hotové' and 'Všetko'", pre: "the new issue is 'Rieši sa'", steps: "status → 'Hotové'; reload default list; filter Hotové; filter Všetko", exp: "not in the default list; present in both other lists; DB DONE (IT-13)" }, async () => {
  const li = hr.locator("main#main li", { has: hr.getByRole("heading", { name: "Pomalé notebooky v tíme QA" }) });
  await li.locator('select[aria-label="Stav"]').selectOption("DONE");
  await toast(hr, "Podnet je uložený.").first().waitFor({ timeout: 8000 });
  await hr.goto(`${BASE}/hr/issues`, { waitUntil: "networkidle" });
  const inDefault = await hr.getByRole("heading", { name: "Pomalé notebooky v tíme QA" }).count();
  await hr.selectOption('select[name="status"]', "DONE"); await hr.getByRole("button", { name: "Filtrovať" }).click(); await hr.waitForURL("**status=DONE**");
  const inDone = await hr.getByRole("heading", { name: "Pomalé notebooky v tíme QA" }).count();
  const doneTitles = await hr.locator("main#main > div > div > ul > li > h2").count();
  await hr.selectOption('select[name="status"]', "ALL"); await hr.getByRole("button", { name: "Filtrovať" }).click(); await hr.waitForURL("**status=ALL**");
  const all = await hr.locator("main#main > div > div > ul > li > h2").count();
  const dbAll = await db.issue.count(); const dbDone = await db.issue.count({ where: { status: "DONE" } });
  return [inDefault === 0 && inDone === 1 && doneTitles === dbDone && all === dbAll, `default list has it=${inDefault}; 'Hotové' list=${doneTitles} (DB ${dbDone}); 'Všetko' list=${all} (DB ${dbAll})`];
});
await step({ j: "G", d: "Filter by owner group equals the database", pre: "issues of several groups", steps: "group 'Správa budovy' + status 'Všetko' → Filtrovať", exp: "listed = issues with ownerGroup FACILITY; the selects keep the chosen values (IT-10)" }, async () => {
  await hr.selectOption('select[name="group"]', "FACILITY"); await hr.getByRole("button", { name: "Filtrovať" }).click(); await hr.waitForURL("**group=FACILITY**");
  const titles = (await hr.locator("main#main > div > div > ul > li > h2").allInnerTexts()).sort();
  const exp = (await db.issue.findMany({ where: { ownerGroup: "FACILITY" } })).map((i) => i.title).sort();
  const sel = `${await hr.inputValue('select[name="group"]')}/${await hr.inputValue('select[name="status"]')}`;
  return [JSON.stringify(titles) === JSON.stringify(exp) && sel === "FACILITY/ALL", `listed=${titles.length}, DB=${exp.length}; selects=${sel}`];
});
await step({ j: "G", d: "Unknown filter values in the address: the list and the selects agree", pre: "issues exist", steps: "open /hr/issues?status=XYZ&group=NOPE", exp: "the list shows what the selects say (default 'Nevybavené' / 'Všetko'), or the request is refused; never 'all issues' under the label 'Nevybavené' (BUG-009)" }, async () => {
  const resp = await hr.goto(`${BASE}/hr/issues?status=XYZ&group=NOPE`, { waitUntil: "networkidle" });
  const sel = `${await hr.inputValue('select[name="group"]').catch(() => "?")}/${await hr.inputValue('select[name="status"]').catch(() => "?")}`;
  const listed = await hr.locator("main#main > div > div > ul > li > h2").count();
  const active = await db.issue.count({ where: { status: { not: "DONE" } } });
  const apiR = await hrApi("/api/hr/issues?status=XYZ");
  return [(sel === "/ACTIVE" && listed === active) || resp.status() === 400, `page HTTP ${resp.status()}; selects=${sel}; listed=${listed}; DB unresolved=${active}; API with unknown status → HTTP ${apiR.status}`];
});
const NOTES0 = await db.meetingNote.count();
await step({ j: "G", d: "Invalid note (no date) is refused with a message", pre: "HR on /hr/notes", steps: "title + text without the meeting date; Uložiť poznámku", exp: "'Vyplň názov (3 až 120 znakov), dátum stretnutia a text.'; nothing stored" }, async () => {
  await hr.goto(`${BASE}/hr/notes`, { waitUntil: "networkidle" });
  await hr.fill('input[name="title"]', "Poznámka bez dátumu QA"); await hr.fill('textarea[name="text"]', "Text bez dátumu.");
  await hr.getByRole("button", { name: "Uložiť poznámku" }).click();
  await hr.waitForTimeout(800);
  const msg = await hr.getByText("Vyplň názov (3 až 120 znakov), dátum stretnutia a text.").isVisible().catch(() => false);
  return [msg && (await db.meetingNote.count()) === NOTES0, `message=${msg}; notes ${NOTES0}→${await db.meetingNote.count()}`];
});
await step({ j: "G", d: "HR writes a note from a meeting", pre: "form filled without a date", steps: "add the date (yesterday); Uložiť poznámku", exp: "toast 'Poznámka je uložená.'; the note is in 'Uložené poznámky' with 'Stretnutie <date>'; DB row with the text (IT-10)" }, async () => {
  const d = new Date(Date.now() - DAY);
  await hr.fill('input[name="title"]', "Stretnutie s Tímom Alfa QA"); await hr.fill('input[name="meetingDate"]', ymd(d));
  await hr.fill('textarea[name="text"]', "Tím by privítal tichú miestnosť na sústredenú prácu.");
  await hr.getByRole("button", { name: "Uložiť poznámku" }).click();
  await toast(hr, "Poznámka je uložená.").waitFor({ timeout: 8000 });
  const li = hr.locator("main#main li", { has: hr.getByRole("heading", { name: "Stretnutie s Tímom Alfa QA" }) });
  await li.waitFor({ timeout: 8000 });
  const text = (await li.innerText()).replace(/\s+/g, " ");
  const n = await db.meetingNote.findFirst({ where: { title: "Stretnutie s Tímom Alfa QA" } });
  return [text.includes(`Stretnutie ${fmtDate(d)}`) && n?.text === "Tím by privítal tichú miestnosť na sústredenú prácu." && (await db.meetingNote.count()) === NOTES0 + 1, `row='${text.slice(0, 160)}'; notes ${NOTES0}→${await db.meetingNote.count()}`, await shot(hr, "m6-11-note")];
});
await step({ j: "G", d: "From a note: 'Vytvoriť podnet' prefills the source and links the issue to the note", pre: "the note exists", steps: "click 'Vytvoriť podnet' in the note; fill a title; Pridať podnet; reopen /hr/notes", exp: "form says 'Podnet z poznámky „…“.' with source 'Stretnutie'; DB issue has noteId; the note lists it under 'Podnety z tejto poznámky' with its status (IT-10)" }, async () => {
  const li = hr.locator("main#main li", { has: hr.getByRole("heading", { name: "Stretnutie s Tímom Alfa QA" }) });
  await li.getByRole("link", { name: "Vytvoriť podnet" }).click();
  await hr.waitForURL("**/hr/issues?note=*");
  await hr.locator('form#new input[name="title"]').waitFor({ state: "visible", timeout: 8000 });
  const formText = (await hr.locator("form#new").innerText()).replace(/\s+/g, " ");
  const source = await hr.inputValue('form#new select[name="source"]');
  await hr.fill('form#new input[name="title"]', "Tichá miestnosť pre Tím Alfa QA");
  await hr.locator("form#new").getByRole("button", { name: "Pridať podnet" }).click();
  await toast(hr, "Podnet je pridaný.").waitFor({ timeout: 8000 });
  const note = await db.meetingNote.findFirst({ where: { title: "Stretnutie s Tímom Alfa QA" } });
  const i = await db.issue.findFirst({ where: { title: "Tichá miestnosť pre Tím Alfa QA" } });
  await hr.goto(`${BASE}/hr/notes`, { waitUntil: "networkidle" });
  const noteText = (await hr.locator("main#main li", { has: hr.getByRole("heading", { name: "Stretnutie s Tímom Alfa QA" }) }).innerText()).replace(/\s+/g, " ");
  const ok = formText.includes("Podnet z poznámky „Stretnutie s Tímom Alfa QA“.") && source === "MEETING" && i?.noteId === note.id && i.source === "MEETING" && noteText.includes("Podnety z tejto poznámky Tichá miestnosť pre Tím Alfa QA Otvorené");
  return [ok, `form note=${formText.includes("Podnet z poznámky")}, source=${source}, db noteId ok=${i?.noteId === note.id}; note block='${noteText.slice(-110)}'`, await shot(hr, "m6-12-note-issue")];
});
await step({ j: "G", d: "Long unbroken text in an issue and a kudos does not widen the page on a 360 px phone", pre: "issue with a 300-character 'word' as description; public kudos with a 200-character link", steps: "open /hr/issues (HR) and the team page (employee) at 360×740", exp: "document width ≤ 360 on both (BUG-011)" }, async () => {
  await hrApi("/api/hr/issues", "POST", { title: "Dlhé slovo QA", description: "x".repeat(300), ownerGroup: "OTHER", source: "OTHER" });
  const to = await db.user.findUnique({ where: { email: U.alfa[1] } });
  await (await api(U.alfa[0]))("/api/kudos", "POST", { toUserId: to.id, text: `https://example.test/${"a".repeat(180)}`, value: "QUALITY", visibility: "TEAM" });
  const h = await session(U.hr, { width: 360, height: 740 }); const e = await session(U.alfa[2], { width: 360, height: 740 });
  await h.goto(`${BASE}/hr/issues`, { waitUntil: "networkidle" }); await e.goto(`${BASE}/team/${teamA.id}`, { waitUntil: "networkidle" });
  const w1 = await h.evaluate(() => document.documentElement.scrollWidth); const w2 = await e.evaluate(() => document.documentElement.scrollWidth);
  const ev = await shot(h, "m6-13-long-word-360");
  await h.context().close(); await e.context().close();
  return [w1 <= 360 && w2 <= 360, `issues page width=${w1}, team page width=${w2}`, ev];
});

// ───────────────────────── G: seed-only variants (manager tasks, plural forms, acceptance script)
resetDb(false);
const seedBeta = await db.round.findFirstOrThrow({ where: { teamId: (await teams()).B.id } });
const t2 = await teams();
await step({ j: "G", d: "Manager of a team that never had a round is asked to create the first one", pre: "seed only: Tím Alfa has no round", steps: "manager Alfa opens '/'", exp: "'Tím ešte nemal žiadny prieskum. Vytvor prvé kolo.' with 'Nové kolo' → /rounds/new (IT-11)" }, async () => {
  const m = await session(U.mgrA);
  const items = await m.locator("main#main ul[role=list] > li").evaluateAll((els) => els.map((e) => `${e.querySelector("p").textContent} [${e.querySelector("a").textContent}→${e.querySelector("a").getAttribute("href")}]`));
  await m.context().close();
  return [items.length === 1 && items[0] === "Tím ešte nemal žiadny prieskum. Vytvor prvé kolo. [Nové kolo→/rounds/new]", items.join(" || ")];
});
for (const [days, phrase, since] of [[1, "1 deň", null], [2, "2 dni", null], [5, "5 dní", null], [20, "20 dní", "pred 20 dňami"]]) {
  await step({ j: "G", d: `Manager task sentences use the right plural for ${days} day(s)`, pre: `seed Beta round's closing time shifted to ${days} day(s) ago in the QA database (time simulation)`, steps: "manager Beta opens '/'; HR opens '/'", exp: `manager: 'Kolo „…“ je uzavreté ${phrase} a tím čaká…'${since ? ` and 'Posledné kolo sa skončilo ${since} a žiadne ďalšie nebeží. Vytvor nové.'` : ""}; HR: '…Najdlhšie Tím Beta, ${phrase}.' (IT-11, BUG-015)` }, async () => {
    const at = new Date(Date.now() - days * DAY - 3600e3);
    await db.round.update({ where: { id: seedBeta.id }, data: { closedAt: at, closesAt: at } });
    const m = await session(U.mgrB); const h = await session(U.hr);
    const mt = await m.locator("main#main ul[role=list] > li p").allInnerTexts(); const ht = await h.locator("main#main ul[role=list] > li p").allInnerTexts();
    await m.context().close(); await h.context().close();
    const ok = mt.some((x) => x.includes(`je uzavreté ${phrase} a tím čaká`)) && ht.some((x) => x.endsWith(`Najdlhšie Tím Beta, ${phrase}.`)) && (!since || mt.some((x) => x === `Posledné kolo sa skončilo ${since} a žiadne ďalšie nebeží. Vytvor nové.`)) && (since || !mt.some((x) => x.includes("Posledné kolo sa skončilo")));
    return [ok, `manager: ${mt.join(" | ")} || HR: ${ht.join(" | ")}`];
  });
}
await step({ j: "G", d: "Known limitation of BUG-010: a draft with a passed deadline stays in the list and cannot be started or removed", pre: "manager Beta has a draft whose deadline was shifted to yesterday (time simulation)", steps: "open /rounds; look at the row", exp: "KNOWN (BUG-010, partly fixed): the row stays as 'Koncept' with 'Spustiť'; there is no control to edit or delete it; the 'create a round' task is not suppressed by it" }, async () => {
  const call = await api(U.mgrB);
  const id = await apiRound(call, { teamId: t2.B.id, name: "Pulse – zabudnutý koncept QA", open: false });
  await db.round.update({ where: { id }, data: { closesAt: new Date(Date.now() - DAY) } });
  const m = await session(U.mgrB);
  const tasks = await m.locator("main#main ul[role=list] > li p").allInnerTexts();
  await m.goto(`${BASE}/rounds`, { waitUntil: "networkidle" });
  const controls = await rowById(m, id).locator("a, button").allInnerTexts();
  await m.context().close();
  return [controls.join("|") === "Spustiť" && tasks.some((x) => x.includes("Posledné kolo sa skončilo")), `row controls='${controls.join("|")}'; 'create a round' task still shown=${tasks.some((x) => x.includes("Posledné kolo sa skončilo"))}`];
});
await step({ j: "A", d: "The HTTP acceptance scenario of mvp.md (steps 1–6) passes on a clean seed after the merge", pre: "clean seed", steps: "node scripts/acceptance.mjs http://localhost:3303", exp: "exit code 0, every step OK" }, async () => {
  resetDb(false);
  let out = ""; let code = 0;
  try { out = execSync(`node scripts/acceptance.mjs ${BASE}`, { cwd: PROJECT, stdio: "pipe" }).toString(); } catch (e) { code = e.status ?? 1; out = `${e.stdout ?? ""}${e.stderr ?? ""}`; }
  fs.writeFileSync(path.join(EVIDENCE, "logs", "acceptance.log"), out);
  const lines = out.trim().split(/\r?\n/);
  return [code === 0, `exit=${code}; lines=${lines.length}; last='${lines.slice(-2).join(" / ").slice(0, 300)}'`, "logs/acceptance.log"];
});
const errs = [hr, mgrA, adam].flatMap((p) => p.errors);
await step({ j: "G", d: "No uncaught JavaScript error on the HR, manager and employee pages visited in this suite", pre: "sessions above", steps: "collect 'pageerror' events", exp: "none" }, async () => [errs.length === 0, `page errors=${errs.length} ${errs.slice(0, 3).join(" | ")}`]);
await closeBrowser();
