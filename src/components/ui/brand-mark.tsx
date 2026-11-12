import { t } from "@/lib/texts.sk";
import { cx } from "./cx";

// Official Asseco Central Europe logo, cropped from the supplied asset with a
// transparent background. Intrinsic size 397 × 94 (aspect 4.22 : 1) – always
// scale by height only so the proportions never change. Replace the PNGs in
// public/brand/ with the official SVG once the brand team provides it.
const LOGO_WIDTH = 397;
const LOGO_HEIGHT = 94;

/** Asseco CE logo, a hairline divider and the product name. */
export function BrandMark({
  size = "md",
  tone = "light",
  showName = true,
}: {
  size?: "md" | "lg";
  /** "dark" for use on the near-black brand background. */
  tone?: "light" | "dark";
  showName?: boolean;
}) {
  const height = size === "lg" ? "h-10" : "h-7 sm:h-8";
  return (
    <span className="inline-flex items-center gap-3.5">
      {/* Plain <img>: a small static PNG gains nothing from image optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tone === "dark" ? "/brand/asseco-ce-logo-white.png" : "/brand/asseco-ce-logo.png"}
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        alt={t.app.company}
        className={cx("block w-auto shrink-0", height)}
      />
      {showName && (
        <>
          <span
            className={cx(
              "w-px self-stretch",
              tone === "dark" ? "bg-white/25" : "bg-line-strong",
              // In the header the product name gives way to the logo on the narrowest phones.
              size === "lg" ? "my-0.5" : "my-1 max-[399px]:hidden",
            )}
            aria-hidden="true"
          />
          <span
            className={cx(
              "font-medium tracking-[-0.01em] whitespace-nowrap",
              tone === "dark" ? "text-white" : "text-ink",
              size === "lg" ? "text-xl" : "text-[0.9375rem] max-[399px]:sr-only",
            )}
          >
            {t.app.name}
          </span>
        </>
      )}
    </span>
  );
}
