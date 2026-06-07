/**
 * Greedy timetable builder for the AI advisor. Pure (no server-only): the DB
 * retrieval lives in ai-search.ts; this module just picks a conflict-free set
 * from ranked candidates, honouring free days, a credit target, and (reusing
 * the #3 campus logic) avoiding back-to-back cross-campus classes.
 *
 * It returns *a* feasible combination, not a provably optimal one — good enough
 * for a suggestion the student can tweak.
 */
import type { Slot } from "./data/types";
import { campusFromRoom } from "./campus";

/** Minimal fields the scheduler needs; callers pass richer objects through. */
export type SchedulableSlotInfo = {
  courseKey: string;
  courseCode: string;
  classroom: string | null;
  campus?: string | null;
  slots: Slot[];
  credits: number | null;
};

export type ScheduleConstraints = {
  /** Weekdays (1=Mon … 7=Sun) to keep free. */
  freeWeekdays?: number[];
  /** Aim for roughly this many credits (default 15). */
  targetCredits?: number;
  /** Hard cap on number of courses (default 8). */
  maxCourses?: number;
  /** Skip a course if it would create a back-to-back cross-campus hop (default true). */
  avoidCrossCampus?: boolean;
  /** Canonical period order, for adjacency checks. */
  periodOrder: string[];
};

/**
 * Pick a conflict-free schedule from candidates pre-sorted by a `score`
 * (higher = more desirable). Greedy: take the best candidate that fits.
 */
export function buildSchedule<T extends SchedulableSlotInfo>(
  candidates: (T & { score: number })[],
  c: ScheduleConstraints,
): { chosen: T[]; totalCredits: number } {
  const free = new Set(c.freeWeekdays ?? []);
  const target = c.targetCredits ?? 15;
  const maxN = c.maxCourses ?? 8;
  const avoidCampus = c.avoidCrossCampus !== false;
  const idx = new Map(c.periodOrder.map((p, i) => [p, i] as const));

  const campusOf = (x: SchedulableSlotInfo) => x.campus ?? campusFromRoom(x.classroom);

  const pool = candidates
    .filter((x) => x.slots.length > 0 && !x.slots.some((s) => free.has(s.weekday)))
    .sort((a, b) => b.score - a.score || a.courseCode.localeCompare(b.courseCode));

  const occupied = new Set<string>(); // "weekday-period"
  const dayTimeline = new Map<number, { order: number; campus: string }[]>();
  const chosenKeys = new Set<string>();
  const chosen: T[] = [];
  let credits = 0;

  for (const x of pool) {
    if (chosen.length >= maxN || credits >= target) break;
    if (chosenKeys.has(x.courseKey)) continue;
    if (x.slots.some((s) => occupied.has(`${s.weekday}-${s.period}`))) continue;

    const campus = campusOf(x);
    if (avoidCampus && campus && wouldHopCampus(x.slots, campus, dayTimeline, idx)) continue;

    // accept
    for (const s of x.slots) occupied.add(`${s.weekday}-${s.period}`);
    if (campus) {
      for (const s of x.slots) {
        const order = idx.get(s.period);
        if (order == null) continue;
        const day = dayTimeline.get(s.weekday) ?? [];
        day.push({ order, campus });
        dayTimeline.set(s.weekday, day);
      }
    }
    chosenKeys.add(x.courseKey);
    chosen.push(x);
    credits += x.credits ?? 0;
  }

  return { chosen, totalCredits: credits };
}

/** True if adding these slots (on `campus`) sits time-adjacent to a class on another campus. */
function wouldHopCampus(
  slots: Slot[],
  campus: string,
  dayTimeline: Map<number, { order: number; campus: string }[]>,
  idx: Map<string, number>,
): boolean {
  for (const s of slots) {
    const order = idx.get(s.period);
    if (order == null) continue;
    for (const e of dayTimeline.get(s.weekday) ?? []) {
      if (Math.abs(e.order - order) === 1 && e.campus !== campus) return true;
    }
  }
  return false;
}
