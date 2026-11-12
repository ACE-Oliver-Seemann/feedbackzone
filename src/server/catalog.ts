import { Prisma } from "@prisma/client";
import { toScaleKey, type ScaleKey } from "@/config/scales";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { forbidden, validationError } from "@/lib/errors";
import type { SessionUser } from "@/lib/session";
import { charLength, cleanText } from "@/lib/text";

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
  /** Null for the shared library, otherwise the owning team (IT-07). */
  teamId: string | null;
};

/** Topic under which a manager's own questions are listed (IT-07). */
export const CUSTOM_QUESTION_TOPIC = "Vlastné otázky tímu";
export const CUSTOM_QUESTION_MIN_LENGTH = 10;
export const CUSTOM_QUESTION_MAX_LENGTH = 200;

const QUESTION_SELECT = {
  id: true,
  text: true,
  type: true,
  topic: true,
  scale: true,
  starter: true,
  fixed: true,
  teamId: true,
} as const;

/**
 * GET /api/questions — question library, manager and HR only (MVP-04).
 * A manager gets the shared library plus the own questions of their team;
 * HR gets everything (IT-07).
 */
export async function listQuestions(user: SessionUser): Promise<QuestionItem[]> {
  requireRole(user, "MANAGER", "HR");
  const questions = await db.question.findMany({
    where: user.role === "HR" ? {} : { OR: [{ teamId: null }, { teamId: user.teamId ?? "" }] },
    orderBy: [{ fixed: "desc" }, { topic: "asc" }, { text: "asc" }],
    select: QUESTION_SELECT,
  });
  return questions.map((question) => ({ ...question, scale: toScaleKey(question.scale) }));
}

/**
 * POST /api/questions — a manager writes an own question for their team (IT-07).
 * It always uses the agreement scale, is never fixed or recommended, and can
 * not be edited or deleted afterwards: a question already used in a round
 * must keep its meaning.
 */
export async function createTeamQuestion(
  user: SessionUser,
  input: Record<string, unknown>,
): Promise<QuestionItem> {
  requireRole(user, "MANAGER");
  if (!user.teamId) throw forbidden();

  const text = cleanText(input.text).replace(/\s+/g, " ");
  if (charLength(text) < CUSTOM_QUESTION_MIN_LENGTH) throw validationError({ text: "too_short" });
  if (charLength(text) > CUSTOM_QUESTION_MAX_LENGTH) throw validationError({ text: "too_long" });

  // The same wording must not exist twice for the team, nor shadow the shared library.
  const candidates = await db.question.findMany({
    where: { OR: [{ teamId: null }, { teamId: user.teamId }] },
    select: { text: true },
  });
  const normalized = text.toLocaleLowerCase("sk");
  if (candidates.some((question) => question.text.toLocaleLowerCase("sk") === normalized)) {
    throw validationError({ text: "duplicate" });
  }

  try {
    const question = await db.question.create({
      data: { text, topic: CUSTOM_QUESTION_TOPIC, scale: "AGREEMENT", teamId: user.teamId },
      select: QUESTION_SELECT,
    });
    return { ...question, scale: toScaleKey(question.scale) };
  } catch (error) {
    // Two identical requests at the same moment: the unique index stops the second.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw validationError({ text: "duplicate" });
    }
    throw error;
  }
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
