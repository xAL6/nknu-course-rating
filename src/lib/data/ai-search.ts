import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listCourses, getCourse, latestSemester } from "./courses";
import { getReviews } from "./reviews";
import { fillRate, avgFillRate } from "@/lib/enrollment";
import { formatSlots } from "@/lib/schedule";
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
  /** 必修／選修／通識… （最新一次開課）。 */
  courseType: string | null;
  /** 是否為學年課（需上下學期連修）。 */
  yearLong: boolean;
  /** 學制：大學部／碩士班／博士班… */
  degreeLevel: string | null;
  /** 日間／進修。 */
  dayNight: string | null;
  /** 開課班級／年級，例如「軟體工程與管理學系四年級」。 */
  className: string | null;
  /** 上課時間（最新一次開課），例如「週三 3,4」；無資料為「時間未定」。 */
  classTime: string;
  /** 上課教室與校區（最新一次開課）。 */
  classroom: string | null;
  campus: string | null;
  /** 評價則數（彙總）。 */
  reviewCount: number;
  rating: AiRating | null;
  /** Aggregated quick-tag counts across this course's teachers, e.g. {可加簽: 12}. */
  tags: Record<string, number>;
  /** 選課人數 / 名額 of the latest offering (搶課熱度); null when unknown. */
  enrollFillRate: number | null;
};

const dnLabel = (d: string | null | undefined) => (d === "N" ? "進修" : d === "D" ? "日間" : null);

/**
 * Resolve a department name/keyword → its row, preferring the 大學部 dept and,
 * among equal candidates, the SHORTEST name (so 「教育系」→「教育學系」, not
 * 「特殊教育學系」). Sourced from the authoritative `departments` table.
 */
async function resolveDept(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: string,
): Promise<{ code: string; name: string } | null> {
  const { data } = await supabase.from("departments").select("code, name");
  const depts = (data ?? []) as { code: string; name: string }[];
  const isGrad = (n: string) => /碩|博|在職|進修|學分班|專班|研究所/.test(n);
  const isProgram = (n: string) => /學程|專長|院課程|校區|軍訓|通識/.test(n);
  const kw = input.replace(/系所?$|學系$|學程$|所$/u, "").trim();

  // exact name wins outright
  const exact = depts.find((d) => d.name === input);
  if (exact) return exact;
  if (!kw) return null;

  // kw's chars must appear IN ORDER in the name — so 「特教」 matches 特[殊]教[育]學系,
  // but 「資工」 does NOT match …工程…資訊… (wrong order). This stops the old any-order
  // char-subset fallback from confidently mis-resolving (特教→特教學程, 資工→某碩士班).
  const subseq = (q: string, n: string) => {
    let i = 0;
    for (const ch of n) if (ch === q[i]) i++;
    return i === q.length;
  };
  const pick = (arr: { code: string; name: string }[]) => {
    let c = arr.filter((d) => d.name.includes(kw) || kw.includes(d.name));
    if (!c.length) c = arr.filter((d) => subseq(kw, d.name));
    return c.sort((a, b) => a.name.length - b.name.length)[0] ?? null; // shortest = most specific dept
  };

  // Prefer a real undergraduate 學系; only fall back to grad/programs by substring
  // (never subsequence), so an abbreviation can't confidently land on a 碩/博/學程.
  const real = pick(depts.filter((d) => !isGrad(d.name) && !isProgram(d.name)));
  if (real) return real;
  return depts.filter((d) => d.name.includes(kw)).sort((a, b) => a.name.length - b.name.length)[0] ?? null;
}

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

// Absolute course-page URL for the AI to link to. Returning a FULL url (not a
// relative /course/… path) matters: given only a relative path, the model kept
// "helpfully" prepending an invented domain (nkust.cc, nknu.red, …). A complete
// https URL leaves nothing to fabricate. encodeURIComponent leaves ()!*'~
// unescaped — and a literal ) closes a Markdown link early — so encode parens too.
const SITE_BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
function coursePath(courseKey: string): string {
  const path = "/course/" + encodeURIComponent(courseKey).replace(/\(/g, "%28").replace(/\)/g, "%29");
  return SITE_BASE ? SITE_BASE + path : path;
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
  const o = c.offerings[0];
  return {
    courseKey: c.courseKey,
    url: coursePath(c.courseKey),
    courseCode: c.courseCode,
    name: c.name,
    nameEn: c.nameEn,
    teachers: c.teachers,
    credits: c.credits,
    departments: c.departments,
    latestSemester: c.latestSemester,
    courseType: o?.courseType ?? null,
    yearLong: o?.category === "Y",
    degreeLevel: o?.degreeLevel ?? c.degreeLevel ?? null,
    dayNight: dnLabel(o?.dayNight),
    className: o?.className ?? null,
    classTime: formatSlots(o?.slots ?? []),
    classroom: o?.classroom ?? null,
    campus: o?.campus ?? null,
    reviewCount: s?.rating?.reviewCount ?? 0,
    rating: exposeRating(s?.rating),
    tags: s?.tags ?? {},
    enrollFillRate: fillRate(o?.enrollCount, o?.enrollCap),
  };
}

