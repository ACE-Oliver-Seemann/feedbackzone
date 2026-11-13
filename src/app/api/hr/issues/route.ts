import { NextResponse } from "next/server";
import { readJsonObject, route } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { createIssue, listIssues } from "@/server/hr-issues";

// GET /api/hr/issues?group=&status= — HR's list of issues (IT-10).
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const query = request.nextUrl.searchParams;
  const issues = await listIssues(user, {
    ownerGroup: query.get("group"),
    status: query.get("status"),
  });
  return NextResponse.json({ issues });
});

// POST /api/hr/issues — HR adds an issue (IT-10).
export const POST = route(async (request) => {
  const user = await requireUser(request);
  const issue = await createIssue(user, await readJsonObject(request));
  return NextResponse.json({ issue }, { status: 201 });
});
