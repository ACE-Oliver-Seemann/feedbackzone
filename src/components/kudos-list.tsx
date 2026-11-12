import { Badge } from "@/components/ui/badge";
import { cx } from "@/components/ui/cx";
import { IconHeart, IconLock } from "@/components/ui/icons";
import { KUDOS_ACCENT, KudosValueBadge } from "@/components/ui/kudos-value";
import { EmptyState } from "@/components/ui/page";
import { InsetList } from "@/components/ui/surface";
import { formatDate, t } from "@/lib/texts.sk";
import type { KudosItem } from "@/server/kudos";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/**
 * One kudos as the recipient sees it: sender, the thank-you text as the hero,
 * value with its icon and the date. A thin bar on the left hints the value.
 * Also used as the live preview in the send form.
 */
export function KudosCard({
  item,
  mode,
  as: Tag = "li",
  className,
  style,
}: {
  item: Pick<KudosItem, "fromName" | "toName" | "text" | "value" | "visibility" | "createdAt">;
  mode: "feed" | "received" | "preview";
  as?: "li" | "div";
  className?: string;
  style?: React.CSSProperties;
}) {
  const person = mode === "preview" ? item.toName : item.fromName;
  return (
    <Tag
      className={cx("relative flex gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5", className)}
      style={style}
    >
      <span
        className={cx("absolute inset-y-4 left-0 w-[3px] rounded-r-full", KUDOS_ACCENT[item.value].bar)}
        aria-hidden="true"
      />
      <span
        className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-[0.8125rem] font-semibold text-brand-700 ring-1 ring-brand-100"
        aria-hidden="true"
      >
        {person ? initials(person) : <IconHeart size={16} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="min-w-0 text-sm font-medium break-words text-ink">
            {mode === "feed"
              ? t.kudos.fromTo(item.fromName, item.toName)
              : mode === "received"
                ? t.kudos.from(item.fromName)
                : item.toName
                  ? t.kudos.previewFor(item.toName)
                  : t.kudos.previewRecipientEmpty}
          </p>
          {mode !== "preview" && (
            <time dateTime={item.createdAt} className="shrink-0 text-xs text-muted tabular-nums">
              {formatDate(item.createdAt)}
            </time>
          )}
        </div>
        <p
          className={cx(
            "mt-1.5 text-[0.9375rem] leading-relaxed break-words whitespace-pre-line sm:text-base",
            item.text ? "text-ink" : "text-muted italic",
          )}
        >
          {item.text || t.kudos.previewTextEmpty}
        </p>
        <span className="mt-3 flex flex-wrap gap-1.5">
          <KudosValueBadge value={item.value} />
          {mode !== "feed" && (
            <Badge dot={false}>
              {item.visibility === "PRIVATE" && <IconLock size={12} className="-ml-0.5" />}
              {t.kudos.visibilities[item.visibility]}
            </Badge>
          )}
        </span>
      </div>
    </Tag>
  );
}

/**
 * Kudos in one grouped list. `mode="feed"` shows sender → recipient (team page),
 * `mode="received"` shows the sender and the visibility ("Moje kudos").
 */
export function KudosList({
  kudos,
  mode,
  emptyText,
}: {
  kudos: KudosItem[];
  mode: "feed" | "received";
  emptyText: string;
}) {
  if (kudos.length === 0) {
    return <EmptyState icon={<IconHeart size={20} />} title={emptyText} />;
  }
  return (
    <InsetList>
      {kudos.map((item, position) => (
        <KudosCard
          key={item.id}
          item={item}
          mode={mode}
          className={position < 8 ? "animate-rise" : undefined}
          style={position < 8 ? { animationDelay: `${position * 45}ms` } : undefined}
        />
      ))}
    </InsetList>
  );
}
