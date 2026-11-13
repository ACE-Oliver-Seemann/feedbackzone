// Suite 5: results, confidentiality threshold everywhere, suggestions, summary, trend, heatmap
// (MVP-10, MVP-11, MVP-14, NFR-01, NFR-02, IT-08, IT-09).
import { closeR, ctx, db, is, keysOf, mkRound, req, reset, suite, submit, t } from "./lib.mjs";

const UUID_ANY = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const r2 = (x) => Math.round(x * 100) / 100;

export default async function run() {
  suite("S5 Results, threshold 4 vs 5, suggestions, summary, trend, heatmap", "fresh seed + demo; Beta rounds RA (4 responses) and RB (5 responses, known values) created and closed through the API");
  await reset(true);
  const workload = ctx.byText("záťaž bola"), overtime = ctx.byText("nadčas"), feedback = ctx.byText("Spätná väzba od môjho");
  const open = async (picked) => { const id = await mkRound("hr", ctx.teamB, picked); await req("POST", `/api/rounds/${id}/open`, { as: "hr" }); return id; };

  const RA = await open([workload, overtime, feedback]);
  const answers = { b1: [4, 2, 5, 3], b2: [5, 3, 4, 2], b3: [3, 1, 5, 4], b4: [4, 2, 4, 3], b5: [2, 2, 5, 1] };
  const comments = { b1: "QA komentár jeden", b2: "QA komentár dva", b3: "QA komentár tri", b4: "QA komentár štyri" };
  for (const u of ["b1", "b2", "b3", "b4"]) await submit(u, RA, answers[u], comments[u]);
  const RB = await open([workload, overtime, feedback]);
  for (const u of ["b1", "b2", "b3", "b4", "b5"]) await submit(u, RB, answers[u], comments[u]);
  const G = (p, as) => req("GET", p, { as });

  // ---- open round: participation only ----
  await t("RESULTS", "OPEN round with 5 responses: results as manager", "200 status=not_closed, keys round,participation,status only; responded=5, teamSize=6 (MVP-10)", async () => {
    const r = await G(`/api/rounds/${RB}/results`, "mB");
    return { ok: r.status === 200 && keysOf(r.json) === "participation,round,status" && r.json.status === "not_closed" && r.json.participation.responded === 5 && r.json.participation.teamSize === 6, actual: `${r.status} keys=${keysOf(r.json)} ${JSON.stringify(r.json.participation)}` };
  });
  await t("RESULTS", "OPEN round: suggestions", "200 exactly {status:not_closed} (IT-09)", async () => (await G(`/api/rounds/${RB}/suggestions`, "mB")).text === '{"status":"not_closed"}');
  await t("RESULTS", "OPEN round is not on the team page nor in the trend", "summary.rounds and trend.points do not contain it", async () => {
    const s = await G(`/api/teams/${ctx.teamB}/summary`, "b1"), tr = await G(`/api/teams/${ctx.teamB}/trend`, "mB");
    return !s.json.rounds.some((x) => x.id === RB) && !tr.json.points.some((x) => x.roundId === RB);
  });
  await closeR(RA); await closeR(RB);

  // ---- below threshold (4) ----
  for (const who of ["mB", "hr"]) {
    await t("THRESHOLD", `closed round with 4 responses: results as ${who}`, "200 status=insufficient_responses, responseCount=4; NO questions, averages, distribution or comments (MVP-11, NFR-02)", async () => {
      const r = await G(`/api/rounds/${RA}/results`, who);
      return { ok: r.status === 200 && keysOf(r.json) === "participation,responseCount,round,status" && r.json.status === "insufficient_responses" && r.json.responseCount === 4 && !/komentár|average|distribution/.test(r.text), actual: `${r.status} keys=${keysOf(r.json)} status=${r.json.status} count=${r.json.responseCount}` };
    });
  }
  await t("THRESHOLD", "4 responses: suggestions", "200 exactly {status:insufficient_responses,responseCount:4} – no suggestions (IT-09)", async () => {
    const r = await G(`/api/rounds/${RA}/suggestions`, "mB");
    return { ok: r.text === '{"status":"insufficient_responses","responseCount":4}', actual: r.text };
  });
  for (const who of ["b5", "mB", "hr"]) {
    await t("THRESHOLD", `4 responses: team summary as ${who}`, "round present with participation 4/6 and results exactly {status:insufficient_responses} – no averages (MVP-14)", async () => {
      const r = await G(`/api/teams/${ctx.teamB}/summary`, who);
      const x = r.json.rounds.find((y) => y.id === RA);
      return { ok: !!x && JSON.stringify(x.results) === '{"status":"insufficient_responses"}' && x.participation.responded === 4 && x.participation.teamSize === 6, actual: JSON.stringify({ results: x?.results, participation: x?.participation }) };
    });
  }
  await t("THRESHOLD", "4 responses: trend point", "point has status insufficient_responses, responded 4 and no fixed/topics keys (IT-08)", async () => {
    const r = await G(`/api/teams/${ctx.teamB}/trend`, "mB");
    const p = r.json.points.find((x) => x.roundId === RA);
    return { ok: keysOf(p) === "closedAt,responded,roundId,roundName,status" && p.status === "insufficient_responses" && p.responded === 4, actual: JSON.stringify(p) };
  });
  await t("THRESHOLD", "closed round with 0 responses", "insufficient_responses, responseCount 0, no division by zero / 500", async () => {
    const id = await open(3); await closeR(id);
    const r = await G(`/api/rounds/${id}/results`, "hr"), s = await G(`/api/rounds/${id}/suggestions`, "hr");
    return r.status === 200 && r.json.status === "insufficient_responses" && r.json.responseCount === 0 && s.json.status === "insufficient_responses";
  });
  await t("THRESHOLD", "seed round of team Beta with 4 responses (acceptance scenario step 4)", "manager Beta gets insufficient_responses", async () => {
    const r = await G(`/api/rounds/${ctx.round(ctx.teamB, "záťaž a sústredenie").id}/results`, "mB");
    return r.json.status === "insufficient_responses" && r.json.responseCount === 4;
  });

  // ---- at threshold (5) ----
  let res;
  await t("RESULTS", "closed round with exactly 5 responses: results as manager", "200 status=ok, responseCount=5, 4 questions, 4 comments (threshold is inclusive, NFR-02)", async () => {
    res = (await G(`/api/rounds/${RB}/results`, "mB")).json;
    return { ok: res.status === "ok" && res.responseCount === 5 && res.questions.length === 4 && res.comments.length === 4 && keysOf(res) === "comments,participation,questions,responseCount,round,status", actual: `status=${res.status} count=${res.responseCount} questions=${res.questions.length} comments=${res.comments.length}` };
  });
  await t("RESULTS", "averages are computed correctly", "averages 3.6, 2, 4.6, 2.6 in question order (fixed first)", async () => ({ ok: res.questions.map((q) => q.average).join() === "3.6,2,4.6,2.6", actual: res.questions.map((q) => q.average).join() }));
  await t("RESULTS", "distributions are computed correctly and sum to the number of responses", "Q2 distribution [1,3,1,0,0]; every distribution sums to 5", async () => ({ ok: res.questions[1].distribution.join() === "1,3,1,0,0" && res.questions.every((q) => q.distribution.reduce((a, b) => a + b, 0) === 5), actual: JSON.stringify(res.questions.map((q) => q.distribution)) }));
  await t("RESULTS", "question order and scales", "position 1 is the fixed question (QUALITY), overtime question has scale OVERTIME", async () => res.questions[0].text === ctx.fixed.text && res.questions[0].scale === "QUALITY" && res.questions[2].scale === "OVERTIME" && res.questions.map((q) => q.position).join() === "1,2,3,4");
  await t("RESULTS", "question result shape", "keys average,distribution,position,scale,text only", async () => res.questions.every((q) => keysOf(q) === "average,distribution,position,scale,text"));
  await t("RESULTS", "comments are exactly the submitted comments, as plain strings", "set equals the 4 submitted comments; items are strings without any metadata", async () => res.comments.every((c) => typeof c === "string") && [...res.comments].sort().join("|") === Object.values(comments).sort().join("|"));
  await t("RESULTS", "comments come in random order (15 calls)", "more than one distinct order observed (MVP-10)", async () => {
    const orders = new Set();
    for (let i = 0; i < 15; i++) orders.add((await G(`/api/rounds/${RB}/results`, "mB")).json.comments.join("|"));
    return { ok: orders.size > 1, actual: `${orders.size} distinct orders in 15 calls` };
  });
  await t("RESULTS", "HR sees the same results as the manager", "identical questions and responseCount (MVP-12)", async () => {
    const h = (await G(`/api/rounds/${RB}/results`, "hr")).json;
    return JSON.stringify(h.questions) === JSON.stringify(res.questions) && h.responseCount === 5;
  });
  await t("NFR-01-API", "results expose no response id, user id, user name or e-mail", "no UUID, no user id, no member name, no e-mail in the JSON", async () => {
    const txt = (await G(`/api/rounds/${RB}/results`, "mB")).text;
    const leaks = [];
    if (UUID_ANY.test(txt)) leaks.push("uuid");
    for (const u of Object.values(ctx.users)) { if (txt.includes(u.id)) leaks.push("userId:" + u.email); if (txt.includes(u.name)) leaks.push("name:" + u.name); if (txt.includes(u.email)) leaks.push("email"); }
    return { ok: leaks.length === 0, actual: leaks.length ? leaks.join(",") : "no identifiers found" };
  });
  await t("NFR-01-API", "team summary, trend, suggestions, heatmap and round list expose no response id or respondent identity", "no UUID anywhere; no user ids; member names only inside kudos", async () => {
    const leaks = [];
    const s = (await G(`/api/teams/${ctx.teamB}/summary`, "mB")).json;
    const texts = { summaryRounds: JSON.stringify(s.rounds), trend: (await G(`/api/teams/${ctx.teamB}/trend`, "mB")).text, sugg: (await G(`/api/rounds/${RB}/suggestions`, "mB")).text, heat: (await G(`/api/hr/heatmap`, "hr")).text, list: (await G(`/api/rounds`, "mB")).text, overview: (await G(`/api/hr/overview`, "hr")).text };
    for (const [k, txt] of Object.entries(texts)) {
      if (UUID_ANY.test(txt)) leaks.push(k + ":uuid");
      for (const u of Object.values(ctx.users)) if (txt.includes(u.id) || txt.includes(u.name) || txt.includes(u.email)) leaks.push(`${k}:${u.email}`);
    }
    return { ok: leaks.length === 0, actual: leaks.length ? leaks.join(",") : "no identifiers found in 6 endpoints" };
  });
  await t("NFR-01-API", "comments appear only in results – not in summary, trend, suggestions, heatmap, round list, issues", "comment text 'QA komentár' absent from all other endpoints (mvp.md API section, IT-08, IT-09)", async () => {
    const hits = [];
    for (const [p, as] of [[`/api/teams/${ctx.teamB}/summary`, "b1"], [`/api/teams/${ctx.teamB}/summary`, "hr"], [`/api/teams/${ctx.teamB}/trend`, "mB"], [`/api/rounds/${RB}/suggestions`, "mB"], ["/api/hr/heatmap", "hr"], ["/api/rounds", "mB"], ["/api/rounds", "b1"], ["/api/hr/overview", "hr"], ["/api/hr/issues", "hr"], [`/api/rounds/${RB}`, "b1"], ["/api/kudos/me", "b1"]]) {
      if ((await G(p, as)).text.includes("QA komentár")) hits.push(p);
    }
    return { ok: hits.length === 0, actual: hits.length ? "found in " + hits.join(",") : "not found in 11 endpoint/role combinations" };
  });
  await t("NFR-01-API", "printable report page of the round contains no comments", "HTML of /rounds/:id/report has no comment text (IT-08)", async () => {
    const r = await G(`/rounds/${RB}/report`, "mB");
    return { ok: r.status === 200 && !r.text.includes("QA komentár"), actual: `HTTP ${r.status}, comment text present: ${r.text.includes("QA komentár")}` };
  });

  // ---- suggestions ----
  await t("SUGGEST", "5 responses: two rule-based suggestions", "status ok, provider rules, 2 suggestions with keys average,questionText,suggestion,topic (IT-09)", async () => {
    const r = (await G(`/api/rounds/${RB}/suggestions`, "mB")).json;
    return { ok: r.status === "ok" && r.provider === "rules" && r.suggestions.length === 2 && r.suggestions.every((s) => keysOf(s) === "average,questionText,suggestion,topic"), actual: JSON.stringify(r).slice(0, 200) };
  });
  await t("SUGGEST", "weakest questions chosen with reversed scale flipped, from different topics, fixed question excluded", "1st = overtime question (avg 4.6 → favourability 1.4), 2nd = feedback question (2.6, other topic); workload (2.0, same topic as overtime) skipped; fixed never", async () => {
    const s = (await G(`/api/rounds/${RB}/suggestions`, "hr")).json.suggestions;
    return { ok: s[0].questionText === overtime.text && s[0].average === 4.6 && s[1].questionText === feedback.text && s[0].topic !== s[1].topic && !s.some((x) => x.questionText === ctx.fixed.text), actual: s.map((x) => `${x.topic} (${x.average})`).join(" | ") };
  });
  await t("SUGGEST", "suggestions are deterministic", "5 calls return identical JSON", async () => {
    const set = new Set();
    for (let i = 0; i < 5; i++) set.add((await G(`/api/rounds/${RB}/suggestions`, "mB")).text);
    return set.size === 1;
  });

  // ---- team summary ----
  await t("SUMMARY", "5 responses: team summary as employee shows averages only", "results.status ok; question keys average,position,scale,text – no distribution, no comments (MVP-14)", async () => {
    const r = await G(`/api/teams/${ctx.teamB}/summary`, "b3");
    const x = r.json.rounds.find((y) => y.id === RB);
    return { ok: x.results.status === "ok" && x.results.questions.every((q) => keysOf(q) === "average,position,scale,text") && x.results.questions.map((q) => q.average).join() === "3.6,2,4.6,2.6" && !/distribution|comments/.test(r.text), actual: JSON.stringify(x.results).slice(0, 220) };
  });
  await t("SUMMARY", "summary shape and ordering", "keys kudos,rounds,team; only CLOSED rounds; newest deadline first", async () => {
    const r = (await G(`/api/teams/${ctx.teamB}/summary`, "hr")).json;
    const times = r.rounds.map((x) => Date.parse(x.closesAt));
    const ids = new Set((await db.round.findMany({ where: { teamId: ctx.teamB, status: "CLOSED" } })).map((x) => x.id));
    return keysOf(r) === "kudos,rounds,team" && times.every((v, i) => i === 0 || times[i - 1] >= v) && r.rounds.every((x) => ids.has(x.id)) && r.rounds.length === ids.size;
  });
  await t("SUMMARY", "summary for unknown team id: HR vs employee", "HR 404, employee 403", async () => {
    const a = await G("/api/teams/cmnope000000000000000000/summary", "hr"), b = await G("/api/teams/cmnope000000000000000000/summary", "b1");
    return { ok: a.status === 404 && b.status === 403, actual: `HR ${a.status}, employee ${b.status}` };
  });

  // ---- trend ----
  await t("TREND", "trend point of the 5-response round", "status ok, fixed 3.6, topics {Záťaž a energia: 1.7 (mean of 2.0 and 6−4.6), Manažér a spätná väzba: 2.6} (IT-08)", async () => {
    const p = (await G(`/api/teams/${ctx.teamB}/trend`, "mB")).json.points.find((x) => x.roundId === RB);
    return { ok: p.status === "ok" && p.fixed === 3.6 && p.topics["Záťaž a energia"] === 1.7 && p.topics["Manažér a spätná väzba"] === 2.6 && p.responded === 5, actual: JSON.stringify(p).slice(0, 240) };
  });
  await t("TREND", "trend of team Alfa: oldest first, 4-response round is a gap", "5 points sorted by closedAt ascending; '42. týždeň' insufficient_responses without scores", async () => {
    const r = (await G(`/api/teams/${ctx.teamA}/trend`, "mA")).json;
    const ts = r.points.map((p) => Date.parse(p.closedAt));
    const gap = r.points.find((p) => p.roundName.includes("42."));
    return { ok: r.points.length === 5 && ts.every((v, i) => i === 0 || ts[i - 1] <= v) && gap.status === "insufficient_responses" && !("fixed" in gap) && !("topics" in gap), actual: r.points.map((p) => `${p.roundName.slice(8, 11)}:${p.status}`).join(" ") };
  });
  await t("TREND", "trend topics list = topics of rounds above the threshold only", "topic used only in the 4-response round ('Tím a psychologické bezpečie' for Alfa week 42) is absent unless another ok round has it", async () => {
    const r = (await G(`/api/teams/${ctx.teamA}/trend`, "hr")).json;
    const fromOk = new Set(r.points.filter((p) => p.status === "ok").flatMap((p) => Object.keys(p.topics)));
    return { ok: r.topics.length === fromOk.size && r.topics.every((x) => fromOk.has(x)), actual: r.topics.join(" | ") };
  });
  await t("TREND", "trend for unknown team id: HR vs manager", "HR 404, manager 403", async () => {
    const a = await G("/api/teams/cmnope000000000000000000/trend", "hr"), b = await G("/api/teams/cmnope000000000000000000/trend", "mB");
    return a.status === 404 && b.status === 403;
  });

  // ---- heatmap ----
  const expectFixedCell = async (teamId) => {
    const rounds = await db.round.findMany({ where: { teamId, status: "CLOSED" }, include: { responses: true } });
    const start = Date.now() - 90 * 86400000;
    const ok = rounds.filter((r) => (r.closedAt ?? r.closesAt).getTime() >= start && r.responses.length >= 5);
    const per = ok.map((r) => r2(r.responses.reduce((a, x) => a + x.v1, 0) / r.responses.length));
    const withSmall = rounds.filter((r) => (r.closedAt ?? r.closesAt).getTime() >= start && r.responses.length > 0).map((r) => r2(r.responses.reduce((a, x) => a + x.v1, 0) / r.responses.length));
    return { cell: r2(per.reduce((a, b) => a + b, 0) / per.length), counted: ok.length, cellIfLeaking: r2(withSmall.reduce((a, b) => a + b, 0) / withSmall.length) };
  };
  await t("HEATMAP", "heatmap shape", "keys teams,topics,windowDays=90; 'Stála otázka' first column; team keys cells,roundsCounted,teamId,teamName (IT-08)", async () => {
    const r = (await G("/api/hr/heatmap", "hr")).json;
    return keysOf(r) === "teams,topics,windowDays" && r.windowDays === 90 && r.topics[0] === "Stála otázka" && r.teams.every((x) => keysOf(x) === "cells,roundsCounted,teamId,teamName");
  });
  for (const [label, team] of [["Beta", "teamB"], ["Alfa", "teamA"]]) {
    await t("HEATMAP", `heatmap team ${label}: rounds below the threshold contribute nothing`, "roundsCounted and 'Stála otázka' cell equal the value recomputed from the DB using only rounds with >= 5 responses", async () => {
      const e = await expectFixedCell(ctx[team]);
      const row = (await G("/api/hr/heatmap", "hr")).json.teams.find((x) => x.teamId === ctx[team]);
      return { ok: row.roundsCounted === e.counted && row.cells["Stála otázka"] === e.cell, actual: `API counted=${row.roundsCounted} cell=${row.cells["Stála otázka"]}; DB expected counted=${e.counted} cell=${e.cell}; value if small rounds leaked=${e.cellIfLeaking}` };
    });
  }
  await t("HEATMAP", "round closed 91 days ago is outside the window", "roundsCounted drops by 1", async () => {
    const before = (await G("/api/hr/heatmap", "hr")).json.teams.find((x) => x.teamId === ctx.teamB).roundsCounted;
    const old = new Date(Date.now() - 91 * 86400000);
    await db.round.update({ where: { id: RB }, data: { closedAt: old, closesAt: old } });
    const after = (await G("/api/hr/heatmap", "hr")).json.teams.find((x) => x.teamId === ctx.teamB).roundsCounted;
    return { ok: after === before - 1, actual: `before ${before}, after ${after}` };
  }, { pre: "closedAt/closesAt of round RB moved 91 days into the past directly in the DB" });
  await t("HEATMAP", "round closed 89 days ago is inside the window", "roundsCounted back to the original value", async () => {
    const d = new Date(Date.now() - 89 * 86400000);
    const mid = (await G("/api/hr/heatmap", "hr")).json.teams.find((x) => x.teamId === ctx.teamB).roundsCounted;
    await db.round.update({ where: { id: RB }, data: { closedAt: d, closesAt: d } });
    const after = (await G("/api/hr/heatmap", "hr")).json.teams.find((x) => x.teamId === ctx.teamB).roundsCounted;
    return { ok: after === mid + 1, actual: `at 91 days ${mid}, at 89 days ${after}` };
  }, { pre: "closedAt/closesAt of round RB moved to 89 days ago directly in the DB" });

  // ---- recomputation against the DB for a demo round ----
  await t("RESULTS", "demo round with 6 responses: averages recomputed from the DB, rounded to 2 decimals", "API averages equal round(avg,2) per question", async () => {
    const round = ctx.round(ctx.teamA, "44. týždeň");
    const rows = await db.response.findMany({ where: { roundId: round.id } });
    const exp = ["v1", "v2", "v3", "v4"].map((k) => r2(rows.reduce((a, x) => a + x[k], 0) / rows.length));
    const api = (await G(`/api/rounds/${round.id}/results`, "mA")).json;
    return { ok: api.questions.map((q) => q.average).join() === exp.join() && api.responseCount === 6, actual: `API ${api.questions.map((q) => q.average)} vs DB ${exp}` };
  });
  await t("RESULTS", "participation.teamSize counts all 6 members including the manager", "teamSize 6, responded = number of Response rows", async () => {
    const api = (await G(`/api/rounds/${ctx.round(ctx.teamA, "44. týždeň").id}/results`, "hr")).json;
    return api.participation.teamSize === 6 && api.participation.responded === 6;
  });
  await t("RESULTS", "results with unknown round id: HR vs manager", "HR 404 not_found, manager 403", async () => {
    const a = await G("/api/rounds/cmnope000000000000000000/results", "hr"), b = await G("/api/rounds/cmnope000000000000000000/results", "mB");
    return is(a, 404, "not_found") && is(b, 403);
  });
  await t("THRESHOLD", "differencing: a 5-response round and its 4-response twin never expose a single person's answer through any endpoint", "RA (4) exposes nothing numeric anywhere, so RB − RA cannot be computed", async () => {
    const hits = [];
    for (const [p, as] of [[`/api/rounds/${RA}/results`, "hr"], [`/api/rounds/${RA}/suggestions`, "hr"], [`/api/teams/${ctx.teamB}/summary`, "hr"], [`/api/teams/${ctx.teamB}/trend`, "hr"]]) {
      const j = (await G(p, as)).json;
      const node = j.rounds ? j.rounds.find((x) => x.id === RA) : j.points ? j.points.find((x) => x.roundId === RA) : j;
      if (/average|distribution|"fixed"|"topics"|questions/.test(JSON.stringify(node))) hits.push(p);
    }
    return { ok: hits.length === 0, actual: hits.length ? "numeric data in " + hits.join(",") : "no averages/distributions/scores for the 4-response round in 4 endpoints" };
  });
  await t("THRESHOLD", "MIN_GROUP_SIZE is defined once in src/config/privacy.ts and not hard-coded elsewhere", "no literal comparison with 5 on response counts in src/server", async () => {
    const fs = await import("node:fs"); const path = await import("node:path"); const { ROOT } = await import("./lib.mjs");
    const dir = path.join(ROOT, "src", "server");
    const hits = [];
    for (const f of fs.readdirSync(dir)) { const s = fs.readFileSync(path.join(dir, f), "utf8"); if (/(length|count|Count)\s*(<|>=|<=|>)\s*5\b/.test(s)) hits.push(f); }
    const cfg = fs.readFileSync(path.join(ROOT, "src/config/privacy.ts"), "utf8");
    return { ok: hits.length === 0 && /MIN_GROUP_SIZE = 5/.test(cfg), actual: hits.length ? "hard-coded in " + hits : "only src/config/privacy.ts defines the value" };
  }, { steps: "static read of src/server/*.ts and src/config/privacy.ts (read-only)" });
}
