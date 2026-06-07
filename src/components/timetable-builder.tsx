"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { Search, Plus, X, Trash2, AlertTriangle, Share2, Save, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import {
  useTimetable,
  addToTimetable,
  removeFromTimetable,
  clearTimetable,
  replaceTimetable,
  timetableSemester,
  encodeShare,
  decodeShare,
  buildSlotMap,
  type TimetableCourse,
} from "@/lib/timetable-store";
import { saveTimetable, loadTimetable } from "@/lib/actions";
import { SEMESTER_TERMS } from "@/lib/config";
import { WEEKDAY_LABELS, PERIOD_TIMES } from "@/lib/period-shared";

const semLabel = (id: string | null) => {
  if (!id) return null;
  const [y, t] = id.split("-");
  return `${y} ${SEMESTER_TERMS[t] ?? t}`;
};

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
  const semester = timetableSemester(courses);

  // Import a shared timetable from the URL (?s=token) once on mount.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("s");
    if (!token) return;
    const imported = decodeShare(token);
    if (imported && imported.length) {
      replaceTimetable(imported);
      toast.success(`已載入分享的課表（${imported.length} 門）`);
    }
    // Clean the URL so a refresh doesn't re-import.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <Toolbar courses={courses} semester={semester} />
        {hasConflict && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-warning-soft bg-warning-soft/50 px-3 py-2 text-sm text-warning-deep">
            <AlertTriangle className="size-4" /> 課表有衝堂，紅色格子為衝突時段。
          </div>
        )}
        <Grid courses={courses} slotMap={slotMap} />
      </div>

      <aside className="space-y-4">
        <AddPanel semester={semester} />
        <SelectedList courses={courses} />
      </aside>
    </div>
  );
}

function Toolbar({
  courses,
  semester,
}: {
  courses: TimetableCourse[];
  semester: string | null;
}) {
  const [saving, startSave] = useTransition();
  const [loadingAcct, startLoad] = useTransition();

  async function share() {
    if (!courses.length) {
      toast("課表是空的，先加入課程吧。");
      return;
    }
    const url = `${window.location.origin}/timetable?s=${encodeShare(courses)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("分享連結已複製到剪貼簿");
    } catch {
      toast.error("無法複製，請手動複製網址列。");
    }
  }

  function save() {
    startSave(async () => {
      try {
        const res = await saveTimetable(courses);
        toast.success(`已儲存到帳號（${res.count} 門）`);
      } catch {
        toast.error("請先以高師大信箱登入才能儲存。");
      }
    });
  }

  function loadAccount() {
    startLoad(async () => {
      try {
        const saved = await loadTimetable();
        if (!saved || !saved.courses.length) {
          toast("帳號中沒有已儲存的課表。");
          return;
        }
        replaceTimetable(saved.courses as TimetableCourse[]);
        toast.success(`已載入帳號課表（${saved.courses.length} 門）`);
      } catch {
        toast.error("載入失敗，請先登入。");
      }
    });
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {semester && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas-soft px-3 py-1 text-xs font-medium text-body">
          <CalendarRange className="size-3.5" /> {semLabel(semester)}・本學期
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={share}
          className="flex items-center gap-1 rounded-full border border-hairline px-3 py-1 text-xs text-body transition-colors hover:bg-secondary"
        >
          <Share2 className="size-3.5" /> 分享
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1 rounded-full border border-hairline px-3 py-1 text-xs text-body transition-colors hover:bg-secondary disabled:opacity-50"
        >
          <Save className="size-3.5" /> 儲存
        </button>
        <button
          onClick={loadAccount}
          disabled={loadingAcct}
          className="flex items-center gap-1 rounded-full border border-hairline px-3 py-1 text-xs text-body transition-colors hover:bg-secondary disabled:opacity-50"
        >
          載入
        </button>
      </div>
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
                        href={`/course/${encodeURIComponent(c.courseKey || c.courseCode)}`}
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

function AddPanel({ semester }: { semester: string | null }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(async () => {
      if (q.trim().length < 1) {
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        // Once a timetable is locked to a semester, scope the search to it.
        const qs = new URLSearchParams({ q });
        if (semester) qs.set("semester", semester);
        const res = await fetch(`/api/courses/search?${qs.toString()}`);
        const data = await res.json();
        setItems(data.items ?? []);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [q, semester]);

  return (
    <div className="glass rounded-lg p-4">
      <h2 className="text-sm font-medium">加入課程</h2>
      <div className="relative mt-2">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mute" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋課程或教師…"
          className="glass-soft h-9 w-full rounded-md pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-link/30"
        />
      </div>
      <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
        {loading && <p className="px-1 py-2 text-xs text-mute">搜尋中…</p>}
        {!loading &&
          items.map((it) => (
            <button
              key={it.courseCode + it.syllabusNo}
              onClick={() => {
                const res = addToTimetable({
                  courseCode: it.courseCode,
                  courseKey: it.courseKey,
                  syllabusNo: it.syllabusNo,
                  name: it.name,
                  teachers: it.teachers,
                  classroom: it.classroom,
                  semesterId: it.semesterId,
                  slots: it.slots,
                });
                if (res.ok) toast.success("已加入課表");
                else if (res.reason === "semester")
                  toast.error("課表已鎖定其他學期，請先清空再加入。");
                else toast("這門課已在課表中");
              }}
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
    <div className="glass rounded-lg p-4">
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
