import { MIN_GROUP_SIZE } from "@/config/privacy";
import type { ScaleKey } from "@/config/scales";
import { db } from "@/lib/db";
import { assertCanViewTeam } from "@/lib/authz";
import { forbidden, notFound } from "@/lib/errors";
import type { SessionUser } from "@/lib/session";
import type { ActionItem, ActionStatus } from "@/server/actions";
import { listTeamKudos, type KudosItem } from "@/server/kudos";
import { computeQuestionResults } from "@/server/results";
import { closeExpiredRounds } from "@/server/rounds";

export type TeamRoundSummary = {
  id: string;
  name: string;
  closesAt: string;
  /** When the round was actually closed (its deadline for rounds closed before IT-05). */
  closedAt: string;
  participation: { responded: number; teamSize: number };
  /** Averages only at or above the threshold. Never distributions or comments. */
  results:
    | {
        status: "ok";
        questions: { position: number; text: string; scale: ScaleKey; average: number }[];
      }
    | { status: "insufficient_responses" };
  actions: ActionItem[];
};

export type TeamSummary = {
  team: { id: string; name: string };
  rounds: TeamRoundSummary[];
  kudos: KudosItem[];
};

/**
 * GET /api/teams/:id/summary — "Povedali ste, urobili sme" (MVP-14, MVP-17):
 * closed rounds (newest first) with participation, averages above the
 * threshold and actions, plus the team's public kudos.
 *
 * Team members and HR. Employees see this page too, so it never contains
 * comments or answer distributions — those are for the manager and HR only.
 */
export async function getTeamSummary(user: SessionUser, teamId: string): Promise<TeamSummary> {
  // Check first, so that a member of another team cannot probe team ids.
  if (user.role !== "HR") assertCanViewTeam(user, teamId);
  await closeExpiredRounds();

  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, _count: { select: { members: true } } },
  });
  if (!team) throw user.role === "HR" ? notFound() : forbidden();
  assertCanViewTeam(user, team.id);

  const rounds = await db.round.findMany({
    where: { teamId: team.id, status: "CLOSED" },
    select: {
      id: true,
      name: true,
      closesAt: true,
      closedAt: true,
      questions: {
        orderBy: { position: "asc" },
        select: { position: true, question: { select: { text: true, scale: true } } },
      },
      responses: { select: { v1: true, v2: true, v3: true, v4: true, v5: true } },
      actions: {
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        select: {
          id: true,
          roundId: true,
          topic: true,
          description: true,
          dueDate: true,
          status: true,
        },
      },
    },
  });

  // Newest first by the moment of closing; a round closed by hand before its
  // deadline must not be dated in the future (QA E2E-001).
  const closedTime = (round: { closedAt: Date | null; closesAt: Date }) =>
    (round.closedAt ?? round.closesAt).getTime();
  rounds.sort((a, b) => closedTime(b) - closedTime(a) || a.id.localeCompare(b.id));

  return {
    team: { id: team.id, name: team.name },
    rounds: rounds.map((round) => ({
      id: round.id,
      name: round.name,
      closesAt: round.closesAt.toISOString(),
      closedAt: new Date(closedTime(round)).toISOString(),
      participation: { responded: round.responses.length, teamSize: team._count.members },
      results:
        round.responses.length >= MIN_GROUP_SIZE
          ? {
              status: "ok" as const,
              questions: computeQuestionResults(round.questions, round.responses).map(
                ({ position, text, scale, average }) => ({ position, text, scale, average }),
              ),
            }
          : { status: "insufficient_responses" as const },
      actions: round.actions.map((action) => ({
        ...action,
        dueDate: action.dueDate.toISOString(),
        status: action.status as ActionStatus,
      })),
    })),
    kudos: await listTeamKudos(team.id),
  };
}
