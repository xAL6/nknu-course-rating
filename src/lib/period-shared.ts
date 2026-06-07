export const WEEKDAY_LABELS = ["", "週一", "週二", "週三", "週四", "週五", "週六", "週日"];

/** 節次 → display time (NKNU). */
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

/** Canonical period ordering (08:10 → 22:05). Used for adjacency/commute checks. */
export const PERIOD_ORDER: string[] = Object.keys(PERIOD_TIMES);
