import { NextResponse } from "next/server";
import { readJsonObject, route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { getResponsibility, updateResponsibility } from "@/server/responsibilities";

// GET /api/responsibilities/:id — one card with the comments the viewer may see (IT-14).
export const GET = route(async (request, context: RouteContext<"/api/responsibilities/[id]">) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  const responsibility = await getResponsibility(user, id);
  return NextResponse.json({ responsibility });
});

// PATCH /api/responsibilities/:id — fields the viewer may change (IT-14).
export const PATCH = route(async (request, context: RouteContext<"/api/responsibilities/[id]">) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  const responsibility = await updateResponsibility(user, id, await readJsonObject(request));
  return NextResponse.json({ responsibility });
});
