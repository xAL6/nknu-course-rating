import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listCourses, getCourse } from "./courses";
import { getReviews } from "./reviews";
import { fillRate, avgFillRate } from "@/lib/enrollment";
import type { CourseGroup } from "./types";

export type AiRating = {
  reviewCount: number;
  sweetness: number | null;
  coolness: number | null;
  loading: number | null;
  quality: number | null;
  grading: number | null;
};

export type AiCourseResult = {
  courseKey: string;
  courseCode: string;
  name: string;
  nameEn: string | null;
  teachers: string[];
  credits: number | null;
  departments: string[];
  latestSemester: string;
  rating: AiRating | null;
  /** Aggregated quick-tag counts across this course's teachers, e.g. {可加簽: 12}. */
  tags: Record<string, number>;
  /** 選課人數 / 名額 of the latest offering (搶課熱度); null when unknown. */
  enrollFillRate: number | null;
};

/** Per-course (course_key) rating + tag aggregation from course_rating_summary. */
async function fetchSummaries(
  keys: string[],
): Promise<Map<string, { rating: AiRating; tags: Record<string, number> }>> {
  const out = new Map<string, { rating: AiRating; tags: Record<string, number> }>();
  if (!keys.length) return out;

  const supabase = await createClient();
  const { data } = await supabase.from("course_rating_summary").select("*").in("course_key", keys);

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
    out.set(ck, {
      rating: {
        reviewCount: acc.reviews,
        sweetness: avg("avg_sweetness"),
        coolness: avg("avg_coolness"),
        loading: avg("avg_loading"),
        quality: avg("avg_quality"),
        grading: avg("avg_grading"),
      },
      tags: acc.tags,
    });
  }
  return out;
}

function toAiResult(
  c: CourseGroup,
  s?: { rating: AiRating; tags: Record<string, number> },
): AiCourseResult {
  return {
    courseKey: c.courseKey,
    courseCode: c.courseCode,
    name: c.name,
    nameEn: c.nameEn,
    teachers: c.teachers,
    credits: c.credits,
    departments: c.departments,
    latestSemester: c.latestSemester,
    rating: s?.rating ?? null,
    tags: s?.tags ?? {},
    enrollFillRate: fillRate(c.offerings[0]?.enrollCount, c.offerings[0]?.enrollCap),
  };
}

/**
 * Retrieval for the AI advisor: keyword-search courses, attach rating
 * summaries, quick tags, and 搶課熱度. Optionally filter to courses carrying
 * ALL of `opts.tags`. Returns compact records the model can reason over (RAG).
 */
export async function retrieveCourses(
  query: string,
  department?: string,
  opts?: { tags?: string[] },
): Promise<AiCourseResult[]> {
  const tags = opts?.tags?.filter(Boolean) ?? [];
  // Widen the candidate pool when tag-filtering, since few courses carry tags.
  const result = await listCourses({ q: query, dept: department, pageSize: tags.length ? 36 : 12 });
  const sums = await fetchSummaries(result.items.map((c) => c.courseKey).filter(Boolean));

  let courses = result.items.map((c) => toAiResult(c, sums.get(c.courseKey)));
  if (tags.length) {
    courses = courses.filter((c) => tags.every((t) => (c.tags[t] ?? 0) > 0)).slice(0, 12);
  }
  return courses;
}

/**
 * Compare the different teachers of the SAME course. Returns the per-teacher
 * variants (each a logical course = dept+name+teacher) sharing the dominant
 * normalized name, so the model can lay them side by side.
 */
export async function compareTeachersForAI(courseName: string): Promise<AiCourseResult[]> {
  const items = await retrieveCourses(courseName);
  if (items.length <= 1) return items;

  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const groups = new Map<string, AiCourseResult[]>();
  for (const it of items) {
    const k = norm(it.name);
    const arr = groups.get(k) ?? [];
    arr.push(it);
    groups.set(k, arr);
  }
  let best = items;
  let bestN = 0;
  for (const arr of groups.values()) {
    if (arr.length > bestN) {
      best = arr;
      bestN = arr.length;
    }
  }
  return best;
}

export type AiCourseDetail = {
  courseKey: string;
  name: string;
  teachers: string[];
  credits: number | null;
  departments: string[];
  semesters: string[];
  rating: AiRating | null;
  tags: Record<string, number>;
  /** latest-offering fill rate, and historical average across offerings. */
  enrollFillRate: number | null;
  enrollAvgFillRate: number | null;
  reviewCount: number;
  sampleComments: string[];
};

/** Deep dive on one course: rating, tag breakdown, 搶課熱度 (latest + 歷年), short reviews. */
export async function getCourseDetailForAI(courseKey: string): Promise<AiCourseDetail | null> {
  const course = await getCourse(courseKey);
  if (!course) return null;

  const sums = await fetchSummaries([courseKey]);
  const s = sums.get(courseKey);
  const reviews = await getReviews(courseKey);
  const sampleComments = reviews
    .map((r) => r.shortComment)
    .filter((c): c is string => !!c)
    .slice(0, 6);

  return {
    courseKey,
    name: course.name,
    teachers: course.teachers,
    credits: course.credits,
    departments: course.departments,
    semesters: [...new Set(course.offerings.map((o) => o.semesterId))].sort((a, b) => b.localeCompare(a)),
    rating: s?.rating ?? null,
    tags: s?.tags ?? {},
    enrollFillRate: fillRate(course.offerings[0]?.enrollCount, course.offerings[0]?.enrollCap),
    enrollAvgFillRate: avgFillRate(course.offerings).rate,
    reviewCount: s?.rating?.reviewCount ?? reviews.length,
    sampleComments,
  };
}
