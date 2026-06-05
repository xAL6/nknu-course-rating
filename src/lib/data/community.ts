import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./courses";

export type Contributor = { displayName: string; reputation: number; reviewCount: number };
export type TrendingCourse = {
  courseKey: string;
  teacherKey: string;
  teachers: string[];
  courseCode: string;
  name: string;
  reviewCount: number;
  avgQuality: number | null;
};

export async function getTopContributors(limit = 50): Promise<Contributor[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name, reputation, reviews(count)")
    .order("reputation", { ascending: false })
    .limit(limit);
  return (data ?? [])
    .map((p) => ({
      displayName: p.display_name as string,
      reputation: (p.reputation as number) ?? 0,
      reviewCount: (p.reviews as unknown as { count: number }[])?.[0]?.count ?? 0,
    }))
    .filter((c) => c.reviewCount > 0);
}

export async function getTrendingCourses(limit = 20): Promise<TrendingCourse[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_rating_summary")
    .select("course_key, teacher_key, course_code, name, review_count, avg_quality")
    .order("review_count", { ascending: false })
    .limit(limit);
  return (data ?? [])
    .filter((s) => (s.review_count ?? 0) > 0)
    .map((s) => {
      const tk = (s.teacher_key as string | null) ?? "";
      return {
        courseKey: s.course_key as string,
        teacherKey: tk,
        teachers: tk ? tk.split("、") : [],
        courseCode: s.course_code as string,
        name: s.name as string,
        reviewCount: s.review_count as number,
        avgQuality: s.avg_quality as number | null,
      };
    });
}
