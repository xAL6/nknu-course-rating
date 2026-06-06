import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RatingSummaryBars } from "@/components/rating-summary";
import { AddToTimetable } from "@/components/add-to-timetable";
import { formatSlots } from "@/lib/schedule";
import { RATING_DIMENSIONS } from "@/lib/config";
import type { CourseGroup } from "@/lib/data/types";

const ACCENTS = [
  "var(--rate-sweet)",
  "var(--rate-grading)",
  "var(--rate-cool)",
  "var(--rate-quality)",
  "var(--rate-load)",
];
function accentFor(code: string) {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export function CourseCard({ course }: { course: CourseGroup }) {
  const latest = course.offerings[0];
  const yearLong = course.offerings.some((o) => o.category === "Y");
  const canSchedule = (latest?.slots?.length ?? 0) > 0;
  const accent = accentFor(course.courseCode + course.name);
  const hasRating = !!course.summary && course.summary.reviewCount > 0;

  return (
    <div className="elev-2 hover:elev-3 card-pop group relative overflow-hidden rounded-xl bg-canvas">
      {/* derived accent stripe */}
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: accent }} aria-hidden />

      {/* stretched link — whole card navigates */}
      <Link
        href={`/course/${encodeURIComponent(course.courseKey)}`}
        className="absolute inset-0 z-0"
        aria-label={course.name}
      />

      <div className="pointer-events-none relative p-5 pl-6">
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
              <Badge variant="outline" className="text-xs" title="學年課,需上下學期連修">
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
          {hasRating ? (
            <RatingSummaryBars summary={course.summary} compact />
          ) : (
            // Colorful empty state — also teaches the 5 rating dimensions.
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {RATING_DIMENSIONS.map((d) => (
                  <span key={d.key} className="flex items-center gap-0.5 text-[11px] text-mute">
                    <span
                      className="size-2 rounded-full opacity-60"
                      style={{ backgroundColor: d.color }}
                    />
                    {d.label.charAt(0)}
                  </span>
                ))}
              </div>
              <span className="ml-auto text-[11px] text-mute">尚無評價</span>
            </div>
          )}
        </div>

        {latest?.enrollCap != null && (
          <div className="mt-3 flex items-center gap-1 text-xs text-mute">
            <Users className="size-3" />
            {latest.enrollCount}/{latest.enrollCap}
          </div>
        )}
      </div>

      {canSchedule && latest && (
        <div className="relative z-10 flex justify-end px-5 pb-4">
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
