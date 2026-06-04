"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, Plus, X, Trash2, AlertTriangle } from "lucide-react";
import {
  useTimetable,
  addToTimetable,
  removeFromTimetable,
  clearTimetable,
  buildSlotMap,
  type TimetableCourse,
} from "@/lib/timetable-store";
import { WEEKDAY_LABELS, PERIOD_TIMES } from "@/lib/period-shared";

const PERIODS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "A", "B", "C", "D"];
const WEEKDAYS = [1, 2, 3, 4, 5, 6];

const PALETTE = [
  "var(--rate-grading)",
  "var(--rate-quality)",
  "var(--rate-sweet)",
  "var(--cyan)",
  "var(--warning)",
  "var(--rate-load)",
];
function colorFor(code: string) {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) % PALETTE.length;
  return PALETTE[h];
}

type SearchItem = TimetableCourse & { credits: number | null };

export function TimetableBuilder() {
  const courses = useTimetable();
  const slotMap = buildSlotMap(courses);
  const hasConflict = [...slotMap.values()].some((arr) => arr.length > 1);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        {hasConflict && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-warning-soft bg-warning-soft/50 px-3 py-2 text-sm text-warning-deep">
            <AlertTriangle className="size-4" /> 課表有衝堂，紅色格子為衝突時段。
          </div>
        )}
        <Grid courses={courses} slotMap={slotMap} />
      </div>

      <aside className="space-y-4">
        <AddPanel />
        <SelectedList courses={courses} />
      </aside>
    </div>
  );
}

function Grid({
  courses,
  slotMap,
}: {
  courses: TimetableCourse[];
  slotMap: ReturnType<typeof buildSlotMap>;
}) {
  void courses;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-center text-xs">
        <thead>
          <tr>
            <th className="w-14 border border-hairline bg-canvas-soft p-1 font-normal text-mute">節次</th>
            {WEEKDAYS.map((wd) => (
              <th key={wd} className="border border-hairline bg-canvas-soft p-1 font-medium">
                {WEEKDAY_LABELS[wd]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((p) => (
            <tr key={p}>
              <td className="border border-hairline bg-canvas-soft p-1 align-middle">
                <div className="font-medium">{p}</div>
                <div className="text-[10px] leading-tight text-mute">{PERIOD_TIMES[p] ?? ""}</div>
              </td>
              {WEEKDAYS.map((wd) => {
                const here = slotMap.get(`${wd}-${p}`) ?? [];
                const conflict = here.length > 1;
                return (
                  <td
                    key={wd}
                    className={`h-12 min-w-[88px] border border-hairline p-0.5 align-top ${conflict ? "bg-error-soft/60" : ""}`}
                  >
                    {here.map((c) => (
                      <Link
                        key={c.courseCode + c.syllabusNo}
                        href={`/course/${encodeURIComponent(c.courseCode)}`}
                        className="mb-0.5 block rounded px-1 py-0.5 text-left text-[11px] leading-tight text-white"
                        style={{ backgroundColor: conflict ? "var(--error)" : colorFor(c.courseCode) }}
                        title={`${c.name}${c.classroom ? ` · ${c.classroom}` : ""}`}
                      >
                        <span className="line-clamp-2">{c.name}</span>
                      </Link>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddPanel() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    if (q.trim().length < 1) {
      setItems([]);
      return;
    }
    t.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/courses/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setItems(data.items ?? []);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [q]);

  return (
    <div className="elev-2 rounded-lg bg-canvas p-4">
      <h2 className="text-sm font-medium">加入課程</h2>
      <div className="relative mt-2">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mute" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋課程或教師…"
          className="h-9 w-full rounded-md border border-hairline bg-canvas pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
        {loading && <p className="px-1 py-2 text-xs text-mute">搜尋中…</p>}
        {!loading &&
          items.map((it) => (
            <button
              key={it.courseCode + it.syllabusNo}
              onClick={() =>
                addToTimetable({
                  courseCode: it.courseCode,
                  syllabusNo: it.syllabusNo,
                  name: it.name,
                  teachers: it.teachers,
                  classroom: it.classroom,
                  semesterId: it.semesterId,
                  slots: it.slots,
                })
              }
              className="flex w-full items-start gap-2 rounded-md p-2 text-left text-xs transition-colors hover:bg-secondary"
            >
              <Plus className="mt-0.5 size-3.5 shrink-0 text-link" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{it.name}</span>
                <span className="block truncate text-mute">
                  {it.courseCode} · {it.teachers.join("、") || "待聘"}
                </span>
              </span>
            </button>
          ))}
        {!loading && q.trim().length > 0 && items.length === 0 && (
          <p className="px-1 py-2 text-xs text-mute">沒有符合的課程。</p>
        )}
      </div>
    </div>
  );
}

function SelectedList({ courses }: { courses: TimetableCourse[] }) {
  return (
    <div className="elev-2 rounded-lg bg-canvas p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">已選 {courses.length} 門</h2>
        {courses.length > 0 && (
          <button
            onClick={clearTimetable}
            className="flex items-center gap-1 text-xs text-mute hover:text-error"
          >
            <Trash2 className="size-3" /> 清空
          </button>
        )}
      </div>
      {courses.length === 0 ? (
        <p className="mt-2 text-xs text-mute">從上方搜尋並加入課程,即可預覽課表與衝堂。</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {courses.map((c) => (
            <li
              key={c.courseCode + c.syllabusNo}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colorFor(c.courseCode) }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.name}</span>
                <span className="block truncate text-mute">{c.teachers.join("、") || "待聘"}</span>
              </span>
              <button
                onClick={() => removeFromTimetable(c)}
                aria-label="移除"
                className="text-mute hover:text-error"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
