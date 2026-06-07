import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listCourses } from "./courses";

export type AiCourseResult = {
  courseKey: string;
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
  /** Aggregated quick-tag counts across this course's teachers, e.g. {可加簽: 12}. */
  tags: Record<string, number>;
};

/**
 * Retrieval for the AI advisor: keyword-search courses, attach rating
 * summaries. Returns compact records the model can reason over (grounded RAG).
 */
export async function retrieveCourses(query: string, department?: string): Promise<AiCourseResult[]> {
  const result = await listCourses({ q: query, dept: department, pageSize: 12 });
  const keys = result.items.map((c) => c.courseKey).filter(Boolean);

  // Aggregate per-teacher summary rows up to the logical course (course_key).
  const summaries = new Map<string, AiCourseResult["rating"]>();
  const tagsByKey = new Map<string, Record<string, number>>();
  if (keys.length) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("course_rating_summary")
      .select("*")
      .in("course_key", keys);
    const byKey = new Map<
      string,
      { sum: Record<string, number>; n: Record<string, number>; reviews: number; tags: Record<string, number> }
    >();
    for (const s of data ?? []) {
      const ck = s.course_key as string;
      const acc = byKey.get(ck) ?? { sum: {}, n: {}, reviews: 0, tags: {} };
      acc.reviews += s.review_count ?? 0;
      for (const k of ["avg_sweetness", "avg_coolness", "avg_loading", "avg_quality", "avg_grading"]) {
        const v = s[k] as number | null;
        if (v != null) {
          acc.sum[k] = (acc.sum[k] ?? 0) + v;
          acc.n[k] = (acc.n[k] ?? 0) + 1;
        }
      }
      const tc = (s.tag_counts as Record<string, number> | null) ?? {};
      for (const [tag, v] of Object.entries(tc)) acc.tags[tag] = (acc.tags[tag] ?? 0) + (v ?? 0);
      byKey.set(ck, acc);
    }
    for (const [ck, acc] of byKey) {
      const avg = (k: string) => (acc.n[k] ? acc.sum[k] / acc.n[k] : null);
      summaries.set(ck, {
        reviewCount: acc.reviews,
        sweetness: avg("avg_sweetness"),
        coolness: avg("avg_coolness"),
        loading: avg("avg_loading"),
        quality: avg("avg_quality"),
        grading: avg("avg_grading"),
      });
      tagsByKey.set(ck, acc.tags);
    }
  }

  return result.items.map((c) => ({
    courseKey: c.courseKey,
    courseCode: c.courseCode,
    name: c.name,
    nameEn: c.nameEn,
    teachers: c.teachers,
    credits: c.credits,
    departments: c.departments,
    latestSemester: c.latestSemester,
    rating: summaries.get(c.courseKey) ?? null,
    tags: tagsByKey.get(c.courseKey) ?? {},
  }));
}
