import { NextResponse } from "next/server";
import { readJsonObject, route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { submitResponse } from "@/server/responses";

// POST /api/rounds/:id/responses — submit an answer; 409 on a second attempt (MVP-09).
// NFR-01: the reply carries no id of the stored response and the body is never logged.
export const POST = route(
  async (request, context: RouteContext<"/api/rounds/[id]/responses">) => {
    const user = await requireUser(request);
    const { id } = await context.params;
    await submitResponse(user, id, await readJsonObject(request));
    return NextResponse.json({ ok: true }, { status: 201 });
  },
);
