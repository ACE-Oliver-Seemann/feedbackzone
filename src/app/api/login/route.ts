import { NextResponse } from "next/server";
import { readJsonObject, route } from "@/lib/errors";
import { homePathFor, setSessionCookie } from "@/lib/session";
import { authenticate } from "@/server/auth";

// POST /api/login — the only endpoint available without a session (MVP-01).
export const POST = route(async (request) => {
  const user = await authenticate(await readJsonObject(request));
  const response = NextResponse.json({ user, home: homePathFor(user.role) });
  setSessionCookie(response, user.id);
  return response;
});
