import Link from "next/link";
import {
  Search, Star, CalendarRange, Sparkles, ArrowRight, Flame, TrendingUp, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { CountUp } from "@/components/count-up";
import { ReviewMarquee } from "@/components/review-marquee";
import { SITE_TAGLINE } from "@/lib/config";
import { getHomeStats, getTrendingCourses, getRecentReviews } from "@/lib/data/community";

const RATE = [
  { label: "甜度", v: 86, c: "var(--rate-sweet)" },
  { label: "涼度", v: 72, c: "var(--rate-cool)" },
  { label: "收穫", v: 92, c: "var(--rate-quality)" },
];

export default async function Home() {
  const [stats, trending, recentReviews] = await Promise.all([
    getHomeStats(),
    getTrendingCourses(6),
    getRecentReviews(16),
  ]);

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-12 px-6 pt-20 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
          {/* copy */}
          <div className="text-center lg:text-left">
            <span className="glass-strong animate-rise inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs text-body">
              <span className="size-2 rounded-full" style={{ backgroundColor: "var(--rate-sweet)" }} /> 高師大・選課評價
            </span>
            <h1
              className="animate-rise mt-6 text-[2.6rem] leading-[1.04] font-semibold tracking-tight text-balance sm:text-6xl"
              style={{ animationDelay: "60ms" }}
            >
              選課前,先看看
              <br />
              <span style={{ color: "var(--rate-sweet)" }}>學長姐</span>怎麼說。
            </h1>
            <p
              className="animate-rise mx-auto mt-5 max-w-md text-lg text-body text-pretty lg:mx-0"
              style={{ animationDelay: "120ms" }}
            >
              {SITE_TAGLINE}
            </p>

            <form
              action="/courses"
              className="animate-rise mx-auto mt-8 flex max-w-md items-center gap-2 lg:mx-0"
              style={{ animationDelay: "180ms" }}
            >
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-mute" />
                <input
                  name="q"
                  placeholder="搜尋課程、教師或代號…"
                  className="glass h-13 w-full rounded-full pr-4 pl-10 text-sm text-ink outline-none transition placeholder:text-mute focus-visible:ring-4 focus-visible:ring-link/25"
                />
              </div>
              <Button type="submit" size="lg" className="h-13 rounded-full px-7 text-sm">
                搜尋
              </Button>
            </form>

            <div
              className="animate-rise mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 lg:justify-start"
              style={{ animationDelay: "240ms" }}
            >
              <Stat n={stats.courses} label="課程資料" />
              <Stat n={stats.departments} label="系所" />
              <Stat n={stats.semesters} label="學年期" />
            </div>

            <div
              className="animate-rise mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
              style={{ animationDelay: "300ms" }}
            >
              <Button render={<Link href="/courses" />} nativeButton={false} className="rounded-full">
                瀏覽全部課程
              </Button>
              <Button render={<Link href="/ai" />} nativeButton={false} variant="outline" className="gap-1.5 rounded-full">
                試試 AI 課程助手 <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* floating product preview */}
          <Reveal delay={0.15} className="hidden lg:block">
            <div className="relative">
              {/* stacked back card for depth */}
              <div className="glass-soft absolute -top-4 right-6 left-10 h-24 rounded-2xl opacity-60" aria-hidden />
              <div className="glass animate-float relative rounded-3xl p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-xs text-rate-grading">EN201</div>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight">英文寫作（一）</h3>
                    <p className="mt-0.5 text-xs text-mute">周雋 · 週三 3,4</p>
                  </div>
                  <span className="rounded-full bg-[color-mix(in_oklch,var(--rate-grading)_16%,transparent)] px-2 py-0.5 text-xs font-medium text-rate-grading">
                    4.6 ★
                  </span>
                </div>
                <div className="mt-5 space-y-2.5">
                  {RATE.map((r) => (
                    <div key={r.label} className="flex items-center gap-3">
                      <span className="w-8 shrink-0 text-xs text-mute">{r.label}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--ink)_8%,transparent)]">
                        <span className="block h-full rounded-full" style={{ width: `${r.v}%`, backgroundColor: r.c }} />
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4 text-xs text-mute">
                  <span>52 則評價</span>
                  <span className="text-rate-quality">收穫滿滿</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* live review ticker */}
        {recentReviews.length >= 3 && (
          <div className="relative mx-auto max-w-[1400px] px-6 pb-14">
            <p className="mb-3 px-1 text-xs font-medium tracking-wide text-mute">學長姐怎麼說</p>
            <ReviewMarquee reviews={recentReviews} />
          </div>
        )}
      </section>

      {/* ── Bento features ── */}
      <section className="mx-auto max-w-[1240px] px-6 py-16">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight">不只是評分,是一整套選課工具</h2>
          <p className="mt-2 text-body">從看評價、排課表到 AI 推薦,選課需要的都在這。</p>
        </Reveal>
        <div className="mt-8 grid gap-4 md:auto-rows-[196px] md:grid-cols-3">
          <Reveal className="md:col-span-2 md:row-span-2" delay={0.05}>
            <BentoBig />
          </Reveal>
          <Reveal delay={0.1}>
            <Bento color="var(--rate-quality)" icon={<Sparkles className="size-5" />} title="AI 課程助手" desc="一句話描述需求,從同學評價中推薦。" />
          </Reveal>
          <Reveal delay={0.15}>
            <Bento color="var(--rate-cool)" icon={<CalendarRange className="size-5" />} title="排課模擬" desc="加課自動偵測衝堂,一眼看懂一週。" />
          </Reveal>
          <Reveal className="md:col-span-3" delay={0.2}>
            <Bento
              color="var(--rate-grading)"
              icon={<Layers className="size-5" />}
              title="跨學期搜尋・每位老師各自評分"
              desc="搜尋跨所有學年期,同一門課的歷年開課自動合併;每位老師的版本分開評分,選課更精準。"
              row
            />
          </Reveal>
        </div>
      </section>

      {/* ── Trending ── */}
      <section className="mx-auto max-w-[1240px] px-6 pb-24">
        <Reveal>
          <div className="flex items-center gap-2">
            <Flame className="size-5 text-rate-sweet" />
            <h2 className="text-lg font-semibold tracking-tight">熱門課程</h2>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          {trending.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {trending.map((t, i) => (
                <Link
                  key={`${t.courseKey}|${t.teacherKey}`}
                  href={`/course/${encodeURIComponent(t.courseKey)}?t=${encodeURIComponent(t.teacherKey)}`}
                  className="glass-soft glass-interactive group relative flex items-center gap-3 overflow-hidden rounded-xl p-4"
                >
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-lg font-mono text-sm font-semibold"
                    style={{ color: RANK[i % RANK.length], backgroundColor: `color-mix(in oklch, ${RANK[i % RANK.length]} 16%, transparent)` }}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium group-hover:text-link">{t.name}</span>
                    <span className="block truncate text-xs text-mute">{t.teachers.join("、") || t.courseCode}</span>
                  </span>
                  {t.avgQuality != null && <span className="shrink-0 text-xs font-medium text-rate-quality">收穫 {t.avgQuality.toFixed(1)}</span>}
                </Link>
              ))}
            </div>
          ) : (
            <div className="glass mt-5 overflow-hidden rounded-2xl">
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
        </Reveal>
      </section>
    </>
  );
}

