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
export function groupCourses(offerings: Offering[]): CourseGroup[] {
  const map = new Map<string, Offering[]>();
  for (const o of offerings) {
    const k = o.courseKey || `${o.courseCode} ${o.name}`;
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
    if (level) query = query.eq("degree_level_code", level);
    if (dept) query = query.eq("department_code", dept);
    if (classCode) query = query.eq("class_code", classCode);
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

  const groups = groupCourses(offerings).sort((a, b) => a.courseCode.localeCompare(b.courseCode));
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
  const groups = groupCourses(offerings).sort((a, b) => a.courseCode.localeCompare(b.courseCode));
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
