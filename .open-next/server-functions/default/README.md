# Location Data Dashboard - SingleInterface Toyota Hyperlocal

A comprehensive dashboard to manage **SI (Store Information)** and **Spotlight** location records, with VMN mapping, live status tracking, media spend, and platform fees management.

Built with **Next.js 16**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, and **Prisma (SQLite)**.

## Features

### Location Management
- **SI Data** (28 fields): SI Code, Client Code, Business Profile ID, Business Name, Circle, Address, City, State, Latitude/Longitude, VMN, GMB status, live status, and more.
- **Spotlight Data** (20 fields): Client Code, Name, Region, State, City, Domain, AdAccount CID, Facebook Page ID, live status, and more.

### VMN Mapping (validated)
- **SI**: Sales landing numbers + Service landing numbers (comma-separated 10-digit mobile numbers, max 5 each)
- **Spotlight**: Spotlight landing numbers (comma-separated 10-digit mobile numbers, max 5)
- Validation enforces exactly 10 digits per number and a maximum of 5 numbers per field.

### Live Status & Auto-Sync
- Mark SI / Spotlight records as live or inactive.
- When an SI is marked live and has a `linkedSpotlightCode`, the linked Spotlight record is automatically marked live too.
- A status badge and live/inactive filter are available on both tables.

### Media Spend
- Track monthly media spend per location: allocated budget, utilized amount, and pending balance in wallet (carried forward).
- Summary cards + monthly breakdown.
- Filter by month, type (SI/Spotlight), and search.

### Platform Fees
- Fixed monthly fee of ₹8,060 + 18% GST = ₹9,510.80 per live location.
- **Auto-creation**: When an SI is marked live, a platform fee entry is automatically created for the current month (fees start when a location goes live).
- **Auto-Generate**: Bulk-create platform fee entries for all live locations for any selected month (existing entries are skipped).
- Mark entries as Paid, filter by status, and export CSV.

### Excel Import
- Import SI and Spotlight records from an `.xlsx` workbook with sheets named "SI data" and "Spotlight data".
- Two modes: **Upsert** (update existing, insert new) or **Replace All** (wipe and re-import).

## Getting Started

### Prerequisites
- Node.js 20+ (or Bun)
- SQLite (file-based, no server needed)

### Install & Run
```bash
# Install dependencies
bun install   # or npm install

# Set up the database
cp .env.example .env
bun run db:push

# Start the dev server
bun run dev
```

Open http://localhost:3000 in your browser.

### Import Initial Data
Click the **Import Excel** button in the dashboard header, then either:
- Import from the default uploaded file, or
- Upload a new `.xlsx` file.

## Tech Stack
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4 + shadcn/ui (New York)
- Prisma ORM + SQLite
- Recharts for analytics
- TanStack Query / Zustand ready
- Lucide icons

## Project Structure
```
src/
  app/
    api/                  # REST API routes (si, spotlight, media-spend, platform-fees, stats, import, filters)
    page.tsx              # Main dashboard (tabs: Overview, SI, Spotlight, Media Spend, Platform Fees)
    layout.tsx
  components/
    dashboard/             # Data tables, forms, overview, import dialog
    ui/                    # shadcn/ui components
  lib/
    api.ts                # Frontend API client
    fields.ts             # Form field definitions
    types.ts              # Shared TypeScript types
    validation.ts         # Landing-number + currency helpers
    db.ts                 # Prisma client
prisma/
  schema.prisma           # SIRecord, SpotlightRecord, MediaSpend, PlatformFee models
```

## Deployment Notes

### ⚠️ Cloudflare Pages / Workers Caveat

This app uses **Prisma with a file-based SQLite database** (`db/custom.db`). Cloudflare's serverless runtime (Pages Functions / Workers) **does not support a persistent filesystem or the Prisma SQLite client**, so deploying this app to Cloudflare as-is will compile but the API routes will fail at runtime.

To run on Cloudflare you must migrate the database to **Cloudflare D1** (SQLite-compatible):

1. Create a D1 database:
   ```bash
   wrangler d1 create singleinterface-toyota
   ```
2. Update `prisma/schema.prisma` datasource to use D1:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
   and set `DATABASE_URL` to the D1 connection string in `wrangler.toml`.
3. Use the Prisma D1 driver adapter (`@prisma/adapter-d1`) in `src/lib/db.ts`.
4. Add `@cloudflare/next-on-pages` and build with `npx @cloudflare/next-on-pages`.
5. Configure `wrangler.toml` with the D1 binding and deploy:
   ```bash
   npx @cloudflare/next-on-pages
   npx wrangler pages deploy .vercel/output/static
   ```

Until that migration is done, the recommended deployment target is a platform with a persistent filesystem (Vercel, Railway, Render, Fly.io, or any Node host).

### Recommended (works out of the box)
- **Vercel** — works, but use a Postgres or external SQLite (Turso) provider since Vercel's serverless functions also lack a persistent FS.
- **Turso** (libSQL) — drop-in SQLite replacement that works on serverless. Change the datasource provider to `libsql` and you're set.
- **Railway / Render / Fly.io** — persistent volumes, SQLite works as-is.

## License
Private / proprietary.
