import { NextResponse } from "next/server";
import { readJsonObject, route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { updateIssue } from "@/server/hr-issues";

// PATCH /api/hr/issues/:id — HR changes status, owner group or due date (IT-10).
export const PATCH = route(async (request, context: RouteContext<"/api/hr/issues/[id]">) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  const issue = await updateIssue(user, id, await readJsonObject(request));
  return NextResponse.json({ issue });
});
