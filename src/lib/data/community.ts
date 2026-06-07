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

export type HomeStats = { courses: number; departments: number; semesters: number; reviews: number };

/** Cheap head-counts for the homepage stat band. */
export async function getHomeStats(): Promise<HomeStats> {
  if (!isSupabaseConfigured()) return { courses: 0, departments: 0, semesters: 0, reviews: 0 };
  const supabase = await createClient();
  const [c, d, s, r] = await Promise.all([
    supabase.from("courses").select("id", { count: "exact", head: true }),
    supabase.from("departments").select("code", { count: "exact", head: true }),
    supabase.from("semesters").select("id", { count: "exact", head: true }),
    supabase.from("reviews").select("id", { count: "exact", head: true }),
  ]);
  return {
    courses: c.count ?? 0,
    departments: d.count ?? 0,
    semesters: s.count ?? 0,
    reviews: r.count ?? 0,
  };
}

/** Department names for the homepage marquee (real breadth of the catalog). */
export async function getDepartmentNames(limit = 36): Promise<{ code: string; name: string }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("departments")
    .select("code, name")
    .order("name")
    .limit(limit);
  return (data ?? [])
    .map((d) => ({ code: d.code as string, name: d.name as string }))
    .filter((d) => d.name && !/占用|未定|nan/i.test(d.name));
}

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
