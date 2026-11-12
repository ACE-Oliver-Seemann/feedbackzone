// Suite 7: question library and own questions (MVP-04, IT-03, IT-04, IT-07),
// HR issues, notes and overview (IT-05, IT-10), home tasks (IT-11).
import { closeR, ctx, dateStr, db, is, keysOf, mkOpenRound, req, reset, suite, t } from "./lib.mjs";

export default async function run() {
  suite("S7 Question library, own questions, HR issues/notes/overview, home tasks", "fresh seed + demo data");
  await reset(true);
  const field = (r, f, code) => r.status === 400 && r.json?.fields?.[f] === code;
  const Q = (body, as = "mA") => req("POST", "/api/questions", { as, body });
  const list = async (as) => (await req("GET", "/api/questions", { as })).json.questions;

  await t("QUESTIONS", "library as manager", "200; 38 questions (37 rotating + 1 fixed), fixed first, 12 starters, 8 topics + fixed (IT-03)", async () => {
    const q = await list("mA");
    const topics = new Set(q.filter((x) => !x.fixed).map((x) => x.topic));
    return { ok: q.length === 38 && q[0].fixed && q.filter((x) => x.fixed).length === 1 && q.filter((x) => x.starter).length === 12 && topics.size === 8, actual: `count=${q.length} fixed=${q.filter((x) => x.fixed).length} starters=${q.filter((x) => x.starter).length} topics=${topics.size}` };
  });
  await t("QUESTIONS", "question item shape", "keys fixed,id,scale,starter,teamId,text,topic,type; scale one of AGREEMENT/QUALITY/OVERTIME/FREQUENCY", async () => (await list("hr")).every((x) => keysOf(x) === "fixed,id,scale,starter,teamId,text,topic,type" && ["AGREEMENT", "QUALITY", "OVERTIME", "FREQUENCY"].includes(x.scale)));
  await t("QUESTIONS", "seeded question texts never contain 'anonym'", "no match (NFR-04)", async () => !(await list("hr")).some((x) => /anonym/i.test(x.text)));
  let own;
  await t("QUESTIONS", "manager creates an own question", "201 question{teamId=own team, scale AGREEMENT, fixed false, starter false, topic 'Vlastné otázky tímu'} (IT-07)", async () => {
    const r = await Q({ text: "Vyhovuje mi rozdelenie úloh v našom QA tíme?" });
    own = r.json.question;
    return r.status === 201 && own.teamId === ctx.teamA && own.scale === "AGREEMENT" && own.fixed === false && own.starter === false && own.topic === "Vlastné otázky tímu";
  });
  await t("QUESTIONS", "mass assignment: teamId (Beta), fixed, starter, scale, topic, type, id", "201; all ignored – question belongs to Alfa, not fixed, not starter, AGREEMENT", async () => {
    const r = await Q({ text: "Pokus o hromadné priradenie polí otázky?", teamId: ctx.teamB, fixed: true, starter: true, scale: "OVERTIME", topic: "Stála otázka", type: "TEXT", id: "qa-question-id" });
    const x = r.json.question;
    return { ok: r.status === 201 && x.teamId === ctx.teamA && !x.fixed && !x.starter && x.scale === "AGREEMENT" && x.topic === "Vlastné otázky tímu" && x.id !== "qa-question-id" && x.type === "SCALE_1_5", actual: JSON.stringify(x).slice(0, 200) };
  });
  await t("QUESTIONS", "exactly one fixed question still exists after the attempt", "1 fixed question in the DB (IT-04)", async () => (await db.question.count({ where: { fixed: true } })) === 1);
  for (const [label, text, code] of [["9 characters", "Je to ok?", "too_short"], ["empty", "", "too_short"], ["missing", undefined, "too_short"], ["number", 1234567890123, "too_short"], ["201 characters", "o".repeat(200) + "?", "too_long"], ["9 chars + many spaces", "a   b   c   d   e", "too_short"], ["array", ["Je toto v poriadku otázka?"], "too_short"]]) {
    await t("QUESTIONS-VALID", `own question text ${label}`, `400 fields.text=${code} (IT-07: 10–200)`, async () => field(await Q({ text }), "text", code));
  }
  await t("QUESTIONS-VALID", "own question exactly 10 characters", "201", async () => is(await Q({ text: "Je to tak?" }), 201));
  await t("QUESTIONS-VALID", "own question exactly 200 characters", "201", async () => is(await Q({ text: "p".repeat(199) + "?" }), 201));
  await t("QUESTIONS-VALID", "whitespace is collapsed", "201, text stored with single spaces and trimmed", async () => (await Q({ text: "   Mám   dosť \n informácií\tk práci?  " })).json.question.text === "Mám dosť informácií k práci?");
  await t("QUESTIONS-VALID", "duplicate of an own question (different case)", "400 fields.text=duplicate", async () => field(await Q({ text: own.text.toUpperCase() }), "text", "duplicate"));
  await t("QUESTIONS-VALID", "duplicate of a shared-library question", "400 fields.text=duplicate", async () => field(await Q({ text: ctx.lib[0].text }), "text", "duplicate"));
  await t("QUESTIONS-VALID", "own question of 10 zero-width spaces (U+200B)", "400 too_short – no visible content", async () => {
    const r = await Q({ text: "​".repeat(10) });
    return { ok: r.status === 400, actual: `${r.status} (invisible question accepted: ${r.status === 201})` };
  });
  await t("QUESTIONS", "the same wording may exist in another team", "201 for manager Beta", async () => is(await Q({ text: own.text }, "mB"), 201));
  await t("QUESTIONS", "another manager does not see the own question; HR sees own questions of all teams", "manager Beta: no question with teamId Alfa; HR: questions of both teams (IT-07)", async () => {
    const b = await list("mB"), h = await list("hr");
    return !b.some((x) => x.teamId === ctx.teamA) && h.some((x) => x.teamId === ctx.teamA) && h.some((x) => x.teamId === ctx.teamB);
  });
  const rb = (ids, teamId) => ({ name: "QA vlastná otázka", teamId, closesAt: dateStr(5), questionIds: ids });
  await t("QUESTIONS", "manager Beta uses Alfa's own question in a Beta round", "400 fields.questionIds=unknown (IT-07)", async () => field(await req("POST", "/api/rounds", { as: "mB", body: rb([own.id, ctx.lib[0].id], ctx.teamB) }), "questionIds", "unknown"));
  await t("QUESTIONS", "HR uses Alfa's own question in a Beta round", "400 fields.questionIds=unknown", async () => field(await req("POST", "/api/rounds", { as: "hr", body: rb([own.id, ctx.lib[0].id], ctx.teamB) }), "questionIds", "unknown"));
  await t("QUESTIONS", "own question in a round of its own team counts towards the 3–5 limit", "201 with 2 picked (own + 1 library) = 3 total; 400 too_many with own + 4 library", async () => {
    const a = await req("POST", "/api/rounds", { as: "mA", body: rb([own.id, ctx.lib[0].id], ctx.teamA) });
    const b = await req("POST", "/api/rounds", { as: "mA", body: rb([own.id, ...ctx.lib.slice(0, 4).map((x) => x.id)], ctx.teamA) });
    return { ok: a.status === 201 && field(b, "questionIds", "too_many"), actual: `${a.status} / ${b.status} ${b.text.slice(0, 80)}` };
  });
  await t("QUESTIONS", "own question cannot be edited or deleted", "PUT/PATCH/DELETE /api/questions and /api/questions/:id → 405 or 404", async () => {
    const codes = [];
    for (const m of ["PUT", "PATCH", "DELETE"]) { codes.push((await req(m, "/api/questions", { as: "mA", body: { id: own.id, text: "zmena zmena zmena" } })).status); codes.push((await req(m, `/api/questions/${own.id}`, { as: "mA", body: { text: "zmena zmena zmena" } })).status); }
    const row = await db.question.findUnique({ where: { id: own.id } });
    return { ok: codes.every((c) => c === 405 || c === 404) && row.text === own.text, actual: `statuses ${codes}` };
  });
  await t("QUESTIONS", "5 identical own questions posted in parallel", "exactly one 201, others 400 duplicate (no duplicate rows)", async () => {
    const text = "Paralelne vytvorená vlastná otázka tímu?";
    const rs = await Promise.all(Array.from({ length: 5 }, () => Q({ text })));
    const n = await db.question.count({ where: { text, teamId: ctx.teamA } });
    return { ok: n === 1, actual: `statuses ${rs.map((r) => r.status)}; rows with this text for the team: ${n}` };
  });

  // ================= HR issues =================
  const I = (body, as = "hr") => req("POST", "/api/hr/issues", { as, body });
  const ib = (o = {}) => ({ title: "QA podnet", description: "Opis podnetu", source: "MEETING", ownerGroup: "FACILITY", ...o });
  const closedA = ctx.round(ctx.teamA, "46. týždeň");
  let issue;
  await t("HR-ISSUE", "create issue with all optional fields empty", "201 issue{status OPEN, round null, team null, note null, dueDate null} (IT-10)", async () => {
    const r = await I({ title: "QA minimálny podnet", source: "OTHER", ownerGroup: "OTHER" });
    issue = r.json.issue;
    return r.status === 201 && keysOf(issue) === "createdAt,description,dueDate,id,note,ownerGroup,round,source,status,team,title" && issue.status === "OPEN" && issue.round === null && issue.team === null && issue.note === null && issue.dueDate === null && issue.description === "";
  });
  await t("HR-ISSUE", "create issue from a round: team is derived from the round", "201 round.id = given, team.id = round's team", async () => {
    const r = await I(ib({ source: "SURVEY", roundId: closedA.id, dueDate: dateStr(10) }));
    return r.status === 201 && r.json.issue.round.id === closedA.id && r.json.issue.team.id === ctx.teamA && r.json.issue.dueDate !== null;
  });
  await t("HR-ISSUE", "round of Alfa + teamId of Beta in one request", "201; team taken from the round (Alfa), not from the body", async () => (await I(ib({ roundId: closedA.id, teamId: ctx.teamB }))).json.issue.team.id === ctx.teamA);
  await t("HR-ISSUE", "issue with team only", "201 team set, round null", async () => { const r = await I(ib({ teamId: ctx.teamB })); return r.status === 201 && r.json.issue.team.id === ctx.teamB && r.json.issue.round === null; });
  for (const [label, o, f, code] of [
    ["unknown roundId", { roundId: "cmnope000000000000000000" }, "roundId", "unknown"], ["unknown teamId", { teamId: "cmnope000000000000000000" }, "teamId", "unknown"], ["unknown noteId", { noteId: "cmnope000000000000000000" }, "noteId", "unknown"],
    ["title 2 chars", { title: "ab" }, "title", "too_short"], ["title missing", { title: undefined }, "title", "too_short"], ["title 121 chars", { title: "t".repeat(121) }, "title", "too_long"], ["title number", { title: 12345 }, "title", "too_short"],
    ["description 2001 chars", { description: "d".repeat(2001) }, "description", "too_long"], ["source unknown", { source: "EMAIL" }, "source", "invalid"], ["source missing", { source: undefined }, "source", "invalid"],
    ["ownerGroup unknown", { ownerGroup: "FINANCE" }, "ownerGroup", "invalid"], ["ownerGroup missing", { ownerGroup: undefined }, "ownerGroup", "invalid"], ["dueDate 2026-13-40", { dueDate: "2026-13-40" }, "dueDate", "invalid"], ["dueDate number", { dueDate: 20261231 }, "dueDate", "invalid"],
  ]) {
    await t("HR-ISSUE-VALID", `create issue: ${label}`, `400 fields.${f}=${code}`, async () => field(await I(ib(o)), f, code));
  }
  await t("HR-ISSUE-VALID", "create issue: title 3 and 120 chars, description 2000 chars (bounds)", "201 for both", async () => is(await I(ib({ title: "abc" })), 201) && is(await I(ib({ title: "t".repeat(120), description: "d".repeat(2000) })), 201));
  await t("HR-ISSUE-VALID", "create issue: roundId sent as a number", "400 fields.roundId (wrong type must not be silently dropped)", async () => {
    const r = await I(ib({ roundId: 12345 }));
    return { ok: r.status === 400, actual: `${r.status}; issue created without the round: ${r.status === 201 && r.json.issue.round === null}` };
  });
  await t("HR-ISSUE-VALID", "create issue: teamId sent as an array", "400 fields.teamId", async () => {
    const r = await I(ib({ teamId: [ctx.teamA] }));
    return { ok: r.status === 400, actual: `${r.status}; issue created without the team: ${r.status === 201 && r.json.issue.team === null}` };
  });
  await t("HR-ISSUE-VALID", "create issue: description sent as an object", "400 fields.description", async () => {
    const r = await I(ib({ description: { text: "opis" } }));
    return { ok: r.status === 400, actual: `${r.status}; stored description: ${JSON.stringify(r.json?.issue?.description)}` };
  });
  await t("HR-ISSUE", "mass assignment: status DONE, createdById, createdAt, id", "201; status OPEN, createdBy = HR, createdAt ~ now", async () => {
    const r = await I(ib({ status: "DONE", createdById: ctx.users.mA.id, createdAt: "2020-01-01T00:00:00Z", id: "qa-issue-id" }));
    const row = await db.issue.findUnique({ where: { id: r.json.issue.id } });
    return r.status === 201 && row.status === "OPEN" && row.createdById === ctx.users.hr.id && row.id !== "qa-issue-id" && Math.abs(row.createdAt.getTime() - Date.now()) < 15000;
  });
  await t("HR-ISSUE", "issue JSON does not expose who created it", "no createdById / user id in the response", async () => { const r = await req("GET", "/api/hr/issues", { as: "hr" }); return !r.text.includes("createdById") && !r.text.includes(ctx.users.hr.id); });

  const P = (body, id = issue.id) => req("PATCH", `/api/hr/issues/${id}`, { as: "hr", body });
  await t("HR-ISSUE", "PATCH status → IN_PROGRESS → DONE", "200 each, persisted", async () => (await P({ status: "IN_PROGRESS" })).json.issue.status === "IN_PROGRESS" && (await P({ status: "DONE" })).json.issue.status === "DONE" && (await db.issue.findUnique({ where: { id: issue.id } })).status === "DONE");
  await t("HR-ISSUE", "PATCH ownerGroup and dueDate, then clear dueDate with null and ''", "200; dueDate set then null", async () => {
    const a = await P({ ownerGroup: "IT_SUPPORT", dueDate: dateStr(3) }), b = await P({ dueDate: null }), c = await P({ dueDate: dateStr(4) }), d = await P({ dueDate: "" });
    return a.json.issue.ownerGroup === "IT_SUPPORT" && a.json.issue.dueDate !== null && b.json.issue.dueDate === null && c.json.issue.dueDate !== null && d.json.issue.dueDate === null;
  });
  for (const [label, body, f] of [["status unknown", { status: "CLOSED" }, "status"], ["ownerGroup unknown", { ownerGroup: "X" }, "ownerGroup"], ["dueDate invalid", { dueDate: "zajtra" }, "dueDate"], ["status null", { status: null }, "status"], ["empty object", {}, "status"]]) {
    await t("HR-ISSUE-VALID", `PATCH issue: ${label}`, `400 fields.${f}`, async () => { const r = await P(body); return r.status === 400 && f in (r.json.fields ?? {}); });
  }
  await t("HR-ISSUE", "PATCH issue: title, description, roundId, createdById cannot be changed", "400 (nothing changeable sent) and row unchanged", async () => {
    const before = await db.issue.findUnique({ where: { id: issue.id } });
    const r = await P({ title: "ZMENA", description: "ZMENA", roundId: closedA.id, createdById: ctx.users.mA.id });
    const after = await db.issue.findUnique({ where: { id: issue.id } });
    return r.status === 400 && JSON.stringify(before) === JSON.stringify(after);
  });
  await t("HR-ISSUE", "PATCH unknown issue id", "404 not_found", async () => is(await P({ status: "DONE" }, "cmnope000000000000000000"), 404, "not_found"));
  await t("HR-ISSUE", "partially invalid PATCH changes nothing", "400 and status unchanged when ownerGroup is invalid", async () => {
    const r = await P({ status: "OPEN", ownerGroup: "NOPE" });
    return r.status === 400 && (await db.issue.findUnique({ where: { id: issue.id } })).status === "DONE";
  });
  const L = async (qs) => (await req("GET", "/api/hr/issues" + qs, { as: "hr" }));
  await t("HR-ISSUE-FILTER", "filter by group", "only FACILITY issues", async () => { const r = (await L("?group=FACILITY")).json.issues; return r.length > 0 && r.every((x) => x.ownerGroup === "FACILITY"); });
  await t("HR-ISSUE-FILTER", "filter by status DONE", "only DONE issues", async () => { const r = (await L("?status=DONE")).json.issues; return r.length > 0 && r.every((x) => x.status === "DONE"); });
  await t("HR-ISSUE-FILTER", "filter status=ACTIVE", "only OPEN and IN_PROGRESS (IT-13)", async () => { const r = (await L("?status=ACTIVE")).json.issues; return r.length > 0 && r.every((x) => x.status !== "DONE"); });
  await t("HR-ISSUE-FILTER", "combined filter group + status", "intersection", async () => (await L("?group=FACILITY&status=OPEN")).json.issues.every((x) => x.ownerGroup === "FACILITY" && x.status === "OPEN"));
  await t("HR-ISSUE-FILTER", "unknown filter values (group=NOPE, status=NOPE)", "400 or an empty list – an invalid filter must not silently return everything", async () => {
    const all = (await L("")).json.issues.length;
    const r = await L("?group=NOPE&status=NOPE");
    return { ok: r.status === 400 || r.json.issues.length === 0, actual: `${r.status}; returned ${r.json?.issues?.length} of ${all} issues (filter ignored: ${r.json?.issues?.length === all})` };
  });
  await t("HR-ISSUE-FILTER", "SQL-injection string in the filter", "200, treated as data; no error", async () => (await L("?group=" + encodeURIComponent("' OR 1=1 --") + "&status=" + encodeURIComponent("OPEN' UNION SELECT * FROM User--"))).status === 200);
  await t("HR-ISSUE-FILTER", "list is sorted newest first", "createdAt descending", async () => { const r = (await L("")).json.issues; return r.every((x, i) => i === 0 || Date.parse(r[i - 1].createdAt) >= Date.parse(x.createdAt)); });
  await t("HR-ISSUE", "DELETE / PUT on issues", "405", async () => (await req("DELETE", `/api/hr/issues/${issue.id}`, { as: "hr" })).status === 405 && (await req("PUT", `/api/hr/issues`, { as: "hr", body: {} })).status === 405);

  // ================= HR notes =================
  const N = (body) => req("POST", "/api/hr/notes", { as: "hr", body });
  const nb = (o = {}) => ({ title: "QA stretnutie", text: "Poznámka zo stretnutia.", meetingDate: dateStr(-2), ...o });
  let note;
  await t("HR-NOTE", "create a note", "201 note{id}", async () => { const r = await N(nb()); note = r.json.note; return r.status === 201 && keysOf(note) === "id"; });
  await t("HR-NOTE", "issue created from the note is listed under the note", "note.issues contains the issue (IT-10)", async () => {
    const i = await I(ib({ noteId: note.id, title: "QA podnet z poznámky" }));
    const notes = (await req("GET", "/api/hr/notes", { as: "hr" })).json.notes;
    const n = notes.find((x) => x.id === note.id);
    return i.status === 201 && i.json.issue.note.id === note.id && n.issues.some((x) => x.id === i.json.issue.id) && keysOf(n) === "createdAt,id,issues,meetingDate,text,title";
  });
  for (const [label, o, f, code] of [["title 2 chars", { title: "ab" }, "title", "too_short"], ["title 121 chars", { title: "t".repeat(121) }, "title", "too_long"], ["text missing", { text: undefined }, "text", "required"], ["text whitespace", { text: " \n " }, "text", "required"], ["text 10 001 chars", { text: "x".repeat(10001) }, "text", "too_long"], ["text number", { text: 5 }, "text", "required"], ["meetingDate missing", { meetingDate: undefined }, "meetingDate", "invalid"], ["meetingDate 31.12.2026", { meetingDate: "31.12.2026" }, "meetingDate", "invalid"]]) {
    await t("HR-NOTE-VALID", `create note: ${label}`, `400 fields.${f}=${code}`, async () => field(await N(nb(o)), f, code));
  }
  await t("HR-NOTE-VALID", "create note: text exactly 10 000 chars", "201", async () => is(await N(nb({ text: "x".repeat(10000) })), 201));
  await t("HR-NOTE", "mass assignment createdById in note", "201; createdBy = HR session user", async () => {
    const r = await N(nb({ createdById: ctx.users.mA.id, id: "qa-note" }));
    const row = await db.meetingNote.findUnique({ where: { id: r.json.note.id } });
    return row.createdById === ctx.users.hr.id && row.id !== "qa-note";
  });
  await t("HR-NOTE", "notes list sorted by meeting date, newest first", "meetingDate descending", async () => { const n = (await req("GET", "/api/hr/notes", { as: "hr" })).json.notes; return n.every((x, i) => i === 0 || Date.parse(n[i - 1].meetingDate) >= Date.parse(x.meetingDate)); });
  await t("HR-NOTE", "note with a meeting date far in the future", "informational: requirements are silent", async () => { const r = await N(nb({ meetingDate: "2099-01-01" })); return { ok: [201, 400].includes(r.status), actual: `${r.status} (future meeting date accepted: ${r.status === 201})` }; });

  // ================= HR overview (IT-05) =================
  await t("HR-OVERVIEW", "overview shape", "keys teams,total; team keys incl. awaitingRounds, medianDaysToFirstAction, sharePercent, actions{planned,inProgress,done,overdue}", async () => {
    const r = (await req("GET", "/api/hr/overview", { as: "hr" })).json;
    return keysOf(r) === "teams,total" && r.teams.length === 2 && r.teams.every((x) => keysOf(x) === "actions,awaitingRounds,closedRounds,medianDaysToFirstAction,roundsWithAction,sharePercent,teamId,teamName" && keysOf(x.actions) === "done,inProgress,overdue,planned");
  });
  await t("HR-OVERVIEW", "numbers recomputed from the DB", "closedRounds, roundsWithAction, sharePercent, action counts and overdue match the DB for each team and in total", async () => {
    const api = (await req("GET", "/api/hr/overview", { as: "hr" })).json;
    const problems = [];
    let tc = 0, tw = 0;
    for (const team of api.teams) {
      const rounds = await db.round.findMany({ where: { teamId: team.teamId, status: "CLOSED" }, include: { actions: true } });
      const withA = rounds.filter((r) => r.actions.length).length;
      const acts = rounds.flatMap((r) => r.actions);
      tc += rounds.length; tw += withA;
      const exp = { closedRounds: rounds.length, roundsWithAction: withA, sharePercent: rounds.length ? Math.round((withA / rounds.length) * 100) : null, planned: acts.filter((a) => a.status === "PLANNED").length, inProgress: acts.filter((a) => a.status === "IN_PROGRESS").length, done: acts.filter((a) => a.status === "DONE").length, overdue: acts.filter((a) => a.status !== "DONE" && a.dueDate < new Date()).length, awaiting: rounds.length - withA };
      const got = { closedRounds: team.closedRounds, roundsWithAction: team.roundsWithAction, sharePercent: team.sharePercent, planned: team.actions.planned, inProgress: team.actions.inProgress, done: team.actions.done, overdue: team.actions.overdue, awaiting: team.awaitingRounds.length };
      if (JSON.stringify(exp) !== JSON.stringify(got)) problems.push(`${team.teamName}: exp ${JSON.stringify(exp)} got ${JSON.stringify(got)}`);
    }
    if (api.total.closedRounds !== tc || api.total.roundsWithAction !== tw) problems.push("total mismatch");
    return { ok: problems.length === 0, actual: problems.join("; ") || `matches DB (total closed ${tc}, with action ${tw})` };
  });
  await t("HR-OVERVIEW", "median days to first action for team Alfa (demo: actions after 2, 3 and 1 days)", "medianDaysToFirstAction = 2", async () => {
    const a = (await req("GET", "/api/hr/overview", { as: "hr" })).json.teams.find((x) => x.teamId === ctx.teamA);
    return { ok: a.medianDaysToFirstAction === 2, actual: `median=${a.medianDaysToFirstAction}` };
  });
  await t("HR-OVERVIEW", "awaiting rounds are sorted longest waiting first; automatically closed round counts from its deadline", "daysWaiting descending; round auto-closed with a deadline 3 days ago shows daysWaiting 3", async () => {
    const id = await mkOpenRound(ctx.teamB);
    await db.round.update({ where: { id }, data: { closesAt: new Date(Date.now() - 3 * 86400000 - 60000) } });
    const b = (await req("GET", "/api/hr/overview", { as: "hr" })).json.teams.find((x) => x.teamId === ctx.teamB);
    const w = b.awaitingRounds;
    return { ok: w.every((x, i) => i === 0 || w[i - 1].daysWaiting >= x.daysWaiting) && w.find((x) => x.id === id)?.daysWaiting === 3, actual: JSON.stringify(w.map((x) => x.daysWaiting)) + ` auto-closed: ${w.find((x) => x.id === id)?.daysWaiting}` };
  }, { pre: "open Beta round whose closesAt was moved 3 days into the past directly in the DB" });
  await t("HR-OVERVIEW", "overview contains nothing from responses", "no 'average', 'comment', 'responded' keys", async () => !/average|comment|responded|distribution/.test((await req("GET", "/api/hr/overview", { as: "hr" })).text));

  // ================= Home tasks (IT-11) via the server-rendered page =================
  const page = async (as) => (await req("GET", "/", { as })).text;
  await t("HOME", "employee with an open, unanswered round sees a link to fill it in", "HTML of / contains /rounds/<open id>/fill (IT-11)", async () => (await page("a1")).includes(`/rounds/${ctx.round(ctx.teamA, "48. týždeň").id}/fill`));
  await t("HOME", "employee of a team without an open round has no fill task", "HTML of / for a Beta employee contains no /fill link", async () => !/\/rounds\/[a-z0-9]+\/fill/.test(await page("b1")));
  await t("HOME", "manager Alfa is sent to the closed round without an action", "HTML contains /rounds/<id of '46. týždeň'>/results", async () => (await page("mA")).includes(`/rounds/${closedA.id}/results`));
  await t("HOME", "manager never gets a task that points to another team's round", "no Beta round id in manager Alfa's home page", async () => {
    const html = await page("mA");
    const beta = (await db.round.findMany({ where: { teamId: ctx.teamB } })).map((r) => r.id);
    return !beta.some((id) => html.includes(id));
  });
  await t("HOME", "HR home links to the overview of rounds awaiting an action", "HTML contains /hr/overview", async () => (await page("hr")).includes("/hr/overview"));
  await t("HOME", "home page never uses the word 'anonym'", "no match for employee, manager, HR (NFR-04)", async () => !/anonym/i.test((await page("a1")) + (await page("mA")) + (await page("hr"))));
}
