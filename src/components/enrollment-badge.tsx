import { fillRate, enrollLevel, fillPct } from "@/lib/enrollment";

/**
 * 搶課熱度徽章 — a small pill showing how full a course is (爆滿/搶手/適中/好上)
 * with the fill percentage. Pass either count+cap (per offering) or a
 * precomputed rate (e.g. a historical average). Renders nothing without data.
 */
export function EnrollmentBadge({
  count,
  cap,
  rate: rateProp,
  className,
}: {
  count?: number | null;
  cap?: number | null;
  rate?: number | null;
  className?: string;
}) {
  const rate = rateProp ?? fillRate(count, cap);
  const level = enrollLevel(rate);
  if (!level) return null;

  const pct = fillPct(rate);
  const detail = count != null && cap != null ? `（${count}/${cap}）` : "";

  return (
    <span
      title={`額滿程度 ${pct}${detail}・${level.hint}`}
      className={`inline-flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 text-xs font-medium ${className ?? ""}`}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: level.tone }} />
      <span style={{ color: level.tone }}>{level.label}</span>
      {pct && <span className="font-mono text-mute">{pct}</span>}
    </span>
  );
}
