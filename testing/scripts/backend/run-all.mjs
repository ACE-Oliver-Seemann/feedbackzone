// Runs the backend QA suites in a fixed order so that test ids stay stable.
// Usage (from the project root, Git Bash):
//   export PATH="/c/Program Files/nodejs:$PATH"; node testing/scripts/backend/run-all.mjs            (everything)
//   node testing/scripts/backend/run-all.mjs s1 s3                                                    (subset; ids then differ, output tagged)
import { db, reset, save } from "./lib.mjs";
const all = ["s1-auth", "s2-authz", "s3-rounds", "s4-responses", "s5-results", "s6-actions-kudos", "s7-questions-hr", "s8-security", "s9-deep"];
const pick = process.argv.slice(2);
const chosen = pick.length ? all.filter((s) => pick.some((p) => s.startsWith(p))) : all;
for (const name of chosen) {
  const mod = await import(`./${name}.mjs`);
  await mod.default();
}
save(pick.length ? "-partial" : "");
await reset(true); // leave the QA database in seed + demo state
await db.$disconnect();
