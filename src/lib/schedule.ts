import { WEEKDAY_LABELS, PERIOD_TIMES } from "./period-shared";
import type { Slot } from "./data/types";

/** Render slots like "週一 3-4、週三 5" from structured slot data. */
export function formatSlots(slots: Slot[]): string {
  if (!slots || slots.length === 0) return "時間未定";
  const byDay = new Map<number, string[]>();
  for (const s of slots) {
    const arr = byDay.get(s.weekday) ?? [];
    arr.push(s.period);
    byDay.set(s.weekday, arr);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([wd, periods]) => `${WEEKDAY_LABELS[wd] ?? `週${wd}`} ${periods.join(",")}`)
    .join("、");
}

export { WEEKDAY_LABELS, PERIOD_TIMES };
