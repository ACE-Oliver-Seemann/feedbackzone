import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { getReactionOverview } from "@/server/hr-overview";

// GET /api/hr/overview — share of closed rounds with an action and reaction
// time per team, for HR only (IT-05).
export const GET = route(async (request) => {
  const user = await requireUser(request);
  return NextResponse.json(await getReactionOverview(user));
});
