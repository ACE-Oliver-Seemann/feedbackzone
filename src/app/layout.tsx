import type { Metadata, Viewport } from "next";
import { t } from "@/lib/texts.sk";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: t.app.name, template: `%s – ${t.app.name}` },
  description: t.app.testDataNotice,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sk" className="h-full">
      <body className="min-h-full bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
