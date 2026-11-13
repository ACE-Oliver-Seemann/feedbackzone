"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { KudosForm } from "@/components/kudos-form";
import { KudosList } from "@/components/kudos-list";
import { Button } from "@/components/ui/button";
import { Confetti, CountUp } from "@/components/ui/celebrate";
import { cx } from "@/components/ui/cx";
import { IconHeart, IconSend } from "@/components/ui/icons";
import { KudosValueBadge } from "@/components/ui/kudos-value";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/page";
import { KUDOS_VALUES } from "@/config/kudos";
import { t } from "@/lib/texts.sk";
import type { KudosItem } from "@/server/kudos";

export type KudosTab = "received" | "send";
export type KudosRecipient = { id: string; name: string; teamName: string | null };

/**
 * CONTRACT between the /kudos server page and this client component.
 * The page loads the data (listMyKudos, listKudosRecipients) and passes it in;
 * this component owns the tabs, the received list and the send form.
 */
export type KudosHubProps = {
  /** Kudos the current user received, newest first (public and private). */
  received: KudosItem[];
  /** Everyone the user may send kudos to (everyone except themselves). */
  recipients: KudosRecipient[];
  /** Tab to show first, from the ?tab= search param. */
  initialTab: KudosTab;
  /** Id of the signed-in user: one "seen" counter per account on a shared browser. */
  viewerId: string;
};

const TABS: KudosTab[] = ["received", "send"];
const TAB_LABELS: Record<KudosTab, string> = {
  received: t.kudos.myTitle,
  send: t.kudos.newTitle,
};

/** localStorage key of the received count the user has already seen. */
const seenKey = (viewerId: string) => `feedback-portal:kudos-seen:${viewerId}`;

/**
 * "Moje kudos" and "Poslať kudos" in one place (MVP-16, MVP-17). Both tab
 * panels are always rendered (the inactive one is `hidden`), so the server
 * HTML contains both. The URL follows the tab via history.replaceState.
 */
