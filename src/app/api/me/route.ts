import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { requireUser } from "@/lib/session";

// GET /api/me — current user, role and team (MVP-03).
export const GET = route(async (request) => {
  const user = await requireUser(request);
  return NextResponse.json({ user });
});