/**
 * Retrieval for the AI advisor: keyword-search courses, attach rating
 * summaries, quick tags, and 搶課熱度. Optionally filter to courses carrying
 * ALL of `opts.tags`. Returns compact records the model can reason over (RAG).
 */
/**
 * Real 通識（博雅）electives live under the 通識 departments (GR8xx, varied names),
 * NOT under the literal name「通識教育」(which is each dept's placeholder slot). A
 * keyword search for「通識」would only hit the placeholders, so route gen-ed asks
 * to the actual 通識 departments instead.
 */
async function genEdCourses(): Promise<CourseGroup[]> {
  const supabase = await createClient();
  const semester = await latestSemester();
  if (!semester) return [];
  // Authoritative 通識 dept codes from the departments table (covers BOTH 和平 +
  // 燕巢, even when a course carries the dept only in its membership array).
  const { data: deptRows } = await supabase.from("departments").select("code, name").ilike("name", "%通識%");
  const codes = ((deptRows ?? []) as { code: string; name: string }[]).map((d) => d.code);
  const lists: CourseGroup[][] = [];
  for (const code of codes) {
    const r = await listCourses({ semester, dept: code, pageSize: 300, withFacets: false });
    lists.push(r.items.filter((g) => g.name !== "通識教育"));
  }
  // Round-robin interleave so neither campus dominates the head (a later slice
  // must not drop one whole campus).
  const out: CourseGroup[] = [];
  const seen = new Set<string>();
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const g = l[i];
      if (!g) continue;
      const k = g.courseKey + "|" + g.courseCode;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(g);
      }
    }
  }
  return out;
}

export async function retrieveCourses(
  query: string,
  department?: string,
  opts?: { tags?: string[]; campus?: string },
): Promise<AiCourseResult[]> {
  const tags = opts?.tags?.filter(Boolean) ?? [];
  const campus = opts?.campus;
  // 通識／博雅 category asks → list real gen-ed electives, not a「通識」name search.
  const isGenEd = /通識|博雅|通才/.test(query) && !department;
  let items = isGenEd
    ? await genEdCourses()
    : (await listCourses({ q: query, dept: department, campus, pageSize: tags.length ? 36 : 12, withFacets: false })).items;
  if (campus && isGenEd) items = items.filter((g) => g.offerings[0]?.campus === campus);
  const sums = await fetchSummaries(items.map((c) => c.courseKey).filter(Boolean));

  const courses = items.map((c) => toAiResult(c, sums.get(c.courseKey)));
  if (tags.length) {
    const tagged = courses.filter((c) => tags.every((t) => (c.tags[t] ?? 0) > 0));
    // Few courses carry tags (UGC is sparse). Returning only tagged hits makes the
    // model keep re-searching; so when tagged results are thin, also include the
    // top keyword matches (the model can see which actually carry the tag).
    if (tagged.length >= 4) return tagged.slice(0, 12);
    const rest = courses.filter((c) => !tagged.includes(c)).slice(0, 12);
    return [...tagged, ...rest].slice(0, 14);
  }
  return courses.slice(0, 16);
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

  // 2) resolve department name → code (prefer 大學部, shortest-name tiebreak)
  const dept = await resolveDept(supabase, args.department);
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
      const r = await listCourses({ semester, dept: dept.code, classCode: cc, pageSize: 500, withFacets: false });
      for (const g of r.items) groups.set(g.courseKey + "|" + g.courseCode, g);
    }
  } else {
    const r = await listCourses({ semester, dept: dept.code, pageSize: 500, withFacets: false });
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
  courseType: string | null;
  yearLong: boolean;
  degreeLevel: string | null;
  className: string | null;
  /** 上課時間（最新一次開課），例如「週三 3,4」。 */
  classTime: string;
  classroom: string | null;
  campus: string | null;
  syllabusUrl: string | null;
  /** 各學期的上課時間/教室/老師/日夜/選課率（新到舊），回答「歷年/某學期」用。 */
  offerings: {
    semester: string;
    classTime: string;
    classroom: string | null;
    campus: string | null;
    teachers: string[];
    courseType: string | null;
    dayNight: string | null;
    enrollFillRate: number | null;
    syllabusUrl: string | null;
  }[];
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

  const offs = [...course.offerings].sort((a, b) => b.semesterId.localeCompare(a.semesterId));
  const latest = offs[0];
  const offerings = offs.slice(0, 6).map((o) => ({
    semester: o.semesterId,
    classTime: formatSlots(o.slots),
    classroom: o.classroom,
    campus: o.campus ?? null,
    teachers: o.teachers,
    courseType: o.courseType ?? null,
    dayNight: dnLabel(o.dayNight),
    enrollFillRate: fillRate(o.enrollCount, o.enrollCap),
    syllabusUrl: o.syllabusUrl ?? null,
  }));

  return {
    courseKey,
    url: coursePath(courseKey),
    name: course.name,
    teachers: course.teachers,
    credits: course.credits,
    departments: course.departments,
    semesters: [...new Set(offs.map((o) => o.semesterId))],
    courseType: latest?.courseType ?? null,
    yearLong: latest?.category === "Y",
    degreeLevel: latest?.degreeLevel ?? course.degreeLevel ?? null,
    className: latest?.className ?? null,
    classTime: formatSlots(latest?.slots ?? []),
    classroom: latest?.classroom ?? null,
    campus: latest?.campus ?? null,
    syllabusUrl: latest?.syllabusUrl ?? null,
    offerings,
    rating: exposeRating(s?.rating),
    tags: s?.tags ?? {},
    enrollFillRate: fillRate(latest?.enrollCount, latest?.enrollCap),
    enrollAvgFillRate: avgFillRate(course.offerings).rate,
    reviewCount: s?.rating?.reviewCount ?? reviews.length,
    sampleComments,
  };
}

