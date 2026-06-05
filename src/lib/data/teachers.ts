import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, rowToOffering, groupCourses, SELECT, type CourseRow } from "./courses";
import type { CourseGroup, RatingSummary } from "./types";

export type TeacherListItem = { name: string; courseCount: number };

export async function listTeachers(q?: string): Promise<TeacherListItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("teacher_list", { p_q: q ?? null });
  return (data ?? []).map((t: { name: string; course_count: number }) => ({
    name: t.name,
    courseCount: Number(t.course_count),
  }));
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

  // Aggregate rating across this teacher's courses (from the summary table).
  const codes = [...new Set(courses.map((c) => c.courseCode))];
  let summary: RatingSummary | null = null;
  if (codes.length) {
    const { data: sums } = await supabase
      .from("course_rating_summary")
      .select("*")
      .in("course_code", codes);
    const withReviews = (sums ?? []).filter((s) => (s.review_count ?? 0) > 0);
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
