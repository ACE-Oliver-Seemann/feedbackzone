// Suite 3: round creation and lifecycle (MVP-04, MVP-05, MVP-06, IT-04).
import { closeR, ctx, dateStr, db, is, mkOpenRound, mkRound, req, reset, suite, submit, t } from "./lib.mjs";

export default async function run() {
  suite("S3 Rounds: creation, validation, lifecycle", "fresh seed + demo data");
  await reset(true);
  const q = (n, from = 0) => ctx.lib.slice(from, from + n).map((x) => x.id);
  const base = () => ({ name: "QA kolo", teamId: ctx.teamB, closesAt: dateStr(7), questionIds: q(3) });
  const C = (body, as = "hr") => req("POST", "/api/rounds", { as, body });
  const field = (r, f, code) => r.status === 400 && r.json?.error === "validation_error" && r.json.fields?.[f] === code;

  await t("ROUND-CREATE", "HR creates a round with 3 picked questions", "201 {round:{id}}; DB status DRAFT, 4 questions, fixed question at position 1 (MVP-04, IT-04)", async () => {
    const r = await C(base());
    const row = await db.round.findUnique({ where: { id: r.json.round.id }, include: { questions: { orderBy: { position: "asc" } } } });
    return { ok: r.status === 201 && row.status === "DRAFT" && row.questions.length === 4 && row.questions[0].questionId === ctx.fixed.id && row.startsAt === null, actual: `${r.status}; DB status=${row.status}, questions=${row.questions.length}, first is fixed=${row.questions[0].questionId === ctx.fixed.id}` };
  });
  await t("ROUND-CREATE", "manager omits teamId", "201, round belongs to the manager's own team", async () => {
    const b = base(); delete b.teamId;
    const r = await C(b, "mB");
    const row = await db.round.findUnique({ where: { id: r.json.round.id } });
    return r.status === 201 && row.teamId === ctx.teamB;
  });
  await t("ROUND-CREATE", "HR omits teamId", "400 fields.teamId=required", async () => { const b = base(); delete b.teamId; return field(await C(b), "teamId", "required"); });
  await t("ROUND-CREATE", "HR sends unknown teamId", "400 fields.teamId=unknown", async () => field(await C({ ...base(), teamId: "cmnope000000000000000000" }), "teamId", "unknown"));
  await t("ROUND-CREATE", "manager sends unknown teamId", "403 (must not learn whether the team exists)", async () => is(await C({ ...base(), teamId: "cmnope000000000000000000" }, "mB"), 403));
  await t("ROUND-CREATE", "teamId as number (HR)", "400 fields.teamId", async () => (await C({ ...base(), teamId: 5 })).json?.fields?.teamId !== undefined);
  await t("ROUND-CREATE", "teamId as array (manager Beta, Alfa id inside)", "round is NOT created for Alfa (403 or own team)", async () => {
    const before = await db.round.count({ where: { teamId: ctx.teamA } });
    const r = await C({ ...base(), teamId: [ctx.teamA] }, "mB");
    const after = await db.round.count({ where: { teamId: ctx.teamA } });
    return { ok: before === after, actual: `${r.status}; Alfa rounds before/after ${before}/${after}` };
  });

  for (const [label, name, code] of [["missing", undefined, "required"], ["empty", "", "required"], ["whitespace only", "   ", "required"], ["121 characters", "x".repeat(121), "too_long"], ["number", 123, "required"], ["null", null, "required"], ["array", ["a"], "required"]]) {
    await t("ROUND-CREATE", `name ${label}`, `400 fields.name=${code}`, async () => field(await C({ ...base(), name }), "name", code));
  }
  await t("ROUND-CREATE", "name exactly 120 characters", "201", async () => is(await C({ ...base(), name: "n".repeat(120) }), 201));
  await t("ROUND-CREATE", "name with unicode, emoji and HTML", "201 and stored verbatim (output escaping is the UI's job)", async () => {
    const name = 'Ľúbezný pulz 🚀 <script>alert(1)</script> "; DROP TABLE Round;--';
    const r = await C({ ...base(), name });
    const row = await db.round.findUnique({ where: { id: r.json.round.id } });
    return r.status === 201 && row.name === name;
  });
  await t("ROUND-CREATE", "name of 5 zero-width spaces (U+200B)", "400 fields.name=required (name is effectively blank)", async () => {
    const r = await C({ ...base(), name: "​".repeat(5) });
    return { ok: r.status === 400, actual: `${r.status} ${r.text.slice(0, 100)} (invisible name accepted: ${r.status === 201})` };
  });

  for (const [label, v, code] of [
    ["missing", undefined, "invalid"], ["31 February", "2027-02-31", "invalid"], ["dd.mm.yyyy", "12.12.2026", "invalid"], ["ISO datetime", "2026-12-12T10:00:00Z", "invalid"],
    ["yesterday", dateStr(-1), "in_past"], ["number timestamp", Date.now() + 86400000, "invalid"], ["month 13", "2026-13-01", "invalid"], ["empty string", "", "invalid"],
    ["year 0000", "0000-01-01", "invalid"], ["null", null, "invalid"], ["trailing space", dateStr(3) + " ", "invalid"],
  ]) {
    await t("ROUND-CREATE", `closesAt ${label}`, `400 fields.closesAt=${code}`, async () => field(await C({ ...base(), closesAt: v }), "closesAt", code));
  }
  await t("ROUND-CREATE", "closesAt today", "201 (deadline = end of today)", async () => is(await C({ ...base(), closesAt: dateStr(0) }), 201));
  await t("ROUND-CREATE", "closesAt 9999-12-31", "201 or 400, no 500", async () => { const r = await C({ ...base(), closesAt: "9999-12-31" }); return [201, 400].includes(r.status); });
  await t("ROUND-CREATE", "closesAt 2028-02-29 (leap day)", "201", async () => is(await C({ ...base(), closesAt: "2028-02-29" }), 201));

  for (const [label, ids, code] of [
    ["missing", undefined, "invalid"], ["string instead of array", "abc", "invalid"], ["array of numbers", [1, 2, 3], "invalid"], ["object", { 0: "a" }, "invalid"],
    ["empty array (only fixed = 1)", [], "too_few"], ["1 picked (total 2)", q(1), "too_few"], ["5 picked (total 6)", q(5), "too_many"], ["30 picked", q(30), "too_many"],
    ["duplicate id", [q(1)[0], q(1)[0], q(2)[1]], "duplicate"], ["unknown id", [...q(2), "cmnope000000000000000000"], "unknown"], ["SQL-injection id", [...q(2), "' OR 1=1 --"], "unknown"],
    ["nested array", [q(1), q(1), q(1)], "invalid"], ["null element", [...q(2), null], "invalid"],
  ]) {
    await t("ROUND-CREATE", `questionIds ${label}`, `400 fields.questionIds=${code} (MVP-04)`, async () => field(await C({ ...base(), questionIds: ids }), "questionIds", code));
  }
  await t("ROUND-CREATE", "2 picked (total 3 with fixed) – lower bound", "201, 3 questions", async () => {
    const r = await C({ ...base(), questionIds: q(2) });
    return r.status === 201 && (await db.roundQuestion.count({ where: { roundId: r.json.round.id } })) === 3;
  });
  await t("ROUND-CREATE", "4 picked (total 5 with fixed) – upper bound", "201, 5 questions", async () => {
    const r = await C({ ...base(), questionIds: q(4) });
    return r.status === 201 && (await db.roundQuestion.count({ where: { roundId: r.json.round.id } })) === 5;
  });
  await t("ROUND-CREATE", "fixed question sent explicitly + 2 picked", "201, fixed not added twice: 3 questions (IT-04)", async () => {
    const r = await C({ ...base(), questionIds: [q(1)[0], ctx.fixed.id, q(2)[1]] });
    const rows = await db.roundQuestion.findMany({ where: { roundId: r.json.round.id }, orderBy: { position: "asc" } });
    return r.status === 201 && rows.length === 3 && rows[0].questionId === ctx.fixed.id;
  });
  await t("ROUND-CREATE", "fixed question sent explicitly + 4 picked (5 total)", "201 with 5 questions", async () => is(await C({ ...base(), questionIds: [ctx.fixed.id, ...q(4)] }), 201));
  await t("ROUND-CREATE", "only the fixed question sent twice", "400 duplicate", async () => field(await C({ ...base(), questionIds: [ctx.fixed.id, ctx.fixed.id] }), "questionIds", "duplicate"));

  await t("ROUND-CREATE", "mass assignment: status, id, startsAt, closedAt, fixed", "201; DB: status DRAFT, generated id, startsAt/closedAt null", async () => {
    const r = await C({ ...base(), status: "OPEN", id: "qa-custom-id", startsAt: "2020-01-01", closedAt: "2020-01-02", fixed: true, responses: [{ v1: 5 }], participations: [] });
    const row = await db.round.findUnique({ where: { id: r.json.round.id } });
    return { ok: r.status === 201 && row.status === "DRAFT" && row.id !== "qa-custom-id" && !row.startsAt && !row.closedAt, actual: `${r.status}; status=${row.status} id=${row.id !== "qa-custom-id" ? "generated" : "CUSTOM"} startsAt=${row.startsAt}` };
  });
  await t("ROUND-CREATE", "all fields invalid at once", "400 with every field listed", async () => {
    const r = await C({ name: "", teamId: "", closesAt: "x", questionIds: "x" });
    return r.status === 400 && ["name", "teamId", "closesAt", "questionIds"].every((f) => f in r.json.fields);
  });
  await t("ROUND-CREATE", "non-object body (array)", "400 invalid_json", async () => is(await req("POST", "/api/rounds", { as: "hr", raw: "[1,2]" }), 400, "invalid_json"));
  await t("ROUND-CREATE", "failed validation creates no rows", "round count unchanged after a 400", async () => {
    const before = await db.round.count();
    await C({ ...base(), questionIds: [...q(2), "cmnope000000000000000000"] });
    return before === (await db.round.count());
  });

  // ---------- lifecycle ----------
  const d1 = await mkRound("mB", ctx.teamB);
  await t("ROUND-LIFE", "draft is not listed for an employee of the team", "GET /api/rounds as employee does not contain the draft (MVP-05, MVP-06)", async () => {
    const r = await req("GET", "/api/rounds", { as: "b1" });
    return r.status === 200 && !r.json.rounds.some((x) => x.id === d1) && r.json.rounds.every((x) => x.status === "OPEN");
  });
  await t("ROUND-LIFE", "employee submits to a DRAFT round", "404 not_found", async () => is(await submit("b1", d1, [3, 3, 3, 3]), 404));
  await t("ROUND-LIFE", "close a DRAFT round", "409 invalid_state", async () => is(await closeR(d1), 409, "invalid_state"));
  await t("ROUND-LIFE", "results of a DRAFT round", "200 status=not_closed, no questions/comments", async () => {
    const r = await req("GET", `/api/rounds/${d1}/results`, { as: "mB" });
    return r.status === 200 && r.json.status === "not_closed" && !("questions" in r.json) && !("comments" in r.json);
  });
  await t("ROUND-LIFE", "add an action to a DRAFT round", "409 round_not_closed", async () => is(await req("POST", `/api/rounds/${d1}/actions`, { as: "mB", body: { topic: "x", description: "y", dueDate: dateStr(3) } }), 409, "round_not_closed"));
  await t("ROUND-LIFE", "open a DRAFT round (manager)", "200 {ok:true}; DB status OPEN, startsAt set", async () => {
    const r = await req("POST", `/api/rounds/${d1}/open`, { as: "mB" });
    const row = await db.round.findUnique({ where: { id: d1 } });
    return r.status === 200 && row.status === "OPEN" && row.startsAt !== null && Math.abs(row.startsAt.getTime() - Date.now()) < 10000;
  });
  await t("ROUND-LIFE", "open an already OPEN round", "409 invalid_state", async () => is(await req("POST", `/api/rounds/${d1}/open`, { as: "mB" }), 409, "invalid_state"));
  await t("ROUND-LIFE", "open round is listed for the employee with submitted=false and without participation numbers", "200; item has submitted=false, no participation/awaitingAction keys (MVP-06)", async () => {
    const r = await req("GET", "/api/rounds", { as: "b1" });
    const it = r.json.rounds.find((x) => x.id === d1);
    return { ok: !!it && it.submitted === false && !("participation" in it) && !("awaitingAction" in it), actual: JSON.stringify(it) };
  });
  await t("ROUND-LIFE", "manager's list shows participation and submitted for own team; HR's list shows no 'submitted'", "manager: participation{responded,teamSize=6}; HR: no submitted key", async () => {
    const m = (await req("GET", "/api/rounds", { as: "mB" })).json.rounds.find((x) => x.id === d1);
    const h = (await req("GET", "/api/rounds", { as: "hr" })).json.rounds.find((x) => x.id === d1);
    return { ok: m.participation.teamSize === 6 && m.participation.responded === 0 && m.submitted === false && !("submitted" in h) && h.participation.teamSize === 6, actual: `mgr ${JSON.stringify(m.participation)} submitted=${m.submitted}; HR keys ${Object.keys(h)}` };
  });
  await t("ROUND-LIFE", "manager's list contains only own team; HR's list contains both teams", "manager Beta: all teamId=Beta; HR: both teams (MVP-12)", async () => {
    const m = (await req("GET", "/api/rounds", { as: "mB" })).json.rounds;
    const h = (await req("GET", "/api/rounds", { as: "hr" })).json.rounds;
    return m.every((x) => x.teamId === ctx.teamB) && h.some((x) => x.teamId === ctx.teamA) && h.some((x) => x.teamId === ctx.teamB);
  });
  await t("ROUND-LIFE", "a running round cannot be edited: PUT/PATCH/DELETE /api/rounds/:id", "405 for each (MVP-05)", async () => {
    const codes = [];
    for (const m of ["PUT", "PATCH", "DELETE"]) codes.push((await req(m, `/api/rounds/${d1}`, { as: "mB", body: { name: "zmena" } })).status);
    const row = await db.round.findUnique({ where: { id: d1 } });
    return { ok: codes.every((c) => c === 405) && row.name !== "zmena", actual: `statuses ${codes}` };
  });
  await t("ROUND-LIFE", "close an OPEN round (manager)", "200; DB status CLOSED, closedAt ~ now", async () => {
    const r = await closeR(d1, "mB");
    const row = await db.round.findUnique({ where: { id: d1 } });
    return r.status === 200 && row.status === "CLOSED" && Math.abs(row.closedAt.getTime() - Date.now()) < 10000;
  });
  await t("ROUND-LIFE", "close an already CLOSED round", "409 invalid_state", async () => is(await closeR(d1, "mB"), 409, "invalid_state"));
  await t("ROUND-LIFE", "re-open a CLOSED round", "409 invalid_state", async () => is(await req("POST", `/api/rounds/${d1}/open`, { as: "hr" }), 409, "invalid_state"));
  await t("ROUND-LIFE", "submit to a CLOSED round", "409 round_closed (MVP-09)", async () => is(await submit("b1", d1, [3, 3, 3, 3]), 409, "round_closed"));
  await t("ROUND-LIFE", "closed round without action is flagged awaitingAction for manager and HR", "awaitingAction=true (MVP-15)", async () => {
    const m = (await req("GET", "/api/rounds", { as: "mB" })).json.rounds.find((x) => x.id === d1);
    const h = (await req("GET", "/api/rounds", { as: "hr" })).json.rounds.find((x) => x.id === d1);
    return m.awaitingAction === true && h.awaitingAction === true;
  });
  await t("ROUND-LIFE", "open/close with unknown id: HR vs manager", "HR 404 not_found, manager 403", async () => {
    const a = await req("POST", "/api/rounds/cmnope000000000000000000/open", { as: "hr" });
    const b = await req("POST", "/api/rounds/cmnope000000000000000000/close", { as: "mB" });
    return { ok: a.status === 404 && b.status === 403, actual: `HR ${a.status}, manager ${b.status}` };
  });
  await t("ROUND-LIFE", "open with a request body trying to set status CLOSED", "body ignored: 200 and status OPEN", async () => {
    const id = await mkRound("hr", ctx.teamB);
    const r = await req("POST", `/api/rounds/${id}/open`, { as: "hr", body: { status: "CLOSED", closesAt: "2020-01-01" } });
    const row = await db.round.findUnique({ where: { id } });
    await closeR(id);
    return r.status === 200 && row.status === "OPEN";
  });

  // deadline handling (state prepared directly in the DB)
  await t("ROUND-LIFE", "open a draft whose deadline already passed", "409 deadline_passed", async () => {
    const id = await mkRound("hr", ctx.teamB);
    await db.round.update({ where: { id }, data: { closesAt: new Date(Date.now() - 3600000) } });
    return is(await req("POST", `/api/rounds/${id}/open`, { as: "hr" }), 409, "deadline_passed");
  }, { pre: "draft created through the API, closesAt moved 1 h into the past directly in the DB" });
  const exp = await mkOpenRound(ctx.teamB);
  const deadline = new Date(Date.now() - 2 * 3600000);
  await db.round.update({ where: { id: exp }, data: { closesAt: deadline } });
  await t("ROUND-LIFE", "submit to an OPEN round after its deadline (before anyone loaded a list)", "409 round_closed – automatic closing (MVP-05, MVP-09)", async () => is(await submit("b2", exp, [3, 3, 3, 3]), 409, "round_closed"), { pre: "open round, closesAt moved 2 h into the past directly in the DB" });
  await t("ROUND-LIFE", "automatically closed round: DB status CLOSED and closedAt = deadline", "status CLOSED, closedAt equals closesAt (IT-05)", async () => {
    const row = await db.round.findUnique({ where: { id: exp } });
    return { ok: row.status === "CLOSED" && row.closedAt?.getTime() === deadline.getTime(), actual: `status=${row.status} closedAt=${row.closedAt?.toISOString()} deadline=${deadline.toISOString()}` };
  });
  await t("ROUND-LIFE", "automatic closing is triggered by GET /api/rounds", "expired OPEN round shows as CLOSED in the list", async () => {
    const id = await mkOpenRound(ctx.teamB);
    await db.round.update({ where: { id }, data: { closesAt: new Date(Date.now() - 1000) } });
    const r = await req("GET", "/api/rounds", { as: "hr" });
    return r.json.rounds.find((x) => x.id === id)?.status === "CLOSED";
  }, { pre: "open round, closesAt moved 1 s into the past directly in the DB" });
  await t("ROUND-LIFE", "manual close of a round whose deadline passed", "409 invalid_state (already closed automatically) and closedAt stays at the deadline", async () => {
    const id = await mkOpenRound(ctx.teamB);
    const dl = new Date(Date.now() - 5000);
    await db.round.update({ where: { id }, data: { closesAt: dl } });
    const r = await closeR(id);
    const row = await db.round.findUnique({ where: { id } });
    return { ok: r.status === 409 && row.status === "CLOSED" && row.closedAt.getTime() === dl.getTime(), actual: `${r.status} ${r.text}; closedAt=deadline: ${row.closedAt?.getTime() === dl.getTime()}` };
  });

  // concurrency
  await t("ROUND-CONC", "two simultaneous open requests on one draft", "exactly one 200 and one 409, no 500", async () => {
    const id = await mkRound("hr", ctx.teamB);
    const rs = await Promise.all([req("POST", `/api/rounds/${id}/open`, { as: "hr" }), req("POST", `/api/rounds/${id}/open`, { as: "mB" })]);
    const codes = rs.map((r) => r.status).sort();
    await closeR(id);
    return { ok: codes.join() === "200,409", actual: `statuses ${codes}` };
  });
  await t("ROUND-CONC", "five simultaneous close requests on one open round", "exactly one 200, others 409, no 500", async () => {
    const id = await mkOpenRound(ctx.teamB);
    const rs = await Promise.all([1, 2, 3, 4, 5].map((i) => closeR(id, i % 2 ? "hr" : "mB")));
    const codes = rs.map((r) => r.status).sort();
    return { ok: codes.filter((c) => c === 200).length === 1 && codes.every((c) => c === 200 || c === 409), actual: `statuses ${codes}` };
  });
  await t("ROUND-CONC", "simultaneous open and close on a draft", "no 500; final state is consistent (OPEN or CLOSED)", async () => {
    const id = await mkRound("hr", ctx.teamB);
    const rs = await Promise.all([req("POST", `/api/rounds/${id}/open`, { as: "hr" }), closeR(id, "mB")]);
    const row = await db.round.findUnique({ where: { id } });
    if (row.status === "OPEN") await closeR(id);
    return { ok: rs.every((r) => [200, 409].includes(r.status)) && ["OPEN", "CLOSED"].includes(row.status), actual: `open ${rs[0].status}, close ${rs[1].status}, final ${row.status}` };
  });
  await t("ROUND-CONC", "10 simultaneous round creations", "all 201, 10 distinct ids, no 500", async () => {
    const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => C({ ...base(), name: "QA paralelné " + i }, i % 2 ? "hr" : "mB")));
    const ids = new Set(rs.map((r) => r.json?.round?.id));
    return { ok: rs.every((r) => r.status === 201) && ids.size === 10, actual: `statuses ${rs.map((r) => r.status)}` };
  });
  await t("ROUND-DB", "every round has 3–5 RoundQuestion rows with contiguous positions and the fixed question first", "holds for all rounds in the DB", async () => {
    const rounds = await db.round.findMany({ include: { questions: { orderBy: { position: "asc" } } } });
    const bad = rounds.filter((r) => r.questions.length < 3 || r.questions.length > 5 || r.questions.some((x, i) => x.position !== i + 1) || r.questions[0].questionId !== ctx.fixed.id);
    return { ok: bad.length === 0, actual: `${rounds.length} rounds checked, ${bad.length} violating` };
  });
}
