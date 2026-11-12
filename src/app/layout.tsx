import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { MotionInitScript } from "@/components/motion-init-script";
import { t } from "@/lib/texts.sk";
import "./globals.css";

// Self-hosted by next/font at build time; latin-ext covers Slovak diacritics.
const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  // Pages export their own title; the template appends the app name (FE-009).
  title: { template: `%s · ${t.app.name}`, default: t.app.name },
  description: t.app.testDataNotice,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-motion is set by the inline script before the first paint (see
    // src/lib/motion.ts), hence suppressHydrationWarning on <html>.
    <html lang="sk" className={`h-full ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <MotionInitScript />
      </head>
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
