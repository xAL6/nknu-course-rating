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
import {
  SEMESTER_TERMS,
  DEGREE_LEVELS,
  DAY_NIGHT_OPTIONS,
  CAMPUS_OPTIONS,
} from "@/lib/config";
import type { Facet } from "@/lib/data/courses";

type Current = {
  q?: string;
  semester?: string;
  dayNight?: string;
  campus?: string;
  level?: string;
  dept?: string;
  classCode?: string;
};

export function CoursesFilter({
  semesters,
  levels,
  departments,
  classes,
  current,
}: {
  semesters: string[];
  levels: Facet[];
  departments: Facet[];
  classes: Facet[];
  current: Current;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const sem = current.semester || semesters[0] || "";
  const [year, term] = sem.split("-");
  const years = [...new Set(semesters.map((s) => s.split("-")[0]))];
  const terms = [...new Set(semesters.map((s) => s.split("-")[1]))].sort();

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    router.push(`/courses?${next.toString()}`);
  }

  // Cascading resets: changing a parent clears dependent selections.
  const setSemester = (s: string) => update({ semester: s, dept: undefined, classCode: undefined });
  const setScope = (patch: Record<string, string | undefined>) =>
    update({ ...patch, dept: undefined, classCode: undefined });

  return (
    <div className="elev-1 space-y-3 rounded-lg bg-canvas p-4">
      {/* 日夜間 + 上課地點 */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Row label="日夜間">
          <Toggle active={!current.dayNight} onClick={() => setScope({ dayNight: undefined })}>
            全部
          </Toggle>
          {DAY_NIGHT_OPTIONS.map((o) => (
            <Toggle
              key={o.value}
              active={current.dayNight === o.value}
              onClick={() => setScope({ dayNight: o.value })}
            >
              {o.label}
            </Toggle>
          ))}
        </Row>
        <Row label="上課地點">
          <Toggle active={!current.campus} onClick={() => setScope({ campus: undefined })}>
            全部
          </Toggle>
          {CAMPUS_OPTIONS.map((o) => (
            <Toggle
              key={o.value}
              active={current.campus === o.value}
              onClick={() => setScope({ campus: o.value })}
            >
              {o.label}
            </Toggle>
          ))}
        </Row>
      </div>

      {/* 學年期 */}
      <Row label="學年期">
        <Select value={year} onValueChange={(y) => setSemester(`${y}-${term}`)}>
          <SelectTrigger className="w-[90px]">
            <SelectValue>{(v) => `${v ?? year} 學年`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y} 學年
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={term} onValueChange={(t) => setSemester(`${year}-${t}`)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue>{(v) => SEMESTER_TERMS[String(v ?? term)] ?? "學期"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {terms.map((t) => (
              <SelectItem key={t} value={t}>
                {SEMESTER_TERMS[t] ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      {/* 學制 */}
      <Row label="學制">
        <Toggle active={!current.level} onClick={() => setScope({ level: undefined })}>
          全部
        </Toggle>
        {DEGREE_LEVELS.map((l) => (
          <Toggle
            key={l.code}
            active={current.level === l.code}
            onClick={() => setScope({ level: l.code })}
          >
            {l.name}
          </Toggle>
        ))}
      </Row>

      {/* 系所 / 班級 (cascading) */}
      <Row label="系所 / 班級">
        <Select
          value={current.dept ?? "all"}
          onValueChange={(v) => update({ dept: v && v !== "all" ? v : undefined, classCode: undefined })}
        >
          <SelectTrigger className="w-auto min-w-[220px] max-w-[340px]">
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

        <Select
          value={current.classCode ?? "all"}
          onValueChange={(v) => update({ classCode: v && v !== "all" ? v : undefined })}
          disabled={!current.dept}
        >
          <SelectTrigger className="w-auto min-w-[200px] max-w-[320px]">
            <SelectValue>
              {(v) =>
                !v || v === "all"
                  ? current.dept
                    ? "全部班級"
                    : "請先選系所"
                  : (classes.find((c) => c.code === v)?.name ?? "全部班級")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部班級</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      {/* 搜尋 */}
      <form
        action="/courses"
        className="relative pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: (new FormData(e.currentTarget).get("q") as string) || undefined });
        }}
      >
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mute" />
        <input
          name="q"
          defaultValue={current.q ?? ""}
          placeholder="搜尋課程名稱、教師或代號…"
          className="h-10 w-full rounded-md border border-hairline bg-canvas pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-sm font-medium text-body">{label}</span>
      {children}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "border border-hairline text-body hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}
