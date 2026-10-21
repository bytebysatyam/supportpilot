import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

const databaseUrl = new URL(env.DATABASE_URL);
// Remote development databases can need longer than the default five-second handshake.
if (!databaseUrl.searchParams.has("connect_timeout"))
  databaseUrl.searchParams.set("connect_timeout", "15");

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl.toString(),
    transactionOptions: { maxWait: 5_000, timeout: 15_000 },
    // The central handler emits safe metadata; raw Prisma errors may include connection/input details.
    log: [],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