const RANK = ["var(--rate-sweet)", "var(--rate-grading)", "var(--rate-cool)", "var(--rate-quality)", "var(--rate-load)"];

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <CountUp to={n} className="text-2xl font-semibold tracking-tight tabular-nums" />
      <span className="text-sm text-mute">{label}</span>
    </div>
  );
}

function BentoBig() {
  return (
    <div className="glass glass-interactive relative flex h-full flex-col overflow-hidden rounded-2xl p-6">
      <div className="flex size-11 items-center justify-center rounded-xl" style={{ color: "var(--rate-sweet)", backgroundColor: "color-mix(in oklch, var(--rate-sweet) 14%, transparent)" }}>
        <Star className="size-5" />
      </div>
      <h3 className="mt-4 text-xl font-semibold tracking-tight">三維度評分</h3>
      <p className="mt-2 max-w-sm text-sm text-body">甜度、涼度、收穫——三個面向量化每門課的真實樣貌,不再只看一個總分。</p>
      <div className="mt-auto space-y-2 pt-6">
        {RATE.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-8 shrink-0 text-xs text-mute">{r.label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--ink)_8%,transparent)]">
              <span className="block h-full rounded-full" style={{ width: `${r.v}%`, backgroundColor: r.c }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bento({
  icon, title, desc, color, row,
}: { icon: React.ReactNode; title: string; desc: string; color: string; row?: boolean }) {
  return (
    <div className={`glass glass-interactive relative h-full overflow-hidden rounded-2xl p-6 ${row ? "flex flex-col justify-center" : ""}`}>
      <div className="flex size-10 items-center justify-center rounded-xl" style={{ color, backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)` }}>
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-xl text-sm text-body">{desc}</p>
    </div>
  );
}
