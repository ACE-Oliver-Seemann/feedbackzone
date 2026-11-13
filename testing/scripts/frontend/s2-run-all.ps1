# Runs the mutating part of the frontend QA suite on a fresh seed + demo data (session 2026-11-12_002).
# Usage (repo root):  $env:QA_PW_DIR = "<folder with node_modules/playwright-core>"; ./testing/scripts/frontend/s2-run-all.ps1
# 01-navigation and 02-responsive are read-only and can be run separately on the same data.
$ErrorActionPreference = "Continue"
$evid = "testing/reports/2026-11-12_002/evidence/frontend"
$env:DATABASE_URL = "file:./qa-frontend.db"
npx.cmd tsx prisma/seed.ts | Select-Object -Last 1
npx.cmd tsx scripts/demo-data.ts | Select-Object -Last 1
Remove-Item Env:DATABASE_URL
foreach ($s in @("06-a11y-visual", "03-login-fill", "04-rounds-results", "05-kudos-hr", "07-extras")) {
  node "testing/scripts/frontend/s2-$s.mjs" > "$evid/out-$s.txt" 2>&1
  Write-Output "done $s"
}
$env:QA_EVID = $evid
npx.cmd tsx testing/scripts/frontend/06-plurals.ts > "$evid/out-06-plurals.txt" 2>&1
Remove-Item Env:QA_EVID
Write-Output "done plurals"
