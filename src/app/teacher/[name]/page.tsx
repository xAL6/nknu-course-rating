import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RatingSummaryBars } from "@/components/rating-summary";
import { getTeacher } from "@/lib/data/teachers";
import { SEMESTER_TERMS } from "@/lib/config";

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return { title: `${decodeURIComponent(name)} 教師` };
}

export default async function TeacherPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const teacher = await getTeacher(decodeURIComponent(name));
  if (!teacher) notFound();

  const semLabel = (id: string) => {
    const [y, t] = id.split("-");
    return `${y} ${SEMESTER_TERMS[t] ?? t}`;
  };

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10">
      <Button render={<Link href="/teachers" />} nativeButton={false} variant="ghost" size="sm" className="mb-4 gap-1">
        <ArrowLeft className="size-4" /> 返回教師列表
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{teacher.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-body">
            <BookOpen className="size-4" /> 開設 {teacher.courseCount} 門課程
          </p>

          <section className="mt-8">
            <h2 className="text-sm font-medium tracking-tight text-body">開設課程</h2>
            <div className="mt-3 space-y-2">
              {teacher.courses.map((c) => (
                <Link
                  key={c.courseCode}
                  href={`/course/${encodeURIComponent(c.courseCode)}`}
                  className="elev-1 hover:elev-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-canvas px-4 py-3 transition-shadow"
                >
                  <span className="font-mono text-xs text-mute">{c.courseCode}</span>
                  <span className="font-medium">{c.name}</span>
                  {c.credits != null && <Badge variant="secondary">{c.credits} 學分</Badge>}
                  <span className="ml-auto font-mono text-xs text-mute">
                    {semLabel(c.latestSemester)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="elev-2 rounded-lg bg-canvas p-5">
            <h2 className="text-sm font-medium tracking-tight text-body">教師綜合評分</h2>
            <p className="mt-1 text-xs text-mute">跨所有課程平均</p>
            <div className="mt-4">
              <RatingSummaryBars summary={teacher.summary} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
