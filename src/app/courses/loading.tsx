export default function Loading() {
  return (
    <div className="mx-auto max-w-[1240px] animate-pulse px-6 py-8">
      <div className="h-7 w-40 rounded-lg bg-[color-mix(in_oklch,var(--ink)_10%,transparent)]" />
      <div className="glass mt-6 h-36 rounded-2xl" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="glass-soft h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
