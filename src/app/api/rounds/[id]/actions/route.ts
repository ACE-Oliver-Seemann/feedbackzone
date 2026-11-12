import { NextResponse } from "next/server";
import { readJsonObject, route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { createAction } from "@/server/actions";

// POST /api/rounds/:id/actions — the manager adds an action ("krok") (MVP-13).
export const POST = route(async (request, context: RouteContext<"/api/rounds/[id]/actions">) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  const action = await createAction(user, id, await readJsonObject(request));
  return NextResponse.json({ action }, { status: 201 });
});
