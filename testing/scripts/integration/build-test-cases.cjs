// Builds TEST_CASES_INTEGRATION.md from the results-*.json evidence written by the journey scripts.
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "../../reports/2026-11-12_001");
const order = ["j1-cycle","j3-kudos","j4-hr","j5-auth","j6-consistency","j7-errors","j8-concurrency","j9-confidentiality","j10-variants","j11-followups"];
const defect = {63:"E2E-001",371:"E2E-001",372:"E2E-001",373:"E2E-002",162:"E2E-003",164:"E2E-004",165:"E2E-004",281:"E2E-004",106:"E2E-005",361:"E2E-005",362:"E2E-005",363:"E2E-005",364:"E2E-005",169:"E2E-006",112:"E2E-007",138:"E2E-008",244:"E2E-009",271:"E2E-010",286:"E2E-011",307:"E2E-012",360:"E2E-013",374:"E2E-014",377:"risk R-3"};
const J = {J1:"1 Full cycle",J2:"2 Threshold",J3:"3 Kudos",J4:"4 HR and home tasks",J5:"5 Authentication",J6:"6 Data consistency",J7:"7 Error handling",J8:"8 Concurrency",J9:"9 Confidentiality",J10:"10 Regression variants"};
const esc = (s) => String(s ?? "").replace(/\|/g, "\|").replace(/\r?\n/g, " ");
let all = [];
for (const s of order) all.push(...JSON.parse(fs.readFileSync(path.join(dir, "evidence/integration", `results-${s}.json`))));
const c = { PASS: 0, FAIL: 0, BLOCKED: 0 }; all.forEach((r) => c[r.status]++);
let md = `# Test cases – Level 3 integration (end-to-end)\n\nSession 2026-11-12_001. Environment: http://localhost:3303, database prisma/qa-e2e.db. Generated from \`evidence/integration/results-*.json\` by \`testing/scripts/integration/build-test-cases.cjs\`.\n\n**Executed: ${all.length} — PASS ${c.PASS}, FAIL ${c.FAIL}, BLOCKED ${c.BLOCKED}.**\n\nEvidence paths are relative to \`evidence/integration/\`. Every row also has its recorded actual result in \`results-<script>.json\`. A FAIL row names the defect (or risk) it belongs to in INTEGRATION_REPORT.md.\n\n| Test ID | Journey | Description | Preconditions | Steps | Expected | Actual | Status | Evidence |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
all.forEach((r, i) => {
  const n = i + 1, id = "E2E-T" + String(n).padStart(3, "0");
  const ev = [r.evidence, `results-${r.suite}.json`, defect[n] ? `→ ${defect[n]}` : ""].filter(Boolean).join("; ");
  md += `| ${id} | ${J[r.j]} | ${esc(r.d)} | ${esc(r.pre)} | ${esc(r.steps)} | ${esc(r.exp)} | ${esc(r.actual)} | ${r.status} | ${esc(ev)} |\n`;
});
fs.writeFileSync(path.join(dir, "TEST_CASES_INTEGRATION.md"), md);
console.log(all.length, c);
