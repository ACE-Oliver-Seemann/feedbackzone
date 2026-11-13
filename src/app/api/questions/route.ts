import { NextResponse } from "next/server";
import { readJsonObject, route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { createTeamQuestion, listQuestions } from "@/server/catalog";

// GET /api/questions — question library for manager and HR (MVP-04).
export const GET = route(async (request) => {
  const user = await requireUser(request);
  return NextResponse.json({ questions: await listQuestions(user) });
});

// POST /api/questions — a manager adds an own question for their team (IT-07).
export const POST = route(async (request) => {
  const user = await requireUser(request);
  const question = await createTeamQuestion(user, await readJsonObject(request));
  return NextResponse.json({ question }, { status: 201 });
});
