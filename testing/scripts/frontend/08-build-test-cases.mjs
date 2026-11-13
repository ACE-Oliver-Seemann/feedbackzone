// Builds TEST_CASES_FRONTEND.md and a summary (counts per area, list of failed tests)
// from the results-*.json files written by the test scripts. No browser needed.
//   node 08-build-test-cases.mjs [evidence dir] [report dir]
import fs from "node:fs";
import path from "node:path";

const REPORT = process.argv[3] ?? "./testing/reports/2026-11-12_001";
const EVID = process.argv[2] ?? path.join(REPORT, "evidence/frontend");
// Failed tests mapped to the defect or note they belong to (filled in by the tester).
const MAP = fs.existsSync(path.join(EVID, "defect-map.json")) ? JSON.parse(fs.readFileSync(path.join(EVID, "defect-map.json"), "utf8")) : [];

const files = fs.readdirSync(EVID).filter((name) => /^results-.*\.json$/.test(name)).sort();
const all = [];
for (const file of files) {
  for (const entry of JSON.parse(fs.readFileSync(path.join(EVID, file), "utf8"))) all.push({ ...entry, script: file.replace(/^results-|\.json$/g, "") });
}
const cell = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const refFor = (entry) => {
  if (entry.status !== "FAIL") return "";
  const hit = MAP.find((rule) => new RegExp(rule.match).test(`${entry.area} ${entry.desc}`));
  return hit ? hit.ref : "UNMAPPED";
};

const lines = [
  "# Frontend test cases – session 2026-11-12_001 (Agent 2, Level 2)",
  "",
  `Generated from \`evidence/frontend/results-*.json\` by \`testing/scripts/frontend/08-build-test-cases.mjs\`. ${all.length} executed tests.`,
  "",
  "Status: PASS = expected result observed; FAIL = expected result not observed (the last column links the defect or note); BLOCKED = could not be executed because the feature is not in this build.",
  "Evidence paths are relative to `evidence/frontend/`. Every row is also a line in `out-<script>.txt` and an entry in `results-<script>.json`.",
  "",
  "| Test ID | Area | Description | Preconditions | Steps | Expected | Actual | Status | Evidence | Defect / note |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
];
const summary = {};
const failed = [];
all.forEach((entry, index) => {
  const id = `FE-T${String(index + 1).padStart(3, "0")}`;
  entry.id = id;
  const ref = refFor(entry);
  const evidence = [entry.evidence, `out-${entry.script}.txt`].filter(Boolean).join(", ");
  lines.push(`| ${id} | ${cell(entry.area)} | ${cell(entry.desc)} | ${cell(entry.pre)} | ${cell(entry.steps)} | ${cell(entry.expected)}${entry.req ? ` (${cell(entry.req)})` : ""} | ${cell(entry.actual).slice(0, 700)} | ${entry.status} | ${cell(evidence)} | ${ref} |`);
  summary[entry.area] ??= { executed: 0, PASS: 0, FAIL: 0, BLOCKED: 0, ERROR: 0 };
  summary[entry.area].executed++;
  summary[entry.area][entry.status]++;
  if (entry.status === "FAIL") failed.push(`${id} [${ref}] ${entry.area} – ${entry.desc}`);
});
fs.writeFileSync(path.join(REPORT, "TEST_CASES_FRONTEND.md"), lines.join("\n") + "\n");

const total = { executed: 0, PASS: 0, FAIL: 0, BLOCKED: 0, ERROR: 0 };
const out = ["| Area | Executed | Passed | Failed | Blocked |", "| --- | --- | --- | --- | --- |"];
for (const [area, counts] of Object.entries(summary).sort()) {
  out.push(`| ${area} | ${counts.executed} | ${counts.PASS} | ${counts.FAIL} | ${counts.BLOCKED} |`);
  for (const key of Object.keys(total)) total[key] += counts[key];
}
out.push(`| **Total** | **${total.executed}** | **${total.PASS}** | **${total.FAIL}** | **${total.BLOCKED}** |`);
const text = `${out.join("\n")}\n\nScript errors: ${total.ERROR}\n\nFailed tests:\n${failed.join("\n")}\n`;
fs.writeFileSync(path.join(EVID, "summary.txt"), text);
console.log(text);
