import "server-only";
import type { CourseGroup, Offering } from "./types";
import { createClient } from "@/lib/supabase/server";
import { DEGREE_LEVELS } from "@/lib/config";
import fixtureJson from "@/data/fixture-courses.json";

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes("placeholder");
}

const FIXTURE = fixtureJson as unknown as Offering[];

export type CourseRow = {
  id?: string;
  syllabus_no: string | null;
  course_key: string | null;
  teacher_key: string | null;
  course_code: string;
  name: string;
  name_en: string | null;
  credits: number | null;
  course_type: string | null;
  category: string | null;
  department_code: string | null;
  class_name: string | null;
  class_code: string | null;
  semester_id: string;
  campus: string | null;
  day_night: string | null;
  class_time_raw: string | null;
  slots: { weekday: number; period: string }[] | null;
  classroom: string | null;
  enroll_count: number | null;
  enroll_cap: number | null;
  syllabus_url: string | null;
  degree_level: string | null;
  teacher_names: string[] | null;
  departments?: { name: string } | null;
};

export function rowToOffering(r: CourseRow): Offering {
  return {
    id: r.id,
    syllabusNo: r.syllabus_no,
    courseKey: r.course_key ?? "",
    teacherKey: r.teacher_key ?? "",
    courseCode: r.course_code,
    name: r.name,
    nameEn: r.name_en,
    credits: r.credits,
    courseType: r.course_type,
    category: r.category,
    className: r.class_name,
    teachers: r.teacher_names ?? [],
    classTimeRaw: r.class_time_raw,
    slots: r.slots ?? [],
    classroom: r.classroom,
    campus: r.campus ?? null,
    enrollCount: r.enroll_count,
    enrollCap: r.enroll_cap,
    syllabusUrl: r.syllabus_url,
    semesterId: r.semester_id,
    departmentCode: r.department_code ?? "",
    departmentName: r.departments?.name ?? "",
    classCode: r.class_code ?? null,
    degreeLevel: r.degree_level ?? null,
    dayNight: r.day_night ?? null,
  };
}

export const SELECT = "*, departments(name)";

/**
 * A logical course is identified by (course_code, name): NKNU reuses a code for
 * different courses across years, so grouping by code alone produces false
 * 開課紀錄. Same code + same name across semesters/classes = one course.
 */
/**
 * Group offerings into courses. Two modes:
 *  - "logical" (default): by course_key (dept+name+teacher) — merges a course's
 *    history across years/codes. Used for the detail page and search results.
 *  - "code": by 開課代號 (course_code+name) — one card per code, mirroring the
 *    school's per-semester 開課 list. Each card still carries its logical
 *    course_key for the link. Used for single-semester browsing.
 */
export function groupCourses(
  offerings: Offering[],
  mode: "logical" | "code" = "logical",
): CourseGroup[] {
  const map = new Map<string, Offering[]>();
  for (const o of offerings) {
    const k =
      mode === "code"
        ? `${o.courseCode} ${o.name}`
        : o.courseKey || `${o.courseCode} ${o.name}`;
    const arr = map.get(k) ?? [];
    arr.push(o);
    map.set(k, arr);
  }
  const groups: CourseGroup[] = [];
  for (const offs of map.values()) {
    const sorted = [...offs].sort((a, b) => b.semesterId.localeCompare(a.semesterId));
    const latest = sorted[0];
    groups.push({
      courseKey: latest.courseKey,
      courseCode: latest.courseCode,
      name: latest.name,
      nameEn: latest.nameEn,
      credits: latest.credits,
      departments: [...new Set(offs.map((o) => o.departmentName).filter(Boolean))],
      teachers: [...new Set(offs.flatMap((o) => o.teachers))],
      degreeLevel: latest.degreeLevel,
      latestSemester: latest.semesterId,
      offerings: sorted,
      summary: null,
    });
  }
  return groups;
}

