import Link from "next/link";
import { GraduationCap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavAuth } from "@/components/nav-auth";
import { MobileNav } from "@/components/mobile-nav";
import { SITE_NAME } from "@/lib/config";

const LINKS = [
  { href: "/courses", label: "課程" },
  { href: "/teachers", label: "教師" },
  { href: "/timetable", label: "排課" },
  { href: "/leaderboard", label: "排行榜" },
];

export function SiteNav() {
  return (
    <header className="glass-strong sticky top-0 z-50 w-full">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <MobileNav />
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <GraduationCap className="size-5" />
          <span className="hidden sm:inline">{SITE_NAME}</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-1.5 text-sm text-body transition-colors hover:bg-secondary hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            render={<Link href="/ai" />}
            nativeButton={false}
            variant="outline"
            size="sm"
            className="hidden gap-1.5 sm:inline-flex"
          >
            <Sparkles className="size-3.5" />
            AI 助手
          </Button>
          <ThemeToggle />
          <NavAuth />
        </div>
      </div>
    </header>
  );
}
