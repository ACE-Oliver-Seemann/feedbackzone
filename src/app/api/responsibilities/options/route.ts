import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { getResponsibilityOptions } from "@/server/responsibilities";

// GET /api/responsibilities/options — choices for the create/edit form (IT-14).
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const options = await getResponsibilityOptions(user);
  return NextResponse.json({ options });
});
