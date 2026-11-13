import { NextResponse } from "next/server";
import { readJsonObject, route, validationError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import {
  createResponsibility,
  listResponsibilities,
  type ResponsibilityFilter,
} from "@/server/responsibilities";

const BOOLEANS: Record<string, boolean> = {
  true: true,
  "1": true,
  false: false,
  "0": false,
};

// GET /api/responsibilities?status=&priority=&teamId=&assigneeId=&relatedUserId=&kind=&overdue=&sort=
// Cards the viewer may see (IT-14). Unknown filter values → 400.
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const query = request.nextUrl.searchParams;
  const overdueParam = query.get("overdue");
  let overdue: boolean | null = null;
  if (overdueParam !== null && overdueParam !== "") {
    if (!(overdueParam in BOOLEANS)) throw validationError({ overdue: "invalid" });
    overdue = BOOLEANS[overdueParam];
  }
  // The values are checked against the allowed lists in listResponsibilities.
  const value = (name: string) => query.get(name) || null;
  const responsibilities = await listResponsibilities(user, {
    status: value("status") as ResponsibilityFilter["status"],
    priority: value("priority") as ResponsibilityFilter["priority"],
    teamId: value("teamId"),
    assigneeId: value("assigneeId"),
    relatedUserId: value("relatedUserId"),
    kind: value("kind") as ResponsibilityFilter["kind"],
    overdue,
    sort: value("sort") as ResponsibilityFilter["sort"],
  });
  return NextResponse.json({ responsibilities });
});

// POST /api/responsibilities — HR or a manager adds a card (IT-14).
export const POST = route(async (request) => {
  const user = await requireUser(request);
  const responsibility = await createResponsibility(user, await readJsonObject(request));
  return NextResponse.json({ responsibility }, { status: 201 });
});
