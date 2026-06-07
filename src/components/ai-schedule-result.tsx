"use client";

import Link from "next/link";
import { toast } from "sonner";
import { CalendarRange, ArrowRight } from "lucide-react";
import { formatSlots } from "@/lib/schedule";
import { replaceTimetable, type TimetableCourse } from "@/lib/timetable-store";
import type { Slot } from "@/lib/data/types";

type ScheduleCourse = {
  courseKey: string;
  courseCode: string;
  syllabusNo: string | null;
  name: string;
  teachers: string[];
  classroom: string | null;
  campus: string | null;
  semesterId: string;
  slots: Slot[];
  credits: number | null;
};

export type AiSchedule = {
  kind: "schedule";
  semester: string;
  totalCredits: number;
  courses: ScheduleCourse[];
  note: string;
};

/** Renders the AI's suggested timetable with a one-click "apply to timetable" action. */
export function AiScheduleResult({ schedule }: { schedule: AiSchedule }) {
  const { courses, totalCredits, note } = schedule;

  if (!courses.length) {
    return <p className="text-xs text-mute">{note}</p>;
  }

  const apply = () => {
    const tc: TimetableCourse[] = courses.map((c) => ({
      courseCode: c.courseCode,
      courseKey: c.courseKey,
      syllabusNo: c.syllabusNo,
      name: c.name,
      teachers: c.teachers,
      classroom: c.classroom,
      campus: c.campus,
      semesterId: c.semesterId,
      slots: c.slots,
    }));
    replaceTimetable(tc);
    toast.success(`已套用 ${tc.length} 門到課表`);
  };

  return (
    <div className="glass-soft rounded-lg p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <CalendarRange className="size-4" /> 建議課表・{totalCredits} 學分 / {courses.length} 門
        </span>
        <button
          onClick={apply}
          className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          套用到課表
        </button>
      </div>

      <ul className="mt-2 divide-y divide-hairline">
        {courses.map((c) => (
          <li key={c.courseKey} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5 text-xs">
            <Link
              href={`/course/${encodeURIComponent(c.courseKey)}`}
              className="min-w-0 flex-1 truncate font-medium hover:text-link hover:underline"
            >
              {c.name}
            </Link>
            <span className="text-mute">{formatSlots(c.slots)}</span>
            {c.campus && <span className="text-mute">· {c.campus}</span>}
            {c.credits != null && <span className="text-mute">· {c.credits} 學分</span>}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-mute">{note}</p>
      <Link
        href="/timetable"
        className="mt-1 inline-flex items-center gap-1 text-xs text-link hover:underline"
      >
        前往課表 <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}
