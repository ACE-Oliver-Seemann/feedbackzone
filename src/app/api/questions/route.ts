import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { listQuestions } from "@/server/catalog";

// GET /api/questions — question library for manager and HR (MVP-04).
export const GET = route(async (request) => {
  const user = await requireUser(request);
  return NextResponse.json({ questions: await listQuestions(user) });
});
