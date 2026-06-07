"use client";

import Link from "next/link";
import type { RecentReview } from "@/lib/data/community";

const DIMS = [
  { key: "sweetness", label: "甜", color: "var(--rate-sweet)" },
  { key: "coolness", label: "涼", color: "var(--rate-cool)" },
  { key: "quality", label: "穫", color: "var(--rate-quality)" },
] as const;

/** Infinite ticker of real student reviews (pauses on hover). */
export function ReviewMarquee({ reviews }: { reviews: RecentReview[] }) {
  if (reviews.length < 3) return null;
  const track = [...reviews, ...reviews];
  return (
    <div className="group relative overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
      <div className="animate-marquee flex w-max gap-3 group-hover:[animation-play-state:paused]">
        {track.map((r, i) => (
          <Link
            key={`${r.courseKey}-${i}`}
            href={`/course/${encodeURIComponent(r.courseKey)}${r.teacherKey ? `?t=${encodeURIComponent(r.teacherKey)}` : ""}`}
            className="glass-soft glass-interactive flex w-[300px] shrink-0 flex-col gap-2 rounded-2xl p-4 no-underline"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold text-body">
                  {r.displayName.slice(0, 1)}
                </span>
                <span className="truncate text-sm font-medium text-ink">{r.name}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                {DIMS.map((d) => {
                  const v = r[d.key];
                  return v == null ? null : (
                    <span key={d.key} className="font-mono text-[11px] font-semibold" style={{ color: d.color }}>
                      {d.label}{v}
                    </span>
                  );
                })}
              </span>
            </div>
            <p className="line-clamp-2 text-[13px] leading-relaxed text-body">{r.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
