/**
 * NKNU class-time codes look like "13,14" or "3A,3B".
 * Encoding: the FIRST character is the weekday (1=Mon … 7=Sun); the REMAINDER
 * is the period code (節次) — a digit (1–9, 10, 11…) or a letter (A–E for the
 * evening blocks). Because the weekday is always a single char, splitting at
 * index 1 is unambiguous.
 */

export type Slot = { weekday: number; period: string };

export function parseClassTime(raw: string | null | undefined): Slot[] {
  if (!raw) return [];
  return raw
    .split(/[,，、\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((token) => {
      const weekday = Number(token[0]);
      const period = token.slice(1);
      return Number.isFinite(weekday) && weekday >= 1 && weekday <= 7 && period
        ? { weekday, period }
        : null;
    })
    .filter((s): s is Slot => s !== null);
}

export const WEEKDAY_LABELS = ["", "週一", "週二", "週三", "週四", "週五", "週六", "週日"];

/** Map of 節次 → display time, captured from the NKNU timetable grid. */
export const PERIOD_TIMES: Record<string, string> = {
  "1": "08:10–09:00",
  "2": "09:10–10:00",
  "3": "10:10–11:00",
  "4": "11:10–12:00",
  "5": "12:10–13:00",
  "6": "13:10–14:00",
  "7": "14:10–15:00",
  "8": "15:10–16:00",
  "9": "16:10–17:00",
  "10": "17:10–18:00",
  A: "18:30–19:20",
  B: "19:25–20:15",
  C: "20:20–21:10",
  D: "21:15–22:05",
};
