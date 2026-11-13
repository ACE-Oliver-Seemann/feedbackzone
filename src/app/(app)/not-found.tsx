import type { Metadata } from "next";
import { ErrorScreen } from "@/components/error-screen";
import { IconInbox } from "@/components/ui/icons";
import { t } from "@/lib/texts.sk";

export const metadata: Metadata = { title: t.errors.notFoundTitle };

// 404 raised by a page inside the app shell (notFound()); the menu stays.
export default function NotFoundInShell() {
  return (
    <ErrorScreen inShell
      icon={<IconInbox size={26} />}
      title={t.errors.notFoundTitle}
      text={t.errors.notFoundText}
      code={t.errors.notFoundCode}
      backLabel={t.errors.backHome}
    />
  );
}
