/**
 * Prisma client factory.
 *
 * One client for two runtimes:
 *   - Local development (Node + Bun) — file-based SQLite at db/custom.db via
 *     the standard PrismaClient.
 *   - Cloudflare Workers / Pages (OpenNext) — a Cloudflare D1 database bound
 *     as `env.DB`, accessed through the Prisma D1 driver adapter.
 *
 * The Cloudflare binding is only available inside a request context, so the
 * client is created lazily on first property access (a Proxy forwards every
 * call to the real client). This keeps the existing `import { db }` call sites
 * across the data layer untouched.
 */
import { PrismaClient } from "@prisma/client";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaD1 } from "@prisma/adapter-d1";

const globalForPrisma = globalThis as unknown as {
  __prismaClient?: PrismaClient;
};

/** Build a PrismaClient appropriate for the current runtime. */
function createPrismaClient(): PrismaClient {
  try {
    const { env } = getCloudflareContext();
    const d1 = (env as unknown as { DB?: D1Database }).DB;
    if (d1) {
      return new PrismaClient({ adapter: new PrismaD1(d1) });
    }
  } catch {
    // Not on Cloudflare (local Node/Bun dev) or the binding is missing.
  }
  return new PrismaClient({ log: ["query"] });
}

let client = globalForPrisma.__prismaClient;
if (!client) {
  client = createPrismaClient();
  globalForPrisma.__prismaClient = client;
}

export const db = client;
