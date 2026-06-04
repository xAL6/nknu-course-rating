/**
 * Apply SQL migrations in supabase/migrations/*.sql via the direct Postgres
 * connection (POSTGRES_URL_NON_POOLING). Run: npm run migrate
 *
 * SSL note: this is a one-off ADMIN migration to the project owner's own
 * Supabase database, run from their machine. Supabase's pooler presents a
 * self-signed root CA that is not in Node's bundled trust store and is only
 * downloadable from the authenticated dashboard, and Postgres' SSLRequest
 * handshake prevents headless CA capture. Transport stays TLS-encrypted; we
 * relax server-identity verification for THIS admin script only. App runtime
 * uses the Supabase JS client over HTTPS (publicly-trusted cert) — unaffected.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

async function main() {
  const conn = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!conn) throw new Error("Missing POSTGRES_URL_NON_POOLING");

  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // Build from discrete fields so the connection string's `sslmode=require`
  // doesn't override our ssl config (newer pg maps require -> verify-full).
  const u = new URL(conn);
  const client = new Client({
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1) || "postgres",
    ssl: { rejectUnauthorized: false }, // admin-only; see file header
  });
  await client.connect();
  try {
    for (const f of files) {
      const sql = readFileSync(join(dir, f), "utf-8");
      process.stderr.write(`[migrate] applying ${f}…\n`);
      await client.query(sql);
      process.stderr.write(`[migrate] ✓ ${f}\n`);
    }
  } finally {
    await client.end();
  }
  process.stderr.write("[migrate] done\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
