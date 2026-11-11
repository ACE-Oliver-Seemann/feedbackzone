-- NOTE: hand-edited after generation. Response and Participation are WITHOUT ROWID
-- and Response has CHECK constraints (NFR-01, MVP-08). Prisma cannot generate these.

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "teamId" TEXT,
    CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    CONSTRAINT "Team_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SCALE_1_5',
    "topic" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" DATETIME,
    "closesAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    CONSTRAINT "Round_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoundQuestion" (
    "roundId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    PRIMARY KEY ("roundId", "position"),
    CONSTRAINT "RoundQuestion_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoundQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Participation" (
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("roundId", "userId"),
    CONSTRAINT "Participation_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Participation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
) WITHOUT ROWID; -- NFR-01 (hand-edited)

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "v1" INTEGER NOT NULL,
    "v2" INTEGER NOT NULL,
    "v3" INTEGER NOT NULL,
    "v4" INTEGER,
    "v5" INTEGER,
    "comment" TEXT,
    CONSTRAINT "Response_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Response_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    -- hand-edited: answer values are integers 1..5, comment max 1000 chars (MVP-08)
    CONSTRAINT "Response_v1_range" CHECK (typeof("v1") = 'integer' AND "v1" BETWEEN 1 AND 5),
    CONSTRAINT "Response_v2_range" CHECK (typeof("v2") = 'integer' AND "v2" BETWEEN 1 AND 5),
    CONSTRAINT "Response_v3_range" CHECK (typeof("v3") = 'integer' AND "v3" BETWEEN 1 AND 5),
    CONSTRAINT "Response_v4_range" CHECK ("v4" IS NULL OR (typeof("v4") = 'integer' AND "v4" BETWEEN 1 AND 5)),
    CONSTRAINT "Response_v5_range" CHECK ("v5" IS NULL OR (typeof("v5") = 'integer' AND "v5" BETWEEN 1 AND 5)),
    CONSTRAINT "Response_comment_length" CHECK ("comment" IS NULL OR length("comment") <= 1000)
) WITHOUT ROWID; -- NFR-01 (hand-edited)

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    CONSTRAINT "Action_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Kudos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Kudos_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Kudos_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Team_managerId_key" ON "Team"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "RoundQuestion_roundId_questionId_key" ON "RoundQuestion"("roundId", "questionId");

-- CreateIndex
CREATE INDEX "Response_roundId_idx" ON "Response"("roundId");
