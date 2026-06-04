/** Delete all courses for a semester + the semester row. Usage:
 *   npm run delete-semester -- 115-1
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sem = process.argv[2];
  if (!sem) throw new Error("usage: delete-semester <semesterId>");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { count: before } = await db
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("semester_id", sem);
  process.stderr.write(`[delete] ${sem}: ${before ?? 0} courses…\n`);

  // course_teachers cascades on course delete (FK on delete cascade).
  const { error } = await db.from("courses").delete().eq("semester_id", sem);
  if (error) throw error;
  await db.from("semesters").delete().eq("id", sem);

  process.stderr.write(`[delete] done.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
