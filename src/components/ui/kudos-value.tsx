import type { ComponentProps } from "react";
import type { KudosValue } from "@/config/kudos";
import { t } from "@/lib/texts.sk";
import { cx } from "./cx";

// Small icons for the kudos values, drawn like the set in icons.tsx
// (24px grid, 1.75 stroke, round caps). Decorative: the label carries the meaning.
type SvgProps = Omit<ComponentProps<"svg">, "children"> & { size?: number };

function Svg({ size = 14, children, ...props }: SvgProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

const ICONS: Record<KudosValue, (props: SvgProps) => React.ReactNode> = {
  // Two linked rings
  COLLABORATION: (p) => (
    <Svg {...p}>
      <circle cx="9" cy="12" r="4.75" />
      <circle cx="15" cy="12" r="4.75" />
    </Svg>
  ),
  // Star
  QUALITY: (p) => (
    <Svg {...p}>
      <path d="M12 4.5l2.3 4.7 5.2.75-3.75 3.65.9 5.15L12 16.3l-4.65 2.45.9-5.15L4.5 9.95l5.2-.75L12 4.5z" />
    </Svg>
  ),
  // Heart
  HELPING: (p) => (
    <Svg {...p}>
      <path d="M12 19.5s-7.5-4.4-7.5-9.7A4.3 4.3 0 0112 7.2a4.3 4.3 0 017.5 2.6c0 5.3-7.5 9.7-7.5 9.7z" />
    </Svg>
  ),
  // Spark
  INNOVATION: (p) => (
    <Svg {...p}>
      <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
    </Svg>
  ),
  // Person with a check: someone we work for
  CUSTOMER: (p) => (
    <Svg {...p}>
      <circle cx="10" cy="8.5" r="3.25" />
      <path d="M4 19c.6-3 3-4.75 6-4.75 1.2 0 2.3.3 3.2.8M15 17.5l2 2 3.5-4" />
    </Svg>
  ),
};

/**
 * Subtle per-value accent, kept inside the brand palette: a thin bar in list
 * rows and the icon color in badges.
 */
export const KUDOS_ACCENT: Record<KudosValue, { bar: string; icon: string }> = {
  COLLABORATION: { bar: "bg-brand-500", icon: "text-brand-600" },
  QUALITY: { bar: "bg-brand-800", icon: "text-brand-800" },
  HELPING: { bar: "bg-brand-400", icon: "text-brand-600" },
  INNOVATION: { bar: "bg-brand-300", icon: "text-brand-700" },
  CUSTOMER: { bar: "bg-brand-700", icon: "text-brand-700" },
};

export function KudosValueIcon({ value, ...props }: SvgProps & { value: KudosValue }) {
  const Icon = ICONS[value];
  return <Icon {...props} />;
}

/** Value pill with its icon; with `count`, reads e.g. "Pomoc kolegom ×2". */
export function KudosValueBadge({
  value,
  count,
  className,
}: {
  value: KudosValue;
  count?: number;
  className?: string;
}) {
  const label = t.kudos.values[value];
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-50 px-2.5 text-xs font-medium text-brand-800",
        className,
      )}
    >
      <KudosValueIcon value={value} size={13} className={KUDOS_ACCENT[value].icon} />
      {count === undefined ? label : t.kudos.valueCount(label, count)}
    </span>
  );
}
