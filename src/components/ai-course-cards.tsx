import Link from "next/link";
import { RATING_DIMENSIONS } from "@/lib/config";
import { TagChips } from "@/components/tag-chips";
import { EnrollmentBadge } from "@/components/enrollment-badge";

/** Shape the AI tools return (searchCourses / compareTeachers / getCourseDetail). */
export type AiCard = {
  courseKey: string;
  name: string;
  courseCode?: string;
  teachers?: string[];
  credits?: number | null;
  rating?: {
    reviewCount: number;
    sweetness: number | null;
    coolness: number | null;
    loading: number | null;
    quality: number | null;
    grading: number | null;
  } | null;
  tags?: Record<string, number>;
  enrollFillRate?: number | null;
};

/** Render the AI advisor's retrieved courses as clickable, on-brand cards. */
export function AiCourseCards({ courses }: { courses: AiCard[] }) {
  if (!courses?.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {courses.map((c) => {
        const rating = c.rating as Record<string, number | null> | null | undefined;
        return (
          <Link
            key={c.courseKey}
            href={`/course/${encodeURIComponent(c.courseKey)}`}
            className="glass-soft glass-interactive rounded-lg p-3 no-underline"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium text-ink">{c.name}</span>
              {c.credits != null && (
                <span className="shrink-0 text-[11px] text-mute">{c.credits} 學分</span>
              )}
            </div>
            {c.teachers?.length ? (
              <p className="mt-0.5 truncate text-xs text-mute">{c.teachers.join("、")}</p>
            ) : null}

            {/* rating mini-spectrum (brand signature) */}
            <div className="mt-2 flex h-1.5 gap-1">
              {RATING_DIMENSIONS.map((d) => {
                const v = rating?.[d.key];
                return (
                  <span
                    key={d.key}
                    className="flex-1 rounded-full"
                    style={{ backgroundColor: d.color, opacity: v ? 1 : 0.25 }}
                  />
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-mute">
                {c.rating?.reviewCount ? `${c.rating.reviewCount} 則評價` : "尚無評價"}
              </span>
              <EnrollmentBadge rate={c.enrollFillRate ?? null} />
            </div>

            {c.tags && Object.keys(c.tags).length > 0 && (
              <TagChips counts={c.tags} max={4} className="mt-1.5" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
