-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SCALE_1_5',
    "topic" TEXT NOT NULL,
    "scale" TEXT NOT NULL DEFAULT 'AGREEMENT',
    "starter" BOOLEAN NOT NULL DEFAULT false,
    "teamId" TEXT,
    "fixed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Question_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("fixed", "id", "scale", "starter", "text", "topic", "type") SELECT "fixed", "id", "scale", "starter", "text", "topic", "type" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
