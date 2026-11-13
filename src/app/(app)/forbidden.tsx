import type { Metadata } from "next";
import { ErrorScreen } from "@/components/error-screen";
import { IconLock } from "@/components/ui/icons";
import { t } from "@/lib/texts.sk";

export const metadata: Metadata = { title: t.errors.forbiddenTitle };

// 403 raised by a page inside the app shell (forbidden()); the menu stays.
export default function ForbiddenInShell() {
  return (
    <ErrorScreen inShell
      icon={<IconLock size={26} />}
      title={t.errors.forbiddenTitle}
      text={t.errors.forbiddenText}
      code={t.errors.forbiddenCode}
      backLabel={t.errors.backHome}
    />
  );
}
