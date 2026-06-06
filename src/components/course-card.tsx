import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RatingSummaryBars } from "@/components/rating-summary";
import { AddToTimetable } from "@/components/add-to-timetable";
import { formatSlots } from "@/lib/schedule";
import type { CourseGroup } from "@/lib/data/types";

export function CourseCard({ course }: { course: CourseGroup }) {
  const latest = course.offerings[0];
  const yearLong = course.offerings.some((o) => o.category === "Y");
  const canSchedule = (latest?.slots?.length ?? 0) > 0;

  return (
    <div className="elev-2 hover:elev-3 group relative rounded-lg bg-canvas p-5 transition-shadow">
      {/* Stretched link: the whole card navigates to the course page… */}
      <Link
        href={`/course/${encodeURIComponent(course.courseKey)}`}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={course.name}
      />

      {/* …content is non-interactive so clicks fall through to the link. */}
      <div className="pointer-events-none relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-xs text-mute">{course.courseCode}</div>
            <h3 className="mt-0.5 truncate text-base font-semibold tracking-tight group-hover:text-link">
              {course.name}
            </h3>
            {course.nameEn && <p className="truncate text-xs text-mute">{course.nameEn}</p>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {course.credits != null && <Badge variant="secondary">{course.credits} 學分</Badge>}
            {yearLong && (
              <Badge variant="outline" className="text-xs" title="學年課，需上下學期連修">
                學年
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-body">
          {course.teachers.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-secondary px-2 py-0.5">
              {t}
            </span>
          ))}
          {latest?.classTimeRaw && (
            <span className="rounded-full bg-secondary px-2 py-0.5">{formatSlots(latest.slots)}</span>
          )}
        </div>

        <div className="mt-4 border-t border-hairline pt-3">
          <RatingSummaryBars summary={course.summary} compact />
        </div>

        {latest?.enrollCap != null && (
          <div className="mt-3 flex items-center gap-1 text-xs text-mute">
            <Users className="size-3" />
            {latest.enrollCount}/{latest.enrollCap}
          </div>
        )}
      </div>

      {/* Add-to-timetable sits above the stretched link (own stacking + clicks). */}
      {canSchedule && latest && (
        <div className="relative z-10 mt-3 flex justify-end">
          <AddToTimetable
            course={{
              courseCode: course.courseCode,
              courseKey: course.courseKey,
              syllabusNo: latest.syllabusNo,
              name: course.name,
              teachers: latest.teachers ?? course.teachers,
              classroom: latest.classroom,
              semesterId: latest.semesterId,
              slots: latest.slots,
            }}
          />
        </div>
      )}
    </div>
  );
}