export type ScheduleCourse = {
  courseKey: string;
  /** Ready-to-use site course-page link — the model must link to THIS, not invent one. */
  url: string;
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
  grade?: number;
  term?: string;
  semester?: string;
  freeWeekdays?: number[];
  targetCredits?: number;
  tags?: string[];
  prefer?: "sweet" | "easy" | "quality";
  avoidCrossCampus?: boolean;
}): Promise<ScheduleResult> {
  const supabase = await createClient();

  // 1) resolve semester: explicit → latest of the asked term → latest main term.
  let semester = args.semester;
  if (!semester) {
    const { data: semRows } = await supabase.from("semesters").select("id").order("id", { ascending: false });
    const ids = (semRows ?? []).map((s) => s.id as string);
    semester = (args.term ? ids.find((id) => id.endsWith(`-${args.term}`)) : ids.find((id) => !id.endsWith("-3"))) ?? ids[0];
  }
  if (!semester) return { error: "NO_SEMESTER", message: "目前沒有可用的學期資料。" };

  // 2) resolve department (abbreviation-friendly, 大學部-preferred) — same path as
  // listDeptCourses, so 「軟工系」→「軟體工程與管理學系」 instead of DEPT_NOT_FOUND.
  let dept: { code: string; name: string } | null = null;
  if (args.department) {
    dept = await resolveDept(supabase, args.department);
    if (!dept)
      return {
        error: "DEPT_NOT_FOUND",
        message: `找不到系所「${args.department}」，請確認名稱（可參考課程列表的系所名稱）。`,
      };
  }

  // 3) grade → that year's class codes (+ all-grade electives), so 「大四」 only
  // pulls senior-level courses instead of the whole department.
  let classCodes: string[] | null = null;
  if (dept && args.grade && args.grade >= 1 && args.grade <= 7) {
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

  // 4) gather candidate offerings via the browse path (grade-scoped when known).
  const groups = new Map<string, CourseGroup>();
  if (dept && classCodes) {
    for (const cc of classCodes) {
      const r = await listCourses({ semester, dept: dept.code, classCode: cc, pageSize: 500, withFacets: false });
      for (const g of r.items) groups.set(g.courseKey + "|" + g.courseCode, g);
    }
  } else {
    const r = await listCourses({ semester, dept: dept?.code, pageSize: 300, withFacets: false });
    for (const g of r.items) groups.set(g.courseKey + "|" + g.courseCode, g);
  }
  const items = [...groups.values()];
  const sums = await fetchSummaries(items.map((c) => c.courseKey).filter(Boolean));

  const tags = args.tags?.filter(Boolean) ?? [];
  const prefDim: keyof AiRating =
    args.prefer === "sweet" ? "sweetness" : args.prefer === "easy" ? "coolness" : "quality";

  const candidates = items
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
        url: coursePath(c.courseKey),
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

// ── Ranking ("全校最甜/最涼/收穫最高/最多人評/最熱門") ───────────────────────────
export type RankedCourse = {
  url: string;
  courseKey: string;
  name: string;
  courseCode: string;
  teachers: string[];
  reviewCount: number;
  sweetness: number | null;
  coolness: number | null;
  quality: number | null;
  tags: Record<string, number>;
};

export async function topCoursesForAI(args: {
  by?: "sweet" | "cool" | "takeaway" | "reviews";
  limit?: number;
}): Promise<{ kind: "ranking"; by: string; courses: RankedCourse[] }> {
  const supabase = await createClient();
  const col =
    args.by === "cool"
      ? "avg_coolness"
      : args.by === "takeaway"
        ? "avg_quality"
        : args.by === "reviews"
          ? "review_count"
          : "avg_sweetness";
  // Rating-based rankings need a minimum sample so a single 5.0 review can't top
  // the chart; "most reviews" only needs >0.
  const minReviews = args.by === "reviews" ? 1 : 3;
  const { data } = await supabase
    .from("course_rating_summary")
    .select("course_key, teacher_key, course_code, name, review_count, avg_sweetness, avg_coolness, avg_quality, tag_counts")
    .gte("review_count", minReviews)
    .order(col, { ascending: false })
    .limit(Math.min(args.limit ?? 8, 20));
  const courses: RankedCourse[] = (data ?? []).map((s) => ({
    url: coursePath(s.course_key as string),
    courseKey: s.course_key as string,
    name: s.name as string,
    courseCode: s.course_code as string,
    teachers: (s.teacher_key as string | null) ? (s.teacher_key as string).split("、") : [],
    reviewCount: (s.review_count as number) ?? 0,
    sweetness: s.avg_sweetness as number | null,
    coolness: s.avg_coolness as number | null,
    quality: s.avg_quality as number | null,
    tags: (s.tag_counts as Record<string, number> | null) ?? {},
  }));
  return { kind: "ranking", by: args.by ?? "sweet", courses };
}

// ── By weekday / time-of-day ("週五下午有哪些涼課") ──────────────────────────────
const PERIOD_BUCKETS: Record<string, string[]> = {
  morning: ["1", "2", "3", "4"],
  afternoon: ["5", "6", "7", "8", "9", "10"],
  evening: ["A", "B", "C", "D"],
};

export async function coursesByTimeForAI(args: {
  weekday?: number;
  timeOfDay?: "morning" | "afternoon" | "evening";
  department?: string;
  prefer?: "sweet" | "cool" | "takeaway";
  limit?: number;
}): Promise<
  | { kind: "timeList"; weekday: number | null; timeOfDay: string | null; count: number; courses: AiCourseResult[] }
  | { error: string; message: string }
> {
  const supabase = await createClient();
  const semester = await latestSemester();
  if (!semester) return { error: "NO_SEMESTER", message: "目前沒有可用的學期資料。" };

  const deptCode = args.department ? (await resolveDept(supabase, args.department))?.code : undefined;

  const r = await listCourses({ semester, dept: deptCode, pageSize: 4000, withFacets: false });
  const bucket = args.timeOfDay ? PERIOD_BUCKETS[args.timeOfDay] : null;
  const wd = args.weekday;
  const matched = r.items.filter((c) =>
    (c.offerings[0]?.slots ?? []).some(
      (s) => (wd == null || Number(s.weekday) === wd) && (!bucket || bucket.includes(String(s.period))),
    ),
  );
  const sums = await fetchSummaries(matched.map((c) => c.courseKey).filter(Boolean));
  const dim: keyof AiRating = args.prefer === "sweet" ? "sweetness" : args.prefer === "takeaway" ? "quality" : "coolness";
  const courses = matched
    .map((c) => toAiResult(c, sums.get(c.courseKey)))
    .sort((a, b) => ((b.rating?.[dim] as number | null) ?? 0) - ((a.rating?.[dim] as number | null) ?? 0))
    .slice(0, 16);
  return { kind: "timeList", weekday: wd ?? null, timeOfDay: args.timeOfDay ?? null, count: courses.length, courses };
}
