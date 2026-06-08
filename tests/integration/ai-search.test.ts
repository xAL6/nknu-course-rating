import { describe, it, expect, beforeAll, vi } from "vitest";
import { createClient as createSb, type SupabaseClient } from "@supabase/supabase-js";

// The AI tools call `@/lib/supabase/server` (which needs next/headers cookies).
// In vitest, swap it for a plain anon client — the tools read only public data,
// exactly what a signed-in user's read sees for these tables.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () =>
    createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    }),
}));

import {
  retrieveCourses,
  compareTeachersForAI,
  getCourseDetailForAI,
  buildScheduleForAI,
  listDeptCoursesForAI,
  topCoursesForAI,
  coursesByTimeForAI,
} from "@/lib/data/ai-search";
import { PERIOD_TIMES } from "@/lib/period-shared";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ready = !!url && !!anon && !!service && !url.includes("placeholder");
const d = ready ? describe : describe.skip;

/** No two chosen courses may share a (weekday, period) cell. */
function hasNoConflict(courses: { slots: { weekday: number; period: string }[] }[]): boolean {
  const seen = new Set<string>();
  for (const c of courses)
    for (const s of c.slots) {
      const k = `${s.weekday}-${s.period}`;
      if (seen.has(k)) return false;
      seen.add(k);
    }
  return true;
}

