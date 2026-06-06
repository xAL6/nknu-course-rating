import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CourseRecord } from "./nknu.js";
import { SEMESTER_TERMS } from "./terms.js";

type Enriched = CourseRecord & {
  semesterId: string;
  departmentCode: string;
  departmentName: string;
  degreeLevel?: string;
  degreeLevelCode?: string;
  dayNight?: string;
  classCode?: string | null;
  departmentCodes?: string[];
  departmentNames?: string[];
  classCodes?: string[];
  classNames?: string[];
  degreeLevelCodes?: string[];
};

function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes("placeholder")) {
    throw new Error("Supabase not configured. Set env in .env.local, or use --dump.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export async function upsertCourses(records: Enriched[]) {
  const db = admin();

  // semesters
  const semesters = new Map<string, { id: string; year: number; term: number; label: string }>();
  for (const r of records) {
    if (!semesters.has(r.semesterId)) {
      const [y, t] = r.semesterId.split("-");
      semesters.set(r.semesterId, {
        id: r.semesterId,
        year: Number(y),
        term: Number(t),
        label: `${y} 學年 ${SEMESTER_TERMS[t] ?? t}`,
      });
    }
  }
  await db.from("semesters").upsert([...semesters.values()], { onConflict: "id" });

  // departments — include every membership code (合班 / 學院開課 cross-listings).
  const depts = new Map<string, { code: string; name: string }>();
  for (const r of records) {
    depts.set(r.departmentCode, { code: r.departmentCode, name: r.departmentName });
    const codes = r.departmentCodes ?? [];
    const names = r.departmentNames ?? [];
    codes.forEach((code, i) => depts.set(code, { code, name: names[i] ?? code }));
  }
  await db.from("departments").upsert([...depts.values()], { onConflict: "code" });

  // courses — teachers stored denormalized as an array (co-teaching safe).
  const rows = records.map((r) => ({
    syllabus_no: r.syllabusNo,
    course_code: r.courseCode,
    name: r.name,
    name_en: r.nameEn,
    credits: r.credits,
    course_type: r.courseType,
    category: r.category,
    department_code: r.departmentCode,
    class_name: r.className,
    class_code: r.classCode ?? null,
    semester_id: r.semesterId,
    degree_level: r.degreeLevel ?? null,
    degree_level_code: r.degreeLevelCode ?? null,
    day_night: r.dayNight ?? null,
    department_codes: r.departmentCodes ?? (r.departmentCode ? [r.departmentCode] : []),
    class_codes: r.classCodes ?? (r.classCode ? [r.classCode] : []),
    class_names: r.classNames ?? (r.className ? [r.className] : []),
    degree_level_codes: r.degreeLevelCodes ?? (r.degreeLevelCode ? [r.degreeLevelCode] : []),
    teacher_names: r.teachers ?? [],
    class_time_raw: r.classTimeRaw,
    slots: r.slots,
    classroom: r.classroom,
    enroll_count: r.enrollCount,
    enroll_cap: r.enrollCap,
    syllabus_url: r.syllabusUrl,
    updated_at: new Date().toISOString(),
  }));
  for (const batch of chunk(rows.filter((c) => c.syllabus_no), 500)) {
    const { error } = await db.from("courses").upsert(batch, { onConflict: "syllabus_no" });
    if (error) throw error;
  }
}
