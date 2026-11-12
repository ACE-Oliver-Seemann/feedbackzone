import { NextResponse } from "next/server";
import { readJsonObject, route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { sendKudos } from "@/server/kudos";

// POST /api/kudos — send kudos to a colleague (MVP-16).
export const POST = route(async (request) => {
  const user = await requireUser(request);
  const kudos = await sendKudos(user, await readJsonObject(request));
  return NextResponse.json({ kudos }, { status: 201 });
});
