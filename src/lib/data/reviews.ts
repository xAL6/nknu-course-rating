import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./courses";
import type { RatingSummary } from "./types";

export type Comment = {
  id: string;
  displayName: string;
  body: string;
  createdAt: string;
};

export type Review = {
  id: string;
  displayName: string;
  semesterId: string | null;
  teacherKey: string;
  sweetness: number | null;
  coolness: number | null;
  loading: number | null;
  quality: number | null;
  grading: number | null;
  shortComment: string | null;
  body: string | null;
  tags: string[];
  likeCount: number;
  usefulCount: number;
  createdAt: string;
  userId: string;
  comments: Comment[];
};

/** Reviews for a logical course (by course_key), each tagged with its teacher_key. */
export async function getReviews(courseKey: string): Promise<Review[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select(
      "*, courses!inner(course_key, teacher_key), comments(id, body, display_name, created_at)",
    )
    .eq("courses.course_key", courseKey)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    displayName: r.display_name,
    semesterId: r.semester_id,
    teacherKey: (r.courses as unknown as { teacher_key: string } | null)?.teacher_key ?? "",
    sweetness: r.sweetness,
    coolness: r.coolness,
    loading: r.loading,
    quality: r.quality,
    grading: r.grading,
    shortComment: r.short_comment,
    body: r.body,
    tags: (r.tags as string[] | null) ?? [],
    likeCount: r.like_count ?? 0,
    usefulCount: r.useful_count ?? 0,
    createdAt: r.created_at,
    userId: r.user_id,
    comments: ((r.comments as unknown as {
      id: string;
      body: string;
      display_name: string | null;
      created_at: string;
    }[]) ?? [])
      .map((c) => ({
        id: c.id,
        displayName: c.display_name ?? "匿名",
        body: c.body,
        createdAt: c.created_at,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }));
}

export type TeacherSummary = { teacherKey: string; summary: RatingSummary };

/** Per-teacher rating summaries for a course (keyed by teacher_key). */
export async function getTeacherSummaries(courseKey: string): Promise<TeacherSummary[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_rating_summary")
    .select("*")
    .eq("course_key", courseKey);
  return (data ?? []).map((d) => ({
    teacherKey: d.teacher_key as string,
    summary: {
      reviewCount: d.review_count ?? 0,
      sweetness: d.avg_sweetness,
      coolness: d.avg_coolness,
      loading: d.avg_loading,
      quality: d.avg_quality,
      grading: d.avg_grading,
      tagCounts: (d.tag_counts as Record<string, number> | null) ?? {},
    },
  }));
}
