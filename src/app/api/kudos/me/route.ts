import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { listMyKudos } from "@/server/kudos";

// GET /api/kudos/me — kudos I received, including private ones (MVP-17).
export const GET = route(async (request) => {
  const user = await requireUser(request);
  return NextResponse.json({ kudos: await listMyKudos(user) });
});
