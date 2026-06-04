/** Wipe all crawled course data (keeps profiles). Run: npm run reset-data */
import { Client } from "pg";

async function main() {
  const conn = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!conn) throw new Error("Missing POSTGRES_URL_NON_POOLING");
  const u = new URL(conn);
  const client = new Client({
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1) || "postgres",
    ssl: { rejectUnauthorized: false }, // admin-only; see migrate.ts header
  });
  await client.connect();
  try {
    // courses CASCADE removes course_teachers, reviews, bookmarks (and via
    // reviews -> comments, votes). Then clear teachers/semesters/summary.
    await client.query(
      "truncate table courses, teachers, semesters, course_rating_summary restart identity cascade",
    );
    process.stderr.write("[reset] all course data wiped.\n");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
