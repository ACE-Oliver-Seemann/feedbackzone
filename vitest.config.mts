import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // All test files share one SQLite file, so they run one after another.
    fileParallelism: false,
    env: {
      // Relative to prisma/schema.prisma → prisma/test.db
      DATABASE_URL: "file:./test.db",
      SESSION_SECRET: "test-secret-test-secret-test-secret-0123",
    },
  },
});
