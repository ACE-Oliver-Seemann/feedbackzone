// Journey 9: confidentiality end to end (NFR-01, NFR-02). After full cycles with a known
// ground truth (who submitted what, in which order), try to recover the authorship from
// everything a manager, HR or someone with read access to the database can see.
import fs from "node:fs";
import path from "node:path";
import { BASE, PROJECT, U, db, resetDb, recorder, session, shot, mainText, api, ymd, closeBrowser } from "./lib.mjs";

const R = recorder("j9-confidentiality");
const step = async (meta, fn) => {
  try { const [ok, actual, evidence] = await fn(); return R.check({ j: "J9", ...meta }, ok, actual, evidence ?? ""); }
  catch (error) { return R.check({ j: "J9", ...meta }, false, `SCRIPT/RUNTIME ERROR: ${error.message}`); }
};
resetDb(false);
const teamA = await db.team.findFirstOrThrow({ where: { name: "Tím Alfa" } });
const hrApi = await api(U.hr); const mgrApi = await api(U.mgrA);
const members = [...U.alfa, U.mgrA];
const sessions = await Promise.all(members.map((e) => api(e)));
const users = await Promise.all(members.map((e) => db.user.findUniqueOrThrow({ where: { email: e } })));
const qs = (await hrApi("/api/questions")).json.questions.filter((q) => !q.fixed).slice(0, 3).map((q) => q.id);
const mk = async (name) => { const c = await hrApi("/api/rounds", "POST", { name, teamId: teamA.id, closesAt: ymd(new Date(Date.now() + 7 * 864e5)), questionIds: qs }); await hrApi(`/api/rounds/${c.json.round.id}/open`, "POST"); return c.json.round.id; };

// Ground truth: member i always answers with a vector that is unique to them, so that
// the tester (and only the tester) knows which stored row belongs to whom.
const VEC = [[1, 1, 1, 1], [2, 2, 2, 2], [3, 3, 3, 3], [4, 4, 4, 4], [5, 5, 5, 5], [1, 2, 3, 4]];
const ROUNDS = 6;
const truth = []; // per round: submission order (member indexes)
const counterSeen = [];
for (let n = 0; n < ROUNDS; n++) {
  const id = await mk(`QA dôvernosť ${n + 1}`);
  const order = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);
  const seen = [];
  for (const i of order) {
    const res = await sessions[i](`/api/rounds/${id}/responses`, "POST", { answers: VEC[i], comment: `QA komentár člena ${i + 1} v kole ${n + 1}` });
    if (res.status !== 201) throw new Error(`submit failed ${res.status}`);
    if (n === 0) { truth.firstBody = truth.firstBody ?? res.text; seen.push((await mgrApi("/api/rounds")).json.rounds.find((r) => r.id === id).participation.responded); }
  }
  if (n === 0) counterSeen.push(...seen);
  truth.push({ id, order });
}
const evidenceFile = path.join(PROJECT, "testing/reports/2026-11-12_001/evidence/integration/j9-db-dump.txt");
const dump = [];

