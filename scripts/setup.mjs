// One-command setup: creates .env if missing, applies migrations, seeds test data.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

if (!existsSync(".env")) {
  writeFileSync(
    ".env",
    `DATABASE_URL="file:./dev.db"\nSESSION_SECRET="${randomBytes(32).toString("hex")}"\n`,
  );
  console.log("Created .env with a random SESSION_SECRET.");
}

const run = (command) => execSync(command, { stdio: "inherit" });
run("npx prisma migrate deploy");
run("npx prisma generate");
run("npx tsx prisma/seed.ts");
