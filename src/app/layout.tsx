import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { MOTION_INIT_SCRIPT } from "@/lib/motion-script";
import { t } from "@/lib/texts.sk";
import "./globals.css";

// Self-hosted by next/font at build time; latin-ext covers Slovak diacritics.
const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: t.app.name,
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
        <script dangerouslySetInnerHTML={{ __html: MOTION_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
