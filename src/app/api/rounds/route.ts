import { NextResponse } from "next/server";
import { readJsonObject, route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { createRound, listRounds } from "@/server/rounds";

// GET /api/rounds — rounds by role (MVP-06, MVP-12).
export const GET = route(async (request) => {
  const user = await requireUser(request);
  return NextResponse.json({ rounds: await listRounds(user) });
});

// POST /api/rounds — create a draft round (MVP-04).
export const POST = route(async (request) => {
  const user = await requireUser(request);
  const round = await createRound(user, await readJsonObject(request));
  return NextResponse.json({ round }, { status: 201 });
});
