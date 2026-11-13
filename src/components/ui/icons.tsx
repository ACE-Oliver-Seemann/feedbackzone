import type { ComponentProps } from "react";

// One small, consistent icon set: 24px grid, 1.75 stroke, round caps.
// Icons are decorative (aria-hidden); the text next to them carries the meaning.
type IconProps = Omit<ComponentProps<"svg">, "children"> & { size?: number };

function Icon({ size = 18, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
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

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);
export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 6l6 6-6 6" />
  </Icon>
);
export const IconChevronLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.5 6l-6 6 6 6" />
  </Icon>
);
export const IconChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Icon>
);
export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const IconLogout = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 16l-4-4 4-4M6 12h10" />
  </Icon>
);
export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
  </Icon>
);
export const IconCalendar = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </Icon>
);
export const IconUsers = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8.5" r="3.25" />
    <path d="M3.5 19c.6-3 2.8-4.75 5.5-4.75S13.9 16 14.5 19" />
    <path d="M15.5 5.5a3.25 3.25 0 010 6M17.5 14.5c1.5.6 2.6 2.1 3 4.5" />
  </Icon>
);
export const IconChart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h16" />
    <rect x="5.5" y="11" width="3" height="6" rx="0.75" />
    <rect x="10.5" y="7" width="3" height="10" rx="0.75" />
    <rect x="15.5" y="13" width="3" height="4" rx="0.75" />
  </Icon>
);
export const IconInbox = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 13.5l2.2-7.1A2 2 0 018.1 5h7.8a2 2 0 011.9 1.4l2.2 7.1V18a2 2 0 01-2 2H6a2 2 0 01-2-2v-4.5z" />
    <path d="M4 13.5h4.5l1.5 2.5h4l1.5-2.5H20" />
  </Icon>
);
export const IconHeart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 19.5s-7.5-4.4-7.5-9.7A4.3 4.3 0 0112 7.2a4.3 4.3 0 017.5 2.6c0 5.3-7.5 9.7-7.5 9.7z" />
  </Icon>
);
export const IconSend = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 4L10.5 13.5M20 4l-6 16-3.5-6.5L4 10l16-6z" />
  </Icon>
);
export const IconClipboard = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5.5" y="4.5" width="13" height="16" rx="2" />
    <path d="M9 4.5V4a1 1 0 011-1h4a1 1 0 011 1v.5M9 10h6M9 14h6M9 18h3" />
  </Icon>
);
export const IconMessage = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 5.5h14a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5h-7.5L7 20.5v-3H5A1.5 1.5 0 013.5 16V7A1.5 1.5 0 015 5.5z" />
  </Icon>
);
export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.75v5M12 16.25h.01" />
  </Icon>
);
export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.75V12l2.75 1.75" />
  </Icon>
);
export const IconInfo = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.25M12 7.75h.01" />
  </Icon>
);
export const IconSparkle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 4.5l1.6 4.4 4.4 1.6-4.4 1.6L10 16.5l-1.6-4.4L4 10.5l4.4-1.6z" />
    <path d="M17.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </Icon>
);
export const IconX = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Icon>
);
export const IconUser = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.75" />
    <path d="M4.75 20c.9-3.6 3.8-5.75 7.25-5.75s6.35 2.15 7.25 5.75" />
  </Icon>
);
export const IconFlag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.5 20.5V4.5M5.5 4.5h10.25l-1.75 4 1.75 4H5.5" />
  </Icon>
);
