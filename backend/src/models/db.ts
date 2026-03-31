import { PrismaClient } from "@prisma/client";

// ─── Prisma Singleton ─────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["warn", "error"],
  });
}

// In production, always create a new instance.
// In development, reuse across hot reloads to avoid too many DB connections.
const prisma: PrismaClient =
  process.env.NODE_ENV === "production"
    ? createPrismaClient()
    : (global.__prisma ?? (global.__prisma = createPrismaClient()));

export default prisma;

// ─── Graceful Disconnect ──────────────────────────────────────────────────────

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
}
