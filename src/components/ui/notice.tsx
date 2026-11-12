import type { ComponentProps } from "react";
import { cx } from "./cx";
import { IconAlert, IconCheck, IconInfo, IconLock } from "./icons";

export type NoticeTone = "info" | "success" | "warning" | "error" | "confidential";

const TONES: Record<NoticeTone, { box: string; icon: string; Icon: typeof IconInfo }> = {
  info: { box: "bg-brand-50 text-brand-900", icon: "text-brand-600", Icon: IconInfo },
  confidential: { box: "bg-brand-50 text-brand-900", icon: "text-brand-600", Icon: IconLock },
  success: { box: "bg-emerald-50 text-emerald-950", icon: "text-emerald-600", Icon: IconCheck },
  warning: { box: "bg-amber-50 text-amber-950", icon: "text-amber-600", Icon: IconAlert },
  error: { box: "bg-red-50 text-red-900", icon: "text-red-600", Icon: IconAlert },
};

/**
 * Inline message: errors, success feedback, explanations. Pass role="alert"
 * for errors and role="status" for success so screen readers announce them.
 */
export function Notice({
  tone = "info",
  title,
  children,
  className,
  ...props
}: Omit<ComponentProps<"div">, "title"> & { tone?: NoticeTone; title?: React.ReactNode }) {
  const { box, icon, Icon } = TONES[tone];
  return (
    <div
      className={cx("flex animate-rise gap-3 rounded-xl px-4 py-3 text-sm leading-relaxed", box, className)}
      {...props}
    >
      <Icon className={cx("mt-0.5 shrink-0", icon)} />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : undefined}>{children}</div>}
      </div>
    </div>
  );
}