await step({ d: "Response table has no user column, no time column, and no hidden rowid", pre: "QA database after 36 submissions", steps: "PRAGMA table_info(Response); SELECT rowid FROM Response; read sqlite_master", exp: "columns exactly id, roundId, teamId, v1..v5, comment; table is WITHOUT ROWID so 'SELECT rowid' fails (NFR-01)" }, async () => {
  const cols = (await db.$queryRawUnsafe(`PRAGMA table_info("Response")`)).map((c) => c.name).join(",");
  let rowid = "selectable";
  try { await db.$queryRawUnsafe(`SELECT rowid FROM "Response" LIMIT 1`); } catch { rowid = "no such column"; }
  const sql = (await db.$queryRawUnsafe(`SELECT sql FROM sqlite_master WHERE name='Response'`))[0].sql;
  dump.push(`Response columns: ${cols}`, `SELECT rowid FROM Response → ${rowid}`);
  return [cols === "id,roundId,teamId,v1,v2,v3,v4,v5,comment" && rowid === "no such column" && /WITHOUT ROWID/i.test(sql), `columns=${cols}; rowid=${rowid}; WITHOUT ROWID=${/WITHOUT ROWID/i.test(sql)}`];
});
await step({ d: "Participation table holds only round and user", pre: "-", steps: "PRAGMA table_info(Participation); SELECT rowid", exp: "columns exactly roundId, userId; no rowid; no timestamp (NFR-01)" }, async () => {
  const cols = (await db.$queryRawUnsafe(`PRAGMA table_info("Participation")`)).map((c) => c.name).join(",");
  let rowid = "selectable";
  try { await db.$queryRawUnsafe(`SELECT rowid FROM "Participation" LIMIT 1`); } catch { rowid = "no such column"; }
  dump.push(`Participation columns: ${cols}`, `SELECT rowid FROM Participation → ${rowid}`);
  return [cols === "roundId,userId" && rowid === "no such column", `columns=${cols}; rowid=${rowid}`];
});
await step({ d: "No other table, trigger or index links a response to a person or a time", pre: "-", steps: "list all tables, triggers and indexes; look for columns referring to Response or carrying both a user and answer values", exp: "no trigger; no table with a responseId column; only index on Response is roundId" }, async () => {
  const objs = await db.$queryRawUnsafe(`SELECT type, name, tbl_name FROM sqlite_master WHERE name NOT LIKE '_prisma%' ORDER BY type, name`);
  const triggers = objs.filter((o) => o.type === "trigger").length;
  const tables = objs.filter((o) => o.type === "table").map((o) => o.name);
  let responseRefs = 0;
  for (const t of tables) { const cols = await db.$queryRawUnsafe(`PRAGMA table_info("${t}")`); if (t !== "Response" && cols.some((c) => /response/i.test(c.name))) responseRefs++; }
  const idx = objs.filter((o) => o.type === "index" && o.tbl_name === "Response").map((o) => o.name);
  dump.push(`tables: ${tables.join(", ")}`, `triggers: ${triggers}`, `indexes on Response: ${idx.join(", ")}`);
  return [triggers === 0 && responseRefs === 0, `tables=${tables.join(",")}; triggers=${triggers}; tables referencing a response=${responseRefs}; Response indexes=${idx.join(",")}`];
});
await step({ d: "Response ids are random UUIDs (version 4), not sequential", pre: "36 responses", steps: "check the format of every id", exp: "all match the UUID v4 pattern (data model: 'id je UUID, nie poradové číslo')" }, async () => {
  const ids = (await db.response.findMany({ select: { id: true } })).map((r) => r.id);
  const v4 = ids.filter((i) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(i)).length;
  return [v4 === ids.length && ids.length >= 36, `${v4} of ${ids.length} ids are UUID v4, e.g. ${ids[0]}`];
});
await step({ d: "Order of Response rows in the database does not reveal the order of submission", pre: "6 rounds × 6 members submitted one after another in a known random order, each member with a unique answer vector (ground truth known only to the test)", steps: "for each round read rows in storage (primary key) order and compare with the submission order; compute rank correlation over all 36 rows", exp: "no round where storage order equals submission order or its reverse; |Spearman ρ| small (no systematic relation)" }, async () => {
  let equal = 0; const pairs = [];
  for (const { id, order } of truth) {
    const rows = await db.$queryRawUnsafe(`SELECT id, v1, v2, v3, v4 FROM "Response" WHERE roundId = ?`, id);
    const who = rows.map((r) => VEC.findIndex((v) => v.join() === [r.v1, r.v2, r.v3, r.v4].join()));
    const storage = who.join(""); const submit = order.join("");
    if (storage === submit || storage === [...order].reverse().join("")) equal++;
    who.forEach((member, storageRank) => pairs.push([storageRank, order.indexOf(member)]));
    dump.push(`round ${id}: submission order (member #) ${submit} | storage order ${storage}`);
  }
  const n = pairs.length; const d2 = pairs.reduce((s, [a, b]) => s + (a - b) ** 2, 0);
  // Spearman within-round ranks pooled (ranks 0..5 in both variables)
  const meanRank = 2.5; const varRank = pairs.reduce((s, [a]) => s + (a - meanRank) ** 2, 0);
  const cov = pairs.reduce((s, [a, b]) => s + (a - meanRank) * (b - meanRank), 0);
  const rho = cov / varRank;
  return [equal === 0 && Math.abs(rho) < 0.45, `rounds where storage order = submission order (or reverse): ${equal} of ${ROUNDS}; pooled rank correlation ρ=${rho.toFixed(2)} (n=${n}, Σd²=${d2})`, "j9-db-dump.txt"];
});
await step({ d: "Order of Participation rows does not reveal the order of submission either", pre: "as above", steps: "read Participation rows per round in storage order", exp: "identical order (by userId) in every round although the submission order differed" }, async () => {
  const orders = new Set();
  for (const { id } of truth) {
    const rows = await db.$queryRawUnsafe(`SELECT userId FROM "Participation" WHERE roundId = ?`, id);
    orders.add(rows.map((r) => users.findIndex((u) => u.id === r.userId)).join(""));
  }
  dump.push(`participation storage orders over ${ROUNDS} rounds: ${[...orders].join(" / ")}`);
  return [orders.size === 1, `distinct storage orders across rounds=${orders.size} (${[...orders].join(", ")}); submission orders were ${truth.map((t) => t.order.join("")).join(", ")}`];
});
await step({ d: "Every round has as many participations as responses (who and what are written together)", pre: "all rounds in the QA DB", steps: "compare counts per round", exp: "equal for every round" }, async () => {
  const rounds = await db.round.findMany({ include: { _count: { select: { participations: true, responses: true } } } });
  const bad = rounds.filter((r) => r._count.participations !== r._count.responses);
  return [bad.length === 0, `${rounds.length} rounds checked; mismatches=${bad.length}`];
});
await step({ d: "The reply to a submission carries no response id", pre: "first submission of this journey", steps: "read the body of POST /api/rounds/:id/responses", exp: "no UUID and no answer echo" }, async () => {
  const body = truth.firstBody;
  return [!/[0-9a-f]{8}-[0-9a-f]{4}-/.test(body) && !body.includes("answers"), `body=${body}`];
});

