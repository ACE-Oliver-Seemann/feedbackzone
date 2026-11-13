import { NextResponse } from "next/server";
import { readJsonObject, route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { createNote, listNotes } from "@/server/hr-issues";

// GET /api/hr/notes — HR's notes from offline meetings (IT-10).
export const GET = route(async (request) => {
  const user = await requireUser(request);
  return NextResponse.json({ notes: await listNotes(user) });
});

// POST /api/hr/notes — HR writes down a note; text only (IT-10).
export const POST = route(async (request) => {
  const user = await requireUser(request);
  const note = await createNote(user, await readJsonObject(request));
  return NextResponse.json({ note }, { status: 201 });
});
