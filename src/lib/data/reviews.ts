import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./courses";
import type { RatingSummary } from "./types";

export type Review = {
  id: string;
  displayName: string;
  semesterId: string | null;
  sweetness: number | null;
  coolness: number | null;
  loading: number | null;
  quality: number | null;
  grading: number | null;
  shortComment: string | null;
  body: string | null;
  likeCount: number;
  usefulCount: number;
  createdAt: string;
  userId: string;
};

/** Reviews for a logical course (course_code + name). Empty if no DB yet. */
export async function getReviews(courseCode: string, name?: string): Promise<Review[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  let query = supabase
    .from("reviews")
    .select("*, courses!inner(course_code, name)")
    .eq("courses.course_code", courseCode);
  if (name) query = query.eq("courses.name", name);
  const { data } = await query.order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    displayName: r.display_name,
    semesterId: r.semester_id,
    sweetness: r.sweetness,
    coolness: r.coolness,
    loading: r.loading,
    quality: r.quality,
    grading: r.grading,
    shortComment: r.short_comment,
    body: r.body,
    likeCount: r.like_count ?? 0,
    usefulCount: r.useful_count ?? 0,
    createdAt: r.created_at,
    userId: r.user_id,
  }));
}

export async function getRatingSummary(courseCode: string): Promise<RatingSummary | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_rating_summary")
    .select("*")
    .eq("course_code", courseCode)
    .maybeSingle();
  if (!data) return null;
  return {
    reviewCount: data.review_count ?? 0,
    sweetness: data.avg_sweetness,
    coolness: data.avg_coolness,
    loading: data.avg_loading,
    quality: data.avg_quality,
    grading: data.avg_grading,
  };
}
