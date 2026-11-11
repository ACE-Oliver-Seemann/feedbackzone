import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, createSessionToken } from "@/lib/session";

// Invented fixtures only (NFR-06).

export const PASSWORD = "Heslo123";

export type Fixture = Awaited<ReturnType<typeof resetDb>>;

export async function wipeDb() {
  await db.kudos.deleteMany();
  await db.action.deleteMany();
  await db.response.deleteMany();
  await db.participation.deleteMany();
  await db.roundQuestion.deleteMany();
  await db.round.deleteMany();
  await db.question.deleteMany();
  await db.user.updateMany({ data: { teamId: null } });
  await db.team.deleteMany();
  await db.user.deleteMany();
}

async function createTeam(key: string, passwordHash: string) {
  const manager = await db.user.create({
    data: {
      name: `Manažér ${key}`,
      email: `manager.${key}@example.test`,
      passwordHash,
      role: "MANAGER",
    },
  });
  const team = await db.team.create({ data: { name: `Tím ${key}`, managerId: manager.id } });
  await db.user.update({ where: { id: manager.id }, data: { teamId: team.id } });

  const employees = [];
  for (let index = 1; index <= 5; index++) {
    employees.push(
      await db.user.create({
        data: {
          name: `Zamestnanec ${key}${index}`,
          email: `employee${index}.${key}@example.test`,
          passwordHash,
          role: "EMPLOYEE",
          teamId: team.id,
        },
      }),
    );
  }
  return { team, manager: { ...manager, teamId: team.id }, employees };
}

/** Wipes the test database and creates 2 teams of 6, 1 HR and 6 questions. */
export async function resetDb() {
  await wipeDb();
  const passwordHash = await bcrypt.hash(PASSWORD, 4);

  const hr = await db.user.create({
    data: { name: "HR Test", email: "hr@example.test", passwordHash, role: "HR" },
  });
  const a = await createTeam("a", passwordHash);
  const b = await createTeam("b", passwordHash);

  const questions = [];
  for (let index = 1; index <= 6; index++) {
    questions.push(
      await db.question.create({ data: { text: `Testovacia otázka ${index}`, topic: "Test" } }),
    );
  }
  return { hr, a, b, questions };
}

type RequestOptions = {
  method?: string;
  /** Logged-in user; omit for an anonymous request. */
  as?: { id: string };
  body?: unknown;
};

export function request(path: string, options: RequestOptions = {}): NextRequest {
  const headers = new Headers();
  if (options.as) headers.set("cookie", `${SESSION_COOKIE}=${createSessionToken(options.as.id)}`);
  if (options.body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`http://localhost${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

/** Route context for dynamic segments, e.g. `params({ id })`. */
export function params<T extends Record<string, string>>(value: T) {
  return { params: Promise.resolve(value) };
}

/** A date `days` from today as YYYY-MM-DD in local time. */
export function dateInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
