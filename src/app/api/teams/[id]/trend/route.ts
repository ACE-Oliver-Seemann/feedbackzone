import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { getTeamTrend } from "@/server/trends";

// GET /api/teams/:id/trend — scores of the team's closed rounds over time,
// only rounds above the confidentiality threshold; manager of the team and HR (IT-08).
export const GET = route(async (request, context: RouteContext<"/api/teams/[id]/trend">) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  return NextResponse.json(await getTeamTrend(user, id));
});
