import { PrismaClient } from "@prisma/client";

// Avoid exhausting database connections from Next.js hot-reload in dev by
// reusing a single client across module reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
