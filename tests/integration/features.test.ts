import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ready = !!url && !!anon && !!service && !url.includes("placeholder");
const d = ready ? describe : describe.skip;

d("Batch features: search, votes, comments, timetables", () => {
  let admin: SupabaseClient;
  let userClient: SupabaseClient;
  let otherClient: SupabaseClient;
  let userId = "";
  let otherId = "";
  const email = `vitest_feat_${Date.now()}@mail.nknu.edu.tw`;
  const otherEmail = `vitest_other_${Date.now()}@mail.nknu.edu.tw`;
  const password = "Test-" + Math.random().toString(36).slice(2) + "A1!";
  let courseId = "";
  let courseKey = "";
  let reviewId = "";
  let hasCourse = false;

  beforeAll(async () => {
    admin = createClient(url!, service!, { auth: { persistSession: false } });
    userClient = createClient(url!, anon!, { auth: { persistSession: false } });
    otherClient = createClient(url!, anon!, { auth: { persistSession: false } });

    const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    userId = u.user!.id;
    const { data: o } = await admin.auth.admin.createUser({ email: otherEmail, password, email_confirm: true });
    otherId = o.user!.id;
    await admin.from("profiles").insert([
      { user_id: userId, display_name: "測試甲" },
      { user_id: otherId, display_name: "測試乙" },
    ]);

    const { data: course } = await admin
      .from("courses")
      .select("id, course_key")
      .not("course_key", "is", null)
      .limit(1)
      .maybeSingle();
    if (course) {
      courseId = course.id;
      courseKey = course.course_key;
      hasCourse = true;
    }

    await userClient.auth.signInWithPassword({ email, password });
    await otherClient.auth.signInWithPassword({ email: otherEmail, password });

    if (hasCourse) {
      const { data: r } = await admin
        .from("reviews")
        .insert({
          course_id: courseId,
          user_id: userId,
          semester_id: "114-2",
          sweetness: 4, coolness: 4, loading: 3, quality: 5, grading: 4,
          short_comment: "整合測試評價",
          display_name: "測試甲",
        })
        .select("id")
        .single();
      reviewId = r!.id;
    }
  });

  afterAll(async () => {
    for (const id of [userId, otherId]) {
      if (!id) continue;
      await admin.from("timetables").delete().eq("user_id", id);
      await admin.from("comments").delete().eq("user_id", id);
      await admin.from("votes").delete().eq("user_id", id);
      await admin.from("reviews").delete().eq("user_id", id);
      await admin.from("profiles").delete().eq("user_id", id);
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("search_courses returns ranked, distinct course_keys", async () => {
    const { data, error } = await admin.rpc("search_courses", { p_q: "微積分", p_limit: 10 });
    expect(error).toBeNull();
    const rows = (data ?? []) as { course_key: string; rank: number }[];
    expect(rows.length).toBeGreaterThan(0);
    // distinct keys
    expect(new Set(rows.map((r) => r.course_key)).size).toBe(rows.length);
    // descending rank
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].rank).toBeGreaterThanOrEqual(rows[i].rank);
  });

  it("vote-count trigger maintains reviews.like_count", async ({ skip }) => {
    if (!hasCourse) return skip();
    const { error: vErr } = await userClient
      .from("votes")
      .insert({ user_id: userId, review_id: reviewId, kind: "like" });
    expect(vErr).toBeNull();
    const { data } = await admin.from("reviews").select("like_count").eq("id", reviewId).single();
    expect(data!.like_count).toBe(1);

    await userClient.from("votes").delete().eq("user_id", userId).eq("review_id", reviewId).eq("kind", "like");
    const { data: after } = await admin.from("reviews").select("like_count").eq("id", reviewId).single();
    expect(after!.like_count).toBe(0);
  });

  it("comment carries a display_name snapshot and reads publicly", async ({ skip }) => {
    if (!hasCourse) return skip();
    const { error } = await userClient
      .from("comments")
      .insert({ review_id: reviewId, user_id: userId, body: "推", display_name: "測試甲" });
    expect(error).toBeNull();
    const anonClient = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data } = await anonClient.from("comments").select("display_name, body").eq("review_id", reviewId);
    expect(data?.some((c) => c.display_name === "測試甲" && c.body === "推")).toBe(true);
  });

  it("per-teacher summary aggregates by course_key (review_count >= 1)", async ({ skip }) => {
    if (!hasCourse) return skip();
    const { data } = await admin
      .from("course_rating_summary")
      .select("review_count")
      .eq("course_key", courseKey);
    const total = (data ?? []).reduce((a, s) => a + (s.review_count ?? 0), 0);
    expect(total).toBeGreaterThanOrEqual(1);
  });

  it("timetables: a user can save and read back their own; others cannot", async () => {
    const courses = [{ courseCode: "X1", name: "測試課", teachers: [], classroom: null, semesterId: "114-2", slots: [], syllabusNo: "s" }];
    const { error } = await userClient
      .from("timetables")
      .upsert({ user_id: userId, semester_id: "114-2", courses, updated_at: new Date().toISOString() });
    expect(error).toBeNull();

    const { data: own } = await userClient.from("timetables").select("courses").eq("user_id", userId).maybeSingle();
    expect((own?.courses as unknown[])?.length).toBe(1);

    // RLS: the other user must not see it.
    const { data: leaked } = await otherClient.from("timetables").select("user_id").eq("user_id", userId);
    expect(leaked ?? []).toHaveLength(0);
  });
});
