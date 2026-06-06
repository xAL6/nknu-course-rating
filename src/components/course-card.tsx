"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Users } from "lucide-react";
import { AddToTimetable } from "@/components/add-to-timetable";
import { formatSlots } from "@/lib/schedule";
import { RATING_DIMENSIONS } from "@/lib/config";
import type { CourseGroup } from "@/lib/data/types";

const ACCENTS = ["#ff0080", "#0070f3", "#00dfd8", "#7928ca", "#f5a623"];
function accentFor(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export function CourseCard({ course, index = 0 }: { course: CourseGroup; index?: number }) {
  const latest = course.offerings[0];
  const yearLong = course.offerings.some((o) => o.category === "Y");
  const canSchedule = (latest?.slots?.length ?? 0) > 0;
  const accent = accentFor(course.courseCode + course.name);
  const hasRating = !!course.summary && course.summary.reviewCount > 0;
  const meta = [latest?.teachers?.[0] ?? course.teachers[0], latest && formatSlots(latest.slots)]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: (index % 12) * 0.035 }}
      whileHover={{
        y: -6,
        borderColor: accent,
        boxShadow: `0 18px 46px -20px ${accent}66`,
        transition: { type: "spring", stiffness: 340, damping: 22 },
      }}
      style={{ borderColor: "var(--hairline)", ["--accent" as string]: accent }}
      className="group relative flex flex-col rounded-2xl border bg-canvas p-5"
    >
      {/* whole card navigates */}
      <Link
        href={`/course/${encodeURIComponent(course.courseKey)}`}
        className="absolute inset-0 z-0 rounded-2xl"
        aria-label={course.name}
      />

      <div className="pointer-events-none relative flex-1">
        <div className="flex items-start justify-between gap-3">
          <span
            className="font-mono text-xs font-medium tracking-wide"
            style={{ color: accent }}
          >
            {course.courseCode}
          </span>
          <div className="flex shrink-0 items-center gap-1.5 text-xs text-mute">
            {yearLong && (
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ color: accent, backgroundColor: `${accent}1a` }}>
                學年
              </span>
            )}
            {course.credits != null && <span>{course.credits} 學分</span>}
          </div>
        </div>

        <h3 className="mt-2 text-[17px] leading-snug font-semibold tracking-tight transition-colors group-hover:text-[var(--accent)] line-clamp-2">
          {course.name}
        </h3>
        {course.nameEn && <p className="mt-0.5 truncate text-xs text-mute">{course.nameEn}</p>}

        {meta && <p className="mt-3 truncate text-xs text-body">{meta}</p>}

        {/* rating — slim 5-segment spectrum (the brand signature) */}
        <div className="mt-4">
          <div className="flex h-1.5 gap-1">
            {RATING_DIMENSIONS.map((d) => (
              <span
                key={d.key}
                className="flex-1 rounded-full transition-opacity"
                style={{ backgroundColor: d.color, opacity: hasRating ? 1 : 0.28 }}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-mute">
            {hasRating ? `${course.summary!.reviewCount} 則評價` : "尚無評價"}
          </p>
        </div>
      </div>

      <div className="relative z-10 mt-4 flex items-center justify-between border-t border-hairline pt-3">
        <span className="flex items-center gap-1 text-xs text-mute">
          {latest?.enrollCap != null && (
            <>
              <Users className="size-3" />
              {latest.enrollCount}/{latest.enrollCap}
            </>
          )}
        </span>
        {canSchedule && latest && (
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
        )}
      </div>
    </motion.div>
  );
}
