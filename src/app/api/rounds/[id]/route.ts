import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { getRoundForFill } from "@/server/responses";

// GET /api/rounds/:id — questions of the round for a team member (MVP-08).
export const GET = route(async (request, context: RouteContext<"/api/rounds/[id]">) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  return NextResponse.json({ round: await getRoundForFill(user, id) });
});