export type Facet = { code: string; name: string };
export type CourseListParams = {
  q?: string;
  semester?: string;
  dayNight?: string;
  campus?: string;
  level?: string; // degree_level_code
  dept?: string; // department_code
  classCode?: string;
  page?: number;
  pageSize?: number;
};
export type CourseListResult = {
  items: CourseGroup[];
  total: number;
  page: number;
  pageSize: number;
  semesters: string[];
  levels: Facet[];
  departments: Facet[];
  classes: Facet[];
};

const LEVEL_FACETS: Facet[] = DEGREE_LEVELS.map((l) => ({ code: l.code, name: l.name }));

/** The most recent semester id (e.g. "114-1"), or null if unconfigured/empty. */
export async function latestSemester(): Promise<string | null> {
  // Prefer the latest MAIN term (1/2). The summer term (`-3`) sorts highest but
  // has only a handful of courses, so it's a bad default for search/browse.
  const pickMain = (ids: string[]) => ids.find((id) => !id.endsWith("-3")) ?? ids[0] ?? null;
  if (!isSupabaseConfigured()) {
    return pickMain([...FIXTURE.map((o) => o.semesterId)].sort((a, b) => b.localeCompare(a)));
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("semesters")
    .select("id")
    .order("id", { ascending: false });
  return pickMain((data ?? []).map((s) => s.id as string));
}

/**
 * Timetable search — scope to a TERM (1/2/3) across ALL academic years, deduped
 * to the latest offering per logical course, ranked by the trigram search. Lets
 * the add-panel find courses by term without being trapped in one specific year.
 */
export async function searchTimetableCourses(q: string, term: string, limit = 40): Promise<CourseGroup[]> {
  if (!isSupabaseConfigured() || !q.trim()) return [];
  const supabase = await createClient();
  const { data: semRows } = await supabase.from("semesters").select("id");
  const sems = (semRows ?? []).map((s) => s.id as string).filter((id) => id.split("-")[1] === term);
  if (!sems.length) return [];

  const { data: ranked } = await supabase.rpc("search_courses", { p_q: q.trim(), p_limit: 150 });
  const keys = ((ranked ?? []) as { course_key: string }[]).map((r) => r.course_key);
  if (!keys.length) return [];
  const order = new Map(keys.map((k, i) => [k, i] as const));

  const offerings: Offering[] = [];
  for (let i = 0; i < keys.length; i += 150) {
    const chunk = keys.slice(i, i + 150);
    const { data } = await supabase
      .from("courses")
      .select(SELECT)
      .in("course_key", chunk)
      .in("semester_id", sems);
    offerings.push(...(data ?? []).map((r) => rowToOffering(r as unknown as CourseRow)));
  }
  const groups = groupCourses(offerings, "logical"); // one card per logical course, latest offering first
  groups.sort((a, b) => (order.get(a.courseKey) ?? 1e9) - (order.get(b.courseKey) ?? 1e9));
  return groups.slice(0, limit);
}

export async function listCourses(params: CourseListParams): Promise<CourseListResult> {
  if (!isSupabaseConfigured()) return listFromFixture(params);
  const { q, dayNight, campus, level, dept, classCode, page = 1, pageSize = 24 } = params;
  const supabase = await createClient();

  const { data: semRows } = await supabase
    .from("semesters")
    .select("id")
    .order("id", { ascending: false });
  const semesters = (semRows ?? []).map((s) => s.id as string);
  const sem = params.semester || semesters[0];

  // A free-text query (with no explicit semester chosen) searches across ALL
  // semesters, ranked by trigram similarity — see migration 0012.
  if (q && q.trim() && !params.semester) {
    return searchCoursesRanked({ q: q.trim(), dayNight, campus, level, dept, page, pageSize }, {
      semesters,
      supabase,
    });
  }

  // Cascading facets (DISTINCT server-side via RPC).
  const [{ data: deptRows }, classRes] = await Promise.all([
    supabase.rpc("facet_departments", {
      p_sem: sem,
      p_level: level ?? null,
      p_dn: dayNight ?? null,
      p_campus: campus ?? null,
    }),
    dept
      ? supabase.rpc("facet_classes", {
          p_sem: sem,
          p_level: level ?? null,
          p_dn: dayNight ?? null,
          p_campus: campus ?? null,
          p_dept: dept,
        })
      : Promise.resolve({ data: [] as Facet[] }),
  ]);
  const departments = (deptRows ?? []) as Facet[];
  const classes = (classRes.data ?? []) as Facet[];

  // Fetch matching offerings (server-side filters), paged past the 1000 cap.
  let offerings: Offering[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from("courses")
      .select(SELECT)
      .eq("semester_id", sem)
      .order("course_code")
      .range(from, from + PAGE - 1);
    if (dayNight) query = query.eq("day_night", dayNight);
    if (campus) query = query.eq("campus", campus);
    // 學制/系所/班級 are M:N memberships (一門課可掛多個班級/系所/學制).
    if (level) query = query.contains("degree_level_codes", [level]);
    if (dept) query = query.contains("department_codes", [dept]);
    if (classCode) query = query.contains("class_codes", [classCode]);
    const { data } = await query;
    const batch = (data ?? []).map((r) => rowToOffering(r as unknown as CourseRow));
    offerings.push(...batch);
    if (batch.length < PAGE) break;
  }

  if (q) {
    const n = q.trim().toLowerCase();
    offerings = offerings.filter(
      (o) =>
        o.name.toLowerCase().includes(n) ||
        (o.nameEn ?? "").toLowerCase().includes(n) ||
        o.courseCode.toLowerCase().includes(n) ||
        o.teachers.some((t) => t.toLowerCase().includes(n)),
    );
  }

  const groups = groupCourses(offerings, "code").sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  const start = (page - 1) * pageSize;
  return {
    items: groups.slice(start, start + pageSize),
    total: groups.length,
    page,
    pageSize,
    semesters,
    levels: LEVEL_FACETS,
    departments,
    classes,
  };
}

type RankedDeps = {
  semesters: string[];
  supabase: Awaited<ReturnType<typeof createClient>>;
};

/** Cross-semester, trigram-ranked search (migration 0012 `search_courses`). */
async function searchCoursesRanked(
  p: {
    q: string;
    dayNight?: string;
    campus?: string;
    level?: string;
    dept?: string;
    page: number;
    pageSize: number;
  },
  deps: RankedDeps,
): Promise<CourseListResult> {
  const { supabase, semesters } = deps;
  const { data: ranked } = await supabase.rpc("search_courses", { p_q: p.q, p_limit: 90 });
  const rows = (ranked ?? []) as { course_key: string; rank: number }[];
  const rankOf = new Map(rows.map((r, i) => [r.course_key, { rank: r.rank, order: i }]));
  const keys = rows.map((r) => r.course_key);

  const offerings: Offering[] = [];
  if (keys.length) {
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      let query = supabase
        .from("courses")
        .select(SELECT)
        .in("course_key", keys)
        .order("semester_id", { ascending: false })
        .range(from, from + PAGE - 1);
      if (p.dayNight) query = query.eq("day_night", p.dayNight);
      if (p.campus) query = query.eq("campus", p.campus);
      if (p.level) query = query.contains("degree_level_codes", [p.level]);
      if (p.dept) query = query.contains("department_codes", [p.dept]);
      const { data } = await query;
      const batch = (data ?? []).map((r) => rowToOffering(r as unknown as CourseRow));
      offerings.push(...batch);
      if (batch.length < PAGE) break;
    }
  }

  const groups = groupCourses(offerings).sort((a, b) => {
    const ra = rankOf.get(a.courseKey)?.order ?? Infinity;
    const rb = rankOf.get(b.courseKey)?.order ?? Infinity;
    return ra - rb;
  });

  // Departments present in the result set (so the filter still offers a choice).
  const departments = [
    ...new Map(
      offerings.filter((o) => o.departmentCode).map((o) => [o.departmentCode, o.departmentName]),
    ).entries(),
  ].map(([code, name]) => ({ code, name }));

  const start = (p.page - 1) * p.pageSize;
  return {
    items: groups.slice(start, start + p.pageSize),
    total: groups.length,
    page: p.page,
    pageSize: p.pageSize,
    semesters,
    levels: LEVEL_FACETS,
    departments,
    classes: [],
  };
}

