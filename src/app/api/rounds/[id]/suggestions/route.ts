import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { getRoundSuggestions } from "@/server/suggestions";

// GET /api/rounds/:id/suggestions — two suggested actions for a closed round
// above the confidentiality threshold; manager of the team and HR (IT-09).
export const GET = route(
  async (request, context: RouteContext<"/api/rounds/[id]/suggestions">) => {
    const user = await requireUser(request);
    const { id } = await context.params;
    return NextResponse.json(await getRoundSuggestions(user, id));
  },
);
