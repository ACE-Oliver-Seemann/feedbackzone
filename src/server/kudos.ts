import {
  KUDOS_MAX_LENGTH,
  KUDOS_MIN_LENGTH,
  KUDOS_VALUES,
  KUDOS_VISIBILITIES,
  type KudosValue,
  type KudosVisibility,
} from "@/config/kudos";
import { db } from "@/lib/db";
import { validationError } from "@/lib/errors";
import { charCount, visibleLength } from "@/lib/text-length";
import type { SessionUser } from "@/lib/session";

// Kudos are signed: the sender is always stored and shown (MVP-16).

export type KudosItem = {
  id: string;
  fromName: string;
  toName: string;
  text: string;
  value: KudosValue;
  visibility: KudosVisibility;
  createdAt: string;
};

const KUDOS_SELECT = {
  id: true,
  text: true,
  value: true,
  visibility: true,
  createdAt: true,
  fromUser: { select: { name: true } },
  toUser: { select: { name: true } },
} as const;

type KudosRow = {
  id: string;
  text: string;
  value: string;
  visibility: string;
  createdAt: Date;
  fromUser: { name: string };
  toUser: { name: string };
};

const toItem = (row: KudosRow): KudosItem => ({
  id: row.id,
  fromName: row.fromUser.name,
  toName: row.toUser.name,
  text: row.text,
  value: row.value as KudosValue,
  visibility: row.visibility as KudosVisibility,
  createdAt: row.createdAt.toISOString(),
});

const includes = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

/** POST /api/kudos — any logged-in user sends kudos to anyone but themselves. */
export async function sendKudos(
  user: SessionUser,
  input: Record<string, unknown>,
): Promise<KudosItem> {
  const fields: Record<string, string> = {};

  const toUserId = typeof input.toUserId === "string" ? input.toUserId : "";
  if (!toUserId) fields.toUserId = "required";
  else if (toUserId === user.id) fields.toUserId = "self";

  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (visibleLength(text) < KUDOS_MIN_LENGTH) fields.text = "too_short";
  else if (charCount(text) > KUDOS_MAX_LENGTH) fields.text = "too_long";

  if (!includes(KUDOS_VALUES, input.value)) fields.value = "invalid";
  if (!includes(KUDOS_VISIBILITIES, input.visibility)) fields.visibility = "invalid";

  if (Object.keys(fields).length > 0) throw validationError(fields);

  const recipient = await db.user.findUnique({ where: { id: toUserId }, select: { id: true } });
  if (!recipient) throw validationError({ toUserId: "unknown" });

  const kudos = await db.kudos.create({
    data: {
      fromUserId: user.id,
      toUserId: recipient.id,
      text,
      value: input.value as string,
      visibility: input.visibility as string,
    },
    select: KUDOS_SELECT,
  });
  return toItem(kudos);
}

/**
 * GET /api/kudos/me — kudos the user received, public and private (MVP-17).
 * This is the only place private kudos are ever returned.
 */
export async function listMyKudos(user: SessionUser): Promise<KudosItem[]> {
  const kudos = await db.kudos.findMany({
    where: { toUserId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: KUDOS_SELECT,
  });
  return kudos.map(toItem);
}

/**
 * Public kudos of a team: visibility TEAM and the recipient is a member.
 * The caller checks that the user may see the team page.
 */
export async function listTeamKudos(teamId: string): Promise<KudosItem[]> {
  const kudos = await db.kudos.findMany({
    where: { visibility: "TEAM", toUser: { teamId } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: KUDOS_SELECT,
  });
  return kudos.map(toItem);
}

/** Possible recipients for the kudos form: everyone except the sender. */
export async function listKudosRecipients(
  user: SessionUser,
): Promise<{ id: string; name: string; teamName: string | null }[]> {
  const users = await db.user.findMany({
    where: { id: { not: user.id } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, team: { select: { name: true } } },
  });
  return users.map((item) => ({ id: item.id, name: item.name, teamName: item.team?.name ?? null }));
}