export type CourseSibling = { courseKey: string; name: string; relation: "next" | "prev" };

/**
 * For a year-long course's (一)/(二) half, find the other half's course page.
 * Pairing is conservative to avoid the false-positives that bit course_code:
 *   1) same department + the swapped name (safe, ~85% of cases);
 *   2) else a globally UNIQUE swapped-name match (recovers cross-listed halves
 *      like 室內樂…(一)/(二) under sibling dept codes, while skipping ambiguous
 *      names such as 微積分(二) that exist in many departments).
 * Only year-long courses (category 'Y') are linked.
 */
export async function getCourseSibling(course: CourseGroup): Promise<CourseSibling | null> {
  if (!isSupabaseConfigured()) return null;
  if (!course.offerings.some((o) => o.category === "Y")) return null;

  const name = course.name;
  const mOne = name.match(/^(.*?)[(（]一[)）]\s*$/);
  const mTwo = name.match(/^(.*?)[(（]二[)）]\s*$/);
  let base: string;
  let relation: "next" | "prev";
  if (mOne) { base = mOne[1]; relation = "next"; }
  else if (mTwo) { base = mTwo[1]; relation = "prev"; }
  else return null;

  const target = relation === "next" ? "二" : "一";
  const siblingName = `${base}(${target})`;
  const variants = [siblingName, `${base}（${target}）`]; // half- and full-width parens

  const supabase = await createClient();
  const deptCodes = [...new Set(course.offerings.map((o) => o.departmentCode).filter(Boolean))];

  // Tier 1: same department.
  if (deptCodes.length) {
    const { data } = await supabase
      .from("courses")
      .select("course_key, name")
      .in("name", variants)
      .in("department_code", deptCodes)
      .limit(5);
    const keys = [...new Set((data ?? []).map((r) => r.course_key as string))];
    if (keys.length === 1) return { courseKey: keys[0], name: (data![0].name as string), relation };
  }

  // Tier 2: globally unique swapped-name match.
  const { data } = await supabase
    .from("courses")
    .select("course_key, name")
    .in("name", variants)
    .limit(10);
  const keys = [...new Set((data ?? []).map((r) => r.course_key as string))];
  if (keys.length === 1) return { courseKey: keys[0], name: (data![0].name as string), relation };

  return null;
}

