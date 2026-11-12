import { cookies } from "next/headers";
import { forbidden, notFound, redirect } from "next/navigation";
import { HttpError } from "@/lib/errors";
import { SESSION_COOKIE, loadSessionUser, type Role, type SessionUser } from "@/lib/session";

// Server-rendered pages enforce the same rules as the API (MVP-03):
// no session → /login, wrong role or team → 403 page.

export async function getPageUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  return loadSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requirePageUser(...roles: Role[]): Promise<SessionUser> {
  const user = await getPageUser();
  if (!user) redirect("/login");
  if (roles.length > 0 && !roles.includes(user.role)) forbidden();
  return user;
}

/** Runs a service call and turns its 403/404 into the matching page. */
export async function pageData<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 403) forbidden();
      if (error.status === 404) notFound();
      if (error.status === 401) redirect("/login");
    }
    throw error;
  }
}
