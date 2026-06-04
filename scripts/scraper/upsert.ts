import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CourseRecord } from "./nknu.js";
import { SEMESTER_TERMS } from "./terms.js";

type Enriched = CourseRecord & {
  semesterId: string;
  departmentCode: string;
  departmentName: string;
};

function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes("placeholder")) {
    throw new Error(
      "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, or use --dump.",
    );
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

  // 1) semesters
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

  // 2) departments
  const depts = new Map<string, { code: string; name: string }>();
  for (const r of records) depts.set(r.departmentCode, { code: r.departmentCode, name: r.departmentName });
  await db.from("departments").upsert([...depts.values()], { onConflict: "code" });

  // 3) teachers (dedupe by name) -> id map
  const names = [...new Set(records.flatMap((r) => r.teachers))].filter(Boolean);
  for (const batch of chunk(names.map((name) => ({ name })), 500)) {
    await db.from("teachers").upsert(batch, { onConflict: "name", ignoreDuplicates: true });
  }
  const teacherId = new Map<string, string>();
  for (const batch of chunk(names, 300)) {
    const { data } = await db.from("teachers").select("id,name").in("name", batch);
    for (const t of data ?? []) teacherId.set(t.name, t.id);
  }

  // 4) courses (upsert by syllabus_no) -> id map for linking teachers
  const courseRows = records.map((r) => ({
    syllabus_no: r.syllabusNo,
    course_code: r.courseCode,
    name: r.name,
    name_en: r.nameEn,
    credits: r.credits,
    course_type: r.courseType,
    category: r.category,
    department_code: r.departmentCode,
    class_name: r.className,
    semester_id: r.semesterId,
    class_time_raw: r.classTimeRaw,
    slots: r.slots,
    classroom: r.classroom,
    enroll_count: r.enrollCount,
    enroll_cap: r.enrollCap,
    syllabus_url: r.syllabusUrl,
    updated_at: new Date().toISOString(),
  }));
  for (const batch of chunk(courseRows.filter((c) => c.syllabus_no), 500)) {
    const { error } = await db.from("courses").upsert(batch, { onConflict: "syllabus_no" });
    if (error) throw error;
  }

  // 5) course_teachers links
  const syllabusNos = [...new Set(records.map((r) => r.syllabusNo).filter(Boolean))] as string[];
  const courseId = new Map<string, string>();
  for (const batch of chunk(syllabusNos, 300)) {
    const { data } = await db.from("courses").select("id,syllabus_no").in("syllabus_no", batch);
    for (const c of data ?? []) courseId.set(c.syllabus_no, c.id);
  }
  const links: { course_id: string; teacher_id: string }[] = [];
  for (const r of records) {
    if (!r.syllabusNo) continue;
    const cid = courseId.get(r.syllabusNo);
    if (!cid) continue;
    for (const name of r.teachers) {
      const tid = teacherId.get(name);
      if (tid) links.push({ course_id: cid, teacher_id: tid });
    }
  }
  for (const batch of chunk(links, 500)) {
    await db.from("course_teachers").upsert(batch, { onConflict: "course_id,teacher_id", ignoreDuplicates: true });
  }
}
