import { beforeAll, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/login/route";
import { POST as logout } from "@/app/api/logout/route";
import { GET as me } from "@/app/api/me/route";
import { db } from "@/lib/db";
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from "@/lib/session";
import { PASSWORD, request, resetDb, type Fixture } from "./helpers";

let fx: Fixture;
beforeAll(async () => {
  fx = await resetDb();
});

const loginAs = (email: unknown, password: unknown) =>
  login(request("/api/login", { method: "POST", body: { email, password } }), undefined);

describe("login [MVP-01]", () => {
  it("logs in with correct credentials and returns the home page of the role", async () => {
    const employee = await loginAs(fx.a.employees[0].email, PASSWORD);
    expect(employee.status).toBe(200);
    expect((await employee.json()).home).toBe("/");

    const hr = await loginAs(fx.hr.email, PASSWORD);
    expect((await hr.json()).home).toBe("/hr/rounds");
  });

  it("returns the same generic error for an unknown e-mail and a wrong password", async () => {
    const wrongPassword = await loginAs(fx.hr.email, "wrong");
    const unknownEmail = await loginAs("nobody@example.test", PASSWORD);

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
    expect(wrongPassword.headers.get("set-cookie")).toBeNull();
  });

  it("rejects malformed input without a server error", async () => {
    expect((await loginAs(undefined, undefined)).status).toBe(401);
    expect((await loginAs({ $ne: null }, ["x"])).status).toBe(401);
  });

  it("never returns the password hash", async () => {
    const response = await loginAs(fx.hr.email, PASSWORD);
    expect(JSON.stringify(await response.json())).not.toContain("passwordHash");
  });
});

describe("session cookie [NFR-05]", () => {
  it("is HttpOnly and SameSite=Lax", async () => {
    const response = await loginAs(fx.hr.email, PASSWORD);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
  });

  it("rejects forged and expired tokens", () => {
    const token = createSessionToken(fx.hr.id);
    expect(verifySessionToken(token)).toBe(fx.hr.id);

    const [payload, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ uid: fx.a.manager.id, exp: 9999999999 }),
    ).toString("base64url");
    expect(verifySessionToken(`${forgedPayload}.${signature}`)).toBeNull();
    expect(verifySessionToken(`${payload}.`)).toBeNull();
    expect(verifySessionToken("garbage")).toBeNull();

    const nineHours = 9 * 60 * 60 * 1000;
    expect(verifySessionToken(token, Date.now() + nineHours)).toBeNull();
  });

  it("stores passwords only as bcrypt hashes", async () => {
    const users = await db.user.findMany({ select: { passwordHash: true } });
    for (const user of users) {
      expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(user.passwordHash).not.toContain(PASSWORD);
    }
  });
});

describe("authenticated endpoints [MVP-03]", () => {
  it("GET /api/me returns 401 without a session", async () => {
    expect((await me(request("/api/me"), undefined)).status).toBe(401);
  });

  it("GET /api/me returns the user, role and team", async () => {
    const response = await me(request("/api/me", { as: fx.b.manager }), undefined);
    expect(response.status).toBe(200);
    expect((await response.json()).user).toEqual({
      id: fx.b.manager.id,
      name: fx.b.manager.name,
      role: "MANAGER",
      teamId: fx.b.team.id,
    });
  });

  it("logout clears the session cookie [MVP-01]", async () => {
    const response = await logout(
      request("/api/logout", { method: "POST", as: fx.hr }),
      undefined,
    );
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${SESSION_COOKIE}=;`);
    expect(cookie).toMatch(/max-age=0/i);
  });
});
