import { PrismaClient } from '@prisma/client';
import { env } from './env';

// ─────────────────────────────────────────────────────────────────────────────
// src/config/database.ts
// Prisma client singleton.
// Re-using the same instance across the application prevents connection pool
// exhaustion. In development, we attach it to the global object to survive
// hot-reloads (Next.js / ts-node-dev pattern).
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
    errorFormat: env.NODE_ENV === 'production' ? 'minimal' : 'pretty',
  });
}

export const prisma: PrismaClient =
  global.__prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export default prisma;

/**
 * Call this in server.ts to verify the DB is reachable before accepting traffic.
 * Returns the number of ms the connection attempt took.
 */
export async function connectDatabase(): Promise<number> {
  const start = Date.now();
  await prisma.$connect();
  return Date.now() - start;
}

/**
 * Call this in the shutdown handler (SIGTERM / SIGINT) to drain connections.
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

// Default export for backward compatibility
export default prisma;
