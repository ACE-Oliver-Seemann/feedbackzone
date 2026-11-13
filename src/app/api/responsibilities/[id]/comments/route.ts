import { NextResponse } from "next/server";
import { readJsonObject, route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { addResponsibilityComment } from "@/server/responsibilities";

// POST /api/responsibilities/:id/comments — body { text, internal? } (IT-14).
export const POST = route(
  async (request, context: RouteContext<"/api/responsibilities/[id]/comments">) => {
    const user = await requireUser(request);
    const { id } = await context.params;
    const comment = await addResponsibilityComment(user, id, await readJsonObject(request));
    return NextResponse.json({ comment }, { status: 201 });
  },
);
