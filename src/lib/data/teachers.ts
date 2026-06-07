import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, rowToOffering, groupCourses, SELECT, type CourseRow } from "./courses";
import type { CourseGroup, RatingSummary } from "./types";

export type TeacherListItem = { name: string; courseCount: number };

export async function listTeachers(q?: string): Promise<TeacherListItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  // PostgREST caps RPC results at 1000 rows even with .limit(); page via .range().
  const out: TeacherListItem[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .rpc("teacher_list", { p_q: q ?? null })
      .range(from, from + PAGE - 1);
    const batch = (data ?? []) as { name: string; course_count: number }[];
    out.push(...batch.map((t) => ({ name: t.name, courseCount: Number(t.course_count) })));
    if (batch.length < PAGE) break;
  }
  return out;
}

export type TeacherDetail = {
  name: string;
  courses: CourseGroup[];
  summary: RatingSummary | null;
  courseCount: number;
  semesters: string[];
};

export async function getTeacher(name: string): Promise<TeacherDetail | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();

  // All offerings where this teacher appears (co-teaching included).
  const { data } = await supabase
    .from("courses")
    .select(SELECT)
    .contains("teacher_names", [name])
    .order("semester_id", { ascending: false })
    .limit(2000);

  const offerings = (data ?? []).map((r) => rowToOffering(r as unknown as CourseRow));
  if (offerings.length === 0) return null;

  const courses = groupCourses(offerings).sort((a, b) =>
    b.latestSemester.localeCompare(a.latestSemester),
  );

  // Aggregate rating across this teacher's (course_key, teacher_key) rows.
  // teacher_key is the sorted co-teacher set, so a name can appear in several
  // keys (solo + co-taught variants); match any key that includes this name.
  const courseKeys = [...new Set(courses.map((c) => c.courseKey).filter(Boolean))];
  let summary: RatingSummary | null = null;
  if (courseKeys.length) {
    const { data: sums } = await supabase
      .from("course_rating_summary")
      .select("*")
      .in("course_key", courseKeys);
    const withReviews = (sums ?? []).filter(
      (s) =>
        (s.review_count ?? 0) > 0 &&
        ((s.teacher_key as string | null)?.split("、").includes(name) ?? false),
    );
    if (withReviews.length) {
      const avg = (k: string) => {
        const vals = withReviews.map((s) => s[k]).filter((v) => v != null) as number[];
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      };
      summary = {
        reviewCount: withReviews.reduce((a, s) => a + (s.review_count ?? 0), 0),
        sweetness: avg("avg_sweetness"),
        coolness: avg("avg_coolness"),
        loading: avg("avg_loading"),
        quality: avg("avg_quality"),
        grading: avg("avg_grading"),
        tagCounts: withReviews.reduce((acc, s) => {
          const tc = (s.tag_counts as Record<string, number> | null) ?? {};
          for (const [k, v] of Object.entries(tc)) acc[k] = (acc[k] ?? 0) + (v ?? 0);
          return acc;
        }, {} as Record<string, number>),
      };
    }
  }

  return {
    name,
    courses,
    summary,
    courseCount: courses.length,
    semesters: [...new Set(offerings.map((o) => o.semesterId))].sort((a, b) => b.localeCompare(a)),
  };
}
