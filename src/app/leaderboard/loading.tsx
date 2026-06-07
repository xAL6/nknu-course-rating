export default function Loading() {
  return (
    <div className="mx-auto max-w-[1100px] animate-pulse px-6 py-10">
      <div className="h-7 w-28 rounded-lg bg-[color-mix(in_oklch,var(--ink)_10%,transparent)]" />
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, col) => (
          <div key={col} className="space-y-2.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass-soft h-14 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
