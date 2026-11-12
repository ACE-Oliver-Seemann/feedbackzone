import { ButtonLink } from "@/components/ui/button";
import { IconLock } from "@/components/ui/icons";
import { t } from "@/lib/texts.sk";

// 403 page. Renders outside the app shell.
export default function Forbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="flex max-w-sm animate-rise flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-full bg-brand-50 text-brand-600">
          <IconLock size={26} />
        </span>
        <h1 className="mt-6 text-[1.75rem] leading-tight font-medium tracking-[-0.02em] text-ink">
          {t.errors.forbiddenTitle}
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
          {t.errors.forbiddenText}
        </p>
        <ButtonLink href="/" className="mt-8">
          {t.errors.backHome}
        </ButtonLink>
        <p className="mt-6 text-xs text-muted">{t.errors.forbiddenCode}</p>
      </div>
    </main>
  );
}
