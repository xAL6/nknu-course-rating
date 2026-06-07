/**
 * Enrollment popularity ("搶課熱度") — derived purely from the crawled
 * enroll_count / enroll_cap. Pure module (no server-only): safe in both server
 * and client components.
 *
 * Note: enroll_count is the number ENROLLED, not the number who registered, so
 * this is a fill-level / popularity signal, framed as a rough "選上機率" hint —
 * not a true competition ratio.
 */

export type EnrollLevelKey = "full" | "hot" | "ok" | "easy";

export type EnrollLevel = {
  key: EnrollLevelKey;
  label: string;
  /** A CSS color (var) for the dot/label — keeps theming consistent. */
  tone: string;
  hint: string;
};

/** count / cap, or null when capacity data is missing. */
export function fillRate(
  count: number | null | undefined,
  cap: number | null | undefined,
): number | null {
  if (count == null || cap == null || cap <= 0) return null;
  return count / cap;
}

/** Bucket a fill rate into a popularity level (null when rate is unknown). */
export function enrollLevel(rate: number | null): EnrollLevel | null {
  if (rate == null) return null;
  if (rate >= 1)
    return { key: "full", label: "爆滿", tone: "var(--pink)", hint: "選課人數已達或超過名額，通常得搶或加簽" };
  if (rate >= 0.8)
    return { key: "hot", label: "搶手", tone: "var(--warning)", hint: "接近額滿，建議及早選課" };
  if (rate >= 0.5)
    return { key: "ok", label: "適中", tone: "var(--mute)", hint: "名額還算充足" };
  return { key: "easy", label: "好上", tone: "var(--cyan)", hint: "名額充足，通常容易選上" };
}

/** Average fill rate across offerings that carry capacity data (historical popularity). */
export function avgFillRate(
  offerings: { enrollCount: number | null; enrollCap: number | null }[],
): { rate: number | null; sample: number } {
  const rates = offerings
    .map((o) => fillRate(o.enrollCount, o.enrollCap))
    .filter((r): r is number => r != null);
  if (rates.length === 0) return { rate: null, sample: 0 };
  return { rate: rates.reduce((a, b) => a + b, 0) / rates.length, sample: rates.length };
}

/** "95%" style label for a fill rate (null when unknown). */
export function fillPct(rate: number | null): string | null {
  return rate == null ? null : `${Math.round(rate * 100)}%`;
}
