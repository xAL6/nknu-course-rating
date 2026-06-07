export default function Loading() {
  return (
    <div className="mx-auto max-w-[1000px] animate-pulse px-6 py-10">
      <div className="h-4 w-28 rounded bg-[color-mix(in_oklch,var(--ink)_10%,transparent)]" />
      <div className="mt-5 h-9 w-2/3 rounded-lg bg-[color-mix(in_oklch,var(--ink)_12%,transparent)]" />
      <div className="mt-2 h-4 w-40 rounded bg-[color-mix(in_oklch,var(--ink)_8%,transparent)]" />
      <div className="glass mt-8 h-72 rounded-2xl" />
      <div className="glass mt-5 h-96 rounded-2xl" />
    </div>
  );
}
