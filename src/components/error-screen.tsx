import { ButtonLink } from "@/components/ui/button";

/**
 * Body of the 403 and 404 screens. Outside the app shell it is the page's
 * <main>; inside the shell the layout already provides <main>, so there it is
 * a plain block (FE2-008).
 */
export function ErrorScreen({
  inShell = false,
  icon,
  title,
  text,
  code,
  backLabel,
}: {
  inShell?: boolean;
  icon: React.ReactNode;
  title: string;
  text: string;
  code: string;
  backLabel: string;
}) {
  const Tag = inShell ? "div" : "main";
  return (
    <Tag
      className={
        inShell
          ? "flex items-center justify-center px-4 py-10 sm:py-16"
          : "flex min-h-screen items-center justify-center px-4 py-16"
      }
    >
      <div className="flex max-w-sm animate-rise flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-full bg-brand-50 text-brand-600">
          {icon}
        </span>
        <h1 className="mt-6 text-[1.75rem] leading-tight font-medium tracking-[-0.02em] text-ink">
          {title}
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{text}</p>
        <ButtonLink href="/" className="mt-8">
          {backLabel}
        </ButtonLink>
        <p className="mt-6 text-xs text-muted">{code}</p>
      </div>
    </Tag>
  );
}
