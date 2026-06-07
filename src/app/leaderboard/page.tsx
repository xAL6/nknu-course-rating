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
                  className="glass-soft flex items-center gap-3 rounded-md px-4 py-3"
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
                  key={`${t.courseKey}|${t.teacherKey}`}
                  href={`/course/${encodeURIComponent(t.courseKey)}?t=${encodeURIComponent(t.teacherKey)}`}
                  className="glass-soft glass-interactive flex items-center gap-3 rounded-md px-4 py-3"
                >
                  <span className="w-6 text-center font-mono text-sm text-mute">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.name}</div>
                    <div className="truncate text-xs text-mute">
                      {t.teachers.length ? t.teachers.join("、") : t.courseCode}
                    </div>
                  </div>
                  {t.avgQuality != null && (
                    <span className="shrink-0 text-xs text-mute">收穫 {t.avgQuality.toFixed(1)}</span>
                  )}
                  <span className="shrink-0 text-xs text-mute">{t.reviewCount} 則</span>
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
    <div className="glass rounded-lg p-8 text-center text-sm text-mute">{text}</div>
  );
}