// close all rounds; collect everything a manager and HR can request
for (const { id } of truth) await mgrApi(`/api/rounds/${id}/close`, "POST");
const rid = truth[0].id;
const responseIds = (await db.response.findMany({ select: { id: true } })).map((r) => r.id);
const employees = users.slice(0, 5);
const scan = (text) => ({
  ids: employees.filter((u) => text.includes(u.id)).length,
  emails: employees.filter((u) => text.includes(u.email)).length,
  names: employees.filter((u) => text.includes(u.name)).length,
  rids: responseIds.filter((i) => text.includes(i)).length,
});
await step({ d: "No API response available to the manager contains user ids, e-mails, names or response ids", pre: "6 closed rounds above the threshold", steps: "manager: GET /api/rounds, results, suggestions (all 6 rounds), team summary, team trend, /api/me, /api/questions; search the bodies", exp: "0 employee ids, 0 e-mails, 0 employee names, 0 response ids (API section of mvp.md, NFR-01)" }, async () => {
  let all = (await mgrApi("/api/rounds")).text + (await mgrApi(`/api/teams/${teamA.id}/summary`)).text + (await mgrApi(`/api/teams/${teamA.id}/trend`)).text + (await mgrApi("/api/questions")).text;
  for (const { id } of truth) all += (await mgrApi(`/api/rounds/${id}/results`)).text + (await mgrApi(`/api/rounds/${id}/suggestions`)).text + (await mgrApi(`/api/rounds/${id}`)).text;
  const s = scan(all);
  return [s.ids + s.emails + s.names + s.rids === 0, `scanned ${all.length} bytes: user ids=${s.ids}, e-mails=${s.emails}, names=${s.names}, response ids=${s.rids}`];
});
await step({ d: "No API response available to HR contains user ids, e-mails or response ids of respondents", pre: "as above", steps: "HR: GET /api/rounds, results + suggestions of all rounds, summaries, trends, overview, heatmap, issues, notes", exp: "0 employee ids, 0 e-mails, 0 response ids; names only where kudos are signed (none here)" }, async () => {
  let all = (await hrApi("/api/rounds")).text + (await hrApi(`/api/teams/${teamA.id}/summary`)).text + (await hrApi(`/api/teams/${teamA.id}/trend`)).text + (await hrApi("/api/hr/overview")).text + (await hrApi("/api/hr/heatmap")).text + (await hrApi("/api/hr/issues")).text + (await hrApi("/api/hr/notes")).text;
  for (const { id } of truth) all += (await hrApi(`/api/rounds/${id}/results`)).text + (await hrApi(`/api/rounds/${id}/suggestions`)).text;
  const s = scan(all);
  return [s.ids + s.emails + s.names + s.rids === 0, `scanned ${all.length} bytes: user ids=${s.ids}, e-mails=${s.emails}, names=${s.names}, response ids=${s.rids}`];
});
const mgr = await session(U.mgrA);
await step({ d: "Pages of the manager (results, report, team page, trend, round list, home) carry no respondent identity, also not in the embedded page data", pre: "as above", steps: "load the six pages; search the complete HTML including inline scripts", exp: "no employee id/e-mail, no response id, no per-response rows ('\"v1\"'); employee names absent" }, async () => {
  let all = "";
  for (const p of [`/rounds/${rid}/results`, `/rounds/${rid}/report`, `/team/${teamA.id}`, `/team/${teamA.id}/trend`, "/rounds", "/"]) { await mgr.goto(`${BASE}${p}`); all += await mgr.content(); }
  const s = scan(all);
  const raw = /"v1"|\\"v1\\"/.test(all);
  return [s.ids + s.emails + s.names + s.rids === 0 && !raw, `scanned ${all.length} bytes: user ids=${s.ids}, e-mails=${s.emails}, names=${s.names}, response ids=${s.rids}, raw answer rows=${raw}`, await shot(mgr, "j9-01-mgr-home")];
});
await step({ d: "There is no endpoint that lists who has answered", pre: "manager and HR sessions", steps: "GET guessed endpoints: /api/rounds/:id/participations, /participation, /responses, /api/participations, /api/responses, /api/users, /api/teams/:id/members", exp: "404/405 for all; 'kto odpovedal' is not available to anyone (matrix: 'Zistiť autora odpovede – nikto')" }, async () => {
  const out = [];
  for (const p of [`/api/rounds/${rid}/participations`, `/api/rounds/${rid}/participation`, `/api/rounds/${rid}/responses`, "/api/participations", "/api/responses", "/api/users", `/api/teams/${teamA.id}/members`, `/api/teams/${teamA.id}`]) {
    const a = await mgrApi(p); const b = await hrApi(p);
    out.push(`${p.replace(rid, ":id").replace(teamA.id, ":team")}=${a.status}/${b.status}`);
  }
  return [out.every((o) => /=(404|405)\/(404|405)$/.test(o)), out.join("; ")];
});
await step({ d: "Round list of the manager says only whether the manager answered, never who else did", pre: "-", steps: "inspect the JSON keys of GET /api/rounds for the manager", exp: "per round: submitted (own), participation {responded, teamSize}; no list of people" }, async () => {
  const r = (await mgrApi("/api/rounds")).json.rounds[0];
  const keys = Object.keys(r).sort().join();
  return [keys === "awaitingAction,closesAt,id,name,participation,questionCount,status,submitted,teamId,teamName" && Object.keys(r.participation).sort().join() === "responded,teamSize", `keys=${keys}`];
});
await step({ d: "Comments come back in a different order on every request and not in submission order", pre: "round 1: 6 comments submitted in a known order", steps: "GET results 25×; record the orders", exp: "several distinct orders; the first-submitted comment is not always first (MVP-10 'v náhodnom poradí')" }, async () => {
  const orders = new Set(); let firstIsFirst = 0;
  const firstMember = truth[0].order[0] + 1;
  for (let i = 0; i < 25; i++) { const c = (await mgrApi(`/api/rounds/${rid}/results`)).json.comments; orders.add(c.map((x) => x.match(/člena (\d)/)[1]).join("")); if (c[0].includes(`člena ${firstMember} `)) firstIsFirst++; }
  return [orders.size >= 10 && firstIsFirst < 15, `distinct orders in 25 requests=${orders.size}; first-submitted comment shown first ${firstIsFirst}×`];
});
await step({ d: "The results page also shuffles comments on every load", pre: "-", steps: "load the results page 6×, read the comment list", exp: "more than one order" }, async () => {
  const orders = new Set();
  for (let i = 0; i < 6; i++) { await mgr.goto(`${BASE}/rounds/${rid}/results`); orders.add((await mgr.locator("details:has(> summary:has-text('Komentáre')) > ul > li").allTextContents()).map((x) => x.match(/člena (\d)/)[1]).join("")); }
  return [orders.size > 1, `distinct orders in 6 loads=${orders.size}: ${[...orders].join(", ")}`];
});
await step({ d: "Timing channel: what the manager can observe while a round is open", pre: "round 1; the manager polled GET /api/rounds after every single submission", steps: "compare the observed counter with the submissions", exp: "only the running count is visible (1,2,…,6); no answer data before closing (MVP-10). The live count is by design; see potential risk R-2" }, async () => {
  return [counterSeen.join() === "1,2,3,4,5,6", `counter seen after each submission=${counterSeen.join(",")} — a manager who watches the counter and knows who is at the keyboard learns WHO answered WHEN, but no content is available until the round is closed`];
});
await step({ d: "Aggregates cannot be queried for a subset of responses", pre: "closed round", steps: "GET results with query parameters (?limit=1, ?userId=…, ?offset=5, ?position=1)", exp: "parameters are ignored: same aggregate over all responses" }, async () => {
  const base = (await mgrApi(`/api/rounds/${rid}/results`)).json;
  const out = [];
  for (const q of ["?limit=1", `?userId=${users[0].id}`, "?offset=5", "?position=1", "?min=1"]) { const j = (await mgrApi(`/api/rounds/${rid}/results${q}`)).json; out.push(JSON.stringify(j.questions) === JSON.stringify(base.questions) && j.responseCount === base.responseCount); }
  return [out.every(Boolean), `identical aggregates for 5 parameter variants=${out}`];
});
await step({ d: "Differencing with the manager's own answer: threshold of 5 reached by 4 employees + the manager", pre: "new round answered by exactly 4 employees and the manager, closed", steps: "manager opens results; subtracts the own answers from the sums", exp: "results are shown (5 responses, per MVP-11). Observation for the risk register: the manager can compute the exact sum of the 4 employees, i.e. a group smaller than 5" }, async () => {
  const id = await mk("QA 4 + manažér");
  for (const i of [0, 1, 2, 3, 5]) await sessions[i](`/api/rounds/${id}/responses`, "POST", { answers: VEC[i] });
  await mgrApi(`/api/rounds/${id}/close`, "POST");
  const j = (await mgrApi(`/api/rounds/${id}/results`)).json;
  const others = j.questions.map((q, k) => Math.round(q.average * 5) - VEC[5][k]);
  const real = [0, 1, 2, 3].reduce((s, i) => s.map((v, k) => v + VEC[i][k]), [0, 0, 0, 0]);
  return [j.status === "ok" && j.responseCount === 5, `status=${j.status}; sums of the 4 employees derived by the manager=${others} (true sums=${real}); average of 4 people per question=${others.map((x) => x / 4)}`];
});
await step({ d: "Unanimous answers: what a manager learns when everyone gives the same value", pre: "-", steps: "reasoning check on the distribution of a round where all five picked the same value", exp: "inherent to aggregates (not a defect): the distribution [0,0,5,0,0] tells the answer of every respondent" }, async () => {
  const id = await mk("QA jednohlasné");
  for (const i of [0, 1, 2, 3, 4]) await sessions[i](`/api/rounds/${id}/responses`, "POST", { answers: [3, 3, 3, 3] });
  await mgrApi(`/api/rounds/${id}/close`, "POST");
  const j = (await mgrApi(`/api/rounds/${id}/results`)).json;
  return [j.questions[0].distribution.join() === "0,0,5,0,0", `distribution=${j.questions[0].distribution} — informational only`];
});
await step({ d: "An employee cannot read back any stored answer, not even the own one", pre: "Adam answered all rounds", steps: "Adam: GET /api/rounds/:id (closed round), GET /api/rounds, GET summary", exp: "no answer values of individuals; only 'submitted' and team averages" }, async () => {
  const a = sessions[0];
  const t = (await a(`/api/rounds/${rid}`)).text + (await a("/api/rounds")).text + (await a(`/api/teams/${teamA.id}/summary`)).text;
  return [!/"v1"|answers|comment/.test(t) && scan(t).rids === 0, `scanned ${t.length} bytes; contains 'answers'/'comment'/'v1'=${/"v1"|answers|comment/.test(t)}`];
});
await step({ d: "SQLite side files next to the QA database", pre: "-", steps: "list prisma/qa-e2e.db*", exp: "informational: a write-ahead log or journal would keep recent inserts in write order" }, async () => {
  const files = fs.readdirSync(path.join(PROJECT, "prisma")).filter((f) => f.startsWith("qa-e2e.db"));
  const mode = (await db.$queryRawUnsafe(`PRAGMA journal_mode`))[0].journal_mode;
  dump.push(`files: ${files.join(", ")}; journal_mode=${mode}`);
  return [true, `files=${files.join(", ")}; journal_mode=${mode}`];
});
await step({ d: "Server log does not contain the body of a response (NFR-01)", pre: "-", steps: "would require reading stdout/stderr of the QA server process on :3303", exp: "log lines contain method, path and error class only" }, async () => ["BLOCKED", "Not executable from this agent: the server on :3303 was started by the coordinator and its console output is not available to me. Not verified at runtime."]);

fs.writeFileSync(evidenceFile, dump.join("\n"));
console.log(`\nJ9 done: ${R.rows.length} checks, ${R.rows.filter((r) => r.status === "FAIL").length} failed`);
await closeBrowser();
