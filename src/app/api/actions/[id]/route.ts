import { NextResponse } from "next/server";
import { readJsonObject, route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { updateActionStatus } from "@/server/actions";

// PATCH /api/actions/:id — the manager changes the status of an action (MVP-13).
export const PATCH = route(async (request, context: RouteContext<"/api/actions/[id]">) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  const action = await updateActionStatus(user, id, await readJsonObject(request));
  return NextResponse.json({ action });
});
