import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ready = !!url && !!anon && !!service && !url.includes("placeholder");

const d = ready ? describe : describe.skip;

d("Supabase RLS + rating trigger (authenticated NKNU user)", () => {
  let admin: SupabaseClient;
  let userClient: SupabaseClient;
  let userId = "";
  const email = `vitest_${Date.now()}@mail.nknu.edu.tw`;
  const password = "Test-" + Math.random().toString(36).slice(2) + "A1!";
  let courseId = "";
  let courseCode = "";

  beforeAll(async () => {
    admin = createClient(url!, service!, { auth: { persistSession: false } });

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(cErr).toBeNull();
    userId = created.user!.id;
    await admin.from("profiles").insert({ user_id: userId, display_name: "測試同學" });

    const { data: course } = await admin
      .from("courses")
      .select("id, course_code")
      .limit(1)
      .single();
    courseId = course!.id;
    courseCode = course!.course_code;

    userClient = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error: sErr } = await userClient.auth.signInWithPassword({ email, password });
    expect(sErr).toBeNull();
  });

  afterAll(async () => {
    if (userId) {
      await admin.from("reviews").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("lets a signed-in user insert their own review (RLS allow)", async () => {
    const { error } = await userClient.from("reviews").insert({
      course_id: courseId,
      user_id: userId,
      semester_id: "114-2",
      sweetness: 4,
      coolness: 5,
      loading: 2,
      quality: 4,
      grading: 5,
      short_comment: "vitest review",
      display_name: "測試同學",
    });
    expect(error).toBeNull();
  });

  it("recomputes course_rating_summary via the trigger", async () => {
    const { data } = await admin
      .from("course_rating_summary")
      .select("review_count, avg_sweetness")
      .eq("course_code", courseCode)
      .maybeSingle();
    expect(data).not.toBeNull();
    expect(data!.review_count).toBeGreaterThanOrEqual(1);
    expect(Number(data!.avg_sweetness)).toBeGreaterThan(0);
  });

  it("blocks inserting a review as another user (RLS deny)", async () => {
    const { error } = await userClient.from("reviews").insert({
      course_id: courseId,
      user_id: "00000000-0000-0000-0000-000000000000",
      semester_id: "114-2",
      sweetness: 1,
      coolness: 1,
      loading: 1,
      quality: 1,
      grading: 1,
      display_name: "冒充",
    });
    expect(error).not.toBeNull();
  });

  it("allows public (anon) read of reviews", async () => {
    const anonClient = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data, error } = await anonClient.from("reviews").select("id").eq("user_id", userId);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThanOrEqual(1);
  });
});
