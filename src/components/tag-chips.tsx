/**
 * Quick-tag chips. Two modes:
 *  - `counts`: aggregated tag → count (course/teacher summary), sorted desc, shows the number.
 *  - `tags`:   a plain list (one review's own tags), no numbers.
 */
export function TagChips({
  tags,
  counts,
  max,
  className,
}: {
  tags?: string[];
  counts?: Record<string, number> | null;
  max?: number;
  className?: string;
}) {
  let entries: [string, number | null][];
  if (counts) {
    entries = Object.entries(counts).sort((a, b) => b[1] - a[1]) as [string, number][];
  } else {
    entries = (tags ?? []).map((t) => [t, null] as [string, number | null]);
  }
  if (max != null) entries = entries.slice(0, max);
  if (entries.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      {entries.map(([tag, n]) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full border border-hairline bg-secondary/60 px-2.5 py-0.5 text-xs text-body"
        >
          {tag}
          {n != null && <span className="font-mono text-mute">{n}</span>}
        </span>
      ))}
    </div>
  );
}
