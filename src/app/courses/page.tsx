import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/course-card";
import { CoursesFilter } from "@/components/courses-filter";
import { listCourses } from "@/lib/data/courses";

export const metadata = { title: "課程搜尋" };

type SP = { [k: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CoursesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Number(str(sp.page) ?? "1") || 1;
  const result = await listCourses({
    q: str(sp.q),
    dept: str(sp.dept),
    semester: str(sp.semester),
    level: str(sp.level),
    page,
  });

  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const mkHref = (p: number) => {
    const next = new URLSearchParams();
    if (str(sp.q)) next.set("q", str(sp.q)!);
    if (str(sp.dept)) next.set("dept", str(sp.dept)!);
    if (str(sp.semester)) next.set("semester", str(sp.semester)!);
    if (str(sp.level)) next.set("level", str(sp.level)!);
    next.set("page", String(p));
    return `/courses?${next.toString()}`;
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">課程搜尋</h1>
          <p className="mt-1 text-sm text-body">
            共 {result.total} 門課程 · {str(sp.q) ? `「${str(sp.q)}」的結果` : "瀏覽全部"}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <CoursesFilter
          departments={result.departments}
          semesters={result.semesters}
          levels={result.levels}
          current={{ q: str(sp.q), dept: str(sp.dept), semester: str(sp.semester), level: str(sp.level) }}
        />
      </div>

      {result.items.length === 0 ? (
        <div className="mt-16 rounded-lg bg-canvas-soft p-12 text-center">
          <p className="text-body">找不到符合條件的課程。</p>
          <Button render={<Link href="/courses" />} nativeButton={false} variant="outline" className="mt-4 rounded-full">
            清除篩選
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((c) => (
            <CourseCard key={c.courseCode} course={c} />
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
