import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import type { Role, SessionUser } from "@/lib/session";

// Compared against when the e-mail is unknown, so that both failure paths
// cost the same and return the same error (MVP-01).
const DUMMY_HASH = bcrypt.hashSync("no-such-user", 10);

/**
 * Ends every session of the user (MVP-01). The session is a signed cookie,
 * so deleting it in the browser is not enough: a copy would keep working.
 * Logging out on one device therefore logs the user out everywhere.
 */
export async function endSessions(userId: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { sessionsValidAfter: new Date() } });
}

export async function authenticate(input: Record<string, unknown>): Promise<SessionUser> {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";

  const user = email
    ? await db.user.findUnique({
        where: { email },
        select: { id: true, name: true, role: true, teamId: true, passwordHash: true },
      })
    : null;

  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordMatches) throw new HttpError(401, "invalid_credentials");

  return { id: user.id, name: user.name, role: user.role as Role, teamId: user.teamId };
}