/** Resolve a logical course by its stable course_key (see migration 0008). */
export async function getCourse(courseKey: string): Promise<CourseGroup | null> {
  if (!isSupabaseConfigured()) {
    const offs = FIXTURE.filter((o) => o.courseKey === courseKey);
    return offs.length ? groupCourses(offs)[0] : null;
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select(SELECT)
    .eq("course_key", courseKey)
    .order("semester_id", { ascending: false });
  const offs = (data ?? []).map((r) => rowToOffering(r as unknown as CourseRow));
  if (offs.length === 0) return null;
  return groupCourses(offs)[0];
}

// ── Fixture fallback ──
function listFromFixture(params: CourseListParams): CourseListResult {
  const { q, semester, dept, page = 1, pageSize = 24 } = params;
  const semesters = [...new Set(FIXTURE.map((o) => o.semesterId))].sort((a, b) => b.localeCompare(a));
  const sem = semester || semesters[0];
  let offerings = FIXTURE.filter((o) => o.semesterId === sem);
  const departments = [
    ...new Map(offerings.map((o) => [o.departmentCode, o.departmentName])).entries(),
  ].map(([code, name]) => ({ code, name }));
  if (dept) offerings = offerings.filter((o) => o.departmentCode === dept);
  if (q) {
    const n = q.trim().toLowerCase();
    offerings = offerings.filter(
      (o) => o.name.toLowerCase().includes(n) || o.courseCode.toLowerCase().includes(n),
    );
  }
  const groups = groupCourses(offerings, "code").sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  const start = (page - 1) * pageSize;
  return {
    items: groups.slice(start, start + pageSize),
    total: groups.length,
    page,
    pageSize,
    semesters,
    levels: LEVEL_FACETS,
    departments,
    classes: [],
  };
}
