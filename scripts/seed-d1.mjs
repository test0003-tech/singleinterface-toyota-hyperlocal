/**
 * scripts/seed-d1.mjs
 *
 * Exports every row from the local SQLite database (db/custom.db) into a
 * D1-compatible SQL file (migrations/seed.sql) of INSERT statements.
 *
 * Run:   bun run cf:d1:seed
 *
 * The resulting file is applied to the Cloudflare D1 database with:
 *   npx wrangler d1 execute singleinterface-toyota --remote --file=migrations/seed.sql
 *
 * Notes:
 *   • Uses bun:sqlite (no native dependency to install).
 *   • Strings are escaped via single-quote doubling and nulls → NULL.
 *   • Floats are emitted as-is; booleans → 1/0 (SQLite has no native bool).
 */
import { Database } from "bun:sqlite";

const DB_PATH = "./db/custom.db";
const OUT_PATH = "./migrations/seed.sql";

const TABLES = ["DealerGroup", "LocationRecord", "MonthlyPlan", "EditLog"];

const db = new Database(DB_PATH, { readonly: true });

function sqlEscape(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  // string — escape single quotes
  return "'" + String(v).replace(/'/g, "''") + "'";
}

let out = "-- D1 seed generated from local SQLite (db/custom.db)\n";
out += "-- Applied with: npx wrangler d1 execute singleinterface-toyota --remote --file=migrations/seed.sql\n\n";

for (const table of TABLES) {
  let cols;
  try {
    cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  } catch {
    out += `-- table ${table}: skipped (not found)\n\n`;
    continue;
  }
  if (!cols.length) {
    out += `-- table ${table}: skipped (no columns)\n\n`;
    continue;
  }
  let rows;
  try {
    rows = db.prepare(`SELECT * FROM ${table}`).all();
  } catch (e) {
    out += `-- table ${table}: skipped (${e.message})\n\n`;
    continue;
  }
  out += `-- ${table}: ${rows.length} row(s)\n`;
  out += `DELETE FROM ${table};\n`;
  const colList = cols.map((c) => `"${c}"`).join(", ");
  for (const row of rows) {
    const vals = cols.map((c) => sqlEscape(row[c])).join(", ");
    out += `INSERT INTO ${table} (${colList}) VALUES (${vals});\n`;
  }
  out += "\n";
}

db.close();

await Bun.write(OUT_PATH, out);
console.log(`Wrote ${OUT_PATH}`);
// stats
for (const t of TABLES) {
  const n = (out.match(new RegExp(`INSERT INTO ${t} `, "g")) || []).length;
  console.log(`  ${t}: ${n} inserts`);
}
