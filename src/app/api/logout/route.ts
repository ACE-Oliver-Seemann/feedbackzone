import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { clearSessionCookie, requireUser } from "@/lib/session";
import { endSessions } from "@/server/auth";

// POST /api/logout — ends the session (MVP-01).
export const POST = route(async (request) => {
  const user = await requireUser(request);
  await endSessions(user.id);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
});
