/**
 * Campus helpers — NKNU has two campuses (和平 / 燕巢) ~30–40 min apart, so a
 * timetable with back-to-back classes on different campuses is effectively
 * impossible. Pure module (no server-only): usable in client components.
 */
import type { Slot } from "./data/types";

/**
 * Derive a campus from a room code, mirroring the crawler's rule
 * (scripts/scraper/rooms.ts): 和平 room codes start with a digit / CB / G;
 * every other leading letter is a 燕巢 building (BT/CM/LI/MA/PH/SF/SR/TC…).
 * Returns null when the room is missing or unrecognised.
 */
export function campusFromRoom(room: string | null | undefined): string | null {
  if (!room) return null;
  const s = room.trim();
  if (!s) return null;
  // Defensive: some room strings embed the campus name directly.
  if (s.includes("燕巢")) return "燕巢";
  if (s.includes("和平")) return "和平";
  if (/^[0-9]/.test(s)) return "和平";
  if (/^CB/i.test(s)) return "和平";
  if (/^G/i.test(s)) return "和平";
  if (/^[A-Za-z]/.test(s)) return "燕巢";
  return null;
}

type CommuteCourse = { slots: Slot[]; classroom: string | null; campus?: string | null };

export type CommuteIssue = {
  weekday: number;
  fromPeriod: string;
  toPeriod: string;
  fromCampus: string;
  toCampus: string;
  /** Free periods between the two classes (0 = back-to-back). */
  gap: number;
};

/**
 * Find same-day transitions where consecutive (in time) classes sit on different
 * campuses. `gap === 0` means back-to-back — no time to commute.
 *
 * @param periodOrder canonical period ordering (e.g. ["1".."10","A".."D"]).
 */
export function findCommuteIssues(
  courses: CommuteCourse[],
  periodOrder: string[],
): CommuteIssue[] {
  const idx = new Map(periodOrder.map((p, i) => [p, i] as const));

  // weekday -> occupied periods with a known campus
  const byDay = new Map<number, { period: string; campus: string; order: number }[]>();
  for (const c of courses) {
    const campus = c.campus ?? campusFromRoom(c.classroom);
    if (!campus) continue;
    for (const s of c.slots) {
      const order = idx.get(s.period);
      if (order == null) continue;
      const arr = byDay.get(s.weekday) ?? [];
      arr.push({ period: s.period, campus, order });
      byDay.set(s.weekday, arr);
    }
  }

  const issues: CommuteIssue[] = [];
  for (const [weekday, list] of byDay) {
    const sorted = [...list].sort((a, b) => a.order - b.order);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (cur.order === prev.order) continue; // same period (handled by 衝堂)
      if (prev.campus !== cur.campus) {
        issues.push({
          weekday,
          fromPeriod: prev.period,
          toPeriod: cur.period,
          fromCampus: prev.campus,
          toCampus: cur.campus,
          gap: cur.order - prev.order - 1,
        });
      }
    }
  }

  // Tightest (back-to-back) first, then by weekday.
  return issues.sort((a, b) => a.gap - b.gap || a.weekday - b.weekday);
}
