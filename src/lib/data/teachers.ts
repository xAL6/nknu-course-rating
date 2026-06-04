import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, rowToOffering, groupCourses, SELECT, type CourseRow } from "./courses";
import type { CourseGroup, RatingSummary } from "./types";

export type TeacherListItem = { name: string; courseCount: number };

/** "待聘", "本系教師" etc. are placeholders, not real instructors. */
function isRealTeacher(name: string): boolean {
  return !!name && !/待聘|本系|未定|TBA|兼任教師$/.test(name);
}

export async function listTeachers(q?: string): Promise<TeacherListItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  let query = supabase
    .from("teachers")
    .select("name, course_teachers(count)")
    .order("name");
  if (q) query = query.ilike("name", `%${q}%`);
  const { data } = await query.limit(2000);
  return (data ?? [])
    .map((t) => ({
      name: t.name as string,
      courseCount: (t.course_teachers as unknown as { count: number }[])?.[0]?.count ?? 0,
    }))
    .filter((t) => isRealTeacher(t.name) && t.courseCount > 0);
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
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, name")
    .eq("name", name)
    .maybeSingle();
  if (!teacher) return null;

  const { data: links } = await supabase
    .from("course_teachers")
    .select(`courses(${SELECT})`)
    .eq("teacher_id", teacher.id)
    .limit(2000);

  const offerings = (links ?? [])
    .map((l) => (l.courses ? rowToOffering(l.courses as unknown as CourseRow) : null))
    .filter((o): o is NonNullable<typeof o> => o !== null);

  const courses = groupCourses(offerings).sort((a, b) => b.latestSemester.localeCompare(a.latestSemester));

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
    name: teacher.name,
    courses,
    summary,
    courseCount: courses.length,
    semesters: [...new Set(offerings.map((o) => o.semesterId))].sort((a, b) => b.localeCompare(a)),
  };
}
