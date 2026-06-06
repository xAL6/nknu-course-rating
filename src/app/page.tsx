import Link from "next/link";
import { Search, Star, CalendarRange, Sparkles, ArrowRight, Flame, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE_TAGLINE } from "@/lib/config";
import { getHomeStats, getTrendingCourses } from "@/lib/data/community";

export default async function Home() {
  const [stats, trending] = await Promise.all([getHomeStats(), getTrendingCourses(6)]);

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-hairline">
        <div className="spectrum-bar absolute inset-x-0 top-0 h-1" aria-hidden />
        <div
          aria-hidden
          className="mesh-gradient pointer-events-none absolute inset-x-0 -top-32 h-[520px] opacity-40 dark:opacity-30"
        />
        <div className="relative mx-auto max-w-[1400px] px-6 pt-24 pb-20 text-center sm:pt-28">
          <span className="animate-rise inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas/80 px-3 py-1 font-mono text-xs text-body backdrop-blur">
            <span className="spectrum-bar size-2 rounded-full" /> 高師大・選課評價
          </span>
          <h1
            className="animate-rise mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl"
            style={{ animationDelay: "60ms" }}
          >
            選課前,先看看
            <br className="hidden sm:block" />
            <span className="text-spectrum">學長姐</span>怎麼說。
          </h1>
          <p
            className="animate-rise mx-auto mt-5 max-w-xl text-lg text-body text-pretty"
            style={{ animationDelay: "120ms" }}
          >
            {SITE_TAGLINE}
          </p>

          {/* Hero search */}
          <form
            action="/courses"
            className="animate-rise mx-auto mt-8 flex max-w-xl items-center gap-2"
            style={{ animationDelay: "180ms" }}
          >
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-mute" />
              <input
                name="q"
                placeholder="搜尋課程、教師或代號…"
                className="h-13 w-full rounded-full border border-hairline bg-canvas pr-4 pl-10 text-sm shadow-sm outline-none transition focus-visible:border-link focus-visible:ring-4 focus-visible:ring-link/15"
              />
            </div>
            <Button type="submit" size="lg" className="h-13 rounded-full px-7 text-sm">
              搜尋
            </Button>
          </form>

          {/* Real stat band */}
          <div
            className="animate-rise mx-auto mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
            style={{ animationDelay: "240ms" }}
          >
            <Stat n={stats.courses} label="課程資料" />
            <Dot />
            <Stat n={stats.departments} label="系所" />
            <Dot />
            <Stat n={stats.semesters} label="學年期" />
            {stats.reviews > 0 && (
              <>
                <Dot />
                <Stat n={stats.reviews} label="則評價" />
              </>
            )}
          </div>

          <div
            className="animate-rise mt-7 flex flex-wrap items-center justify-center gap-3 text-sm"
            style={{ animationDelay: "300ms" }}
          >
            <Button render={<Link href="/courses" />} nativeButton={false} variant="outline" className="rounded-full">
              瀏覽全部課程
            </Button>
            <Button render={<Link href="/ai" />} nativeButton={false} variant="ghost" className="gap-1.5 rounded-full">
              試試 AI 課程助手 <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── Feature trio (each owns a rating color) ── */}
      <section className="mx-auto grid max-w-[1400px] gap-4 px-6 py-20 md:grid-cols-3">
        <FeatureCard
          delay={0}
          color="var(--rate-sweet)"
          icon={<Star className="size-5" />}
          title="多維度評價"
          desc="甜度、涼度、負擔、品質、給分五大面向,量化每門課的真實樣貌。"
        />
        <FeatureCard
          delay={80}
          color="var(--rate-cool)"
          icon={<CalendarRange className="size-5" />}
          title="排課模擬"
          desc="把心儀的課加入課表,自動偵測衝堂,一眼看出一週的安排。"
        />
        <FeatureCard
          delay={160}
          color="var(--rate-quality)"
          icon={<Sparkles className="size-5" />}
          title="AI 課程助手"
          desc="用一句話描述你想要的課,AI 從同學評價中為你推薦最合適的選擇。"
        />
      </section>

      {/* ── Trending / cold-start ── */}
      <section className="mx-auto max-w-[1400px] px-6 pb-24">
        <div className="flex items-center gap-2">
          <Flame className="size-5 text-rate-sweet" />
          <h2 className="text-lg font-semibold tracking-tight">熱門課程</h2>
        </div>

        {trending.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trending.map((t, i) => (
              <Link
                key={`${t.courseKey}|${t.teacherKey}`}
                href={`/course/${encodeURIComponent(t.courseKey)}`}
                className="elev-1 card-pop group relative flex items-center gap-3 overflow-hidden rounded-xl bg-canvas p-4"
              >
                <span
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ backgroundColor: RANK_COLORS[i % RANK_COLORS.length] }}
                  aria-hidden
                />
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg font-mono text-sm font-semibold"
                  style={{
                    color: RANK_COLORS[i % RANK_COLORS.length],
                    backgroundColor: `color-mix(in srgb, ${RANK_COLORS[i % RANK_COLORS.length]} 14%, transparent)`,
                  }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium group-hover:text-link">{t.name}</span>
                  <span className="block truncate text-xs text-mute">
                    {t.teachers.length ? t.teachers.join("、") : t.courseCode}
                  </span>
                </span>
                {t.avgQuality != null && (
                  <span className="shrink-0 text-xs font-medium text-rate-quality">
                    品質 {t.avgQuality.toFixed(1)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-hairline bg-canvas-soft">
            <div className="spectrum-bar h-1" aria-hidden />
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <TrendingUp className="size-7 text-mute" />
              <p className="text-body">還沒有人評價過任何課——成為第一個分享心得的學長姐!</p>
              <Button render={<Link href="/courses" />} nativeButton={false} className="mt-1 rounded-full">
                去找一門課評價
              </Button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

const RANK_COLORS = [
  "var(--rate-sweet)",
  "var(--rate-grading)",
  "var(--rate-cool)",
  "var(--rate-quality)",
  "var(--rate-load)",
];

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xl font-semibold tracking-tight tabular-nums">{n.toLocaleString()}</span>
      <span className="text-sm text-mute">{label}</span>
    </div>
  );
}

function Dot() {
  return <span className="hidden size-1 rounded-full bg-hairline-strong sm:block" aria-hidden />;
}

function FeatureCard({
  icon,
  title,
  desc,
  color,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  delay: number;
}) {
  return (
    <div
      className="elev-2 card-pop animate-rise relative overflow-hidden rounded-2xl bg-canvas p-6"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} aria-hidden />
      <div
        className="flex size-11 items-center justify-center rounded-xl"
        style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
      >
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-body">{desc}</p>
    </div>
  );
}
