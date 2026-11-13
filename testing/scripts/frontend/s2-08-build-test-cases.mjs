// Builds TEST_CASES_FRONTEND.md and evidence/frontend/summary.txt for session 2026-11-12_002 from the
// results-*.json files written by the s2-* scripts (and by 06-plurals.ts). No browser needed.
//   node testing/scripts/frontend/s2-08-build-test-cases.mjs [report dir]
// evidence/frontend/defect-map.json maps failed tests to defects: [{ "match": "<regex on description>", "ref": "FE2-001" }]
import fs from "node:fs";
import path from "node:path";

const REPORT = process.argv[2] ?? "./testing/reports/2026-11-12_002";
const EVID = path.join(REPORT, "evidence/frontend");
const MAP = fs.existsSync(path.join(EVID, "defect-map.json")) ? JSON.parse(fs.readFileSync(path.join(EVID, "defect-map.json"), "utf8")) : [];
const SECTIONS = { A: "A – Navigation", B: "B – UI components", C: "C – Forms and questionnaire", D: "D – Animations and interactions", E: "E – Responsive design", F: "F – Visual and text quality", G: "G – Accessibility" };

const files = fs.readdirSync(EVID).filter((name) => /^results-.*\.json$/.test(name)).sort();
const all = [];
for (const file of files) {
  for (const entry of JSON.parse(fs.readFileSync(path.join(EVID, file), "utf8"))) {
    // 06-plurals.ts (session 001 format) has `area`; these are text-quality checks -> section F.
    all.push({ ...entry, section: entry.section ?? "F", script: file.replace(/^results-|\.json$/g, "") });
  }
}
const cell = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const refFor = (entry) => {
  if (entry.status !== "FAIL") return "";
  const hit = MAP.find((rule) => new RegExp(rule.match).test(entry.desc));
  return hit ? hit.ref : "UNMAPPED";
};

const lines = [
  "# Frontend test cases – session 2026-11-12_002 (Agent 2, Level 2)",
  "",
  `Generated from \`evidence/frontend/results-*.json\` by \`testing/scripts/frontend/s2-08-build-test-cases.mjs\`. ${all.length} executed tests.`,
  "",
  "Status: PASS = expected result observed; FAIL = expected result not observed (the last column names the defect or note); BLOCKED = could not be executed in this data set or build; ERROR = the test script itself failed (not counted as a product result).",
  "Evidence paths are relative to `evidence/frontend/`. Every row is also a line in `out-<script>.txt` and an entry in `results-<script>.json`.",
  "",
  "| Test ID | Section | Description | Preconditions | Steps | Expected | Actual | Status | Evidence | Defect / note |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
];
const summary = {};
const failed = [];
const byRef = {};
all.forEach((entry, index) => {
  const id = `FE2-T${String(index + 1).padStart(3, "0")}`;
  const ref = refFor(entry);
  const evidence = [entry.evidence, `out-${entry.script}.txt`].filter(Boolean).join(", ");
  lines.push(`| ${id} | ${entry.section} | ${cell(entry.desc)} | ${cell(entry.pre)} | ${cell(entry.steps)} | ${cell(entry.expected)}${entry.req ? ` (${cell(entry.req)})` : ""} | ${cell(entry.actual).slice(0, 700)} | ${entry.status} | ${cell(evidence)} | ${ref} |`);
  const key = SECTIONS[entry.section] ?? entry.section;
  summary[key] ??= { executed: 0, PASS: 0, FAIL: 0, BLOCKED: 0, ERROR: 0 };
  summary[key].executed++;
  summary[key][entry.status]++;
  if (entry.status === "FAIL") { failed.push(`${id} [${ref}] ${entry.section} – ${entry.desc}`); (byRef[ref] ??= []).push(id); }
  if (entry.status === "BLOCKED" || entry.status === "ERROR") failed.push(`${id} [${entry.status}] ${entry.section} – ${entry.desc}`);
});
fs.writeFileSync(path.join(REPORT, "TEST_CASES_FRONTEND.md"), lines.join("\n") + "\n");

const total = { executed: 0, PASS: 0, FAIL: 0, BLOCKED: 0, ERROR: 0 };
const out = ["| Section | Executed | Passed | Failed | Blocked |", "| --- | --- | --- | --- | --- |"];
for (const [section, counts] of Object.entries(summary).sort()) {
  out.push(`| ${section} | ${counts.executed} | ${counts.PASS} | ${counts.FAIL} | ${counts.BLOCKED} |`);
  for (const key of Object.keys(total)) total[key] += counts[key];
}
out.push(`| **Total** | **${total.executed}** | **${total.PASS}** | **${total.FAIL}** | **${total.BLOCKED}** |`);
const refs = Object.entries(byRef).sort().map(([ref, ids]) => `${ref}: ${ids.length} tests (${ids.slice(0, 12).join(", ")}${ids.length > 12 ? ", …" : ""})`);
const text = `${out.join("\n")}\n\nScript errors: ${total.ERROR}\n\nFailed tests per defect / note:\n${refs.join("\n")}\n\nFailed, blocked and errored tests:\n${failed.join("\n")}\n`;
fs.writeFileSync(path.join(EVID, "summary.txt"), text);
console.log(text);
