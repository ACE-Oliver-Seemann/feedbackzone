import { PrismaClient } from "@prisma/client";
const db = new PrismaClient({ datasources: { db: { url: "file:" + process.argv[2] } } });
const rows = await db.$queryRawUnsafe(`select name, sql from sqlite_master where type='table' and name in ('Response','Participation')`);
for (const r of rows) console.log(r.name, "WITHOUT ROWID:", /WITHOUT ROWID\s*$/i.test(r.sql), "CHECK constraints:", (r.sql.match(/CHECK/g) ?? []).length);
console.log("tables:", (await db.$queryRawUnsafe(`select name from sqlite_master where type='table' order by name`)).map((x) => x.name).join(","));
await db.$disconnect();
