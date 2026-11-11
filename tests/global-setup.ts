import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

// Fresh test database with the real migrations (including the hand-edited
// WITHOUT ROWID and CHECK constraints) before every test run.
export default function setup() {
  for (const file of ["prisma/test.db", "prisma/test.db-journal"]) {
    rmSync(file, { force: true });
  }
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
