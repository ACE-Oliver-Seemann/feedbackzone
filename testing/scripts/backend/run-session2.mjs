// Runs only the new suites of session 2026-11-12_002 (test ids BE2-T001…).
// Usage (from the project root): node testing/scripts/backend/run-session2.mjs [--keep]
// Evidence goes to testing/reports/<QA_SESSION>/evidence/backend/results-new.json, requests-new.jsonl, summary-new.json.
import { db, reset, save, setIdPrefix } from "./lib.mjs";
setIdPrefix("BE2-T");
try {
  for (const name of ["s10-session2", "s11-session2-extra"]) {
    const mod = await import(`./${name}.mjs`);
    await mod.default();
  }
} finally {
  save("-new");
}
if (!process.argv.includes("--keep")) await reset(false); // leave the QA database as a clean seed
await db.$disconnect();
