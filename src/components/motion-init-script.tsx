"use client";

import { useEffect } from "react";
import { MOTION_INIT_SCRIPT } from "@/lib/motion-script";

/**
 * Inline motion bootstrap for <head> (see src/lib/motion-script.ts).
 *
 * In the server HTML it is a normal script, so the browser runs it while
 * parsing, before the first paint. When React renders it on the client (e.g.
 * the root layout re-rendering for a forbidden()/notFound() boundary), it gets
 * a data-block type: React never executes client-rendered scripts anyway, and
 * a data block does not trigger React's "Encountered a script tag" error
 * (FE-003). The type differs between server and client on purpose, hence
 * suppressHydrationWarning. next/script `beforeInteractive` is not used: it
 * runs inline scripts from the Next runtime, i.e. after the first paint.
 *
 * 403/404 responses are a client-rendered error shell (<html id="__next_error__">)
 * without this layout, so there the bootstrap never ran and data-motion is
 * missing. The effect then runs it once through a DOM-created script (those do
 * execute). On every other page the attribute is already set and nothing runs
 * twice.
 */
export function MotionInitScript() {
  useEffect(() => {
    if (document.documentElement.hasAttribute("data-motion")) return;
    const script = document.createElement("script");
    script.textContent = MOTION_INIT_SCRIPT;
    document.head.appendChild(script);
    script.remove();
  }, []);

  return (
    <script
      type={typeof window === "undefined" ? undefined : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: MOTION_INIT_SCRIPT }}
    />
  );
}
