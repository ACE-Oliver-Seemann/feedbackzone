import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { getHeatmap } from "@/server/trends";

// GET /api/hr/heatmap — teams × topics over the last 90 days, only rounds
// above the confidentiality threshold; HR only (IT-08).
export const GET = route(async (request) => {
  const user = await requireUser(request);
  return NextResponse.json(await getHeatmap(user));
});
