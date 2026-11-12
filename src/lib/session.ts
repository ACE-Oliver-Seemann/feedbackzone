import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { unauthorized } from "@/lib/errors";

// Session = signed cookie holding the user id and expiry (MVP-01, NFR-05).
// No session table: the data model in mvp.md has exactly nine tables.

export const SESSION_COOKIE = "fz_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

export type Role = "EMPLOYEE" | "MANAGER" | "HR";

export type SessionUser = {
  id: string;
  name: string;
  role: Role;
  /** Own team. For a manager this is the team they manage. Null for HR. */
  teamId: string | null;
};

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the user id, or null when the token is missing, forged or expired. */
export function verifySessionToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.uid !== "string" || typeof data.exp !== "number") return null;
    if (data.exp * 1000 <= now) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export async function loadSessionUser(token: string | undefined): Promise<SessionUser | null> {
  const userId = verifySessionToken(token);
  if (!userId) return null;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, teamId: true },
  });
  if (!user) return null;
  return { ...user, role: user.role as Role };
}

/** For route handlers: the logged-in user, or 401. */
export async function requireUser(request: NextRequest): Promise<SessionUser> {
  const user = await loadSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) throw unauthorized();
  return user;
}

export function setSessionCookie(response: NextResponse, userId: string): void {
  response.cookies.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Landing page after login (MVP-01). Since IT-11 every role starts on the home
 * page with its tasks; the parameter stays so that a role can differ again.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function homePathFor(role: Role): string {
  return "/";
}
