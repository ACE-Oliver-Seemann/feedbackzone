// Probe for BE2-001/BE2-002 (session 2026-11-12_002): how POST /api/rounds/:id/responses behaves under concurrent writes.
// Usage: node testing/scripts/backend/probe-submit-concurrency.mjs   (server on :3301, database prisma/qa-backend.db)
import fs from "node:fs";
import path from "node:path";
import { EVID, closeR, ctx, db, mkOpenRound, reset, submit } from "./lib.mjs";
await reset(false);
const A = ctx.teamA, B = ctx.teamB;
const alfa = ["a1", "a2", "a3", "a4", "a5", "mA"], beta = ["b1", "b2", "b3", "b4", "b5", "mB"];
const out = [];
const stat = (rs) => { const m = {}; for (const r of rs) m[r.status] = (m[r.status] ?? 0) + 1; return { statuses: m, maxMs: Math.max(...rs.map((r) => r.ms)), minMs: Math.min(...rs.map((r) => r.ms)) }; };
const counts = async (ids) => { let p = 0, n = 0; for (const id of ids) { p += await db.participation.count({ where: { roundId: id } }); n += await db.response.count({ where: { roundId: id } }); } return { participations: p, responses: n }; };
async function scenario(name, build) {
  const { jobs, rounds, note } = await build();
  const t0 = Date.now();
  const rs = await Promise.all(jobs.map((j) => j()));
  const rec = { scenario: name, requests: rs.length, ...stat(rs), wallMs: Date.now() - t0, ...(await counts(rounds)), note };
  out.push(rec); console.log(JSON.stringify(rec));
  for (const id of rounds) await closeR(id);
}
// 1. legitimate: every member of both teams answers one round of their team at the same moment (12 first-time submissions)
await scenario("12 first-time submissions, 2 rounds (one per team)", async () => {
  const ra = await mkOpenRound(A, 3), rb = await mkOpenRound(B, 3);
  return { rounds: [ra, rb], jobs: [...alfa.map((u) => () => submit(u, ra, [3, 3, 3, 3])), ...beta.map((u) => () => submit(u, rb, [3, 3, 3, 3]))], note: "expected 12 x 201" };
});
// 2. legitimate: two open rounds per team, everybody answers both at once (24 first-time submissions)
await scenario("24 first-time submissions, 4 rounds (two per team)", async () => {
  const r = [await mkOpenRound(A, 3), await mkOpenRound(A, 3), await mkOpenRound(B, 3), await mkOpenRound(B, 3)];
  const jobs = [];
  for (const u of alfa) jobs.push(() => submit(u, r[0], [3, 3, 3, 3]), () => submit(u, r[1], [3, 3, 3, 3]));
  for (const u of beta) jobs.push(() => submit(u, r[2], [3, 3, 3, 3]), () => submit(u, r[3], [3, 3, 3, 3]));
  return { rounds: r, jobs, note: "expected 24 x 201" };
});
// 3. double click: each of 6 members sends the same answer twice at once (12 requests, 6 must win)
await scenario("6 members x 2 identical submissions at once (double click)", async () => {
  const r = await mkOpenRound(A, 3);
  return { rounds: [r], jobs: alfa.flatMap((u) => [() => submit(u, r, [4, 4, 4, 4]), () => submit(u, r, [4, 4, 4, 4])]), note: "expected 6 x 201 and 6 x 409" };
});
// 4. one user sends the same answer N times at once
for (const n of [2, 3, 5, 10]) {
  await scenario(`1 member x ${n} identical submissions at once`, async () => {
    const r = await mkOpenRound(B, 3);
    return { rounds: [r], jobs: Array.from({ length: n }, () => () => submit("b1", r, [2, 2, 2, 2])), note: `expected 1 x 201 and ${n - 1} x 409` };
  });
}
// 5. repeat attempts after everybody answered (pure duplicates)
for (const n of [6, 12, 18]) {
  await scenario(`${n} concurrent duplicates after all 6 answered`, async () => {
    const r = await mkOpenRound(B, 3);
    for (const u of beta) await submit(u, r, [3, 3, 3, 3]);
    return { rounds: [r], jobs: Array.from({ length: n }, (_, i) => () => submit(beta[i % 6], r, [5, 5, 5, 5])), note: `expected ${n} x 409` };
  });
}
fs.writeFileSync(path.join(EVID, "probe-submit-concurrency.json"), JSON.stringify(out, null, 1));
await reset(false);
await db.$disconnect();
