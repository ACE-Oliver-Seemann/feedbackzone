import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { openRound } from "@/server/rounds";

// POST /api/rounds/:id/open — DRAFT → OPEN (MVP-05).
export const POST = route(async (request, context: RouteContext<"/api/rounds/[id]/open">) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  await openRound(user, id);
  return NextResponse.json({ ok: true });
});
