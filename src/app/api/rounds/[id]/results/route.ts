import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { getRoundResults } from "@/server/results";

// GET /api/rounds/:id/results — below the threshold only `insufficient_responses`
// and the count (MVP-10, MVP-11).
export const GET = route(async (request, context: RouteContext<"/api/rounds/[id]/results">) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  return NextResponse.json(await getRoundResults(user, id));
});
