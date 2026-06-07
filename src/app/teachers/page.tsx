import Link from "next/link";
import { Search, BookOpen } from "lucide-react";
import { listTeachers } from "@/lib/data/teachers";

export const metadata = { title: "教師列表" };

type SP = { [k: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TeachersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = str(sp.q);
  const teachers = await listTeachers(q);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">教師列表</h1>
      <p className="mt-1 text-sm text-body">共 {teachers.length} 位教師</p>

      <form action="/teachers" className="relative mt-6 max-w-md">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mute" />
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="搜尋教師姓名…"
          className="glass-soft h-10 w-full rounded-md pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-link/30"
        />
      </form>

      {teachers.length === 0 ? (
        <div className="glass mt-12 rounded-lg p-12 text-center text-sm text-mute">
          找不到教師。
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {teachers.map((t) => (
            <Link
              key={t.name}
              href={`/teacher/${encodeURIComponent(t.name)}`}
              className="glass-soft glass-interactive flex items-center justify-between gap-2 rounded-lg px-4 py-3"
            >
              <span className="truncate font-medium">{t.name}</span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-mute">
                <BookOpen className="size-3" />
                {t.courseCount}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
