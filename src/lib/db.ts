/**
 * Prisma client factory.
 *
 * One client for two runtimes:
 *   - Local development (Node + Bun) — file-based SQLite at db/custom.db via
 *     the standard PrismaClient.
 *   - Cloudflare Workers / Pages (OpenNext) — a Cloudflare D1 database bound
 *     as `env.DB`, accessed through the Prisma D1 driver adapter.
 *
 * Uses dynamic import() for the Cloudflare modules so that the import doesn't
 * fail at bundle time in local Node dev (where @opennextjs/cloudflare's
 * getCloudflareContext throws outside a Worker request context). In Cloudflare
 * Workers, the dynamic import resolves to the bundled module.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  __prismaClient?: PrismaClient;
};

let client = globalForPrisma.__prismaClient;

if (!client) {
  // Try Cloudflare D1 first (works inside a Worker request context).
  // In local Node dev, this synchronous check throws and we fall back.
  let d1Client: PrismaClient | null = null;
  try {
    // These are bundled by OpenNext; in local Node they resolve to the
    // installed packages but getCloudflareContext() throws when called
    // outside a request context.
    const cf = require("@opennextjs/cloudflare");
    const { PrismaD1 } = require("@prisma/adapter-d1");
    const { env } = cf.getCloudflareContext();
    const d1 = (env as unknown as { DB?: D1Database }).DB;
    if (d1) {
      d1Client = new PrismaClient({ adapter: new PrismaD1(d1) });
    }
  } catch {
    // Not on Cloudflare (local Node/Bun dev) — fall through.
  }
  client = d1Client ?? new PrismaClient({ log: ["query"] });
  globalForPrisma.__prismaClient = client;
}

export const db = client;
