"use client";

import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { IconLogout } from "@/components/ui/icons";
import { t } from "@/lib/texts.sk";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={logout}
      title={t.nav.logout}
      className={buttonClass({ variant: "ghost", size: "sm", className: "text-ink-soft" })}
    >
      <IconLogout size={16} />
      <span className="sr-only sm:not-sr-only">{t.nav.logout}</span>
    </button>
  );
}
