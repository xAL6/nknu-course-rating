"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { AddToTimetable } from "@/components/add-to-timetable";
import { EnrollmentBadge } from "@/components/enrollment-badge";
import { formatSlots } from "@/lib/schedule";
import type { CourseGroup } from "@/lib/data/types";

export function CourseCard({ course, index = 0 }: { course: CourseGroup; index?: number }) {
  const latest = course.offerings[0];
  const yearLong = course.offerings.some((o) => o.category === "Y");
  const canSchedule = (latest?.slots?.length ?? 0) > 0;
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
        borderColor: "var(--accent)",
        boxShadow: "0 18px 46px -20px var(--accent-line)",
        transition: { type: "spring", stiffness: 340, damping: 22 },
      }}
      className="group glass-soft glass-interactive relative flex flex-col rounded-2xl p-5"
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
            style={{ color: "var(--accent)" }}
          >
            {course.courseCode}
          </span>
          <div className="flex shrink-0 items-center gap-1.5 text-xs text-mute">
            {yearLong && (
              <span className="rounded-full px-1.5 py-0.5 text-[11px] font-medium" style={{ color: "var(--accent)", backgroundColor: "var(--accent-soft)" }}>
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

        {meta && <p className="mt-2.5 truncate text-xs text-mute">{meta}</p>}
      </div>

      <div className="relative z-10 mt-4 flex items-center justify-between gap-2 border-t border-[var(--glass-border)] pt-3">
        <span className="flex items-center gap-2 text-xs text-mute">
          {hasRating ? (
            <span className="font-medium text-body">★ {course.summary!.reviewCount} 則</span>
          ) : (
            <span>尚無評價</span>
          )}
          <EnrollmentBadge count={latest?.enrollCount} cap={latest?.enrollCap} />
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
