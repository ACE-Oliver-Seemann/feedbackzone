import { Prisma } from "@prisma/client";
import { toScaleKey, type ScaleKey } from "@/config/scales";
import { db } from "@/lib/db";
import { assertCanFillRound, requireRole } from "@/lib/authz";
import { conflict, forbidden, notFound, validationError } from "@/lib/errors";
import type { SessionUser } from "@/lib/session";
import { charLength, cleanText } from "@/lib/text";
import { closeExpiredRounds, type RoundStatus } from "@/server/rounds";

export const MAX_COMMENT_LENGTH = 1000;

export type FillRound = {
  id: string;
  name: string;
  teamId: string;
  status: RoundStatus;
  closesAt: string;
  /** Whether the current user already answered. */
  submitted: boolean;
  questions: { position: number; text: string; scale: ScaleKey }[];
};

async function loadFillableRound(user: SessionUser, roundId: string) {
  requireRole(user, "EMPLOYEE", "MANAGER");
  await closeExpiredRounds();
  const round = await db.round.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      name: true,
      teamId: true,
      status: true,
      closesAt: true,
      questions: {
        orderBy: { position: "asc" },
        select: { position: true, question: { select: { text: true, scale: true } } },
      },
    },
  });
  // Members of another team must not learn whether the round exists.
  if (!round) throw forbidden();
  assertCanFillRound(user, round.teamId);
  // A draft is not visible to the team yet (MVP-05).
  if (round.status === "DRAFT") throw notFound();
  return round;
}

/** GET /api/rounds/:id — questions of a round for a team member (MVP-08). */
export async function getRoundForFill(user: SessionUser, roundId: string): Promise<FillRound> {
  const round = await loadFillableRound(user, roundId);
  const participation = await db.participation.findUnique({
    where: { roundId_userId: { roundId: round.id, userId: user.id } },
    select: { userId: true },
  });
  return {
    id: round.id,
    name: round.name,
    teamId: round.teamId,
    status: round.status as RoundStatus,
    closesAt: round.closesAt.toISOString(),
    submitted: participation !== null,
    questions: round.questions.map((item) => ({
      position: item.position,
      text: item.question.text,
      scale: toScaleKey(item.question.scale),
    })),
  };
}

const isScaleValue = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;

/**
 * POST /api/rounds/:id/responses — submits one answer per question plus an
 * optional comment (MVP-09).
 *
 * NFR-01: the Participation row (who) and the Response row (what) are written
 * in one transaction and share nothing but the round. The Response gets a
 * random UUID, no user and no timestamp, and its id is never returned or
 * logged. A second attempt fails on the Participation primary key → 409.
 */
export async function submitResponse(
  user: SessionUser,
  roundId: string,
  input: Record<string, unknown>,
): Promise<void> {
  const round = await loadFillableRound(user, roundId);
  if (round.status !== "OPEN") throw conflict("round_closed");

  const fields: Record<string, string> = {};

  const answers = Array.isArray(input.answers) ? input.answers : null;
  if (!answers || answers.length !== round.questions.length || !answers.every(isScaleValue)) {
    fields.answers = "invalid";
  }

  let comment: string | null = null;
  if (input.comment !== undefined && input.comment !== null) {
    if (typeof input.comment !== "string") fields.comment = "invalid";
    else if (charLength(cleanText(input.comment)) > MAX_COMMENT_LENGTH) fields.comment = "too_long";
    else comment = cleanText(input.comment) || null;
  }

  if (Object.keys(fields).length > 0) throw validationError(fields);
  const values = answers as number[];

  try {
    await db.$transaction(async (tx) => {
      // A real write on the round takes the database write lock first, so the
      // check "still open and before the deadline" and the two inserts cannot
      // be separated by someone closing the round (QA BE-002).
      const stillOpen = await tx.round.updateMany({
        where: { id: round.id, status: "OPEN", closesAt: { gte: new Date() } },
        data: { status: "OPEN" },
      });
      if (stillOpen.count === 0) throw conflict("round_closed");

      await tx.participation.create({ data: { roundId: round.id, userId: user.id } });
      await tx.response.create({
        data: {
          roundId: round.id,
          teamId: round.teamId,
          v1: values[0],
          v2: values[1],
          v3: values[2],
          v4: values[3] ?? null,
          v5: values[4] ?? null,
          comment,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("already_submitted");
    }
    throw error;
  }
}
