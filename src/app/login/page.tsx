import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getPageUser } from "@/lib/page-auth";
import { homePathFor } from "@/lib/session";
import { t } from "@/lib/texts.sk";

// Screen "Prihlásenie" (MVP-01).
export default async function LoginPage() {
  const user = await getPageUser();
  if (user) redirect(homePathFor(user.role));

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <p className="text-sm font-semibold text-teal-700">{t.app.name}</p>
      <h1 className="mt-1 text-2xl font-semibold">{t.login.title}</h1>
      <LoginForm />
      <p className="mt-6 text-xs text-slate-500">{t.app.testDataNotice}</p>
    </main>
  );
}
