import { PrismaClient } from "@prisma/client";

// Query logging stays off on purpose: query parameters would contain
// response bodies (NFR-01).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient({ log: [] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
