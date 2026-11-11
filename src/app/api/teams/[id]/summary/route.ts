import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { getTeamSummary } from "@/server/teams";

// GET /api/teams/:id/summary — closed rounds, averages above the threshold,
// actions and public kudos, for team members and HR (MVP-14, MVP-17).
export const GET = route(async (request, context: RouteContext<"/api/teams/[id]/summary">) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  return NextResponse.json(await getTeamSummary(user, id));
});
