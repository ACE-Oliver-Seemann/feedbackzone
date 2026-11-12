"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { IconLogout } from "@/components/ui/icons";
import { t } from "@/lib/texts.sk";

export function LogoutButton() {
  const router = useRouter();

  const [failed, setFailed] = useState(false);

  async function logout() {
    setFailed(false);
    try {
      const response = await fetch("/api/logout", { method: "POST" });
      // 401 means the session is already gone, which is what the user wanted.
      if (!response.ok && response.status !== 401) throw new Error("logout failed");
    } catch {
      // Staying logged in without saying so would be worse than an error (BUG-038).
      setFailed(true);
      return;
    }
    router.replace("/login");
    router.refresh();
  }
  return (
    <span className="relative inline-flex">
      <button
      type="button"
      onClick={logout}
      title={t.nav.logout}
      className={buttonClass({ variant: "ghost", size: "sm", className: "text-ink-soft pointer-coarse:min-w-11" })}
    >
      <IconLogout size={16} />
      <span className="sr-only sm:not-sr-only">{t.nav.logout}</span>
      </button>
      {failed && (
        <span
          role="alert"
          className="absolute top-full right-0 z-10 mt-1 w-56 animate-rise rounded-lg bg-surface px-3 py-2 text-xs text-red-700 shadow-[var(--shadow-raised)] ring-1 ring-line"
        >
          {t.errors.logoutFailed}
        </span>
      )}
    </span>
  );
}
