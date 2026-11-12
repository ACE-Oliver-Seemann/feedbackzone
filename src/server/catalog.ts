import { toScaleKey, type ScaleKey } from "@/config/scales";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import type { SessionUser } from "@/lib/session";

export type QuestionItem = {
  id: string;
  text: string;
  type: string;
  topic: string;
  scale: ScaleKey;
  /** Part of the recommended starting set (IT-03). */
  starter: boolean;
  /** Added automatically to every round; cannot be picked or removed (IT-04). */
  fixed: boolean;
};

/** GET /api/questions — question library, manager and HR only (MVP-04). */
export async function listQuestions(user: SessionUser): Promise<QuestionItem[]> {
  requireRole(user, "MANAGER", "HR");
  const questions = await db.question.findMany({
    orderBy: [{ fixed: "desc" }, { topic: "asc" }, { text: "asc" }],
    select: {
      id: true,
      text: true,
      type: true,
      topic: true,
      scale: true,
      starter: true,
      fixed: true,
    },
  });
  return questions.map((question) => ({ ...question, scale: toScaleKey(question.scale) }));
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
