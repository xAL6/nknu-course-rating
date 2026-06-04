import { RATING_DIMENSIONS } from "@/lib/config";
import type { RatingSummary } from "@/lib/data/types";

/** Five-dimension rating bars. Shows an empty state when no reviews exist. */
export function RatingSummaryBars({
  summary,
  compact = false,
}: {
  summary: RatingSummary | null;
  compact?: boolean;
}) {
  if (!summary || summary.reviewCount === 0) {
    return (
      <p className="text-sm text-mute">
        尚無評價{!compact && "，成為第一個分享心得的人！"}
      </p>
    );
  }
  return (
    <div className={compact ? "space-y-1.5" : "space-y-3"}>
      {RATING_DIMENSIONS.map((d) => {
        const v = summary[d.key] as number | null;
        const pct = v ? (v / 5) * 100 : 0;
        return (
          <div key={d.key} className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-sm text-body">{d.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="rating-bar-fill h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: d.color }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-xs text-body">
              {v ? v.toFixed(1) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
