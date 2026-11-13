// Groups an HR issue can be assigned to (IT-10). A group is only a label:
// it has no account and gets no notification. Labels are in texts.sk.ts.

export const OWNER_GROUPS = [
  "FACILITY",
  "IT_SUPPORT",
  "HR",
  "MANAGEMENT",
  "TEAM_MANAGER",
  "OTHER",
] as const;
export type OwnerGroup = (typeof OWNER_GROUPS)[number];

export const ISSUE_SOURCES = ["SURVEY", "MEETING", "OTHER"] as const;
export type IssueSource = (typeof ISSUE_SOURCES)[number];

// WAITING ("Čaká sa") was added with IT-14 Zodpovednosti.
export const ISSUE_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING", "DONE"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
