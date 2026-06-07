export default function Loading() {
  return (
    <div className="mx-auto max-w-[1240px] animate-pulse px-6 py-8">
      <div className="h-7 w-32 rounded-lg bg-[color-mix(in_oklch,var(--ink)_10%,transparent)]" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="glass-soft h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
