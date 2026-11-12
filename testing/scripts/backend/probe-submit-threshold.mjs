// Probe for BE2-001 (session 2026-11-12_002): at how many simultaneous submissions the endpoint starts to fail,
// whether other requests stall meanwhile, whether a retry works, and which Prisma error is behind the 500
// (reproduced on a throwaway copy of the database, because the server log shows only the error class).
// Usage: node testing/scripts/backend/probe-submit-threshold.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { EVID, ROOT, closeR, ctx, db, mkOpenRound, req, reset, submit } from "./lib.mjs";
await reset(false);
const beta = ["b1", "b2", "b3", "b4", "b5", "mB"], alfa = ["a1", "a2", "a3", "a4", "a5", "mA"];
const out = { cpus: os.cpus().length, threshold: [], stall: null, retry: null, kudosControl: null, rootCause: null };
const tally = (rs) => { const m = {}; for (const r of rs) m[r.status] = (m[r.status] ?? 0) + 1; return m; };

// A. threshold: n duplicate submissions at once (all should be 409)
const r0 = await mkOpenRound(ctx.teamB, 3);
for (const u of beta) await submit(u, r0, [3, 3, 3, 3]);
for (const n of [12, 13, 14, 15, 16, 17, 18, 20, 30]) {
  const t0 = Date.now();
  const rs = await Promise.all(Array.from({ length: n }, (_, i) => submit(beta[i % 6], r0, [5, 5, 5, 5])));
  const rec = { concurrent: n, statuses: tally(rs), wallMs: Date.now() - t0 };
  out.threshold.push(rec); console.log("A", JSON.stringify(rec));
}
// B. do unrelated requests stall while the submissions hang?
{
  const jobs = Array.from({ length: 20 }, (_, i) => submit(beta[i % 6], r0, [5, 5, 5, 5]));
  await new Promise((r) => setTimeout(r, 300));
  const t0 = Date.now();
  const me = await req("GET", "/api/me", { as: "a1" }); const meMs = Date.now() - t0;
  const t1 = Date.now();
  const list = await req("GET", "/api/rounds", { as: "a1" }); const listMs = Date.now() - t1;
  const t2 = Date.now();
  const kud = await req("POST", "/api/kudos", { as: "a1", body: { toUserId: ctx.users.a2.id, emoji: "👏", value: "HELPING", visibility: "PRIVATE" } }); const kudMs = Date.now() - t2;
  const rs = await Promise.all(jobs);
  out.stall = { submissions: tally(rs), "GET /api/me": `${me.status} in ${meMs} ms`, "GET /api/rounds": `${list.status} in ${listMs} ms`, "POST /api/kudos": `${kud.status} in ${kudMs} ms` };
  console.log("B", JSON.stringify(out.stall));
}
await closeR(r0);
// C. legitimate case and retry: 24 first-time submissions over 4 rounds, then the failed ones try again one by one
{
  const r = [await mkOpenRound(ctx.teamA, 3), await mkOpenRound(ctx.teamA, 3), await mkOpenRound(ctx.teamB, 3), await mkOpenRound(ctx.teamB, 3)];
  const plan = [];
  for (const u of alfa) plan.push([u, r[0]], [u, r[1]]);
  for (const u of beta) plan.push([u, r[2]], [u, r[3]]);
  const rs = await Promise.all(plan.map(([u, id]) => submit(u, id, [3, 3, 3, 3], "QA2-PROBE-COMMENT")));
  const failed = plan.filter((_, i) => rs[i].status !== 201);
  const again = [];
  for (const [u, id] of failed) again.push((await submit(u, id, [3, 3, 3, 3], "QA2-PROBE-COMMENT")).status);
  let p = 0, n = 0;
  for (const id of r) { p += await db.participation.count({ where: { roundId: id } }); n += await db.response.count({ where: { roundId: id } }); }
  out.retry = { first: tally(rs), failed: failed.length, retryStatuses: tally(again.map((s) => ({ status: s }))), participations: p, responses: n };
  console.log("C", JSON.stringify(out.retry));
  for (const id of r) await closeR(id);
}
// D. control: 24 concurrent kudos (single insert, no interactive transaction)
{
  const all = [...alfa, ...beta];
  const t0 = Date.now();
  const rs = await Promise.all(Array.from({ length: 24 }, (_, i) => req("POST", "/api/kudos", { as: all[i % 12], body: { toUserId: ctx.users[all[(i + 1) % 12]].id, emoji: "⭐", value: "QUALITY", visibility: "PRIVATE" } })));
  out.kudosControl = { statuses: tally(rs), wallMs: Date.now() - t0 };
  console.log("D", JSON.stringify(out.kudosControl));
}
// E. root cause on a throwaway copy: the same transaction shape as src/server/responses.ts, 20 at once
{
  const copy = path.join(ROOT, "prisma", "qa-backend-probe-copy.db");
  await db.$executeRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)").catch(() => {});
  fs.copyFileSync(path.join(ROOT, "prisma", "qa-backend.db"), copy);
  const c = new PrismaClient({ datasources: { db: { url: "file:" + copy.split(path.sep).join("/") } } });
  const round = await c.round.findFirst({ where: { status: "CLOSED" } });
  await c.round.update({ where: { id: round.id }, data: { status: "OPEN", closesAt: new Date(Date.now() + 86400000) } });
  const user = await c.user.findFirst({ where: { teamId: round.teamId } });
  const tx = () => c.$transaction(async (t) => {
    await t.round.updateMany({ where: { id: round.id, status: "OPEN" }, data: { status: "OPEN" } });
    await t.participation.create({ data: { roundId: round.id, userId: user.id } });
  });
  await tx().catch(() => {});
  const t0 = Date.now();
  const rs = await Promise.allSettled(Array.from({ length: 20 }, tx));
  const codes = {};
  for (const r of rs) { const k = r.status === "fulfilled" ? "ok" : `${r.reason?.constructor?.name} ${r.reason?.code ?? ""} ${String(r.reason?.message ?? "").split("\n").filter(Boolean).at(-1)?.slice(0, 160)}`; codes[k] = (codes[k] ?? 0) + 1; }
  out.rootCause = { transactionsAtOnce: 20, wallMs: Date.now() - t0, outcomes: codes };
  console.log("E", JSON.stringify(out.rootCause));
  await c.$disconnect();
  for (const f of [copy, copy + "-journal", copy + "-wal", copy + "-shm"]) fs.rmSync(f, { force: true });
}
fs.writeFileSync(path.join(EVID, "probe-submit-threshold.json"), JSON.stringify(out, null, 1));
await reset(false);
await db.$disconnect();
