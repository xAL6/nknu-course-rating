"use client";

import { useState } from "react";
import { MapPin, ExternalLink, ChevronDown } from "lucide-react";
import { EnrollmentBadge } from "@/components/enrollment-badge";
import { AddToTimetable } from "@/components/add-to-timetable";
import { formatSlots } from "@/lib/schedule";
import { SEMESTER_TERMS } from "@/lib/config";
import type { Offering } from "@/lib/data/types";

const semLabel = (id: string) => {
  const [y, t] = id.split("-");
  return `${y}-${t in SEMESTER_TERMS ? (t === "3" ? "暑" : t) : t}`;
};

/**
 * 歷年開課紀錄 — a compact, clearly-separated list of a (course, teacher)'s
 * offerings. Collapses to the latest 3 semesters to save vertical space.
 */
export function OfferingHistory({
  offerings,
  course,
}: {
  offerings: Offering[];
  course: { courseCode: string; courseKey: string; name: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 3;
  const shown = expanded ? offerings : offerings.slice(0, LIMIT);
  const hidden = offerings.length - shown.length;

  return (
    <div className="mt-5 border-t border-hairline pt-4">
      <h3 className="mb-2.5 text-sm font-semibold text-body">
        歷年開課紀錄 <span className="font-normal text-mute">· {offerings.length} 學期</span>
      </h3>

      <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
        {shown.map((o) => (
          <div key={o.syllabusNo ?? `${o.semesterId}-${o.classCode}`} className="px-4 py-3">
            {/* line 1: semester + time/room + actions */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-medium text-body">
                  {semLabel(o.semesterId)}
                </span>
                <span className="truncate text-sm font-medium text-ink">
                  {formatSlots(o.slots) || "時間未定"}
                </span>
                {o.classroom && (
                  <span className="hidden shrink-0 items-center gap-1 text-xs text-mute sm:flex">
                    <MapPin className="size-3" />
                    {o.campus ? `${o.campus}・` : ""}
                    {o.classroom}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {o.syllabusUrl && (
                  <a
                    href={o.syllabusUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-link hover:underline"
                  >
                    大綱 <ExternalLink className="size-3" />
                  </a>
                )}
                <AddToTimetable
                  course={{
                    courseCode: course.courseCode,
                    courseKey: course.courseKey,
                    syllabusNo: o.syllabusNo,
                    name: course.name,
                    teachers: o.teachers,
                    classroom: o.classroom,
                    semesterId: o.semesterId,
                    slots: o.slots,
                  }}
                />
              </div>
            </div>

            {/* line 2: secondary meta */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mute">
              <span className="font-mono">{o.courseCode}</span>
              {o.courseType && <Meta>{o.courseType}</Meta>}
              {o.category === "Y" && <Meta className="text-link">學年</Meta>}
              {o.className && <Meta>{o.className}</Meta>}
              <Meta>{o.dayNight === "N" ? "進修" : "日間"}</Meta>
              {o.classroom && (
                <span className="flex items-center gap-1 sm:hidden">
                  <span className="text-hairline-strong">·</span>
                  <MapPin className="size-3" />
                  {o.campus ? `${o.campus}・` : ""}
                  {o.classroom}
                </span>
              )}
              {o.enrollCap != null && (
                <Meta>
                  選課 {o.enrollCount}/{o.enrollCap}
                </Meta>
              )}
              <EnrollmentBadge count={o.enrollCount} cap={o.enrollCap} />
            </div>
          </div>
        ))}
      </div>

      {offerings.length > LIMIT && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-2.5 flex items-center gap-1 text-xs text-link transition-colors hover:text-link-deep"
        >
          <ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "收合" : `顯示其餘 ${hidden} 學期`}
        </button>
      )}
    </div>
  );
}

function Meta({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-hairline-strong">·</span>
      <span className={className}>{children}</span>
    </span>
  );
}
