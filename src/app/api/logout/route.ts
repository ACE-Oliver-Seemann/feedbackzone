import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { clearSessionCookie, requireUser } from "@/lib/session";

// POST /api/logout — ends the session (MVP-01).
export const POST = route(async (request) => {
  await requireUser(request);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
});
