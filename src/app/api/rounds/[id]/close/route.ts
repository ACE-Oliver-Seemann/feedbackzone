import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { closeRound } from "@/server/rounds";

// POST /api/rounds/:id/close — OPEN → CLOSED (MVP-05).
export const POST = route(async (request, context: RouteContext<"/api/rounds/[id]/close">) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  await closeRound(user, id);
  return NextResponse.json({ ok: true });
});
