"use client";

import { useSyncExternalStore } from "react";
import type { Slot } from "./data/types";

export type TimetableCourse = {
  courseCode: string;
  syllabusNo: string | null;
  name: string;
  teachers: string[];
  classroom: string | null;
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

export function addToTimetable(course: TimetableCourse) {
  const cur = read();
  if (cur.some((c) => c.syllabusNo === course.syllabusNo && c.courseCode === course.courseCode)) return;
  write([...cur, course]);
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
