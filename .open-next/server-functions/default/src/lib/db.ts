/**
 * Prisma client factory.
 *
 * One client for two runtimes:
 *   • Local development (Node + Bun) — file-based SQLite at db/custom.db via
 *     the standard PrismaClient.
 *   • Cloudflare Workers / Pages (OpenNext) — a Cloudflare D1 database bound
 *     as `env.DB`, accessed through the Prisma D1 driver adapter.
 *
 * The Cloudflare binding is only available inside a request context, so the
 * client is created lazily on first property access (a Proxy forwards every
 * call to the real client). This keeps the existing `import { db }` call sites
 * across the data layer untouched.
 *
 * Detection: `getCloudflareContext()` (sync overload) throws when called
 * outside a Cloudflare request context — e.g. in local Node dev. We catch that
 * and fall back to a standard SQLite PrismaClient.
 */
import { PrismaClient } from "@prisma/client";
// These imports are safe in Node too — they only act when invoked, and
// `getCloudflareContext()` throws outside a Cloudflare request context.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaD1 } from "@prisma/adapter-d1";

const globalForPrisma = globalThis as unknown as {
  __prismaClient?: PrismaClient;
};

/** Build a PrismaClient appropriate for the current runtime. */
function createPrismaClient(): PrismaClient {
  try {
    // Synchronous overload — throws outside a Cloudflare request context,
    // which is exactly why creation is deferred to first property access
    // (always within a request handler).
    const { env } = getCloudflareContext();
    const d1 = (env as unknown as { DB?: D1Database }).DB;
    if (d1) {
      return new PrismaClient({ adapter: new PrismaD1(d1) });
    }
  } catch {
    // Not on Cloudflare (local Node/Bun dev) or the binding is missing —
    // fall through to a standard file-based SQLite client.
  }
  return new PrismaClient({ log: ["query"] });
}

/**
 * Lazily-initialised PrismaClient. The Proxy defers construction until the
 * first property access, which always happens inside a request handler where
 * the Cloudflare request context (and the D1 binding) is available.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    let client = globalForPrisma.__prismaClient;
    if (!client) {
      client = createPrismaClient();
      // Cache on globalThis so the client survives HMR in local dev and is
      // reused across requests within a Worker isolate in production.
      globalForPrisma.__prismaClient = client;
    }
    const value = (client as unknown as Record<string | symbol, unknown>)[
      prop
    ];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
