import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { clearSessionCookie, requireUser, revokeSessions } from "@/lib/session";

// POST /api/logout — ends the session (MVP-01). The token is invalidated on
// the server too, so a copied cookie stops working (BE-001).
export const POST = route(async (request) => {
  const user = await requireUser(request);
  await revokeSessions(user.id);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
});
