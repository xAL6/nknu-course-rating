"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAllowedUser } from "@/lib/auth";

// Writes are guarded here by Clerk auth + NKNU-domain check (requireAllowedUser),
// then performed with the service-role client. Reads stay public via anon + RLS.

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
  const { id: userId, displayName } = await requireAllowedUser();
  const input = reviewSchema.parse(Object.fromEntries(formData));
  const db = createAdminClient();

  const { data: course } = await db
    .from("courses")
    .select("id, semester_id")
    .eq("syllabus_no", input.syllabusNo)
    .maybeSingle();
  if (!course) throw new Error("COURSE_NOT_FOUND");

  const { error } = await db.from("reviews").upsert(
    {
      course_id: course.id,
      user_id: userId,
      semester_id: input.semesterId ?? course.semester_id,
      sweetness: input.sweetness,
      coolness: input.coolness,
      loading: input.loading,
      quality: input.quality,
      grading: input.grading,
      short_comment: input.shortComment || null,
      body: input.body || null,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "course_id,user_id" },
  );
  if (error) throw error;

  const { count } = await db
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  await db.from("profiles").update({ reputation: (count ?? 0) * 10 }).eq("user_id", userId);

  revalidatePath(`/course/${input.courseCode}`);
  revalidatePath("/leaderboard");
  return { ok: true };
}

export async function toggleBookmark(courseId: string, courseCode: string) {
  const { id: userId } = await requireAllowedUser();
  const db = createAdminClient();
  const { data: existing } = await db
    .from("bookmarks")
    .select("course_id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) {
    await db.from("bookmarks").delete().eq("user_id", userId).eq("course_id", courseId);
  } else {
    await db.from("bookmarks").insert({ user_id: userId, course_id: courseId });
  }
  revalidatePath(`/course/${courseCode}`);
  return { bookmarked: !existing };
}

const voteKind = z.enum(["like", "useful", "not_useful"]);

export async function voteReview(reviewId: string, kind: string, courseCode: string) {
  const { id: userId } = await requireAllowedUser();
  const k = voteKind.parse(kind);
  const db = createAdminClient();
  const { data: existing } = await db
    .from("votes")
    .select("kind")
    .eq("user_id", userId)
    .eq("review_id", reviewId)
    .eq("kind", k)
    .maybeSingle();

  if (existing) {
    await db.from("votes").delete().eq("user_id", userId).eq("review_id", reviewId).eq("kind", k);
  } else {
    await db.from("votes").insert({ user_id: userId, review_id: reviewId, kind: k });
  }
  revalidatePath(`/course/${courseCode}`);
  return { voted: !existing };
}

export async function addComment(reviewId: string, body: string, courseCode: string) {
  const { id: userId } = await requireAllowedUser();
  const text = z.string().min(1).max(2000).parse(body);
  const db = createAdminClient();
  await db.from("comments").insert({ review_id: reviewId, user_id: userId, body: text });
  revalidatePath(`/course/${courseCode}`);
  return { ok: true };
}
