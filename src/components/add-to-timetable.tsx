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

  return (
    <button
      onClick={() => {
        if (added) {
          removeFromTimetable(course);
          toast("已從課表移除");
        } else {
          addToTimetable(course);
          toast.success("已加入課表");
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
