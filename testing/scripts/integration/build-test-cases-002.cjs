// Builds TEST_CASES_INTEGRATION.md for session 2026-11-12_002 from the results-m*.json evidence
// written by the m1…m7 scripts. Run from anywhere: node testing/scripts/integration/build-test-cases-002.cjs
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "../../reports/2026-11-12_002");
const order = ["m1-cycle", "m2-kudos", "m3-auth", "m4-errors", "m5-multi", "m6-consistency", "m7-followups"];
// FAIL rows → defect they belong to (matched by the start of the description).
const defects = [
  ["'New kudos' notice for the very first kudos", "E2E2-001"],
  ["Step status changed in one tab", "E2E2-002"],
  ["Issue status changed by one HR session", "E2E2-003"],
  ["Browser Back from the thank-you screen", "E2E2-004"],
  ["New kudos arriving while the recipient opens the 'Poslať kudos' tab", "E2E2-005"],
];
// PASS rows that confirm a known, still open defect of session 001.
const known = [["Known BUG-036", "known BUG-036"], ["Known BUG-037", "known BUG-037"], ["Known limitation of BUG-010", "known BUG-010"]];
const S = { A: "A Complete user journeys", B: "B Kudos workflow", C: "C Authentication", D: "D Data consistency", E: "E Error handling", F: "F Multi-user", G: "G Regression" };
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
let all = [];
for (const s of order) all.push(...JSON.parse(fs.readFileSync(path.join(dir, "evidence/integration", `results-${s}.json`), "utf8")));
const c = { PASS: 0, FAIL: 0, BLOCKED: 0 }; all.forEach((r) => c[r.status]++);
const bySection = {};
all.forEach((r) => { (bySection[r.j] ??= { PASS: 0, FAIL: 0, BLOCKED: 0 })[r.status]++; });
let md = `# Test cases – Level 3 integration (end-to-end)\n\nSession 2026-11-12_002 (after the merge of the frontend redesign, commit cc58885). Environment: http://localhost:3303 (production build), database prisma/qa-e2e.db, Edge (Chromium) driven by Playwright. Generated from \`evidence/integration/results-*.json\` by \`testing/scripts/integration/build-test-cases-002.cjs\`.\n\n**Executed: ${all.length} — PASS ${c.PASS}, FAIL ${c.FAIL}, BLOCKED ${c.BLOCKED}.**\n\n| Section | Executed | PASS | FAIL | BLOCKED |\n| --- | --- | --- | --- | --- |\n`;
for (const k of Object.keys(S)) { const b = bySection[k] ?? { PASS: 0, FAIL: 0, BLOCKED: 0 }; md += `| ${S[k]} | ${b.PASS + b.FAIL + b.BLOCKED} | ${b.PASS} | ${b.FAIL} | ${b.BLOCKED} |\n`; }
md += `\nEvidence paths are relative to \`evidence/integration/\`. Every row also has its recorded actual result in \`results-<script>.json\` and in \`logs/<script>.log\`. A FAIL row names the defect it belongs to in INTEGRATION_REPORT.md.\n\n| Test ID | Section | Description | Preconditions | Steps | Expected | Actual | Status | Evidence |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
const unmapped = [];
all.forEach((r, i) => {
  const id = "E2E2-T" + String(i + 1).padStart(3, "0");
  const d = r.status === "FAIL" ? defects.find(([start]) => r.d.startsWith(start))?.[1] : known.find(([start]) => r.d.startsWith(start))?.[1];
  if (r.status === "FAIL" && !d) unmapped.push(`${id} ${r.d}`);
  const ev = [r.evidence, `results-${r.suite}.json`, d ? `→ ${d}` : ""].filter(Boolean).join("; ");
  md += `| ${id} | ${S[r.j] ?? r.j} | ${esc(r.d)} | ${esc(r.pre)} | ${esc(r.steps)} | ${esc(r.exp)} | ${esc(r.actual)} | ${r.status} | ${esc(ev)} |\n`;
});
fs.writeFileSync(path.join(dir, "TEST_CASES_INTEGRATION.md"), md);
fs.writeFileSync(path.join(dir, "evidence/integration", "totals.json"), JSON.stringify({ executed: all.length, ...c, bySection }, null, 1));
console.log(all.length, c, JSON.stringify(bySection));
if (unmapped.length) console.log("FAIL rows without a defect:\n" + unmapped.join("\n"));
all.forEach((r, i) => { if (r.status !== "PASS") console.log(`E2E2-T${String(i + 1).padStart(3, "0")} ${r.status} ${r.d}`); });
