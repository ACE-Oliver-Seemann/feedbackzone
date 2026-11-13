// Journey 6: data consistency on the demo data set (seed + scripts/demo-data.ts).
// Every number shown in the UI is recomputed independently from the database rows and
// compared; the same data is compared across roles and between UI and API.
import { BASE, U, db, resetDb, recorder, session, shot, mainText, api, sk, fmtDate, round2, closeBrowser } from "./lib.mjs";

const R = recorder("j6-consistency");
const step = async (meta, fn) => {
  try { const [ok, actual, evidence] = await fn(); return R.check({ j: "J6", ...meta }, ok, actual, evidence ?? ""); }
  catch (error) { return R.check({ j: "J6", ...meta }, false, `SCRIPT/RUNTIME ERROR: ${error.message}`); }
};
const DAY = 864e5; const MIN = 5;
resetDb(true);
const PRE = "seed + demo data (8 closed rounds, 1 open)";
const teams = await db.team.findMany({ orderBy: { name: "asc" }, include: { members: true } });
const load = () => db.round.findMany({ include: { team: true, responses: true, actions: true, participations: true, questions: { orderBy: { position: "asc" }, include: { question: true } } } });
let rounds = await load();
const lower = (scale) => scale === "OVERTIME" || scale === "FREQUENCY";
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const closedTime = (r) => (r.closedAt ?? r.closesAt).getTime();
function stats(r) {
  const n = r.responses.length;
  return r.questions.map((q) => {
    const vals = r.responses.map((x) => x[`v${q.position}`]);
    const raw = n ? mean(vals) : 0;
    return { pos: q.position, text: q.question.text, topic: q.question.topic, fixed: q.question.fixed, scale: q.question.scale, raw, avg: round2(raw), fav: lower(q.question.scale) ? 6 - raw : raw, dist: [1, 2, 3, 4, 5].map((v) => vals.filter((x) => x === v).length) };
  });
}
/** Scores computed from the raw answers (no intermediate rounding). */
function scores(r) {
  if (r.responses.length < MIN) return null;
  const s = stats(r); const topics = {};
  for (const q of s.filter((x) => !x.fixed)) (topics[q.topic] ??= []).push(q.fav);
  const fixed = s.filter((x) => x.fixed).map((x) => x.fav);
  return { fixed: fixed.length ? mean(fixed) : null, topics: Object.fromEntries(Object.entries(topics).map(([k, v]) => [k, mean(v)])) };
}
const closed = rounds.filter((r) => r.status === "CLOSED");
const byTeam = (teamId) => closed.filter((r) => r.teamId === teamId);

const hr = await session(U.hr); const hrApi = await api(U.hr);
const mgr = { [teams[0].id]: await session(U.mgrA), [teams[1].id]: await session(U.mgrB) };
const mgrApi = { [teams[0].id]: await api(U.mgrA), [teams[1].id]: await api(U.mgrB) };
const empl = { [teams[0].id]: await session(U.alfa[0], { width: 360, height: 740 }), [teams[1].id]: await session(U.beta[0], { width: 360, height: 740 }) };
const label = (r) => `${r.team.name} / ${r.name}`;

