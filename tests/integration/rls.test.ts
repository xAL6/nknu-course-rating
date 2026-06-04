import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ready = !!url && !!anon && !!service && !url.includes("placeholder");

const d = ready ? describe : describe.skip;

/**
 * With Clerk auth, writes go through service-role server actions (Clerk-guarded);
 * the anon client must NOT be able to write. Reviews/trigger still verified.
 */
d("Supabase RLS (Clerk model: service-role writes, anon blocked)", () => {
  let admin: SupabaseClient;
  let anonClient: SupabaseClient;
  const userId = `user_vitest_${Date.now()}`;
  let courseId = "";
  let courseCode = "";
  let hasCourse = false;

  beforeAll(async () => {
    admin = createClient(url!, service!, { auth: { persistSession: false } });
    anonClient = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data: course } = await admin.from("courses").select("id, course_code").limit(1).maybeSingle();
    if (course) {
      courseId = course.id;
      courseCode = course.course_code;
      hasCourse = true;
      await admin.from("profiles").insert({ user_id: userId, display_name: "測試同學" });
    }
  });

  afterAll(async () => {
    if (hasCourse) {
      await admin.from("reviews").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("user_id", userId);
    }
  });

  it("service-role can insert a review (Clerk text user id)", async ({ skip }) => {
    if (!hasCourse) return skip();
    const { error } = await admin.from("reviews").insert({
      course_id: courseId,
      user_id: userId,
      semester_id: "114-2",
      sweetness: 4,
      coolness: 5,
      loading: 2,
      quality: 4,
      grading: 5,
      short_comment: "vitest",
      display_name: "測試同學",
    });
    expect(error).toBeNull();
  });

  it("rating trigger recomputes the summary", async ({ skip }) => {
    if (!hasCourse) return skip();
    const { data } = await admin
      .from("course_rating_summary")
      .select("review_count")
      .eq("course_code", courseCode)
      .maybeSingle();
    expect((data?.review_count ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it("anon client CANNOT insert a review (RLS, no write policy)", async ({ skip }) => {
    if (!hasCourse) return skip();
    const { error } = await anonClient.from("reviews").insert({
      course_id: courseId,
      user_id: userId,
      semester_id: "114-2",
      sweetness: 1,
      coolness: 1,
      loading: 1,
      quality: 1,
      grading: 1,
      display_name: "anon",
    });
    expect(error).not.toBeNull();
  });

  it("anon can still read reviews (public select)", async () => {
    const { error } = await anonClient.from("reviews").select("id").limit(1);
    expect(error).toBeNull();
  });
});
