"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEMESTER_TERMS } from "@/lib/config";

export function CoursesFilter({
  departments,
  semesters,
  current,
}: {
  departments: { code: string; name: string }[];
  semesters: string[];
  current: { q?: string; dept?: string; semester?: string };
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === "all") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    router.push(`/courses?${next.toString()}`);
  }

  const semLabel = (id: string) => {
    const [y, t] = id.split("-");
    return `${y} ${SEMESTER_TERMS[t] ?? t}`;
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form
        action="/courses"
        className="relative flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          const q = new FormData(e.currentTarget).get("q") as string;
          update({ q });
        }}
      >
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mute" />
        <input
          name="q"
          defaultValue={current.q ?? ""}
          placeholder="搜尋課程、教師或代號…"
          className="h-10 w-full rounded-md border border-hairline bg-canvas pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      <Select
        value={current.semester ?? semesters[0]}
        onValueChange={(v) => update({ semester: v ?? undefined })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue>{(v) => semLabel(String(v ?? semesters[0]))}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {semesters.map((s) => (
            <SelectItem key={s} value={s}>
              {semLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={current.dept ?? "all"} onValueChange={(v) => update({ dept: v ?? undefined })}>
        <SelectTrigger className="w-[180px]">
          <SelectValue>
            {(v) =>
              !v || v === "all"
                ? "全部系所"
                : (departments.find((d) => d.code === v)?.name ?? "全部系所")
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部系所</SelectItem>
          {departments.map((d) => (
            <SelectItem key={d.code} value={d.code}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
