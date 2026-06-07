import { NextResponse, type NextRequest } from "next/server";
import { searchTimetableCourses, latestSemester } from "@/lib/data/courses";

/** Timetable course search — scoped to a TERM (1/2/3) across all academic years. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (q.trim().length < 1) return NextResponse.json({ items: [] });

  // term: explicit ?term=1|2|3, else the latest main term.
  const term = searchParams.get("term") ?? (await latestSemester())?.split("-")[1] ?? "2";

  const groups = await searchTimetableCourses(q, term, 40);
  const items = groups.map((c) => {
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
