"use client";

import { CalendarPlus, Check } from "lucide-react";
import { toast } from "sonner";
import {
  useTimetable,
  addToTimetable,
  removeFromTimetable,
  isInTimetable,
  type TimetableCourse,
} from "@/lib/timetable-store";

export function AddToTimetable({ course }: { course: TimetableCourse }) {
  const courses = useTimetable();
  const added = isInTimetable(courses, course.courseCode, course.syllabusNo);

  // Would this course collide with anything already in the timetable?
  const occupied = new Set(
    courses
      .filter((c) => !(c.courseCode === course.courseCode && c.syllabusNo === course.syllabusNo))
      .flatMap((c) => c.slots.map((s) => `${s.weekday}-${s.period}`)),
  );
  const conflicts = course.slots.some((s) => occupied.has(`${s.weekday}-${s.period}`));

  return (
    <button
      onClick={() => {
        if (added) {
          removeFromTimetable(course);
          toast("已從課表移除");
        } else {
          const res = addToTimetable(course);
          if (res.ok)
            conflicts
              ? toast.warning("已加入,但與課表有衝堂")
              : toast.success("已加入課表");
          else if (res.reason === "semester")
            toast.error("課表已鎖定其他學期,請先清空再加入不同學期的課。");
          else toast("這門課已在課表中");
        }
      }}
      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
        added
          ? "border-link bg-link-bg-soft/40 text-link-deep"
          : "border-hairline text-body hover:bg-secondary"
      }`}
    >
      {added ? <Check className="size-3.5" /> : <CalendarPlus className="size-3.5" />}
      {added ? "已加入" : "加入課表"}
    </button>
  );
}