// ───── per closed round: results (manager), comments, summary+suggestions, HR view, report
for (const r of closed.sort((a, b) => closedTime(a) - closedTime(b))) {
  const s = stats(r); const n = r.responses.length; const size = teams.find((t) => t.id === r.teamId).members.length;
  const p = mgr[r.teamId];
  await p.goto(`${BASE}/rounds/${r.id}/results`);
  const cards = p.locator("section:has(h2:text-is('Otázky')) > ul > li");
  if (n >= MIN) {
    await step({ d: `Results (manager) – ${label(r)}: participation, averages and distributions`, pre: PRE, steps: "open the results page; expand the distributions; recompute from Response rows", exp: `'Odpovedalo ${n} z ${size} členov tímu'; 4 averages and 4×5 distribution counts equal the DB` }, async () => {
      const text = await mainText(p);
      const got = [];
      for (let i = 0; i < await cards.count(); i++) {
        await cards.nth(i).locator("summary").click();
        got.push({ text: await cards.nth(i).locator("h3").innerText(), avg: await cards.nth(i).locator("span.text-2xl").innerText(), dist: (await cards.nth(i).locator("details li").evaluateAll((els) => els.map((e) => Number(e.getAttribute("aria-label").match(/: (\d+)×/)[1])))) });
      }
      const ok = text.includes(`Odpovedalo ${n} z ${size} členov tímu`) && got.length === s.length && got.every((g, i) => g.text === s[i].text && g.avg === sk(s[i].avg) && g.dist.join() === s[i].dist.join() && g.dist.reduce((a, b) => a + b, 0) === n);
      return [ok, `UI avg=${got.map((g) => g.avg).join(" | ")}; DB avg=${s.map((x) => sk(x.avg)).join(" | ")}; UI dist=${JSON.stringify(got.map((g) => g.dist))}`, await shot(p, `j6-results-${r.id.slice(-6)}`)];
    });
    await step({ d: `Results (manager) – ${label(r)}: lower-is-better note only on reversed scales`, pre: PRE, steps: "read the note under each question", exp: "'Pri tejto otázke je nižšia hodnota lepšia.' exactly on questions with scale OVERTIME/FREQUENCY (IT-03)" }, async () => {
      const got = [];
      for (let i = 0; i < await cards.count(); i++) got.push((await cards.nth(i).getByText("Pri tejto otázke je nižšia hodnota lepšia.").count()) === 1);
      return [got.join() === s.map((x) => lower(x.scale)).join(), `UI=${got}; DB=${s.map((x) => lower(x.scale))}`];
    });
    await step({ d: `Results (manager) – ${label(r)}: number and set of comments`, pre: PRE, steps: "read 'Komentáre (n)' and the list; compare with Response.comment", exp: "count in the heading and the multiset of texts equal the DB" }, async () => {
      const summary = (await p.locator("details > summary", { hasText: "Komentáre" }).innerText()).trim();
      const items = (await p.locator("details:has(> summary:has-text('Komentáre')) > ul > li").allTextContents()).sort();
      const exp = r.responses.map((x) => x.comment).filter((c) => c !== null).sort();
      return [summary === `Komentáre (${exp.length})` && JSON.stringify(items) === JSON.stringify(exp), `heading='${summary}'; DB comments=${exp.length}; sets equal=${JSON.stringify(items) === JSON.stringify(exp)}`];
    });
    await step({ d: `Results (manager) – ${label(r)}: 'V skratke' and the two suggestions`, pre: PRE, steps: "recompute best/weakest question (reversed scales flipped) and the two weakest non-fixed questions from different topics", exp: "summary sentences and both 'Reaguje na otázku …' lines match (IT-09, IT-13)" }, async () => {
      const sorted = [...s].sort((a, b) => round2(lower(b.scale) ? 6 - b.avg : b.avg) - round2(lower(a.scale) ? 6 - a.avg : a.avg) || a.pos - b.pos);
      const text = await mainText(p);
      const a = `Najlepšie: „${sorted[0].text}“ (${sk(sorted[0].avg)}).`; const b = `Najslabšie: „${sorted.at(-1).text}“ (${sk(sorted.at(-1).avg)}).`;
      const f = (x) => round2(lower(x.scale) ? 6 - x.avg : x.avg);
      const cand = s.filter((x) => !x.fixed).sort((x, y) => f(x) - f(y) || x.text.localeCompare(y.text, "sk"));
      const chosen = [];
      for (const c of cand) if (chosen.length < 2 && !chosen.some((x) => x.topic === c.topic)) chosen.push(c);
      for (const c of cand) if (chosen.length < 2 && !chosen.includes(c)) chosen.push(c);
      const because = await p.locator("#kroky").getByText(/^Reaguje na otázku/).allInnerTexts();
      const expB = chosen.map((c) => `Reaguje na otázku „${c.text}“ (priemer ${sk(c.avg)}).`);
      return [text.includes(a) && text.includes(b) && JSON.stringify(because) === JSON.stringify(expB), `best ok=${text.includes(a)}, weakest ok=${text.includes(b)}; suggestions UI=${JSON.stringify(because)}; expected=${JSON.stringify(expB)}`];
    });
  } else {
    await step({ d: `Results (manager) – ${label(r)}: below the threshold`, pre: PRE, steps: "open the results page", exp: `'Nedostatok odpovedí', 'Kolo má ${n} odpovede.', participation ${n} z ${size}; no averages, comments or suggestions; no comment text in the HTML` }, async () => {
      const text = await mainText(p); const html = await p.content();
      const leak = r.responses.filter((x) => x.comment).some((x) => html.includes(x.comment.slice(0, 25)));
      return [text.includes("Nedostatok odpovedí") && text.includes(`Kolo má ${n} odpovede.`) && text.includes(`Odpovedalo ${n} z ${size} členov tímu`) && !text.includes("Priemer") && !text.includes("Návrhy krokov") && !leak, `participation ok; comment text in HTML=${leak}`, await shot(p, `j6-results-${r.id.slice(-6)}`)];
    });
  }
  await step({ d: `Results – ${label(r)}: badge 'Čaká na krok' and the action list`, pre: PRE, steps: "compare the badge and the listed actions with the Action table", exp: "badge present exactly when the round has no action; actions listed by due date with their status" }, async () => {
    const badge = await p.locator("main").getByText("Čaká na krok", { exact: true }).count();
    const topics = await p.locator("#kroky > ul > li h3").allInnerTexts();
    const values = await p.locator("#kroky > ul > li select").evaluateAll((els) => els.map((e) => e.value));
    const exp = [...r.actions].sort((a, b) => a.dueDate - b.dueDate || a.id.localeCompare(b.id));
    return [(badge === 1) === (r.actions.length === 0) && topics.join("|") === exp.map((a) => a.topic).join("|") && values.join() === exp.map((a) => a.status).join(), `badge=${badge}, DB actions=${r.actions.length}; statuses UI=${values} DB=${exp.map((a) => a.status)}`];
  });
  await step({ d: `Results – ${label(r)}: HR sees the same numbers as the manager; API equals the page`, pre: PRE, steps: "HR opens the same results page; GET /api/rounds/:id/results as HR and manager", exp: "same averages on HR's page; API averages/distributions/participation equal the DB for both roles" }, async () => {
    await hr.goto(`${BASE}/rounds/${r.id}/results`);
    const avgs = await hr.locator("section:has(h2:text-is('Otázky')) span.text-2xl").allInnerTexts();
    const a = (await hrApi(`/api/rounds/${r.id}/results`)).json; const b = (await mgrApi[r.teamId](`/api/rounds/${r.id}/results`)).json;
    const apiOk = [a, b].every((j) => j.participation.responded === n && j.participation.teamSize === size && (n >= MIN ? j.status === "ok" && j.questions.every((q, i) => q.average === s[i].avg && q.distribution.join() === s[i].dist.join()) : j.status === "insufficient_responses" && j.responseCount === n && !("questions" in j)));
    const pageOk = n >= MIN ? avgs.join() === s.map((x) => sk(x.avg)).join() : avgs.length === 0;
    return [apiOk && pageOk, `HR page averages=${avgs.join(" | ") || "(none)"}; API ok for both roles=${apiOk}`];
  });
  await step({ d: `Report – ${label(r)}: printable report equals the results`, pre: PRE, steps: "manager opens /rounds/:id/report", exp: n >= MIN ? "table rows = averages + distributions from DB; actions with status; no comments" : "'Nedostatok odpovedí', no table" }, async () => {
    await p.goto(`${BASE}/rounds/${r.id}/report`);
    const rows = await p.locator("article table tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent.trim()).join(";")));
    const text = await mainText(p); const html = await p.content();
    const leak = r.responses.filter((x) => x.comment).some((x) => html.includes(x.comment.slice(0, 25)));
    const acts = r.actions.every((a) => text.includes(`${a.topic} (${{ PLANNED: "Plánované", IN_PROGRESS: "Prebieha", DONE: "Hotové" }[a.status]})`) && text.includes(`Termín ${fmtDate(a.dueDate)}`));
    const ok = (n >= MIN ? rows.join("|") === s.map((x) => [sk(x.avg), ...x.dist].join(";")).join("|") : rows.length === 0 && text.includes("Nedostatok odpovedí")) && !leak && acts && text.includes(`Odpovedalo ${n} z ${size} členov tímu`);
    return [ok, `rows=${rows.join(" | ") || "(none)"}; actions ok=${acts}; comment leak=${leak}`, await shot(p, `j6-report-${r.id.slice(-6)}`)];
  });
}

// ───── lists
const statusLabel = { DRAFT: "Koncept", OPEN: "Otvorené", CLOSED: "Uzavreté" };
await step({ d: "HR list of rounds: every row (team, status, deadline, question count, participation, 'Čaká na krok') equals the DB, newest deadline first", pre: PRE, steps: "open /hr/rounds; compare each of the 9 rows", exp: "9 rows in closesAt-desc order with correct values (MVP-12, MVP-15)" }, async () => {
  await hr.goto(`${BASE}/hr/rounds`);
  const rows = await hr.locator("main section > ul > li").allInnerTexts();
  const exp = [...rounds].sort((a, b) => b.closesAt - a.closesAt || a.id.localeCompare(b.id));
  const bad = [];
  exp.forEach((r, i) => {
    const t = (rows[i] ?? "").replace(/\s+/g, " ");
    const want = [r.name, statusLabel[r.status], r.team.name, `Uzávierka ${fmtDate(r.closesAt)}`, `${r.questions.length} otázky`, `Účasť: ${r.participations.length} z ${teams.find((x) => x.id === r.teamId).members.length}`];
    const awaiting = r.status === "CLOSED" && r.actions.length === 0;
    if (!want.every((w) => t.includes(w)) || t.includes("Čaká na krok") !== awaiting) bad.push(`${i}: ${t}`);
  });
  return [rows.length === exp.length && bad.length === 0, `rows=${rows.length}; mismatches=${bad.length} ${bad.join(" // ").slice(0, 300)}`, await shot(hr, "j6-hr-rounds")];
});
for (const t of teams) {
  await step({ d: `Manager list of rounds (${t.name}): only the own team's rounds with correct participation and badges`, pre: PRE, steps: "manager opens /rounds", exp: "rows = rounds of the own team only; values equal the DB" }, async () => {
    const p = mgr[t.id];
    await p.goto(`${BASE}/rounds`);
    const rows = (await p.locator("main section > ul > li").allInnerTexts()).map((x) => x.replace(/\s+/g, " "));
    const exp = rounds.filter((r) => r.teamId === t.id).sort((a, b) => b.closesAt - a.closesAt || a.id.localeCompare(b.id));
    const ok = rows.length === exp.length && exp.every((r, i) => rows[i].includes(r.name) && rows[i].includes(statusLabel[r.status]) && rows[i].includes(`Účasť: ${r.participations.length} z ${t.members.length}`) && rows[i].includes("Čaká na krok") === (r.status === "CLOSED" && r.actions.length === 0));
    const api2 = (await mgrApi[t.id]("/api/rounds")).json.rounds;
    return [ok && api2.length === exp.length && api2.every((x) => x.teamId === t.id), `rows=${rows.length} (DB ${exp.length}); API rounds=${api2.length}, all own team=${api2.every((x) => x.teamId === t.id)}`];
  });
}

// ───── team pages for three roles
for (const t of teams) {
  const exp = byTeam(t.id).sort((a, b) => b.closesAt - a.closesAt || a.id.localeCompare(b.id));
  const kudos = await db.kudos.findMany({ where: { visibility: "TEAM", toUser: { teamId: t.id } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { fromUser: true, toUser: true } });
  const read = async (p) => {
    await p.goto(`${BASE}/team/${t.id}`);
    const cards = p.locator("main > div > ul > li");
    const out = [];
    for (let i = 0; i < await cards.count(); i++) out.push({ name: await cards.nth(i).locator("h2").innerText(), meta: (await cards.nth(i).locator("p").first().innerText()).trim(), avgs: await cards.nth(i).locator('span[aria-label="Priemer"]').allInnerTexts(), insufficient: await cards.nth(i).getByText("Nedostatok odpovedí – priemery sa zobrazujú až od 5 odpovedí.").count(), actions: await cards.nth(i).locator("ul h3").allInnerTexts(), text: await cards.nth(i).innerText() });
    const feed = await p.locator("section", { has: p.getByRole("heading", { name: "Kudos v tíme" }) }).locator("ul > li p.font-medium").allInnerTexts();
    return { out, feed };
  };
  const views = { employee: await read(empl[t.id]), manager: await read(mgr[t.id]), HR: await read(hr) };
  await step({ d: `Team page (${t.name}, employee, 360 px): rounds, participation, averages above the threshold, actions`, pre: PRE, steps: "open 'Môj tím'; compare every round card with the DB", exp: "closed rounds newest first; 'Odpovedalo n z 6'; averages = DB where n ≥ 5, otherwise the 'Nedostatok odpovedí' note and no numbers; actions with status (MVP-14)" }, async () => {
    const v = views.employee.out; const bad = [];
    exp.forEach((r, i) => {
      const s = stats(r); const c = v[i]; const n = r.responses.length;
      const okAvg = n >= MIN ? c?.avgs.join() === s.map((x) => sk(x.avg)).join() && c.insufficient === 0 : c?.avgs.length === 0 && c?.insufficient === 1;
      const acts = [...r.actions].sort((a, b) => a.dueDate - b.dueDate || a.id.localeCompare(b.id)).map((a) => a.topic).join("|");
      if (!c || c.name !== r.name || !c.meta.includes(`Odpovedalo ${n} z ${t.members.length}`) || !okAvg || c.actions.join("|") !== acts || r.actions.some((a) => !c.text.includes({ PLANNED: "Plánované", IN_PROGRESS: "Prebieha", DONE: "Hotové" }[a.status]))) bad.push(r.name);
    });
    return [v.length === exp.length && bad.length === 0, `cards=${v.length} (DB ${exp.length}); mismatching rounds=${bad.join(", ") || "none"}`, await shot(empl[t.id], `j6-team-${t.name.slice(-4)}-employee-360`)];
  });
  await step({ d: `Team page (${t.name}): employee, manager and HR see identical rounds, numbers and actions`, pre: PRE, steps: "compare the three renderings", exp: "identical content of the round cards and the kudos feed" }, async () => {
    const norm = (v) => JSON.stringify(v.out.map((c) => [c.name, c.meta, c.avgs, c.insufficient, c.actions])) + JSON.stringify(v.feed);
    return [norm(views.employee) === norm(views.manager) && norm(views.manager) === norm(views.HR), `employee=manager: ${norm(views.employee) === norm(views.manager)}; manager=HR: ${norm(views.manager) === norm(views.HR)}`];
  });
  await step({ d: `Team page (${t.name}): kudos feed equals the public kudos of the team's members, newest first`, pre: PRE, steps: "compare feed lines with the Kudos table (visibility TEAM, recipient in team)", exp: "same items in the same order; no private kudos" }, async () => {
    const expFeed = kudos.map((k) => `${k.fromUser.name} → ${k.toUser.name}`);
    return [JSON.stringify(views.employee.feed) === JSON.stringify(expFeed), `UI=${JSON.stringify(views.employee.feed)}; DB=${JSON.stringify(expFeed)}`];
  });
  await step({ d: `Team page (${t.name}): API summary equals the page`, pre: PRE, steps: "employee: GET /api/teams/:id/summary", exp: "same rounds, participation and averages as the DB; no comments/distributions" }, async () => {
    const a = await api(t.name === "Tím Alfa" ? U.alfa[0] : U.beta[0]);
    const j = (await a(`/api/teams/${t.id}/summary`)).json;
    const ok = j.rounds.length === exp.length && exp.every((r, i) => j.rounds[i].id === r.id && j.rounds[i].participation.responded === r.responses.length && (r.responses.length >= MIN ? j.rounds[i].results.questions.map((q) => q.average).join() === stats(r).map((x) => x.avg).join() : j.rounds[i].results.status === "insufficient_responses"));
    return [ok && !JSON.stringify(j).includes("distribution") && !JSON.stringify(j).includes('"comment'), `rounds=${j.rounds.length}; values equal=${ok}`];
  });
}

// ───── trend per team
for (const t of teams) {
  const exp = byTeam(t.id).sort((a, b) => closedTime(a) - closedTime(b) || a.id.localeCompare(b.id));
  const p = mgr[t.id];
  await p.goto(`${BASE}/team/${t.id}/trend`);
  await step({ d: `Trend (${t.name}): every table cell equals the score recomputed from raw answers`, pre: PRE, steps: "read the table 'Skóre podľa okruhov' (newest first); recompute fixed-question and topic scores per round (reversed scales flipped, 2 decimals)", exp: "row per closed round with 'Odpovedí', date of closing, fixed score and topic scores; rounds under 5 show 'Nedostatok odpovedí'; '–' where a topic was not asked (IT-08)" }, async () => {
    const head = await p.locator("table thead th").allInnerTexts();
    const rows = await p.locator("table tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("th,td")].map((c) => c.innerText.replace(/\s+/g, " ").trim())));
    const bad = [];
    [...exp].reverse().forEach((r, i) => {
      const row = rows[i]; const sc = scores(r);
      if (!row || !row[0].startsWith(r.name) || !row[0].includes(fmtDate(new Date(closedTime(r)))) || row[1] !== String(r.responses.length)) return bad.push(`${r.name}: header cells ${row?.slice(0, 2)}`);
      if (!sc) { if (row[2] !== "Nedostatok odpovedí") bad.push(`${r.name}: expected gap`); return; }
      head.slice(2).forEach((h, k) => {
        const want = h === "Stála otázka" ? (sc.fixed === null ? "–" : sk(round2(sc.fixed))) : h in sc.topics ? sk(round2(sc.topics[h])) : "–";
        if (row[2 + k] !== want) bad.push(`${r.name}/${h}: UI ${row[2 + k]} vs DB ${want}`);
      });
    });
    return [rows.length === exp.length && bad.length === 0, `rows=${rows.length}, columns=${head.length}; mismatches=${bad.join("; ") || "none"}`, await shot(p, `j6-trend-${t.name.slice(-4)}`)];
  });
  await step({ d: `Trend (${t.name}): chart points, gaps and the labelled last value`, pre: PRE, steps: "count markers and dashed gap lines in the SVG; read the value label and the tooltips", exp: "one marker per round with a value, one dashed line per round under the threshold, label = score of the last measured round, tooltips '<round> (<date>): <score>'" }, async () => {
    const withVal = exp.filter((r) => scores(r)?.fixed != null); const gaps = exp.length - withVal.length;
    const markers = await p.locator("svg circle.fill-teal-700").count();
    const dashed = await p.locator("svg line[stroke-dasharray]").count();
    const lbl = await p.locator("svg text.font-semibold").textContent();
    const titles = await p.locator("svg title").allTextContents();
    const expTitles = exp.map((r) => { const sc = scores(r); return `${r.name} (${fmtDate(new Date(closedTime(r)))}): ${sc?.fixed != null ? sk(round2(sc.fixed)) : "bez hodnoty"}`; });
    const few = await p.getByText(/Graf vychádza iba z/).count();
    return [markers === withVal.length && dashed === gaps && lbl === sk(round2(scores(withVal.at(-1)).fixed)) && JSON.stringify(titles) === JSON.stringify(expTitles) && (few === 1) === (withVal.length < 3), `markers=${markers} (exp ${withVal.length}), gaps=${dashed} (exp ${gaps}), label=${lbl}, tooltips equal=${JSON.stringify(titles) === JSON.stringify(expTitles)}, 'few rounds' notice=${few}`];
  });
  await step({ d: `Trend (${t.name}): API equals the DB and HR sees the same table`, pre: PRE, steps: "GET /api/teams/:id/trend as manager; HR opens the same page", exp: "points oldest first with responded and scores; HR table identical to the manager's" }, async () => {
    const j = (await mgrApi[t.id](`/api/teams/${t.id}/trend`)).json;
    const ok = j.points.length === exp.length && exp.every((r, i) => { const sc = scores(r); const pt = j.points[i]; return pt.roundId === r.id && pt.responded === r.responses.length && (sc ? pt.status === "ok" && pt.fixed === round2(sc.fixed) && Object.entries(sc.topics).every(([k, v]) => pt.topics[k] === round2(v)) : pt.status === "insufficient_responses"); });
    const m = await p.locator("table").innerText();
    await hr.goto(`${BASE}/team/${t.id}/trend`);
    const h = await hr.locator("table").innerText();
    return [ok && m === h, `API equal to DB=${ok}; HR table identical=${m === h}`];
  });
}

// ───── heatmap
const heat = () => {
  const now = Date.now(); const out = {};
  for (const t of teams) {
    const sc = byTeam(t.id).filter((r) => closedTime(r) >= now - 90 * DAY).map(scores).filter(Boolean);
    const cells = {};
    for (const s of sc) { if (s.fixed !== null) (cells["Stála otázka"] ??= []).push(s.fixed); for (const [k, v] of Object.entries(s.topics)) (cells[k] ??= []).push(v); }
    out[t.name] = { n: sc.length, cells: Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, mean(v)])), appCells: Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, round2(mean(v.map(round2)))])) };
  }
  return out;
};
const readHeat = async () => {
  await hr.goto(`${BASE}/hr/heatmap`);
  const head = await hr.locator("table thead th").allInnerTexts();
  const rows = await hr.locator("table tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("th,td")].map((c) => c.innerText.replace(/\s+/g, " ").trim())));
  return { head, rows };
};
await step({ d: "Comparison of teams: every cell equals the mean of round scores of the last 90 days (rounds under the threshold excluded)", pre: PRE, steps: "read the table; recompute per team and topic from raw answers", exp: "round counts ('n kolá/kôl') and all cells match to 2 decimals; '–' for topics a team was not asked (IT-08)" }, async () => {
  const { head, rows } = await readHeat(); const exp = heat(); const bad = []; const rounding = [];
  rows.forEach((row) => {
    const name = teams.find((t) => row[0].startsWith(t.name)).name; const e = exp[name];
    const plural = e.n === 1 ? "kolo" : e.n >= 2 && e.n <= 4 ? "kolá" : "kôl";
    if (row[0] !== `${name} ${e.n} ${plural}`) bad.push(`${row[0]} vs ${e.n}`);
    head.slice(1).forEach((h, k) => {
      const want = h in e.cells ? sk(round2(e.cells[h])) : "–";
      if (row[1 + k] !== want) (h in e.cells && row[1 + k] === sk(e.appCells[h]) ? rounding : bad).push(`${name}/${h}: UI ${row[1 + k]} vs exact ${want}`);
    });
  });
  return [bad.length === 0 && rounding.length === 0, `columns=${head.length}; mismatches=${bad.join("; ") || "none"}; cells that differ only through rounding of already rounded round scores=${rounding.join("; ") || "none"}`, await shot(hr, "j6-heatmap")];
});
await step({ d: "Comparison of teams: API equals the page", pre: PRE, steps: "GET /api/hr/heatmap", exp: "windowDays 90; cells equal the table" }, async () => {
  const j = (await hrApi("/api/hr/heatmap")).json; const { head, rows } = await readHeat();
  const ok = j.windowDays === 90 && JSON.stringify(j.topics) === JSON.stringify(head.slice(1)) && j.teams.every((t, i) => head.slice(1).every((h, k) => (h in t.cells ? sk(t.cells[h]) : "–") === rows[i][1 + k]));
  return [ok, `topics=${j.topics.length}; equal=${ok}`];
});
await step({ d: "Comparison of teams: a round closed 91 days ago drops out, one closed 89 days ago counts", pre: "oldest Alfa round re-dated directly in the QA DB (simulated time)", steps: "set closedAt/closesAt to now−91 d → read; set to now−89 d → read", exp: "Alfa round count 3 → 4 and cells follow the recomputation (IT-08: 'za posledných 90 dní')" }, async () => {
  const oldest = byTeam(teams[0].id).sort((a, b) => closedTime(a) - closedTime(b))[0];
  const set = async (days) => { const d = new Date(Date.now() - days * DAY); await db.round.update({ where: { id: oldest.id }, data: { closedAt: d, closesAt: d } }); rounds = await load(); closed.length = 0; closed.push(...rounds.filter((r) => r.status === "CLOSED")); };
  const check = async () => { const { head, rows } = await readHeat(); const e = heat()["Tím Alfa"]; return { n: rows[0][0], ok: rows[0][0].startsWith(`Tím Alfa ${e.n} `) && head.slice(1).every((h, k) => rows[0][1 + k] === (h in e.cells ? sk(round2(e.cells[h])) : "–")), en: e.n }; };
  await set(91); const a = await check();
  await set(89); const b = await check();
  return [a.ok && b.ok && a.en === 3 && b.en === 4, `91 days: '${a.n}' ok=${a.ok}; 89 days: '${b.n}' ok=${b.ok}`];
});

// ───── HR reaction overview
await step({ d: "Reaction overview: headline, totals and per-team figures equal the DB", pre: PRE + ", oldest Alfa round re-dated to 89 days ago", steps: "open /hr/overview, expand all 'Podrobné čísla'; recompute closed rounds, rounds with an action, share, median days to first action, actions by status, overdue, waiting rounds with days", exp: "all figures identical (IT-05)" }, async () => {
  await hr.goto(`${BASE}/hr/overview`);
  for (const s of await hr.locator("main details > summary").all()) await s.click();
  const text = await mainText(hr); const now = Date.now(); const bad = [];
  const summarize = (rs) => {
    const w = rs.filter((r) => r.actions.length > 0);
    const days = w.map((r) => Math.max(0, Math.min(...r.actions.map((a) => a.createdAt.getTime())) - closedTime(r)) / DAY).sort((a, b) => a - b);
    const med = days.length ? Math.round((days.length % 2 ? days[(days.length - 1) / 2] : (days[days.length / 2 - 1] + days[days.length / 2]) / 2) * 10) / 10 : null;
    const acts = rs.flatMap((r) => r.actions);
    return { closed: rs.length, withAction: w.length, share: rs.length ? Math.round((w.length / rs.length) * 100) : null, med, p: acts.filter((a) => a.status === "PLANNED").length, i: acts.filter((a) => a.status === "IN_PROGRESS").length, d: acts.filter((a) => a.status === "DONE").length, overdue: acts.filter((a) => a.status !== "DONE" && a.dueDate.getTime() < now).length };
  };
  const dayWord = (v) => `${v.toLocaleString("sk-SK", { maximumFractionDigits: 1 })} ${!Number.isInteger(v) ? "dňa" : v === 1 ? "deň" : v >= 2 && v <= 4 ? "dni" : "dní"}`;
  const figures = (s) => [`Uzavreté kolá ${s.closed}`, `So zapísaným krokom ${s.withAction} (${s.share} %)`, `Čas do prvého kroku ${s.med === null ? "zatiaľ žiadny krok" : dayWord(s.med)}`, `Plánované: ${s.p}, Prebieha: ${s.i}, Hotové: ${s.d}`, `Po termíne ${s.overdue}`];
  const total = summarize(closed);
  for (const f of figures(total)) if (!text.includes(f)) bad.push(`total: ${f}`);
  const waitingAll = [];
  for (const t of teams) {
    const s = summarize(byTeam(t.id));
    const card = (await hr.locator("main ul > li", { has: hr.getByRole("link", { name: t.name, exact: true }) }).first().innerText()).replace(/\s+/g, " ");
    for (const f of [`Krok má ${s.withAction} z ${s.closed} uzavretých kôl.`, ...figures(s)]) if (!card.includes(f)) bad.push(`${t.name}: ${f}`);
    for (const r of byTeam(t.id).filter((x) => x.actions.length === 0)) { const d = Math.max(0, Math.floor((now - closedTime(r)) / DAY)); waitingAll.push({ team: t.name, d }); if (!card.includes(`${r.name} (uzavreté pred ${d} ${d === 1 ? "dňom" : "dňami"})`)) bad.push(`${t.name}: waiting ${r.name} ${d}`); }
  }
  waitingAll.sort((a, b) => b.d - a.d);
  const head = `${waitingAll.length} z ${total.closed} uzavretých kôl ${waitingAll.length === 1 ? "čaká" : "čakajú"} na krok. Najdlhšie ${waitingAll[0].team}, ${waitingAll[0].d === 1 ? "1 deň" : `${waitingAll[0].d} dní`}.`;
  if (!text.includes(head)) bad.push(`headline: ${head}`);
  return [bad.length === 0, `headline expected='${head}'; mismatches=${bad.join(" | ") || "none"}`, await shot(hr, "j6-hr-overview")];
});
await step({ d: "Reaction overview: API equals the page figures", pre: PRE, steps: "GET /api/hr/overview", exp: "total.closedRounds, roundsWithAction and awaitingRounds per team equal the DB" }, async () => {
  const j = (await hrApi("/api/hr/overview")).json;
  const ok = j.total.closedRounds === closed.length && j.total.roundsWithAction === closed.filter((r) => r.actions.length).length && j.teams.every((t) => t.awaitingRounds.length === byTeam(t.teamId).filter((r) => r.actions.length === 0).length && t.closedRounds === byTeam(t.teamId).length);
  return [ok, `closed=${j.total.closedRounds}, withAction=${j.total.roundsWithAction}, awaiting=${j.teams.map((t) => t.awaitingRounds.length)}`];
});

// ───── home tasks for every user
const T = {
  fill: (name, q) => `Čaká na teba prieskum „${name}“. Má ${q} ${q >= 5 ? "otázok" : "otázky"} a zaberie asi 2 minúty.`,
  awaiting: (name, d) => `Kolo „${name}“ je uzavreté ${d === 0 ? "od dnes" : d === 1 ? "1 deň" : `${d} dní`} a tím čaká, čo sa s výsledkami stane. Pozri výsledky a zapíš krok.`,
  overdue: (c) => `${c === 1 ? "1 krok je" : c >= 2 && c <= 4 ? `${c} kroky sú` : `${c} krokov je`} po termíne. Dokonči ${c === 1 ? "ho" : "ich"} alebo uprav stav.`,
  hrAwaiting: (c, team, d) => `${c === 1 ? "1 uzavreté kolo čaká" : c >= 2 && c <= 4 ? `${c} uzavreté kolá čakajú` : `${c} uzavretých kôl čaká`} na krok manažéra. Najdlhšie ${team}, ${d === 1 ? "1 deň" : `${d} dní`}.`,
  issues: (c) => `${c === 1 ? "1 podnet je" : c >= 2 && c <= 4 ? `${c} podnety sú` : `${c} podnetov je`} po termíne.`,
};
const fillTasks = (user) => rounds.filter((r) => r.teamId === user.teamId && r.status === "OPEN" && !r.participations.some((p) => p.userId === user.id)).sort((a, b) => a.closesAt - b.closesAt || a.id.localeCompare(b.id)).map((r) => T.fill(r.name, r.questions.length));
const allUsers = await db.user.findMany();
for (const [email, page] of [[U.hr, hr], [U.mgrA, mgr[teams[0].id]], [U.mgrB, mgr[teams[1].id]], [U.alfa[0], empl[teams[0].id]], [U.beta[0], empl[teams[1].id]]]) {
  const user = allUsers.find((u) => u.email === email);
  await step({ d: `Home tasks of ${user.name} (${user.role}) equal the state of rounds, actions and issues in the DB`, pre: PRE, steps: "open '/'; rebuild the expected task list (max 3, by urgency) from the DB", exp: "identical sentences in identical order; 'Nič nečaká.' when the list is empty (IT-11)" }, async () => {
    const now = Date.now(); let exp = [];
    if (user.role === "HR") {
      const aw = closed.filter((r) => r.actions.length === 0);
      if (aw.length) { const l = aw.reduce((a, b) => (closedTime(a) <= closedTime(b) ? a : b)); exp.push(T.hrAwaiting(aw.length, l.team.name, Math.floor((now - closedTime(l)) / DAY))); }
      const io = await db.issue.count({ where: { status: { not: "DONE" }, dueDate: { lt: new Date(now) } } });
      if (io) exp.push(T.issues(io));
      for (const r of rounds.filter((x) => x.status === "OPEN" && x.closesAt.getTime() < now + 3 * DAY).sort((a, b) => a.closesAt - b.closesAt)) { const size = teams.find((t) => t.id === r.teamId).members.length; if (r.participations.length * 2 < size) exp.push("low participation"); }
    } else if (user.role === "MANAGER") {
      const mine = rounds.filter((r) => r.teamId === user.teamId);
      mine.filter((r) => r.status === "CLOSED" && r.actions.length === 0).sort((a, b) => closedTime(a) - closedTime(b)).forEach((r) => exp.push(T.awaiting(r.name, Math.floor((now - closedTime(r)) / DAY))));
      const od = mine.flatMap((r) => r.actions).filter((a) => a.status !== "DONE" && a.dueDate.getTime() < now).length;
      if (od) exp.push(T.overdue(od));
      exp.push(...fillTasks(user));
      if (!mine.some((r) => ["OPEN", "DRAFT"].includes(r.status))) {
        const cl = mine.filter((r) => r.status === "CLOSED");
        const since = cl.length ? Math.floor((now - Math.max(...cl.map(closedTime))) / DAY) : null;
        if (since === null) exp.push("Tím ešte nemal žiadny prieskum. Vytvor prvé kolo.");
        else if (since >= 14) exp.push(`Posledné kolo sa skončilo pred ${since} dňami a žiadne ďalšie nebeží. Vytvor nové.`);
      }
    } else exp = fillTasks(user);
    exp = exp.slice(0, 3);
    await page.goto(`${BASE}/`);
    const got = await page.locator("main ol > li p").allInnerTexts();
    const nothing = await page.getByText("Nič nečaká.").count();
    return [JSON.stringify(got) === JSON.stringify(exp) && (nothing === 1) === (exp.length === 0), `UI=${JSON.stringify(got)}; expected=${JSON.stringify(exp)}`, await shot(page, `j6-home-${user.role}-${user.name.split(" ")[0]}`)];
  });
}
await step({ d: "Home of an employee with nothing to do", pre: "Beta has no open round", steps: "Filip opens '/'", exp: "'Nič nečaká. Momentálne nemáš žiadny prieskum na vyplnenie. …' and no survey list" }, async () => {
  const p = empl[teams[1].id];
  await p.goto(`${BASE}/`);
  const text = await mainText(p);
  return [text.includes("Nič nečaká. Momentálne nemáš žiadny prieskum na vyplnenie.") && !text.includes("Moje prieskumy"), text.slice(-200)];
});

// ───── kudos lists
await step({ d: "'Moje kudos' of every user equals the Kudos table (13 users)", pre: PRE, steps: "GET /api/kudos/me for all 13 accounts; compare with rows where toUserId = user", exp: "same ids in createdAt-desc order for every user; private ones only for their recipient" }, async () => {
  const bad = [];
  for (const u of allUsers) {
    const j = (await (await api(u.email))("/api/kudos/me")).json.kudos.map((k) => k.id).join();
    const e = (await db.kudos.findMany({ where: { toUserId: u.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] })).map((k) => k.id).join();
    if (j !== e) bad.push(u.name);
  }
  return [bad.length === 0, `users checked=${allUsers.length}; mismatches=${bad.join(", ") || "none"}`];
});
await step({ d: "'Moje kudos' page of a recipient shows the DB rows with sender, value and visibility", pre: PRE, steps: "open /kudos/me as the user who received most kudos", exp: "cards equal the rows" }, async () => {
  const top = (await db.kudos.groupBy({ by: ["toUserId"], _count: true })).sort((a, b) => b._count - a._count)[0];
  const u = allUsers.find((x) => x.id === top.toUserId);
  const rows = await db.kudos.findMany({ where: { toUserId: u.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { fromUser: true } });
  const p = await session(u.email);
  await p.goto(`${BASE}/kudos/me`);
  const cards = (await p.locator("main ul > li").allInnerTexts()).map((x) => x.replace(/\s+/g, " "));
  const ok = cards.length === rows.length && rows.every((k, i) => cards[i].includes(`Od: ${k.fromUser.name}`) && cards[i].includes(k.visibility === "TEAM" ? "Verejné v tíme" : "Súkromné") && (!k.text || cards[i].includes(k.text.slice(0, 30))) && cards[i].includes(fmtDate(k.createdAt)));
  const s = await shot(p, "j6-my-kudos");
  await p.context().close();
  return [ok, `${u.name}: cards=${cards.length}, DB=${rows.length}`, s];
});

// ───── open round in the demo
const open = rounds.find((r) => r.status === "OPEN");
await step({ d: "Open demo round: results page and API show participation only", pre: PRE, steps: "manager opens results of the open round; GET results", exp: "'Odpovedalo 0 z 6 členov tímu' and the notice; API not_closed; no report link" }, async () => {
  const p = mgr[open.teamId];
  await p.goto(`${BASE}/rounds/${open.id}/results`);
  const text = await mainText(p);
  const j = (await mgrApi[open.teamId](`/api/rounds/${open.id}/results`)).json;
  return [text.includes(`Odpovedalo ${open.participations.length} z 6 členov tímu`) && text.includes("Výsledky sa zobrazia až po uzavretí kola.") && j.status === "not_closed" && !text.includes("Report na tlač"), `participation=${open.participations.length}; api=${j.status}`];
});
await step({ d: "New-round defaults on the demo data: the 3 preselected questions are the recommended ones the team has not had for the longest time", pre: PRE, steps: "manager Alfa opens /rounds/new; recompute least-recently-used starter questions (one per topic) from RoundQuestion", exp: "the same 3 questions are ticked (IT-13)" }, async () => {
  const p = mgr[teams[0].id];
  await p.goto(`${BASE}/rounds/new`);
  const ticked = (await p.locator('label:has(input[type="checkbox"]:checked) span.flex-1').allInnerTexts()).map((t) => t.replace(/\s*Odporúčaná\s*$/, "").trim()).sort();
  const starters = await db.question.findMany({ where: { starter: true, fixed: false, teamId: null }, orderBy: [{ topic: "asc" }, { text: "asc" }] });
  const last = new Map();
  for (const r of rounds.filter((x) => x.teamId === teams[0].id)) for (const q of r.questions) last.set(q.questionId, Math.max(last.get(q.questionId) ?? 0, r.closesAt.getTime()));
  const cand = [...starters].sort((a, b) => (last.get(a.id) ?? 0) - (last.get(b.id) ?? 0));
  const pick = [];
  for (const q of cand) if (pick.length < 3 && !pick.some((x) => x.topic === q.topic)) pick.push(q);
  const exp = pick.map((q) => q.text).sort();
  return [JSON.stringify(ticked) === JSON.stringify(exp), `UI=${JSON.stringify(ticked)}; expected=${JSON.stringify(exp)}`];
});

console.log(`\nJ6 done: ${R.rows.length} checks, ${R.rows.filter((r) => r.status === "FAIL").length} failed`);
await closeBrowser();
