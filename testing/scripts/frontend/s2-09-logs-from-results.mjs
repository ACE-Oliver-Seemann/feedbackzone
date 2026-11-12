// Rewrites out-<script>.txt from results-<script>.json as UTF-8 (Windows PowerShell 5.1 redirects
// console output as UTF-16 and breaks Slovak characters). Also removes user-home paths from logs.
//   node testing/scripts/frontend/s2-09-logs-from-results.mjs [evidence dir] [script names...]
import fs from "node:fs";
import path from "node:path";

const EVID = process.argv[2] ?? "./testing/reports/2026-11-12_002/evidence/frontend";
const only = process.argv.slice(3);
for (const file of fs.readdirSync(EVID).filter((n) => /^results-.*\.json$/.test(n))) {
  const name = file.replace(/^results-|\.json$/g, "");
  if (only.length && !only.includes(name)) continue;
  const rows = JSON.parse(fs.readFileSync(path.join(EVID, file), "utf8"));
  const lines = rows.map((e) => `${String(e.status).padEnd(7)} [${e.section ?? e.area}] ${e.desc} => ${String(e.actual).replace(/\s+/g, " ")}`);
  fs.writeFileSync(path.join(EVID, `out-${name}.txt`), lines.join("\n") + "\n");
}
for (const file of fs.readdirSync(EVID).filter((n) => /\.(txt|json)$/.test(n))) {
  const p = path.join(EVID, file);
  const s = fs.readFileSync(p, "utf8");
  const clean = s.replace(/[A-Za-z]:\\Users\\[^\\\s"]+/g, "<user>").replace(/\/c\/Users\/[^/\s"]+/g, "<user>");
  if (clean !== s) fs.writeFileSync(p, clean);
}
console.log("logs rewritten");