export function KudosHub({ received, recipients, initialTab, viewerId }: KudosHubProps) {
  const [tab, setTab] = useState<KudosTab>(initialTab);
  const [newCount, setNewCount] = useState(0);
  const tabRefs = useRef<Record<KudosTab, HTMLButtonElement | null>>({ received: null, send: null });
  const id = useId();
  const tabId = (name: KudosTab) => `${id}-tab-${name}`;
  const panelId = (name: KudosTab) => `${id}-panel-${name}`;

  // "New kudos" moment: compare with the count seen on the last visit. Read
  // only after mount (no hydration mismatch); storage may be unavailable.
  useEffect(() => {
    // Stored even while the count is zero, so that the very first kudos is
    // announced on the next visit too (E2E2-001).
    const key = seenKey(viewerId);
    let seen: number | null = null;
    try {
      const stored = window.localStorage.getItem(key);
      seen = stored === null ? null : Number(stored);
      window.localStorage.setItem(key, String(received.length));
    } catch {
      return;
    }
    if (seen !== null && Number.isFinite(seen) && received.length > seen) {
      // Syncing with an external store (localStorage) that only exists after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewCount(received.length - seen);
    }
  }, [received, viewerId]);

  function select(next: KudosTab, focus = false) {
    setTab(next);
    if (focus) tabRefs.current[next]?.focus();
    try {
      const url = new URL(window.location.href);
      if (next === "send") url.searchParams.set("tab", "send");
      else url.searchParams.delete("tab");
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // The URL is a convenience only.
    }
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const current = TABS.indexOf(tab);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (current + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    select(TABS[next], true);
  }

  const counts = KUDOS_VALUES.map((value) => ({
    value,
    count: received.filter((item) => item.value === value).length,
  })).filter((entry) => entry.count > 0);

  const sendButton = (
    <Button onClick={() => select("send", true)} className="w-full sm:w-auto">
      <IconSend size={16} />
      {t.kudos.newTitle}
    </Button>
  );

  return (
    <div>
      {/* Segmented tabs with one sliding indicator */}
      <div
        role="tablist"
        aria-label={t.kudos.tabsLabel}
        className="relative mb-6 grid w-full grid-cols-2 rounded-full bg-slate-200/60 p-1 sm:inline-grid sm:w-auto"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-surface shadow-[0_1px_2px_rgb(29_29_29/0.08),0_2px_8px_-2px_rgb(29_29_29/0.12)] transition-[translate] duration-300 ease-out-soft"
          style={{ translate: tab === "send" ? "100% 0" : "0 0" }}
        />
        {TABS.map((name) => {
          const selected = tab === name;
          return (
            <button
              key={name}
              ref={(element) => {
                tabRefs.current[name] = element;
              }}
              type="button"
              role="tab"
              id={tabId(name)}
              aria-selected={selected}
              aria-controls={panelId(name)}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(name)}
              onKeyDown={onTabKeyDown}
              className={cx(
                "relative z-10 inline-flex h-9 min-w-0 items-center pointer-coarse:h-11 justify-center gap-1.5 rounded-full px-2.5 text-sm font-medium whitespace-nowrap min-[400px]:px-4 sm:px-5",
                "transition-colors duration-200",
                selected ? "text-ink" : "text-muted hover:text-ink",
              )}
            >
              {name === "received" ? <IconHeart size={15} /> : <IconSend size={15} />}
              {TAB_LABELS[name]}
              {name === "received" && received.length > 0 && (
                <span
                  className={cx(
                    "ml-0.5 rounded-full px-1.5 text-xs tabular-nums transition-colors",
                    selected ? "bg-brand-50 text-brand-700" : "bg-white/70 text-muted",
                  )}
                >
                  {received.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Received */}
      <div
        role="tabpanel"
        id={panelId("received")}
        aria-labelledby={tabId("received")}
        hidden={tab !== "received"}
        tabIndex={0}
        className="focus-visible:outline-offset-4"
      >
        {/* Mounted with fire=false; fires once when new kudos were found. */}
        {/* Only with its notice in view: on the send tab it waits for the switch (E2E2-005). */}
        <Confetti
          fire={newCount > 0 && tab === "received"}
          intensity="light"
          origin={{ x: 0.5, y: 0.3 }}
        />
        {newCount > 0 && (
          <Notice tone="success" role="status" title={t.kudos.newKudos(newCount)} className="mb-4">
            {t.kudos.newKudosText}
          </Notice>
        )}

        {received.length === 0 ? (
          <EmptyState
            icon={<IconHeart size={20} />}
            title={t.kudos.myEmpty}
            description={t.kudos.myEmptyHint}
            action={sendButton}
          />
        ) : (
          <>
            <div className="mb-4 overflow-hidden rounded-[var(--radius-panel)] bg-brand-50/70 p-5 ring-1 ring-brand-100 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <span
                    className="grid size-12 shrink-0 animate-pop place-items-center rounded-full bg-brand-600 text-white shadow-[0_6px_16px_-6px_rgb(0_121_176/0.6)]"
                    aria-hidden="true"
                  >
                    <IconHeart size={22} />
                  </span>
                  <p className="min-w-0">
                    <CountUp
                      value={received.length}
                      className="block text-[2rem] leading-none font-medium tracking-[-0.02em] text-ink"
                    />
                    <span className="mt-1 block text-sm text-ink-soft">{t.kudos.receivedLabel}</span>
                  </p>
                </div>
                {sendButton}
              </div>
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={t.kudos.summaryLabel}>
                {counts.map(({ value, count }) => (
                  <li key={value}>
                    <KudosValueBadge value={value} count={count} className="bg-surface/80 ring-1 ring-brand-100" />
                  </li>
                ))}
              </ul>
            </div>
            <KudosList kudos={received} mode="received" emptyText={t.kudos.myEmpty} />
          </>
        )}
      </div>

      {/* Send */}
      <div
        role="tabpanel"
        id={panelId("send")}
        aria-labelledby={tabId("send")}
        hidden={tab !== "send"}
        tabIndex={0}
        className="focus-visible:outline-offset-4"
      >
        <p className="mb-4 text-sm text-muted">{t.kudos.newIntro}</p>
        <KudosForm recipients={recipients} onShowReceived={() => select("received", true)} />
      </div>
    </div>
  );
}
