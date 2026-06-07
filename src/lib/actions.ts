"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { createClient } from "@/lib/supabase/server";
import { getReviews } from "@/lib/data/reviews";
import {
  isAllowedEmail,
  randomDisplayName,
  RATING_DIMENSIONS,
  REVIEW_TAG_VALUES,
  MAX_REVIEW_TAGS,
} from "@/lib/config";

const ALLOWED_TAGS = new Set(REVIEW_TAG_VALUES);

/** Require an authenticated NKNU-domain user; ensure their profile exists. */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) throw new Error("UNAUTHORIZED");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  let displayName = profile?.display_name;
  if (!displayName) {
    displayName = randomDisplayName();
    await supabase.from("profiles").insert({ user_id: user.id, display_name: displayName });
  }
  return { supabase, user, displayName };
}

const reviewSchema = z.object({
  courseKey: z.string().min(1),
  syllabusNo: z.string().min(1),
  semesterId: z.string().optional(),
  sweetness: z.coerce.number().int().min(1).max(5),
  coolness: z.coerce.number().int().min(1).max(5),
  quality: z.coerce.number().int().min(1).max(5),
  shortComment: z.string().max(100).optional(),
  body: z.string().max(5000).optional(),
});

export async function submitReview(formData: FormData) {
  const { supabase, user, displayName } = await requireUser();
  const input = reviewSchema.parse(Object.fromEntries(formData));

  // tags arrive as repeated form fields — Object.fromEntries would drop all but
  // the last, so read them with getAll. Dedupe, keep only known tags, cap length.
  const tags = [...new Set(formData.getAll("tags").map(String))]
    .filter((t) => ALLOWED_TAGS.has(t))
    .slice(0, MAX_REVIEW_TAGS);

  const { data: course } = await supabase
    .from("courses")
    .select("id, semester_id")
    .eq("syllabus_no", input.syllabusNo)
    .maybeSingle();
  if (!course) throw new Error("COURSE_NOT_FOUND");

  const { error } = await supabase.from("reviews").upsert(
    {
      course_id: course.id,
      user_id: user.id,
      semester_id: input.semesterId ?? course.semester_id,
      sweetness: input.sweetness,
      coolness: input.coolness,
      quality: input.quality,
      short_comment: input.shortComment || null,
      body: input.body || null,
      tags,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "course_id,user_id" },
  );
  if (error) throw error;

  const { count } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  await supabase.from("profiles").update({ reputation: (count ?? 0) * 10 }).eq("user_id", user.id);

  revalidatePath(`/course/${input.courseKey}`);
  revalidatePath("/leaderboard");
  return { ok: true };
}

export async function toggleBookmark(courseId: string, courseKey: string) {
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
  revalidatePath(`/course/${courseKey}`);
  return { bookmarked: !existing };
}

const voteKind = z.enum(["like", "useful", "not_useful"]);

export async function voteReview(reviewId: string, kind: string, courseKey: string) {
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
  revalidatePath(`/course/${courseKey}`);
  return { voted: !existing };
}

const timetableCourse = z.object({
  courseCode: z.string(),
  syllabusNo: z.string().nullable(),
  name: z.string(),
  teachers: z.array(z.string()),
  classroom: z.string().nullable(),
  semesterId: z.string(),
  slots: z.array(z.object({ weekday: z.number(), period: z.string() })),
});

/** Persist the user's timetable (one row per user). */
export async function saveTimetable(courses: unknown) {
  const { supabase, user } = await requireUser();
  const parsed = z.array(timetableCourse).max(60).parse(courses);
  const semesterId = parsed[0]?.semesterId ?? null;
  const { error } = await supabase.from("timetables").upsert(
    {
      user_id: user.id,
      semester_id: semesterId,
      courses: parsed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  return { ok: true, count: parsed.length };
}

/** Load the user's saved timetable, or null if none / not signed in. */
export async function loadTimetable() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("timetables")
    .select("courses, semester_id, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    courses: (data.courses ?? []) as unknown[],
    semesterId: data.semester_id as string | null,
    updatedAt: data.updated_at as string,
  };
}

export async function addComment(reviewId: string, body: string, courseKey: string) {
  const { supabase, user, displayName } = await requireUser();
  const text = z.string().min(1).max(2000).parse(body);
  const { error } = await supabase
    .from("comments")
    .insert({ review_id: reviewId, user_id: user.id, body: text, display_name: displayName });
  if (error) throw error;
  revalidatePath(`/course/${courseKey}`);
  return { ok: true };
}

export type ReviewSummaryResult =
  | { status: "ok"; summary: string; cached: boolean }
  | { status: "too_few" }
  | { status: "disabled" };

/**
 * AI TL;DR of a (course, teacher)'s reviews — pros/cons distilled. Cached in
 * course_rating_summary.ai_summary; regenerated only when newer reviews exist.
 */
export async function getReviewSummary(
  courseKey: string,
  teacherKey: string,
): Promise<ReviewSummaryResult> {
  if (!process.env.DEEPSEEK_API_KEY) return { status: "disabled" };
  const supabase = await createClient();

  const all = await getReviews(courseKey);
  const reviews = all.filter((r) => r.teacherKey === teacherKey);
  if (reviews.length < 2) return { status: "too_few" };

  const latestAt = reviews
    .map((r) => r.createdAt)
    .sort((a, b) => b.localeCompare(a))[0];

  const { data: row } = await supabase
    .from("course_rating_summary")
    .select("ai_summary, ai_summary_at")
    .eq("course_key", courseKey)
    .eq("teacher_key", teacherKey)
    .maybeSingle();

  if (row?.ai_summary && row.ai_summary_at && row.ai_summary_at >= latestAt) {
    return { status: "ok", summary: row.ai_summary, cached: true };
  }

  // Build a compact, grounded prompt from the real reviews.
  const lines = reviews.map((r) => {
    const dims = RATING_DIMENSIONS.map((d) => `${d.label}${(r[d.key as keyof typeof r] as number | null) ?? "—"}`).join(" ");
    const text = [r.shortComment, r.body].filter(Boolean).join(" / ");
    return `- [${dims}] ${text || "(無文字評論)"}`;
  });

  const { text } = await generateText({
    model: deepseek("deepseek-chat"),
    system:
      "你是課程評價摘要助手。根據學生對某位老師某門課的真實評價，寫出客觀、精簡的繁體中文摘要。" +
      "不可捏造未提及的資訊。輸出格式：先一句總結，接著「優點」與「注意」兩個 Markdown 條列（各 2–4 點）。",
    prompt: `評分面向 1–5（甜度=給分甜、涼度=輕鬆、收穫=學到多少/內容紮實）。\n以下是 ${reviews.length} 則評價：\n${lines.join("\n")}`,
  });

  await supabase
    .from("course_rating_summary")
    .update({ ai_summary: text, ai_summary_at: new Date().toISOString() })
    .eq("course_key", courseKey)
    .eq("teacher_key", teacherKey);

  return { status: "ok", summary: text, cached: false };
}
