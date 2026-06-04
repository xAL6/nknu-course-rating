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
 * The five rating dimensions, mirroring 甜度/涼度/loading from the reference
 * sites plus 品質 and 給分. Each is scored 1–5. `higherIsBetter` controls how
 * the aggregate color/label is interpreted.
 */
export const RATING_DIMENSIONS = [
  { key: "sweetness", label: "甜度", labelEn: "Sweetness", hint: "給分甜不甜", color: "var(--rate-sweet)", higherIsBetter: true },
  { key: "coolness", label: "涼度", labelEn: "Coolness", hint: "課程輕不輕鬆", color: "var(--rate-cool)", higherIsBetter: true },
  { key: "loading", label: "負擔", labelEn: "Loading", hint: "作業考試多寡", color: "var(--rate-load)", higherIsBetter: false },
  { key: "quality", label: "品質", labelEn: "Quality", hint: "教學內容紮實度", color: "var(--rate-quality)", higherIsBetter: true },
  { key: "grading", label: "給分", labelEn: "Grading", hint: "成績分布", color: "var(--rate-grading)", higherIsBetter: true },
] as const;

export type RatingDimensionKey = (typeof RATING_DIMENSIONS)[number]["key"];

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
