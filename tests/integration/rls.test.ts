import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ready = !!url && !!anon && !!service && !url.includes("placeholder");

const d = ready ? describe : describe.skip;

d("Supabase Auth RLS + rating trigger (authenticated user)", () => {
  let admin: SupabaseClient;
  let userClient: SupabaseClient;
  let userId = "";
  const email = `vitest_${Date.now()}@mail.nknu.edu.tw`;
  const password = "Test-" + Math.random().toString(36).slice(2) + "A1!";
  let courseId = "";
  let courseCode = "";
  let hasCourse = false;

  beforeAll(async () => {
    admin = createClient(url!, service!, { auth: { persistSession: false } });
    userClient = createClient(url!, anon!, { auth: { persistSession: false } });

    const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    userId = created.user!.id;
    await admin.from("profiles").insert({ user_id: userId, display_name: "測試同學" });

    const { data: course } = await admin.from("courses").select("id, course_code").limit(1).maybeSingle();
    if (course) {
      courseId = course.id;
      courseCode = course.course_code;
      hasCourse = true;
    }
    await userClient.auth.signInWithPassword({ email, password });
  });

  afterAll(async () => {
    if (userId) {
      await admin.from("reviews").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("signed-in user can insert their own review (RLS allow)", async ({ skip }) => {
    if (!hasCourse) return skip();
    const { error } = await userClient.from("reviews").insert({
      course_id: courseId, user_id: userId, semester_id: "114-2",
      sweetness: 4, coolness: 5, loading: 2, quality: 4, grading: 5,
      short_comment: "vitest", display_name: "測試同學",
    });
    expect(error).toBeNull();
  });

  it("rating trigger recomputes the summary", async ({ skip }) => {
    if (!hasCourse) return skip();
    // course_code is no longer unique in the summary (keyed by course_key+teacher_key);
    // sum the review_count across this code's rows.
    const { data } = await admin
      .from("course_rating_summary").select("review_count").eq("course_code", courseCode);
    const total = (data ?? []).reduce((a, s) => a + (s.review_count ?? 0), 0);
    expect(total).toBeGreaterThanOrEqual(1);
  });

  it("blocks inserting a review as another user (RLS deny)", async ({ skip }) => {
    if (!hasCourse) return skip();
    const { error } = await userClient.from("reviews").insert({
      course_id: courseId, user_id: "00000000-0000-0000-0000-000000000000", semester_id: "114-2",
      sweetness: 1, coolness: 1, loading: 1, quality: 1, grading: 1, display_name: "冒充",
    });
    expect(error).not.toBeNull();
  });

  it("allows public (anon) read of reviews", async () => {
    const anonClient = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await anonClient.from("reviews").select("id").limit(1);
    expect(error).toBeNull();
  });
});
