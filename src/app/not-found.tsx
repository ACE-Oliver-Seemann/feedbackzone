import type { Metadata } from "next";
import { ErrorScreen } from "@/components/error-screen";
import { IconInbox } from "@/components/ui/icons";
import { t } from "@/lib/texts.sk";

export const metadata: Metadata = { title: t.errors.notFoundTitle };

// 404 for unknown addresses. Renders outside the app shell.
export default function NotFound() {
  return (
    <ErrorScreen
      icon={<IconInbox size={26} />}
      title={t.errors.notFoundTitle}
      text={t.errors.notFoundText}
      code={t.errors.notFoundCode}
      backLabel={t.errors.backHome}
    />
  );
}
