import { Badge } from "@/components/round-list";
import { formatDate, t } from "@/lib/texts.sk";
import type { KudosItem } from "@/server/kudos";

/**
 * Kudos cards. `mode="feed"` shows sender → recipient (team page),
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
    return <p className="mt-3 text-sm text-slate-600">{emptyText}</p>;
  }
  return (
    <ul className="mt-3 space-y-3">
      {kudos.map((item) => (
        <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-medium">
              {mode === "feed"
                ? t.kudos.fromTo(item.fromName, item.toName)
                : t.kudos.from(item.fromName)}
            </p>
            <span className="flex flex-wrap gap-1.5">
              <Badge className="bg-teal-100 text-teal-800">{t.kudos.values[item.value]}</Badge>
              {mode === "received" && (
                <Badge className="bg-slate-100 text-slate-700">
                  {t.kudos.visibilities[item.visibility]}
                </Badge>
              )}
            </span>
          </div>
          {item.emoji && (
            <p className="mt-2 text-3xl leading-none" aria-label={item.emoji}>
              {item.emoji}
            </p>
          )}
          {item.text && (
            <p className="mt-2 whitespace-pre-line text-sm text-slate-800">{item.text}</p>
          )}
          <p className="mt-2 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
        </li>
      ))}
    </ul>
  );
}
