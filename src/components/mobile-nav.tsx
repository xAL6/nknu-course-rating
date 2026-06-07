"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Sparkles } from "lucide-react";

const LINKS = [
  { href: "/courses", label: "課程" },
  { href: "/teachers", label: "教師" },
  { href: "/timetable", label: "排課" },
  { href: "/leaderboard", label: "排行榜" },
  { href: "/ai", label: "AI 助手", icon: true },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the overlay is open. (Each nav link also closes the
  // menu via its own onClick, so route changes dismiss it.)
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "關閉選單" : "開啟選單"}
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-md text-body transition-colors hover:bg-secondary"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 top-16 z-40 bg-ink/20 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <nav className="glass-strong fixed inset-x-0 top-16 z-50 p-4">
            <div className="flex flex-col gap-1">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-3 text-base text-body transition-colors hover:bg-secondary"
                >
                  {l.icon && <Sparkles className="size-4" />}
                  {l.label}
                </Link>
              ))}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