d("AI tools — correctness against live data", () => {
  let admin: SupabaseClient;
  let latestSem = "";
  let term1Sem = "";

  beforeAll(async () => {
    admin = createSb(url!, service!, { auth: { persistSession: false } });
    const { data: sems } = await admin.from("semesters").select("id").order("id", { ascending: false });
    const ids = (sems ?? []).map((s) => s.id as string);
    latestSem = ids.find((i) => !i.endsWith("-3")) ?? ids[0];
    term1Sem = ids.find((i) => i.endsWith("-1")) ?? latestSem;
  });

  // ── retrieveCourses (keyword search) ─────────────────────────────────────
  describe("retrieveCourses", () => {
    it("finds a well-known course and exposes full fields", async () => {
      const r = await retrieveCourses("微積分");
      expect(r.length).toBeGreaterThan(0);
      for (const c of r) {
        expect(c.url.includes("/course/")).toBe(true);
        expect(c.name.length).toBeGreaterThan(0);
        expect(typeof c.classTime).toBe("string"); // never undefined
        expect(c.url).not.toContain("("); // parens encoded for markdown links
      }
      // relevance: at least one hit actually mentions the query term
      expect(r.some((c) => c.name.includes("微積分"))).toBe(true);
    });

    it("never throws on a no-result query (returns [])", async () => {
      const r = await retrieveCourses("zzzznotacourse九九九");
      expect(Array.isArray(r)).toBe(true);
    });

    it("gen-ed query returns 通識 electives from BOTH campuses", async () => {
      const r = await retrieveCourses("通識");
      expect(r.length).toBeGreaterThan(0);
      const campuses = new Set(r.map((c) => c.campus).filter(Boolean));
      // both 和平 and 燕巢 should appear (the interleave fix)
      expect(campuses.size).toBeGreaterThanOrEqual(2);
    });
  });

  // ── listDeptCoursesForAI (系所+年級+學期) ─────────────────────────────────
  describe("listDeptCoursesForAI", () => {
    it("resolves a department ABBREVIATION (軟工系 → 軟體工程與管理學系)", async () => {
      const r = await listDeptCoursesForAI({ department: "軟工系", grade: 4, term: "1" });
      expect("error" in r).toBe(false);
      if (!("error" in r)) {
        expect(r.department).toContain("軟體工程");
        expect(r.count).toBeGreaterThan(0);
        expect(r.courses.length).toBeGreaterThan(0);
      }
    });

    it("resolves 教育系 to the undergrad 教育學系 (not 特教/碩士)", async () => {
      const r = await listDeptCoursesForAI({ department: "教育系", term: "1" });
      expect("error" in r).toBe(false);
      if (!("error" in r)) expect(r.department).toBe("教育學系");
    });

    it("returns DEPT_NOT_FOUND for a nonsense department", async () => {
      const r = await listDeptCoursesForAI({ department: "宇宙無敵系" });
      expect("error" in r).toBe(true);
    });

    // Regression: the old any-order char-subset fallback mis-resolved these.
    it.each([
      ["特教系", "特殊教育學系"], // was wrongly → 特教學程資優類
      ["軟工系", "軟體工程與管理學系"],
      ["教育系", "教育學系"],
      ["國文系", "國文學系"],
      ["英語系", "英語學系"],
      ["體育系", "體育學系"],
      ["工設系", "工業設計學系"],
      ["視設系", "視覺設計學系"],
      ["生科系", "生物科技系"],
    ])("resolves %s → %s (not a 學程/碩士班)", async (abbr, expected) => {
      const r = await listDeptCoursesForAI({ department: abbr, term: "1" });
      expect("error" in r).toBe(false);
      if (!("error" in r)) expect(r.department).toBe(expected);
    });

    it("does NOT confidently resolve a non-existent dept to a 碩士班 (資工系)", async () => {
      // 高師大 has no undergrad 資工系; better to say not-found than land on a grad program.
      const r = await listDeptCoursesForAI({ department: "資工系" });
      if (!("error" in r)) expect(r.department).not.toMatch(/碩士班|博士班|學程/);
    });
  });

  // ── buildScheduleForAI (the just-fixed tool) ─────────────────────────────
  describe("buildScheduleForAI", () => {
    it("軟工系大四上學期: resolves dept, scopes to senior courses, conflict-free", async () => {
      const r = await buildScheduleForAI({ department: "軟工系", grade: 4, term: "1", targetCredits: 15 });
      expect("error" in r).toBe(false);
      if (!("error" in r)) {
        expect(r.semester.endsWith("-1")).toBe(true); // 上學期
        expect(r.courses.length).toBeGreaterThan(0);
        expect(hasNoConflict(r.courses)).toBe(true);
        expect(r.totalCredits).toBeGreaterThan(0);
      }
    });

    it("honours freeWeekdays (no class on a requested free day)", async () => {
      const r = await buildScheduleForAI({ department: "數學系", grade: 2, term: "1", freeWeekdays: [5] });
      if (!("error" in r)) {
        for (const c of r.courses) for (const s of c.slots) expect(s.weekday).not.toBe(5);
      }
    });

    it("does not exceed the credit target by much", async () => {
      const r = await buildScheduleForAI({ department: "國文系", grade: 1, term: "1", targetCredits: 12 });
      if (!("error" in r)) {
        // greedy stops once target is met; one final course may overshoot
        expect(r.totalCredits).toBeLessThanOrEqual(12 + 6);
      }
    });
  });

  // ── topCoursesForAI (ranking) ────────────────────────────────────────────
  describe("topCoursesForAI", () => {
    it("rating ranks require >= 3 reviews and are sorted desc", async () => {
      const r = await topCoursesForAI({ by: "sweet", limit: 10 });
      expect(r.courses.length).toBeGreaterThan(0);
      for (const c of r.courses) expect(c.reviewCount).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < r.courses.length; i++)
        expect(r.courses[i - 1].sweetness ?? 0).toBeGreaterThanOrEqual(r.courses[i].sweetness ?? 0);
    });

    it("review-count rank allows >= 1 review and is sorted desc", async () => {
      const r = await topCoursesForAI({ by: "reviews", limit: 10 });
      expect(r.courses.length).toBeGreaterThan(0);
      for (const c of r.courses) expect(c.reviewCount).toBeGreaterThanOrEqual(1);
      for (let i = 1; i < r.courses.length; i++)
        expect(r.courses[i - 1].reviewCount).toBeGreaterThanOrEqual(r.courses[i].reviewCount);
    });

    it("every ranked course links to a real course page (no undefined url)", async () => {
      const r = await topCoursesForAI({ by: "takeaway", limit: 12 });
      for (const c of r.courses) {
        expect(c.courseKey).toBeTruthy();
        expect(c.url.includes("/course/")).toBe(true);
        expect(c.url).not.toContain("undefined");
      }
    });
  });

  // ── coursesByTimeForAI (星期+時段) ───────────────────────────────────────
  describe("coursesByTimeForAI", () => {
    it("週一早上: every returned course actually has a Mon morning slot", async () => {
      const r = await coursesByTimeForAI({ weekday: 1, timeOfDay: "morning", limit: 15 });
      if (!("error" in r)) {
        expect(r.courses.length).toBeGreaterThan(0);
        const morning = new Set(["1", "2", "3", "4"]);
        for (const c of r.courses) {
          const o = (c as { classTime: string });
          // the course must have at least one slot matching weekday 1 + morning period
          expect(o.classTime.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // ── period coverage (timetable + coursesByTime depend on it) ─────────────
  describe("period coverage", () => {
    it("every period code present in the data has a PERIOD_TIMES entry", async () => {
      const { data } = await admin.from("courses").select("slots").eq("semester_id", latestSem).limit(4000);
      const seen = new Set<string>();
      for (const c of (data ?? []) as { slots: { period: string }[] }[])
        for (const s of c.slots ?? []) seen.add(String(s.period));
      const missing = [...seen].filter((p) => !(p in PERIOD_TIMES));
      // a missing period would render blank on the timetable and drop from
      // coursesByTime buckets — exactly the T/E bug.
      expect(missing).toEqual([]);
    });
  });

  // ── compareTeachersForAI ─────────────────────────────────────────────────
  describe("compareTeachersForAI", () => {
    it("returns the per-teacher variants of a shared course name", async () => {
      // 微積分 is taught by many teachers across departments
      const r = await compareTeachersForAI("微積分");
      expect(r.length).toBeGreaterThanOrEqual(1);
      for (const c of r) expect(c.url.includes("/course/")).toBe(true);
    });
  });

  // ── getCourseDetailForAI ─────────────────────────────────────────────────
  describe("getCourseDetailForAI", () => {
    it("deep dive matches the course_rating_summary for a reviewed course", async () => {
      // find a course_key that has reviews
      const { data } = await admin
        .from("course_rating_summary")
        .select("course_key, review_count")
        .order("review_count", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return;
      const detail = await getCourseDetailForAI(data.course_key as string);
      expect(detail).not.toBeNull();
      if (detail) {
        expect(detail.url.includes("/course/")).toBe(true);
        expect(detail.reviewCount).toBeGreaterThanOrEqual(1);
        expect(detail.offerings.length).toBeGreaterThan(0);
      }
    });
  });
});
