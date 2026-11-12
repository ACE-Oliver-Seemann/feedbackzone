"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
      // Staying logged in without saying so would be worse than an error (QA E2E-011).
      setFailed(true);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={logout}
        className="rounded-md border border-slate-300 px-3 py-3 text-sm text-slate-700 hover:bg-slate-100"
      >
        {t.nav.logout}
      </button>
      {failed && (
        <span role="alert" className="text-xs text-red-700">
          {t.errors.logoutFailed}
        </span>
      )}
    </span>
  );
}
