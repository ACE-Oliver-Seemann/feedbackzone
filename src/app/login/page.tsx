import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { BrandMark } from "@/components/ui/brand-mark";
import { IconInfo } from "@/components/ui/icons";
import { getPageUser } from "@/lib/page-auth";
import { homePathFor } from "@/lib/session";
import { t } from "@/lib/texts.sk";

export const metadata: Metadata = { title: t.login.title };

// Screen "Prihlásenie" (MVP-01). Outside the app shell: on large screens a
// quiet brand pane next to the form, on small screens only the form.
export default async function LoginPage() {
  const user = await getPageUser();
  if (user) redirect(homePathFor(user.role));

  return (
    <div className="flex min-h-screen lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex xl:p-16">
        <div>
          <BrandMark size="lg" tone="dark" />
        </div>
        <div className="max-w-md">
          <p className="text-[2.5rem] leading-[1.1] font-medium tracking-[-0.025em]">
            {t.login.tagline}
          </p>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-white/75">
            {t.login.taglineDetail}
          </p>
        </div>
        <p className="text-sm text-white/55">{t.app.testDataNotice}</p>
      </aside>

      <main className="flex w-full flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-10 flex justify-center lg:hidden">
            <BrandMark />
          </div>
          <h1 className="text-[1.75rem] leading-tight font-medium tracking-[-0.02em] text-ink">
            {t.login.title}
          </h1>
          <p className="mt-1.5 text-[0.9375rem] text-ink-soft">{t.login.subtitle}</p>
          <LoginForm />
          <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted lg:hidden">
            <IconInfo size={14} />
            {t.app.testDataNotice}
          </p>
        </div>
      </main>
    </div>
  );
}
