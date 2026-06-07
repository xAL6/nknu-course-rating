"use client";

import Link from "next/link";

/** Infinite horizontal ticker (pauses on hover). Duplicated track for seamless loop. */
export function Marquee({ items }: { items: { label: string; href: string }[] }) {
  if (!items.length) return null;
  const track = [...items, ...items];
  return (
    <div className="group relative overflow-hidden py-1 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <div className="animate-marquee flex w-max gap-2.5 group-hover:[animation-play-state:paused]">
        {track.map((it, i) => (
          <Link
            key={`${it.label}-${i}`}
            href={it.href}
            className="glass-soft glass-interactive shrink-0 rounded-full px-4 py-1.5 text-sm whitespace-nowrap text-body hover:text-ink"
          >
            {it.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
