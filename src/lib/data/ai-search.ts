import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listCourses, getCourse, latestSemester } from "./courses";
import { getReviews } from "./reviews";
import { fillRate, avgFillRate } from "@/lib/enrollment";
import { buildSchedule } from "@/lib/schedule-builder";
import { PERIOD_ORDER } from "@/lib/period-shared";
import type { CourseGroup, Slot } from "./types";

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
  /** Ready-to-use, URL-encoded course page path — the model must link to THIS. */
  url: string;
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

// The product only surfaces 3 dimensions (甜度/涼度/收穫); hide the legacy
// loading/grading from the model so it never cites removed dimensions.
function exposeRating(r: AiRating | null | undefined): AiRating | null {
  return r ? { ...r, loading: null, grading: null } : null;
}

function toAiResult(
  c: CourseGroup,
  s?: { rating: AiRating; tags: Record<string, number> },
): AiCourseResult {
  return {
    courseKey: c.courseKey,
    url: "/course/" + encodeURIComponent(c.courseKey),
    courseCode: c.courseCode,
    name: c.name,
    nameEn: c.nameEn,
    teachers: c.teachers,
    credits: c.credits,
    departments: c.departments,
    latestSemester: c.latestSemester,
    rating: exposeRating(s?.rating),
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

const CJK_NUM = ["一", "二", "三", "四", "五", "六", "七"];

export type DeptListResult =
  | {
      kind: "deptList";
      semester: string;
      department: string;
      grade: number | null;
      count: number;
      courses: AiCourseResult[];
    }
  | { error: string; message: string };

/**
 * Structured course listing for "X系 [大四] [上學期] 有哪些課" — the precise
 * answer the keyword search can't give. Resolves the department + grade to the
 * exact class codes via the SAME facets the /courses page uses, then lists
 * courses through the proven browse path (membership-array containment, so 合班/
 * 跨班 課 are NOT missed). Grade includes that year's classes + all-grade electives.
 */
export async function listDeptCoursesForAI(args: {
  department: string;
  grade?: number;
  term?: string;
  semester?: string;
}): Promise<DeptListResult> {
  const supabase = await createClient();

  // 1) resolve semester: explicit → latest of term → latest main term
  let semester = args.semester;
  if (!semester) {
    const { data: semRows } = await supabase.from("semesters").select("id").order("id", { ascending: false });
    const ids = (semRows ?? []).map((s) => s.id as string);
    semester = (args.term ? ids.find((id) => id.endsWith(`-${args.term}`)) : ids.find((id) => !id.endsWith("-3"))) ?? ids[0];
  }
  if (!semester) return { error: "NO_SEMESTER", message: "目前沒有可用的學期資料。" };

  // 2) resolve department name → code (prefer the 大學部 one, not 碩/博/在職)
  const { data: deptRows } = await supabase.rpc("facet_departments", {
    p_sem: semester,
    p_level: null,
    p_dn: null,
    p_campus: null,
  });
  const depts = (deptRows ?? []) as { code: string; name: string }[];
  const isUg = (n: string) => !/碩|博|在職|進修|學分班|專班/.test(n);
  const kw = args.department.replace(/系所?$|學系$|學程$/u, "").trim();
  let cands = depts.filter((d) => d.name === args.department || d.name.includes(kw) || kw.includes(d.name));
  if (!cands.length && kw) cands = depts.filter((d) => [...kw].every((ch) => d.name.includes(ch)));
  cands.sort((a, b) => (isUg(b.name) ? 1 : 0) - (isUg(a.name) ? 1 : 0) || a.name.length - b.name.length);
  const dept = cands[0];
  if (!dept)
    return { error: "DEPT_NOT_FOUND", message: `找不到系所「${args.department}」，請確認名稱（可參考課程列表的系所名稱）。` };

  // 3) grade → class codes (that year + all-grade electives) via facet_classes
  let classCodes: string[] | null = null;
  if (args.grade && args.grade >= 1 && args.grade <= 7) {
    const { data: classRows } = await supabase.rpc("facet_classes", {
      p_sem: semester,
      p_level: null,
      p_dn: null,
      p_campus: null,
      p_dept: dept.code,
    });
    const classes = (classRows ?? []) as { code: string; name: string }[];
    const gstr = CJK_NUM[args.grade - 1] + "年級";
    const matched = classes.filter((c) => c.name.includes(gstr) || /全年級|不分年級/.test(c.name));
    classCodes = matched.map((c) => c.code);
    if (!classCodes.length) classCodes = null; // no such grade → fall back to whole dept
  }

  // 4) list via the proven browse path; union over the grade's class codes
  const groups = new Map<string, CourseGroup>();
  if (classCodes) {
    for (const cc of classCodes) {
      const r = await listCourses({ semester, dept: dept.code, classCode: cc, pageSize: 500 });
      for (const g of r.items) groups.set(g.courseKey + "|" + g.courseCode, g);
    }
  } else {
    const r = await listCourses({ semester, dept: dept.code, pageSize: 500 });
    for (const g of r.items) groups.set(g.courseKey + "|" + g.courseCode, g);
  }
  const list = [...groups.values()];
  const sums = await fetchSummaries(list.map((g) => g.courseKey).filter(Boolean));
  const courses = list.map((g) => toAiResult(g, sums.get(g.courseKey))).slice(0, 80);

  return { kind: "deptList", semester, department: dept.name, grade: args.grade ?? null, count: courses.length, courses };
}

export type AiCourseDetail = {
  courseKey: string;
  url: string;
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
    .map((r) => (r.body || r.shortComment || "").trim())
    .filter((c) => c.length > 0)
    .map((c) => (c.length > 120 ? c.slice(0, 120) + "…" : c))
    .slice(0, 6);

  return {
    courseKey,
    url: "/course/" + encodeURIComponent(courseKey),
    name: course.name,
    teachers: course.teachers,
    credits: course.credits,
    departments: course.departments,
    semesters: [...new Set(course.offerings.map((o) => o.semesterId))].sort((a, b) => b.localeCompare(a)),
    rating: exposeRating(s?.rating),
    tags: s?.tags ?? {},
    enrollFillRate: fillRate(course.offerings[0]?.enrollCount, course.offerings[0]?.enrollCap),
    enrollAvgFillRate: avgFillRate(course.offerings).rate,
    reviewCount: s?.rating?.reviewCount ?? reviews.length,
    sampleComments,
  };
}

export type ScheduleCourse = {
  courseKey: string;
  courseCode: string;
  syllabusNo: string | null;
  name: string;
  teachers: string[];
  classroom: string | null;
  campus: string | null;
  semesterId: string;
  slots: Slot[];
  credits: number | null;
  rating: AiRating | null;
  tags: Record<string, number>;
};

export type ScheduleResult =
  | { kind: "schedule"; semester: string; totalCredits: number; courses: ScheduleCourse[]; note: string }
  | { error: string; message: string };

/**
 * Auto-build a conflict-free suggested timetable for one semester, honouring
 * free days, a credit target, tag/rating preferences, and (default) avoiding
 * back-to-back cross-campus classes. The combinatorial search runs in code
 * (schedule-builder) — the model only relays/explains the result.
 */
export async function buildScheduleForAI(args: {
  department?: string;
  semester?: string;
  freeWeekdays?: number[];
  targetCredits?: number;
  tags?: string[];
  prefer?: "sweet" | "easy" | "quality";
  avoidCrossCampus?: boolean;
}): Promise<ScheduleResult> {
  const semester = args.semester ?? (await latestSemester());
  if (!semester) return { error: "NO_SEMESTER", message: "目前沒有可用的學期資料。" };

  const supabase = await createClient();

  // Resolve a department name keyword to its code (keeps the candidate pool small).
  let deptCode: string | undefined;
  if (args.department) {
    const { data } = await supabase.rpc("facet_departments", {
      p_sem: semester,
      p_level: null,
      p_dn: null,
      p_campus: null,
    });
    const facets = (data ?? []) as { code: string; name: string }[];
    const kw = args.department.replace(/系所$|學系$|系$/u, "").trim();
    const hit =
      facets.find((f) => f.name === args.department) ??
      facets.find((f) => f.name.includes(kw) || (kw.length > 0 && kw.includes(f.name)));
    deptCode = hit?.code;
    if (!deptCode)
      return {
        error: "DEPT_NOT_FOUND",
        message: `找不到系所「${args.department}」，請確認名稱（可參考課程列表的系所名稱）。`,
      };
  }

  const list = await listCourses({ semester, dept: deptCode, pageSize: 300 });
  const sums = await fetchSummaries(list.items.map((c) => c.courseKey).filter(Boolean));

  const tags = args.tags?.filter(Boolean) ?? [];
  const prefDim: keyof AiRating =
    args.prefer === "sweet" ? "sweetness" : args.prefer === "easy" ? "coolness" : "quality";

  const candidates = list.items
    .map((c) => {
      const o = c.offerings[0];
      if (!o) return null;
      const s = sums.get(c.courseKey);
      const rating = s?.rating ?? null;
      const tagCounts = s?.tags ?? {};
      const prefVal = (rating?.[prefDim] as number | null) ?? 0;
      const tagBonus = tags.reduce((n, t) => n + ((tagCounts[t] ?? 0) > 0 ? 3 : 0), 0);
      const reviewBonus = Math.min(rating?.reviewCount ?? 0, 5) * 0.1;
      const loadPenalty =
        args.prefer === "easy" && rating?.loading != null ? (5 - rating.loading) * 0.2 : 0;
      return {
        courseKey: c.courseKey,
        courseCode: c.courseCode,
        syllabusNo: o.syllabusNo,
        name: c.name,
        teachers: o.teachers.length ? o.teachers : c.teachers,
        classroom: o.classroom,
        campus: o.campus ?? null,
        semesterId: o.semesterId,
        slots: o.slots,
        credits: c.credits,
        rating,
        tags: tagCounts,
        score: prefVal + tagBonus + reviewBonus + loadPenalty,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const { chosen, totalCredits } = buildSchedule(candidates, {
    freeWeekdays: args.freeWeekdays,
    targetCredits: args.targetCredits,
    avoidCrossCampus: args.avoidCrossCampus,
    periodOrder: PERIOD_ORDER,
  });

  const courses: ScheduleCourse[] = chosen.map(({ score, ...rest }) => {
    void score;
    return rest;
  });

  const target = args.targetCredits ?? 15;
  const note =
    courses.length === 0
      ? "找不到符合條件的課（可能空堂日限制太嚴，或該系所可排的課太少）。可放寬條件再試。"
      : totalCredits < target
        ? `這是一個可行組合，但只湊到 ${totalCredits} 學分（候選課有限）。可放寬條件或自行增減。`
        : "這是一個可行的建議組合，你可以再自行調整。";

  return { kind: "schedule", semester, totalCredits, courses, note };
}
