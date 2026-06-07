/**
 * Central app configuration: rating dimensions, allowed domains, feature flags.
 * Pure data — safe to import in both server and client components.
 */

export const SITE_NAME = "NKNU 選課評價";
export const SITE_NAME_EN = "NKNU Course Rating";
export const SITE_TAGLINE = "高師大學生的選課評價與排課平台";

/** Student mail domains permitted to post reviews. Confirm NKNU's real domain. */
export const ALLOWED_EMAIL_DOMAINS = (
  process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS ?? "mail.nknu.edu.tw"
)
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && ALLOWED_EMAIL_DOMAINS.includes(domain);
}

/**
 * The three rating dimensions, mirroring the classic 甜度/涼度 from the reference
 * sites plus 收穫 (how much you actually learn — stored in the `quality` column).
 * Each is scored 1–5. `higherIsBetter` controls how the aggregate color/label is
 * interpreted. NOTE: the DB still has `loading`/`grading` columns for legacy
 * rows; they're simply no longer collected or shown.
 */
export const RATING_DIMENSIONS = [
  { key: "sweetness", label: "甜度", labelEn: "Sweetness", hint: "給分甜不甜", color: "var(--accent)", higherIsBetter: true },
  { key: "coolness", label: "涼度", labelEn: "Coolness", hint: "課程輕不輕鬆", color: "var(--accent)", higherIsBetter: true },
  { key: "quality", label: "收穫", labelEn: "Takeaway", hint: "學到多少、內容紮實度", color: "var(--accent)", higherIsBetter: true },
] as const;

export type RatingDimensionKey = (typeof RATING_DIMENSIONS)[number]["key"];

/**
 * Quick tags — a controlled vocabulary of *categorical* course facts the five
 * numeric dimensions can't express (點名/加簽/考試/作業/授課形式). Students pick a
 * few when reviewing; tags are aggregated per (course, teacher), shown as chips,
 * filterable, and fed to the AI advisor (grounded RAG).
 *
 * ⚠️ Keep in sync with the CHECK constraint in
 *    supabase/migrations/0020_review_tags.sql (the exact same set of strings).
 */
export const REVIEW_TAG_GROUPS = [
  { label: "點名 / 出席", tags: ["會點名", "不點名", "點名抽人"] },
  { label: "加簽", tags: ["好加簽", "難加簽"] },
  { label: "考試 / 作業", tags: ["不考試", "重期末", "有期中考", "重報告", "作業偏多", "需分組"] },
  { label: "給分 / 風險", tags: ["佛心給分", "容易被當"] },
  { label: "授課形式", tags: ["全英授課", "遠距居多"] },
] as const;

/** Flat list of every allowed tag string — for validation and filtering. */
export const REVIEW_TAG_VALUES: string[] = REVIEW_TAG_GROUPS.flatMap((g) => [...g.tags]);

/** Max tags a single review may carry (also enforced by the DB CHECK). */
export const MAX_REVIEW_TAGS = 5;

/** Phase 3 AI feature flags (DeepSeek). Default off until configured. */
export const AI_FEATURES = {
  reviewSummary: process.env.NEXT_PUBLIC_AI_REVIEW_SUMMARY === "true",
  semanticSearch: process.env.NEXT_PUBLIC_AI_SEMANTIC_SEARCH === "true",
  advisorChat: process.env.NEXT_PUBLIC_AI_ADVISOR === "true",
  reviewModeration: process.env.NEXT_PUBLIC_AI_MODERATION === "true",
};

export const SEMESTER_TERMS: Record<string, string> = {
  "1": "第一學期",
  "2": "第二學期",
  "3": "暑期",
};

/** 學制 (uDeformType) — matches the NKNU form. */
export const DEGREE_LEVELS = [
  { code: "1", name: "大學部" },
  { code: "2", name: "碩士班" },
  { code: "3", name: "博士班" },
  { code: "G", name: "通識/軍訓/體育" },
  { code: "S", name: "學院開課" },
  { code: "H", name: "學程課/第二專長" },
] as const;

export const DAY_NIGHT_OPTIONS = [
  { value: "D", label: "日間" },
  { value: "N", label: "進修" },
] as const;

export const CAMPUS_OPTIONS = [
  { value: "和平", label: "和平" },
  { value: "燕巢", label: "燕巢" },
] as const;

/** Random anonymized handle for first-time profiles, e.g. "綠色的椰子371". */
export function randomDisplayName(): string {
  const colors = ["紅", "橙", "黃", "綠", "藍", "靛", "紫", "青", "棕", "灰"];
  const animals = ["椰子", "石虎", "黑熊", "海豚", "貓頭鷹", "梅花鹿", "穿山甲", "藍鵲", "獼猴", "雲豹"];
  const c = colors[Math.floor(Math.random() * colors.length)];
  const a = animals[Math.floor(Math.random() * animals.length)];
  const n = Math.floor(Math.random() * 900 + 100);
  return `${c}色的${a}${n}`;
}
