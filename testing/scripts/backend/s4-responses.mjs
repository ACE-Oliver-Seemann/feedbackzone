// Suite 4: submitting responses, confidentiality of storage, DB constraints (MVP-08, MVP-09, NFR-01).
import fs from "node:fs";
import path from "node:path";
import { ROOT, closeR, ctx, db, is, keysOf, mkOpenRound, req, reset, suite, submit, t } from "./lib.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const MARKER = "QA-MARKER-7f3a91-dôverný komentár";

export default async function run() {
  suite("S4 Responses & confidentiality storage", "fresh seed + demo data; open 4-question round for team Beta created by HR");
  await reset(true);
  const R = await mkOpenRound(ctx.teamB, 3); // fixed + 3 = 4 questions
  const bad = (r, f = "answers") => r.status === 400 && r.json?.fields?.[f] !== undefined;

  await t("FILL", "GET /api/rounds/:id as team member", "200 round{id,name,teamId,status=OPEN,closesAt,submitted=false,questions[4]{position,text,scale}} – no question ids, no participation", async () => {
    const r = await req("GET", `/api/rounds/${R}`, { as: "b1" });
    const x = r.json.round;
    return { ok: r.status === 200 && keysOf(x) === "closesAt,id,name,questions,status,submitted,teamId" && x.submitted === false && x.questions.length === 4 && keysOf(x.questions[0]) === "position,scale,text" && x.questions[0].position === 1, actual: `${r.status} keys=${keysOf(x)} q=${x.questions.length}` };
  });
  for (const [label, body] of [
    ["answers missing", {}], ["answers not an array", { answers: "3333" }], ["answers object", { answers: { 0: 3, 1: 3, 2: 3, 3: 3 } }], ["too few answers (3 of 4)", { answers: [3, 3, 3] }],
    ["too many answers (5 of 4)", { answers: [3, 3, 3, 3, 3] }], ["value 0", { answers: [0, 3, 3, 3] }], ["value 6", { answers: [3, 3, 3, 6] }], ["value -1", { answers: [-1, 3, 3, 3] }],
    ["value 3.5", { answers: [3.5, 3, 3, 3] }], ["value '3' (string)", { answers: ["3", 3, 3, 3] }], ["value null", { answers: [null, 3, 3, 3] }], ["value true", { answers: [true, 3, 3, 3] }],
    ["value [3] (nested)", { answers: [[3], 3, 3, 3] }], ["value 1e400 (Infinity)", '{"answers":[1e400,3,3,3]}'], ["value 99999999999999999999", '{"answers":[99999999999999999999,3,3,3]}'], ["empty array", { answers: [] }],
  ]) {
    await t("FILL-VALID", `invalid submission: ${label}`, "400 validation_error fields.answers; nothing stored (MVP-08)", async () => {
      const r = typeof body === "string" ? await req("POST", `/api/rounds/${R}/responses`, { as: "b1", raw: body, headers: { "content-type": "application/json" } }) : await req("POST", `/api/rounds/${R}/responses`, { as: "b1", body });
      return bad(r);
    });
  }
  for (const [label, comment, code] of [["comment as number", 5, "invalid"], ["comment as object", { a: 1 }, "invalid"], ["comment as array", ["x"], "invalid"], ["comment 1001 characters", "k".repeat(1001), "too_long"], ["comment 5 MB", "k".repeat(5 * 1024 * 1024), "too_long"]]) {
    await t("FILL-VALID", `invalid submission: ${label}`, `400 fields.comment=${code}; no 500`, async () => {
      const r = await submit("b1", R, [3, 3, 3, 3], comment);
      return { ok: r.status === 400 && r.json?.fields?.comment === code, actual: `${r.status} ${r.text.slice(0, 100)} in ${r.ms} ms` };
    });
  }
  for (const [label, raw] of [["malformed JSON", '{"answers":[3,3,3,3]'], ["empty body", ""], ["JSON array body", "[3,3,3,3]"], ["text/plain garbage", "answers=3"]]) {
    await t("FILL-VALID", `invalid submission: ${label}`, "400 invalid_json", async () => is(await req("POST", `/api/rounds/${R}/responses`, { as: "b1", raw, headers: { "content-type": "application/json" } }), 400, "invalid_json"));
  }
  await t("FILL-DB", "after 25 rejected submissions nothing is stored", "0 Participation and 0 Response rows for the round", async () => {
    const p = await db.participation.count({ where: { roundId: R } }), s = await db.response.count({ where: { roundId: R } });
    return { ok: p === 0 && s === 0, actual: `participations=${p} responses=${s}` };
  });

  // --- valid submissions ---
  await t("FILL", "valid submission with comment (b1)", "201 exactly {ok:true} – no response id, no timestamp (NFR-01)", async () => {
    const r = await submit("b1", R, [1, 2, 3, 4], MARKER);
    return { ok: r.status === 201 && r.text === '{"ok":true}', actual: `${r.status} ${r.text}` };
  });
  await t("FILL", "second submission by the same user", "409 already_submitted (MVP-09)", async () => is(await submit("b1", R, [5, 5, 5, 5]), 409, "already_submitted"));
  await t("FILL", "second submission with an invalid body", "409 or 400 – never stored", async () => {
    const r = await submit("b1", R, [9, 9, 9, 9]);
    return [400, 409].includes(r.status) && (await db.response.count({ where: { roundId: R } })) === 1;
  });
  await t("FILL-DB", "one Participation and one Response row; values and comment stored as sent", "participation(round,b1) exists; response v1..v4 = 1,2,3,4, v5 null, comment = marker", async () => {
    const p = await db.participation.findMany({ where: { roundId: R } });
    const s = await db.response.findMany({ where: { roundId: R } });
    const x = s[0];
    return { ok: p.length === 1 && p[0].userId === ctx.users.b1.id && s.length === 1 && [x.v1, x.v2, x.v3, x.v4].join() === "1,2,3,4" && x.v5 === null && x.comment === MARKER && x.teamId === ctx.teamB, actual: `participations=${p.length} responses=${s.length} values=${[x.v1, x.v2, x.v3, x.v4, x.v5]}` };
  });
  await t("FILL", "GET /api/rounds/:id after submitting", "submitted=true for b1, false for b2", async () => {
    const a = await req("GET", `/api/rounds/${R}`, { as: "b1" }), b = await req("GET", `/api/rounds/${R}`, { as: "b2" });
    return a.json.round.submitted === true && b.json.round.submitted === false;
  });
  await t("FILL", "mass assignment in submission: id, userId, teamId, roundId, createdAt (b2)", "201; stored row has a server-generated UUID, team Beta, this round", async () => {
    const r = await req("POST", `/api/rounds/${R}/responses`, { as: "b2", body: { answers: [2, 2, 2, 2], id: "qa-fixed-id", userId: ctx.users.b3.id, teamId: ctx.teamA, roundId: ctx.round(ctx.teamA, "48. týždeň").id, createdAt: "2020-01-01" } });
    const rows = await db.response.findMany({ where: { roundId: R } });
    const p = await db.participation.findMany({ where: { roundId: R } });
    return { ok: r.status === 201 && rows.length === 2 && rows.every((x) => UUID.test(x.id) && x.teamId === ctx.teamB) && p.some((x) => x.userId === ctx.users.b2.id) && !p.some((x) => x.userId === ctx.users.b3.id), actual: `${r.status}; rows=${rows.length}; all ids UUIDv4=${rows.every((x) => UUID.test(x.id))}; participation recorded for sender only` };
  });
  await t("FILL", "comment exactly 1000 characters (b3)", "201", async () => is(await submit("b3", R, [3, 3, 3, 3], "ž".repeat(1000)), 201));
  await t("FILL", "comment with unicode, emoji, HTML/script and SQL text (b4)", "201; stored and returned verbatim, DB intact", async () => {
    const c = `Ľúbim 🚀 <img src=x onerror=alert(1)> <script>alert('x')</script> '; DROP TABLE "Response";-- \${7*7} {{7*7}}`;
    const r = await submit("b4", R, [4, 4, 4, 4], c);
    const row = await db.response.findFirst({ where: { roundId: R, comment: c } });
    return r.status === 201 && !!row && (await db.response.count()) > 0;
  });
  await t("FILL", "whitespace-only comment is stored as NULL (b5)", "201; comment NULL", async () => {
    const r = await submit("b5", R, [5, 5, 5, 5], "   \n\t ");
    const rows = await db.response.findMany({ where: { roundId: R, v1: 5 } });
    return r.status === 201 && rows.length === 1 && rows[0].comment === null;
  });
  await t("FILL", "manager of the team fills in the round too (mB)", "201 (permission matrix: manager has employee rights in own team)", async () => is(await submit("mB", R, [3, 4, 3, 4], null), 201));
  await t("FILL", "unknown round id as employee", "403 (existence not revealed)", async () => is(await submit("b1", "cmnope000000000000000000", [3, 3, 3, 3]), 403));

  // --- confidentiality of storage (NFR-01) ---
  await t("NFR-01-DB", "Response table has no user and no time column", "columns exactly id,roundId,teamId,v1..v5,comment", async () => {
    const cols = (await db.$queryRawUnsafe(`PRAGMA table_info("Response")`)).map((c) => c.name).join(",");
    return { ok: cols === "id,roundId,teamId,v1,v2,v3,v4,v5,comment", actual: cols };
  });
  await t("NFR-01-DB", "Participation table has only roundId,userId", "columns exactly roundId,userId, PK (roundId,userId)", async () => {
    const info = await db.$queryRawUnsafe(`PRAGMA table_info("Participation")`);
    return { ok: info.map((c) => c.name).join(",") === "roundId,userId" && info.every((c) => Number(c.pk) > 0), actual: info.map((c) => `${c.name}(pk=${c.pk})`).join(",") };
  });
  await t("NFR-01-DB", "Response and Participation are WITHOUT ROWID in the live schema (all 5 migrations applied)", "sqlite_master sql ends with WITHOUT ROWID for both", async () => {
    const rows = await db.$queryRawUnsafe(`select name, sql from sqlite_master where type='table' and name in ('Response','Participation')`);
    return { ok: rows.length === 2 && rows.every((r) => /WITHOUT ROWID\s*$/i.test(r.sql)), actual: rows.map((r) => `${r.name}: ${/WITHOUT ROWID\s*$/i.test(r.sql)}`).join("; ") };
  });
  await t("NFR-01-DB", "hidden rowid cannot be selected from Response", "SQL error (no such column: rowid)", async () => {
    try { await db.$queryRawUnsafe(`select rowid from "Response" limit 1`); return { ok: false, actual: "rowid is selectable" }; } catch (e) { return { ok: /rowid/i.test(e.message), actual: "error: no such column rowid" }; }
  });
  await t("NFR-01-DB", "all Response ids are random UUID v4", "every id matches UUID v4", async () => {
    const rows = await db.response.findMany({ select: { id: true } });
    return { ok: rows.every((x) => UUID.test(x.id)), actual: `${rows.length} rows, non-UUID: ${rows.filter((x) => !UUID.test(x.id)).length}` };
  });
  await t("NFR-01-DB", "physical order of Response rows does not follow submission order", "rows of the round come back ordered by random id, not by b1,b2,b3,b4,b5,mB submission order", async () => {
    const rows = await db.$queryRawUnsafe(`select v1, v2 from "Response" where roundId = ?`, R);
    const order = rows.map((x) => `${x.v1}${x.v2}`).join(",");
    const submitted = "12,22,33,44,55,34";
    return { ok: order !== submitted, actual: `scan order ${order}; submission order ${submitted}` };
  });
  await t("NFR-01-DB", "no table other than Participation links a user to a round's response", "no column named userId/createdAt/updatedAt on Response; no triggers; no extra tables", async () => {
    const tables = (await db.$queryRawUnsafe(`select name from sqlite_master where type='table'`)).map((x) => x.name).filter((n) => !n.startsWith("_") && !n.startsWith("sqlite"));
    const triggers = await db.$queryRawUnsafe(`select name from sqlite_master where type='trigger'`);
    return { ok: triggers.length === 0 && tables.length === 11, actual: `tables: ${tables.join(",")}; triggers: ${triggers.length}` };
  });
  await t("NFR-01-DB", "for every round: number of Participation rows = number of Response rows", "equal for all rounds (single transaction)", async () => {
    const rows = await db.$queryRawUnsafe(`select r.id, (select count(*) from "Participation" p where p.roundId=r.id) as p, (select count(*) from "Response" s where s.roundId=r.id) as s from "Round" r`);
    const badRows = rows.filter((x) => Number(x.p) !== Number(x.s));
    return { ok: badRows.length === 0, actual: `${rows.length} rounds, mismatching: ${badRows.length}` };
  });
  await t("NFR-01-LOG", "server log does not contain the body of a submitted response", "marker comment text not present in evidence/server-backend.log", async () => {
    const log = fs.readFileSync(path.join(ROOT, "testing/reports/2026-11-12_001/evidence/server-backend.log"), "utf8");
    return { ok: !log.includes("QA-MARKER-7f3a91"), actual: `log size ${log.length} bytes; marker found: ${log.includes("QA-MARKER-7f3a91")}` };
  }, { steps: "read testing/reports/2026-11-12_001/evidence/server-backend.log (stdout+stderr of the QA server) after the submissions above" });

  // --- DB constraints (raw SQL against qa-backend.db) ---
  const ins = (v) => db.$executeRawUnsafe(`insert into "Response" (id, roundId, teamId, v1, v2, v3, v4, v5, comment) values (?,?,?,?,?,?,?,?,?)`, ...v);
  const rejects = async (v) => { try { await ins(v); await db.$executeRawUnsafe(`delete from "Response" where id = ?`, v[0]); return { ok: false, actual: "row was inserted" }; } catch (e) { return { ok: true, actual: "rejected: " + (/CHECK|FOREIGN|UNIQUE|NOT NULL/i.exec(e.message)?.[0] ?? e.message.slice(0, 80)) }; } };
  const U = () => crypto.randomUUID();
  for (const [label, row] of [
    ["v1 = 0", (u) => [u, R, ctx.teamB, 0, 3, 3, null, null, null]], ["v1 = 6", (u) => [u, R, ctx.teamB, 6, 3, 3, null, null, null]], ["v2 = 2.5 (real)", (u) => [u, R, ctx.teamB, 3, 2.5, 3, null, null, null]],
    ["v3 = 'x' (text)", (u) => [u, R, ctx.teamB, 3, 3, "x", null, null, null]], ["v4 = 7", (u) => [u, R, ctx.teamB, 3, 3, 3, 7, null, null]], ["v5 = 0", (u) => [u, R, ctx.teamB, 3, 3, 3, 3, 0, null]],
    ["v1 NULL", (u) => [u, R, ctx.teamB, null, 3, 3, null, null, null]], ["comment of 1001 characters", (u) => [u, R, ctx.teamB, 3, 3, 3, null, null, "c".repeat(1001)]],
    ["unknown roundId (foreign key)", (u) => [u, "cmnope000000000000000000", ctx.teamB, 3, 3, 3, null, null, null]], ["unknown teamId (foreign key)", (u) => [u, R, "cmnope000000000000000000", 3, 3, 3, null, null, null]],
  ]) {
    await t("DB-CONSTRAINT", `raw INSERT into Response with ${label}`, "rejected by the database (CHECK / NOT NULL / FOREIGN KEY)", async () => rejects(row(U())), { steps: `raw SQL INSERT into "Response" with ${label}` });
  }
  await t("DB-CONSTRAINT", "raw INSERT of a duplicate Participation (same round, same user)", "rejected (primary key)", async () => {
    try { await db.$executeRawUnsafe(`insert into "Participation" (roundId, userId) values (?,?)`, R, ctx.users.b1.id); return { ok: false, actual: "duplicate inserted" }; } catch (e) { return { ok: true, actual: "rejected: UNIQUE/PK" }; }
  });
  await t("DB-CONSTRAINT", "raw INSERT of Participation for an unknown user (foreign key)", "rejected", async () => {
    try { await db.$executeRawUnsafe(`insert into "Participation" (roundId, userId) values (?,?)`, R, "cmnope000000000000000000"); await db.$executeRawUnsafe(`delete from "Participation" where userId='cmnope000000000000000000'`); return { ok: false, actual: "inserted" }; } catch (e) { return { ok: true, actual: "rejected: FOREIGN KEY" }; }
  });
  await t("DB-CONSTRAINT", "transaction rollback: Participation + invalid Response in one transaction", "whole transaction fails, Participation row is not left behind", async () => {
    const R2 = await mkOpenRound(ctx.teamB, 3);
    let failed = false;
    try {
      await db.$transaction([
        db.participation.create({ data: { roundId: R2, userId: ctx.users.b1.id } }),
        db.$executeRawUnsafe(`insert into "Response" (id, roundId, teamId, v1, v2, v3) values (?,?,?,?,?,?)`, U(), R2, ctx.teamB, 9, 3, 3),
      ]);
    } catch { failed = true; }
    const p = await db.participation.count({ where: { roundId: R2 } });
    await closeR(R2);
    return { ok: failed && p === 0, actual: `transaction failed=${failed}; participations left=${p}` };
  }, { steps: "Prisma $transaction on qa-backend.db: participation.create + raw INSERT Response with v1=9" });
  await t("DB-CONSTRAINT", "deleting a round that has responses is restricted", "DELETE rejected (ON DELETE RESTRICT)", async () => {
    try { await db.$executeRawUnsafe(`delete from "Round" where id = ?`, R); return { ok: false, actual: "round deleted" }; } catch { return { ok: true, actual: "rejected: FOREIGN KEY" }; }
  });
  await t("DB-CONSTRAINT", "User.email is unique", "second user with an existing e-mail rejected", async () => {
    try { await db.$executeRawUnsafe(`insert into "User" (id,name,email,passwordHash,role) values ('qa-dup','QA','hr@example.test','x','EMPLOYEE')`); await db.$executeRawUnsafe(`delete from "User" where id='qa-dup'`); return { ok: false, actual: "inserted" }; } catch { return { ok: true, actual: "rejected: UNIQUE" }; }
  });
  await t("DB-CONSTRAINT", "passwords are stored only as bcrypt hashes", "every passwordHash starts with $2 and none equals the plain password (NFR-05)", async () => {
    const us = await db.user.findMany({ select: { passwordHash: true } });
    return { ok: us.every((u) => /^\$2[aby]\$\d\d\$.{53}$/.test(u.passwordHash)), actual: `${us.length} users, all bcrypt: ${us.every((u) => /^\$2[aby]\$/.test(u.passwordHash))}` };
  });
  await t("DB-INTEGRITY", "no orphaned rows in any relation", "0 orphans for Response, Participation, RoundQuestion, Action, Kudos, Issue, User.teamId, Team.managerId", async () => {
    const checks = {
      response_round: `select count(*) c from "Response" x where not exists (select 1 from "Round" r where r.id=x.roundId)`,
      response_team: `select count(*) c from "Response" x where not exists (select 1 from "Team" r where r.id=x.teamId)`,
      response_team_matches_round: `select count(*) c from "Response" x join "Round" r on r.id=x.roundId where r.teamId<>x.teamId`,
      participation_user: `select count(*) c from "Participation" x where not exists (select 1 from "User" r where r.id=x.userId)`,
      participation_other_team: `select count(*) c from "Participation" x join "Round" r on r.id=x.roundId join "User" u on u.id=x.userId where u.teamId<>r.teamId`,
      roundquestion: `select count(*) c from "RoundQuestion" x where not exists (select 1 from "Question" q where q.id=x.questionId) or not exists (select 1 from "Round" r where r.id=x.roundId)`,
      action_round: `select count(*) c from "Action" x where not exists (select 1 from "Round" r where r.id=x.roundId)`,
      kudos_users: `select count(*) c from "Kudos" x where not exists (select 1 from "User" u where u.id=x.fromUserId) or not exists (select 1 from "User" u where u.id=x.toUserId)`,
      user_team: `select count(*) c from "User" x where x.teamId is not null and not exists (select 1 from "Team" t where t.id=x.teamId)`,
      team_manager: `select count(*) c from "Team" x where not exists (select 1 from "User" u where u.id=x.managerId and u.role='MANAGER')`,
      response_answer_count_matches_questions: `select count(*) c from "Response" x where (select count(*) from "RoundQuestion" q where q.roundId=x.roundId) <> 3 + (x.v4 is not null) + (x.v5 is not null)`,
    };
    const out = {};
    for (const [k, sql] of Object.entries(checks)) out[k] = Number((await db.$queryRawUnsafe(sql))[0].c);
    return { ok: Object.values(out).every((v) => v === 0), actual: JSON.stringify(out) };
  });
  await t("DB-INTEGRITY", "foreign key enforcement is on for the application's connection type", "PRAGMA foreign_keys = 1", async () => {
    const v = await db.$queryRawUnsafe(`PRAGMA foreign_keys`);
    return { ok: Number(Object.values(v[0])[0]) === 1, actual: JSON.stringify(v, (k, x) => (typeof x === "bigint" ? Number(x) : x)) };
  });

  // --- odd characters ---
  const R3 = await mkOpenRound(ctx.teamB, 2); // 3 questions
  await t("FILL", "3-question round: 3 answers", "201; v4 and v5 NULL", async () => {
    const r = await submit("b1", R3, [5, 4, 3]);
    const row = await db.response.findFirst({ where: { roundId: R3 } });
    return r.status === 201 && row.v4 === null && row.v5 === null;
  });
  await t("FILL", "3-question round: 4 answers", "400 fields.answers", async () => bad(await submit("b2", R3, [5, 4, 3, 2])));
  await t("FILL", "comment containing a NUL character (\\u0000)", "201 or 400 – no 500", async () => {
    const r = await submit("b2", R3, [3, 3, 3], "pred\u0000za");
    return { ok: [201, 400].includes(r.status), actual: `${r.status} ${r.text.slice(0, 100)}` };
  });
  await t("FILL", "comment containing a lone surrogate (\\ud800)", "201 or 400 – no 500", async () => {
    const r = await req("POST", `/api/rounds/${R3}/responses`, { as: "b3", raw: '{"answers":[3,3,3],"comment":"zly \\ud800 znak"}', headers: { "content-type": "application/json" } });
    return { ok: [201, 400].includes(r.status), actual: `${r.status} ${r.text.slice(0, 100)}` };
  });
  await t("FILL", "comment of 1000 emoji (2000 UTF-16 units, 1000 characters)", "201 – MVP-08 limit is 1 000 characters", async () => {
    const r = await submit("b4", R3, [3, 3, 3], "🚀".repeat(1000));
    return { ok: r.status === 201, actual: `${r.status} ${r.text.slice(0, 100)} (server counts UTF-16 units, DB CHECK counts characters)` };
  });
  await t("FILL", "duplicate JSON key 'answers' (last one wins)", "201 or 400, deterministic, no 500", async () => {
    const r = await req("POST", `/api/rounds/${R3}/responses`, { as: "b5", raw: '{"answers":[9,9,9],"answers":[2,2,2]}', headers: { "content-type": "application/json" } });
    return [201, 400].includes(r.status);
  });
  await t("FILL", "__proto__ / constructor keys in the body", "201 or 400; no prototype pollution (later requests behave normally)", async () => {
    const r = await req("POST", `/api/rounds/${R3}/responses`, { as: "mB", raw: '{"answers":[2,2,2],"__proto__":{"role":"HR","comment":"x"},"constructor":{"prototype":{"role":"HR"}}}', headers: { "content-type": "application/json" } });
    const me = await req("GET", "/api/me", { as: "b1" });
    return [201, 400].includes(r.status) && me.json.user.role === "EMPLOYEE";
  });

  // --- concurrency ---
  const R4 = await mkOpenRound(ctx.teamB, 3);
  await t("FILL-CONC", "the same user sends 6 identical submissions at once", "exactly one 201, five 409, one Response row (MVP-09)", async () => {
    const rs = await Promise.all(Array.from({ length: 6 }, () => submit("b1", R4, [4, 4, 4, 4], "paralelne")));
    const codes = rs.map((r) => r.status).sort();
    const n = await db.response.count({ where: { roundId: R4 } }), p = await db.participation.count({ where: { roundId: R4 } });
    return { ok: codes.filter((c) => c === 201).length === 1 && codes.filter((c) => c === 409).length === 5 && n === 1 && p === 1, actual: `statuses ${codes}; responses=${n} participations=${p}` };
  });
  await t("FILL-CONC", "five different users submit at the same moment", "all 201, 5 new rows, no 500 (SQLite write contention)", async () => {
    const rs = await Promise.all(["b2", "b3", "b4", "b5", "mB"].map((u) => submit(u, R4, [3, 3, 3, 3])));
    const codes = rs.map((r) => r.status);
    const n = await db.response.count({ where: { roundId: R4 } });
    return { ok: codes.every((c) => c === 201) && n === 6, actual: `statuses ${codes}; responses in round=${n}` };
  });
  const R5 = await mkOpenRound(ctx.teamB, 3);
  await t("FILL-CONC", "submission racing with closing the round", "no 500; if the submission got 201 the row exists, if 409 it does not", async () => {
    const [s, c] = await Promise.all([submit("b1", R5, [3, 3, 3, 3]), closeR(R5)]);
    const n = await db.response.count({ where: { roundId: R5 } });
    return { ok: c.status === 200 && ((s.status === 201 && n === 1) || (s.status === 409 && n === 0)), actual: `submit ${s.status}, close ${c.status}, rows=${n}` };
  });
  await t("FILL-CONC", "30 parallel mixed reads while 5 users submit", "no 500 on any request", async () => {
    const R6 = await mkOpenRound(ctx.teamB, 3);
    const jobs = [];
    for (const u of ["b1", "b2", "b3", "b4", "b5"]) jobs.push(submit(u, R6, [2, 3, 4, 5]));
    for (let i = 0; i < 10; i++) jobs.push(req("GET", "/api/rounds", { as: "hr" }), req("GET", `/api/teams/${ctx.teamB}/summary`, { as: "mB" }), req("GET", "/api/hr/overview", { as: "hr" }));
    const rs = await Promise.all(jobs);
    const codes = {};
    for (const r of rs) codes[r.status] = (codes[r.status] ?? 0) + 1;
    await closeR(R6);
    return { ok: rs.every((r) => r.status < 500 && r.status > 0), actual: JSON.stringify(codes) };
  });
}
