import { forbidden } from "@/lib/errors";
import type { Role, SessionUser } from "@/lib/session";

// Permission matrix from docs/requirements/mvp.md, section "Roly a oprávnenia"
// (MVP-03, NFR-03). Every check throws 403. All server code — route handlers
// and server-rendered pages — goes through these functions.

export function requireRole(user: SessionUser, ...roles: Role[]): void {
  if (!roles.includes(user.role)) throw forbidden();
}

const isOwnTeam = (user: SessionUser, teamId: string) =>
  user.teamId !== null && user.teamId === teamId;

/** Create, open, close a round: manager for own team, HR for any team. */
export function assertCanManageRounds(user: SessionUser, teamId: string): void {
  if (user.role === "HR") return;
  if (user.role === "MANAGER" && isOwnTeam(user, teamId)) return;
  throw forbidden();
}

/** See round results and comments: manager for own team, HR for any team. */
export function assertCanViewResults(user: SessionUser, teamId: string): void {
  assertCanManageRounds(user, teamId);
}

/** Write and change actions ("krok"): the team's manager only. Not HR. */
export function assertCanWriteActions(user: SessionUser, teamId: string): void {
  if (user.role === "MANAGER" && isOwnTeam(user, teamId)) return;
  throw forbidden();
}

/** Fill in a round: employees and the manager of that team. Not HR. */
export function assertCanFillRound(user: SessionUser, teamId: string): void {
  if ((user.role === "EMPLOYEE" || user.role === "MANAGER") && isOwnTeam(user, teamId)) return;
  throw forbidden();
}

/** See the team page and its actions: team members, HR for any team. */
export function assertCanViewTeam(user: SessionUser, teamId: string): void {
  if (user.role === "HR") return;
  if (isOwnTeam(user, teamId)) return;
  throw forbidden();
}
