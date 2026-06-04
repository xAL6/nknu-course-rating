import "server-only";
import type { CourseGroup, Offering } from "./types";
import { createClient } from "@/lib/supabase/server";
import fixtureJson from "@/data/fixture-courses.json";

/**
 * Data-access layer for courses. Uses Supabase when configured; otherwise falls
 * back to a bundled real-data fixture so the UI works pre-provisioning.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes("placeholder");
}

const FIXTURE = fixtureJson as unknown as Offering[];

// ── Row mapping (Supabase) ──
type CourseRow = {
  syllabus_no: string | null;
  course_code: string;
  name: string;
  name_en: string | null;
  credits: number | null;
  course_type: string | null;
  category: string | null;
  department_code: string | null;
  class_name: string | null;
  semester_id: string;
  campus: string | null;
  day_night: string | null;
  class_time_raw: string | null;
  slots: { weekday: number; period: string }[] | null;
  classroom: string | null;
  enroll_count: number | null;
  enroll_cap: number | null;
  syllabus_url: string | null;
  departments?: { name: string } | null;
  course_teachers?: { teachers: { name: string } | null }[];
};

function rowToOffering(r: CourseRow): Offering {
  return {
    syllabusNo: r.syllabus_no,
    courseCode: r.course_code,
    name: r.name,
    nameEn: r.name_en,
    credits: r.credits,
    courseType: r.course_type,
    category: r.category,
    className: r.class_name,
    teachers: (r.course_teachers ?? []).map((ct) => ct.teachers?.name).filter(Boolean) as string[],
    classTimeRaw: r.class_time_raw,
    slots: r.slots ?? [],
    classroom: r.classroom,
    enrollCount: r.enroll_count,
    enrollCap: r.enroll_cap,
    syllabusUrl: r.syllabus_url,
    semesterId: r.semester_id,
    departmentCode: r.department_code ?? "",
    departmentName: r.departments?.name ?? "",
  };
}

const SELECT = "*, departments(name), course_teachers(teachers(name))";

function groupByCode(offerings: Offering[]): CourseGroup[] {
  const map = new Map<string, Offering[]>();
  for (const o of offerings) {
    const arr = map.get(o.courseCode) ?? [];
    arr.push(o);
    map.set(o.courseCode, arr);
  }
  const groups: CourseGroup[] = [];
  for (const [courseCode, offs] of map) {
    const sorted = [...offs].sort((a, b) => b.semesterId.localeCompare(a.semesterId));
    const latest = sorted[0];
    groups.push({
      courseCode,
      name: latest.name,
      nameEn: latest.nameEn,
      credits: latest.credits,
      departments: [...new Set(offs.map((o) => o.departmentName).filter(Boolean))],
      teachers: [...new Set(offs.flatMap((o) => o.teachers))],
      latestSemester: latest.semesterId,
      offerings: sorted,
      summary: null,
    });
  }
  return groups;
}

export type CourseListParams = {
  q?: string;
  dept?: string;
  semester?: string;
  page?: number;
  pageSize?: number;
};

export type CourseListResult = {
  items: CourseGroup[];
  total: number;
  page: number;
  pageSize: number;
  departments: { code: string; name: string }[];
  semesters: string[];
};

export async function listCourses(params: CourseListParams): Promise<CourseListResult> {
  const { q, dept, semester, page = 1, pageSize = 24 } = params;

  if (!isSupabaseConfigured()) return listFromFixture(params);

  const supabase = await createClient();
  const [{ data: semRows }, { data: deptRows }] = await Promise.all([
    supabase.from("semesters").select("id").order("id", { ascending: false }),
    supabase.from("departments").select("code,name").order("code"),
  ]);
  const semesters = (semRows ?? []).map((s) => s.id as string);
  const departments = (deptRows ?? []).map((d) => ({ code: d.code as string, name: d.name as string }));
  const sem = semester || semesters[0];

  // Fetch all offerings for the semester in pages (PostgREST caps at 1000/req),
  // then filter by q (incl. teacher) in-memory so grouping is complete.
  let offerings: Offering[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from("courses")
      .select(SELECT)
      .eq("semester_id", sem)
      .order("course_code")
      .range(from, from + PAGE - 1);
    if (dept) query = query.eq("department_code", dept);
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

  const groups = groupByCode(offerings).sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  const start = (page - 1) * pageSize;
  return {
    items: groups.slice(start, start + pageSize),
    total: groups.length,
    page,
    pageSize,
    departments,
    semesters,
  };
}

export async function getCourse(courseCode: string): Promise<CourseGroup | null> {
  if (!isSupabaseConfigured()) {
    const offs = FIXTURE.filter((o) => o.courseCode === courseCode);
    return offs.length ? groupByCode(offs)[0] : null;
  }
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select(SELECT).eq("course_code", courseCode);
  const offs = (data ?? []).map((r) => rowToOffering(r as unknown as CourseRow));
  return offs.length ? groupByCode(offs)[0] : null;
}

// ── Fixture fallback ──
function listFromFixture(params: CourseListParams): CourseListResult {
  const { q, dept, semester, page = 1, pageSize = 24 } = params;
  const semesters = [...new Set(FIXTURE.map((o) => o.semesterId))].sort((a, b) => b.localeCompare(a));
  const departments = [
    ...new Map(FIXTURE.map((o) => [o.departmentCode, o.departmentName])).entries(),
  ].map(([code, name]) => ({ code, name }));
  const sem = semester || semesters[0];

  let offerings = FIXTURE.filter((o) => o.semesterId === sem);
  if (dept) offerings = offerings.filter((o) => o.departmentCode === dept);
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
  const groups = groupByCode(offerings).sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  const start = (page - 1) * pageSize;
  return { items: groups.slice(start, start + pageSize), total: groups.length, page, pageSize, departments, semesters };
}
