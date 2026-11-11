import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import type { SessionUser } from "@/lib/session";

export type QuestionItem = { id: string; text: string; type: string; topic: string };

/** GET /api/questions — question library, manager and HR only (MVP-04). */
export async function listQuestions(user: SessionUser): Promise<QuestionItem[]> {
  requireRole(user, "MANAGER", "HR");
  return db.question.findMany({
    orderBy: [{ topic: "asc" }, { text: "asc" }],
    select: { id: true, text: true, type: true, topic: true },
  });
}

/** Teams the user may create a round for: own team for a manager, all for HR. */
export async function listManageableTeams(
  user: SessionUser,
): Promise<{ id: string; name: string }[]> {
  requireRole(user, "MANAGER", "HR");
  return db.team.findMany({
    where: user.role === "HR" ? {} : { id: user.teamId ?? "" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
