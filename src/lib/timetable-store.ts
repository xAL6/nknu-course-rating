"use client";

import { useSyncExternalStore } from "react";
import type { Slot } from "./data/types";

export type TimetableCourse = {
  courseCode: string;
  courseKey?: string;
  syllabusNo: string | null;
  name: string;
  teachers: string[];
  classroom: string | null;
  /** Optional; the commute check derives it from `classroom` when absent. */
  campus?: string | null;
  semesterId: string;
  slots: Slot[];
};

const KEY = "nknu-timetable-v1";
const listeners = new Set<() => void>();

function read(): TimetableCourse[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(courses: TimetableCourse[]) {
  localStorage.setItem(KEY, JSON.stringify(courses));
  listeners.forEach((l) => l());
}

// Cache the parsed array so getSnapshot is referentially stable between writes
// (required by useSyncExternalStore to avoid infinite loops).
let cache: TimetableCourse[] = [];
let cacheRaw = "";
function getSnapshot(): TimetableCourse[] {
  if (typeof window === "undefined") return cache;
  const raw = localStorage.getItem(KEY) || "[]";
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cache = JSON.parse(raw);
    } catch {
      cache = [];
    }
  }
  return cache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useTimetable() {
  const courses = useSyncExternalStore(subscribe, getSnapshot, () => cache);
  return courses;
}

export type AddResult = { ok: boolean; reason?: "duplicate" | "semester" };

/** The semester a timetable is locked to (the first course's), or null if empty. */
export function timetableSemester(courses: TimetableCourse[]): string | null {
  return courses[0]?.semesterId ?? null;
}

/** The TERM (1/2/3) a timetable is locked to — year-agnostic — or null if empty. */
export function timetableTerm(courses: TimetableCourse[]): string | null {
  return courses[0]?.semesterId?.split("-")[1] ?? null;
}

export function addToTimetable(course: TimetableCourse): AddResult {
  const cur = read();
  if (cur.some((c) => c.syllabusNo === course.syllabusNo && c.courseCode === course.courseCode)) {
    return { ok: false, reason: "duplicate" };
  }
  // A timetable is scoped to one TERM (上/下/暑), but may mix academic years.
  const term = timetableTerm(cur);
  if (term && course.semesterId.split("-")[1] !== term) return { ok: false, reason: "semester" };
  write([...cur, course]);
  return { ok: true };
}

export function replaceTimetable(courses: TimetableCourse[]) {
  write(courses);
}

export function removeFromTimetable(key: { courseCode: string; syllabusNo: string | null }) {
  write(read().filter((c) => !(c.courseCode === key.courseCode && c.syllabusNo === key.syllabusNo)));
}

export function isInTimetable(courses: TimetableCourse[], courseCode: string, syllabusNo: string | null) {
  return courses.some((c) => c.courseCode === courseCode && c.syllabusNo === syllabusNo);
}

export function clearTimetable() {
  write([]);
}

/** Map of "weekday-period" -> courses occupying that slot (conflict if >1). */
export function buildSlotMap(courses: TimetableCourse[]) {
  const map = new Map<string, TimetableCourse[]>();
  for (const c of courses) {
    for (const s of c.slots) {
      const k = `${s.weekday}-${s.period}`;
      const arr = map.get(k) ?? [];
      arr.push(c);
      map.set(k, arr);
    }
  }
  return map;
}

export function totalCredits(courses: TimetableCourse[]): number {
  // credits aren't carried in slots; computed elsewhere if needed.
  return courses.length;
}

// ── Share-link codec (URL-safe base64 of the minimal course payload) ──

function toUrlB64(s: string): string {
  const b64 = typeof window === "undefined" ? Buffer.from(s, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(s)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromUrlB64(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return typeof window === "undefined"
    ? Buffer.from(b64, "base64").toString("utf8")
    : decodeURIComponent(escape(atob(b64)));
}

export function encodeShare(courses: TimetableCourse[]): string {
  return toUrlB64(JSON.stringify(courses));
}

export function decodeShare(token: string): TimetableCourse[] | null {
  try {
    // Cap token size before decoding/parsing — a shared link is at most a few
    // dozen courses, so anything huge is malformed/abusive (avoid wasting work
    // decoding a multi-MB payload from an untrusted ?s= param).
    if (token.length > 20_000) return null;
    const parsed = JSON.parse(fromUrlB64(token));
    if (!Array.isArray(parsed) || parsed.length > 60) return null;
    // Light validation: each entry must carry slots + identity.
    return parsed.filter(
      (c) => c && typeof c.courseCode === "string" && Array.isArray(c.slots),
    ) as TimetableCourse[];
  } catch {
    return null;
  }
}
