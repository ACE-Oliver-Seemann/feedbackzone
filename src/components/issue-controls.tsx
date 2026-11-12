"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { t } from "@/lib/texts.sk";

const OWNER_GROUPS = ["FACILITY", "IT_SUPPORT", "HR", "MANAGEMENT", "TEAM_MANAGER", "OTHER"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "DONE"] as const;
type OwnerGroup = (typeof OWNER_GROUPS)[number];
type Status = (typeof STATUSES)[number];

/** Status and owner group of one issue, changed in place (IT-10). */
export function IssueControls({
  issueId,
  status,
  ownerGroup,
}: {
  issueId: string;
  status: Status;
  ownerGroup: OwnerGroup;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState({ status, ownerGroup });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function change(patch: { status?: Status; ownerGroup?: OwnerGroup }) {
    const previous = current;
    setCurrent({ ...current, ...patch });
    setPending(true);
    setError(false);
    try {
      const response = await fetch(`/api/hr/issues/${issueId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setCurrent(previous);
      setError(true);
    }
    setPending(false);
  }

  const selectClass =
    "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:opacity-60";

  return (
    <span className="flex flex-wrap items-center gap-2">
      <select
        aria-label={t.issues.ownerGroup}
        value={current.ownerGroup}
        disabled={pending}
        onChange={(event) => change({ ownerGroup: event.target.value as OwnerGroup })}
        className={selectClass}
      >
        {OWNER_GROUPS.map((group) => (
          <option key={group} value={group}>
            {t.ownerGroups[group]}
          </option>
        ))}
      </select>
      <select
        aria-label={t.issues.status}
        value={current.status}
        disabled={pending}
        onChange={(event) => change({ status: event.target.value as Status })}
        className={selectClass}
      >
        {STATUSES.map((item) => (
          <option key={item} value={item}>
            {t.issueStatuses[item]}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {t.errors.generic}
        </span>
      )}
    </span>
  );
}
