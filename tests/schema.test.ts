import { describe, expect, it } from "vitest";
import { MIN_GROUP_SIZE } from "@/config/privacy";
import { db } from "@/lib/db";

// Structural guarantees of the database. These run against the real
// migrations, so they fail if a later migration drops a hand-edited constraint.

type Column = { name: string; type: string };
const columns = (table: string) =>
  db.$queryRawUnsafe<Column[]>(`SELECT name, type FROM pragma_table_info('${table}')`);
const tableSql = async (table: string) => {
  const rows = await db.$queryRawUnsafe<{ sql: string }[]>(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '${table}'`,
  );
  return rows[0].sql;
};

describe("Response table cannot be linked to a user [NFR-01]", () => {
  it("has no user column and no time column", async () => {
    const names = (await columns("Response")).map((column) => column.name);
    expect(names.sort()).toEqual(
      ["comment", "id", "roundId", "teamId", "v1", "v2", "v3", "v4", "v5"].sort(),
    );
    for (const column of await columns("Response")) {
      expect(column.name).not.toMatch(/user|author|created|updated|time|date|_at$/i);
      expect(column.type).not.toMatch(/date|time/i);
    }
  });

  it("Participation holds only round and user, with no time column", async () => {
    const names = (await columns("Participation")).map((column) => column.name);
    expect(names.sort()).toEqual(["roundId", "userId"]);
  });

  it("Response and Participation have no hidden rowid that would reveal insertion order", async () => {
    for (const table of ["Response", "Participation"]) {
      expect(await tableSql(table)).toMatch(/WITHOUT ROWID/i);
      await expect(db.$queryRawUnsafe(`SELECT rowid FROM "${table}"`)).rejects.toThrow();
    }
  });

  it("Participation has a unique key on (round, user)", async () => {
    const primaryKey = await db.$queryRawUnsafe<{ name: string; pk: bigint }[]>(
      `SELECT name, pk FROM pragma_table_info('Participation') WHERE pk > 0 ORDER BY pk`,
    );
    expect(primaryKey.map((column) => column.name)).toEqual(["roundId", "userId"]);
  });
});

describe("database constraints on answers [MVP-08]", () => {
  it("declares a 1–5 CHECK on every value column and a comment length CHECK", async () => {
    const sql = await tableSql("Response");
    for (const column of ["v1", "v2", "v3", "v4", "v5"]) {
      expect(sql).toContain(`"${column}" BETWEEN 1 AND 5`);
    }
    expect(sql).toContain(`length("comment") <= 1000`);
  });
});

describe("confidentiality threshold [NFR-02]", () => {
  it("is 5", () => {
    expect(MIN_GROUP_SIZE).toBe(5);
  });
});
