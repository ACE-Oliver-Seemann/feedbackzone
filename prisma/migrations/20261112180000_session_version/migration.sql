-- BE-001: logout must invalidate the session token. The token carries the
-- user's sessionVersion; logout increments it. Only the User table changes;
-- Response and Participation (WITHOUT ROWID, NFR-01) are untouched.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
