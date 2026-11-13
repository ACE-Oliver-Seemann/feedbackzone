-- QA session 2026-11-12_001.
-- BE-001: logout ends sessions on the server.
ALTER TABLE "User" ADD COLUMN "sessionsValidAfter" DATETIME;

-- BE-005: one wording of an own question per team. NULL team ids (the shared
-- library) are distinct in SQLite, so the shared library is not constrained.
CREATE UNIQUE INDEX "Question_teamId_text_key" ON "Question"("teamId", "text");
