import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/course-card";
import { CoursesFilter } from "@/components/courses-filter";
import { listCourses } from "@/lib/data/courses";

export const metadata = { title: "課程搜尋" };

type SP = { [k: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const KEYS = ["q", "semester", "dayNight", "campus", "level", "dept", "classCode"] as const;

export default async function CoursesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Number(str(sp.page) ?? "1") || 1;
  const current = Object.fromEntries(KEYS.map((k) => [k, str(sp[k])]));

  // A text search is cross-semester: drop the semester filter when there's a
  // query, so searching finds a course no matter which term it was offered in
  // (the in-page search box otherwise carries the selected semester).
  const result = await listCourses({
    ...current,
    semester: current.q ? undefined : current.semester,
    page,
  });

  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const mkHref = (p: number) => {
    const next = new URLSearchParams();
    for (const k of KEYS) if (current[k]) next.set(k, current[k]!);
    next.set("page", String(p));
    return `/courses?${next.toString()}`;
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">課程搜尋</h1>
        <p className="mt-1 text-sm text-body">
          共 {result.total} 門課程 · {current.q ? `「${current.q}」的結果` : "依條件篩選"}
        </p>
      </div>

      <div className="mt-6">
        <CoursesFilter
          semesters={result.semesters}
          levels={result.levels}
          departments={result.departments}
          classes={result.classes}
          current={current}
        />
      </div>

      {result.items.length === 0 ? (
        <div className="mt-12 rounded-lg bg-canvas-soft p-12 text-center">
          <p className="text-body">找不到符合條件的課程。</p>
          <Button render={<Link href="/courses" />} nativeButton={false} variant="outline" className="mt-4 rounded-full">
            清除篩選
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((c) => (
            <CourseCard key={`${c.courseCode} ${c.name}`} course={c} />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <Button
            render={page > 1 ? <Link href={mkHref(page - 1)} /> : <span />}
            nativeButton={false}
            variant="outline"
            size="icon"
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-3 text-sm text-body">
            {page} / {pageCount}
          </span>
          <Button
            render={page < pageCount ? <Link href={mkHref(page + 1)} /> : <span />}
            nativeButton={false}
            variant="outline"
            size="icon"
            disabled={page >= pageCount}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
