import Link from "next/link";
import { Search, Star, CalendarRange, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE_TAGLINE } from "@/lib/config";

export default function Home() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-hairline">
        <div
          aria-hidden
          className="mesh-gradient pointer-events-none absolute inset-x-0 -top-24 h-[420px] opacity-20 dark:opacity-25"
        />
        <div className="relative mx-auto max-w-[1400px] px-6 pt-24 pb-20 text-center sm:pt-28">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas-soft px-3 py-1 font-mono text-xs text-body">
            <Sparkles className="size-3" /> 高師大・選課評價
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
            選課前，先看看學長姐怎麼說。
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-body text-pretty">{SITE_TAGLINE}</p>

          {/* Hero search — server form, navigates to /courses */}
          <form action="/courses" className="mx-auto mt-8 flex max-w-xl items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mute" />
              <input
                name="q"
                placeholder="搜尋課程、教師或代號…"
                className="h-12 w-full rounded-full border border-hairline bg-canvas pr-4 pl-9 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button type="submit" size="lg" className="h-12 rounded-full px-6">
              搜尋
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Button
              render={<Link href="/courses" />}
              nativeButton={false}
              variant="outline"
              className="rounded-full"
            >
              瀏覽全部課程
            </Button>
            <Button
              render={<Link href="/ai" />}
              nativeButton={false}
              variant="ghost"
              className="gap-1.5 rounded-full"
            >
              試試 AI 課程助手 <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── Feature trio ── */}
      <section className="mx-auto grid max-w-[1400px] gap-4 px-6 py-20 md:grid-cols-3">
        <FeatureCard
          icon={<Star className="size-5" />}
          title="多維度評價"
          desc="甜度、涼度、負擔、品質、給分五大面向，量化每門課的真實樣貌。"
        />
        <FeatureCard
          icon={<CalendarRange className="size-5" />}
          title="排課模擬"
          desc="把心儀的課加入課表，自動偵測衝堂，一眼看出一週的安排。"
        />
        <FeatureCard
          icon={<Sparkles className="size-5" />}
          title="AI 課程助手"
          desc="用一句話描述你想要的課，AI 從同學評價中為你推薦最合適的選擇。"
        />
      </section>
    </>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="elev-2 hover:elev-3 rounded-lg bg-canvas p-6 transition-shadow">
      <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-ink">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-body">{desc}</p>
    </div>
  );
}
