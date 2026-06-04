"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/config";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    throw new Error("UNAUTHORIZED");
  }
  return { supabase, user };
}

const reviewSchema = z.object({
  courseCode: z.string().min(1),
  syllabusNo: z.string().min(1),
  semesterId: z.string().optional(),
  sweetness: z.coerce.number().int().min(1).max(5),
  coolness: z.coerce.number().int().min(1).max(5),
  loading: z.coerce.number().int().min(1).max(5),
  quality: z.coerce.number().int().min(1).max(5),
  grading: z.coerce.number().int().min(1).max(5),
  shortComment: z.string().max(100).optional(),
  body: z.string().max(5000).optional(),
});

export async function submitReview(formData: FormData) {
  const { supabase, user } = await requireUser();
  const input = reviewSchema.parse(Object.fromEntries(formData));

  // Resolve the specific offering (course row) by syllabus_no.
  const { data: course } = await supabase
    .from("courses")
    .select("id, semester_id")
    .eq("syllabus_no", input.syllabusNo)
    .maybeSingle();
  if (!course) throw new Error("COURSE_NOT_FOUND");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("reviews").upsert(
    {
      course_id: course.id,
      user_id: user.id,
      semester_id: input.semesterId ?? course.semester_id,
      sweetness: input.sweetness,
      coolness: input.coolness,
      loading: input.loading,
      quality: input.quality,
      grading: input.grading,
      short_comment: input.shortComment || null,
      body: input.body || null,
      display_name: profile?.display_name ?? "同學",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "course_id,user_id" },
  );
  if (error) throw error;

  // Reputation = 10 points per review (idempotent recompute).
  const { count } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  await supabase.from("profiles").update({ reputation: (count ?? 0) * 10 }).eq("user_id", user.id);

  revalidatePath(`/course/${input.courseCode}`);
  revalidatePath("/leaderboard");
  return { ok: true };
}

export async function toggleBookmark(courseId: string, courseCode: string) {
  const { supabase, user } = await requireUser();
  const { data: existing } = await supabase
    .from("bookmarks")
    .select("course_id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) {
    await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("course_id", courseId);
  } else {
    await supabase.from("bookmarks").insert({ user_id: user.id, course_id: courseId });
  }
  revalidatePath(`/course/${courseCode}`);
  return { bookmarked: !existing };
}

const voteKind = z.enum(["like", "useful", "not_useful"]);

export async function voteReview(reviewId: string, kind: string, courseCode: string) {
  const { supabase, user } = await requireUser();
  const k = voteKind.parse(kind);
  const { data: existing } = await supabase
    .from("votes")
    .select("kind")
    .eq("user_id", user.id)
    .eq("review_id", reviewId)
    .eq("kind", k)
    .maybeSingle();

  if (existing) {
    await supabase.from("votes").delete().eq("user_id", user.id).eq("review_id", reviewId).eq("kind", k);
  } else {
    await supabase.from("votes").insert({ user_id: user.id, review_id: reviewId, kind: k });
  }
  revalidatePath(`/course/${courseCode}`);
  return { voted: !existing };
}

export async function addComment(reviewId: string, body: string, courseCode: string) {
  const { supabase, user } = await requireUser();
  const text = z.string().min(1).max(2000).parse(body);
  await supabase.from("comments").insert({ review_id: reviewId, user_id: user.id, body: text });
  revalidatePath(`/course/${courseCode}`);
  return { ok: true };
}
