import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listCourses } from "./courses";

export type AiCourseResult = {
  courseCode: string;
  name: string;
  nameEn: string | null;
  teachers: string[];
  credits: number | null;
  departments: string[];
  latestSemester: string;
  rating: {
    reviewCount: number;
    sweetness: number | null;
    coolness: number | null;
    loading: number | null;
    quality: number | null;
    grading: number | null;
  } | null;
};

/**
 * Retrieval for the AI advisor: keyword-search courses, attach rating
 * summaries. Returns compact records the model can reason over (grounded RAG).
 */
export async function retrieveCourses(query: string, department?: string): Promise<AiCourseResult[]> {
  const result = await listCourses({ q: query, dept: department, pageSize: 12 });
  const codes = result.items.map((c) => c.courseCode);

  const summaries = new Map<string, AiCourseResult["rating"]>();
  if (codes.length) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("course_rating_summary")
      .select("*")
      .in("course_code", codes);
    for (const s of data ?? []) {
      summaries.set(s.course_code, {
        reviewCount: s.review_count ?? 0,
        sweetness: s.avg_sweetness,
        coolness: s.avg_coolness,
        loading: s.avg_loading,
        quality: s.avg_quality,
        grading: s.avg_grading,
      });
    }
  }

  return result.items.map((c) => ({
    courseCode: c.courseCode,
    name: c.name,
    nameEn: c.nameEn,
    teachers: c.teachers,
    credits: c.credits,
    departments: c.departments,
    latestSemester: c.latestSemester,
    rating: summaries.get(c.courseCode) ?? null,
  }));
}
