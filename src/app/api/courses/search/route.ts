import { NextResponse, type NextRequest } from "next/server";
import { listCourses, latestSemester } from "@/lib/data/courses";

/** Lightweight course search for the timetable add-panel (single semester). */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  // Timetables are semester-scoped: default to the latest term so we don't pull
  // cross-semester offerings (that path is for the /courses browse search).
  const semester = searchParams.get("semester") ?? (await latestSemester()) ?? undefined;
  if (q.trim().length < 1) return NextResponse.json({ items: [] });

  const result = await listCourses({ q, semester, pageSize: 20 });
  const items = result.items.map((c) => {
    const o = c.offerings[0];
    return {
      courseCode: c.courseCode,
      courseKey: c.courseKey,
      name: c.name,
      teachers: c.teachers,
      credits: c.credits,
      syllabusNo: o.syllabusNo,
      semesterId: o.semesterId,
      classroom: o.classroom,
      classTimeRaw: o.classTimeRaw,
      slots: o.slots,
    };
  });
  return NextResponse.json({ items });
}
