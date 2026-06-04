import Link from "next/link";
import { Trophy, Flame, Star } from "lucide-react";
import { getTopContributors, getTrendingCourses } from "@/lib/data/community";

export const metadata = { title: "排行榜" };

export default async function LeaderboardPage() {
  const [contributors, trending] = await Promise.all([
    getTopContributors(),
    getTrendingCourses(),
  ]);

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">排行榜</h1>
      <p className="mt-1 text-sm text-body">最熱心的貢獻者與最多人評價的課程。</p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="flex items-center gap-2 text-sm font-medium text-body">
            <Trophy className="size-4" /> 貢獻排行
          </h2>
          <div className="mt-3 space-y-2">
            {contributors.length === 0 ? (
              <Empty text="目前還沒有評價貢獻,快來搶頭香!" />
            ) : (
              contributors.map((c, i) => (
                <div
                  key={c.displayName + i}
                  className="elev-1 flex items-center gap-3 rounded-md bg-canvas px-4 py-3"
                >
                  <span className="w-6 text-center font-mono text-sm text-mute">{i + 1}</span>
                  <span className="flex-1 font-medium">{c.displayName}</span>
                  <span className="text-xs text-mute">{c.reviewCount} 則評價</span>
                  <span className="flex items-center gap-1 text-sm font-medium text-violet">
                    <Star className="size-3.5" /> {c.reputation}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="flex items-center gap-2 text-sm font-medium text-body">
            <Flame className="size-4" /> 熱門課程
          </h2>
          <div className="mt-3 space-y-2">
            {trending.length === 0 ? (
              <Empty text="還沒有課程被評價。" />
            ) : (
              trending.map((t, i) => (
                <Link
                  key={t.courseCode}
                  href={`/course/${encodeURIComponent(t.courseCode)}`}
                  className="elev-1 hover:elev-2 flex items-center gap-3 rounded-md bg-canvas px-4 py-3 transition-shadow"
                >
                  <span className="w-6 text-center font-mono text-sm text-mute">{i + 1}</span>
                  <span className="flex-1 font-mono text-sm">{t.courseCode}</span>
                  {t.avgQuality != null && (
                    <span className="text-xs text-mute">品質 {t.avgQuality.toFixed(1)}</span>
                  )}
                  <span className="text-xs text-mute">{t.reviewCount} 則</span>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg bg-canvas-soft p-8 text-center text-sm text-mute">{text}</div>
  );
}
