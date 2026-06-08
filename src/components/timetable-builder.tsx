"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { Search, Plus, X, Trash2, AlertTriangle, Share2, Save, CalendarRange, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  useTimetable,
  addToTimetable,
  removeFromTimetable,
  clearTimetable,
  replaceTimetable,
  timetableSemester,
  timetableTerm,
  encodeShare,
  decodeShare,
  buildSlotMap,
  type TimetableCourse,
} from "@/lib/timetable-store";
import { saveTimetable, loadTimetable } from "@/lib/actions";
import { SEMESTER_TERMS } from "@/lib/config";
import { WEEKDAY_LABELS, PERIOD_TIMES } from "@/lib/period-shared";
import { findCommuteIssues, campusFromRoom } from "@/lib/campus";
import { colorFor } from "@/lib/timetable-colors";
import { downloadTimetablePng } from "@/lib/timetable-image";
import { Download } from "lucide-react";

const semLabel = (id: string | null) => {
  if (!id) return null;
  const [y, t] = id.split("-");
  return `${y} ${SEMESTER_TERMS[t] ?? t}`;
};

const PERIODS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "T", "A", "B", "C", "D"];
const WEEKDAYS = [1, 2, 3, 4, 5, 6];

type SearchItem = TimetableCourse & { credits: number | null };

export function TimetableBuilder({ defaultTerm = "2" }: { defaultTerm?: string }) {
  const courses = useTimetable();
  const slotMap = buildSlotMap(courses);
  const hasConflict = [...slotMap.values()].some((arr) => arr.length > 1);
  const semester = timetableSemester(courses);
  const lockedTerm = timetableTerm(courses);
  const [pickedTerm, setPickedTerm] = useState(defaultTerm);
  // Once a course is added the term is locked to it; otherwise the user picks.
  const term = lockedTerm ?? pickedTerm;
  // Cross-campus commute warnings: same-day campus switches with ≤1 free period.
  const commuteIssues = findCommuteIssues(courses, PERIODS).filter((i) => i.gap <= 1);

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
        <Toolbar courses={courses} semester={semester} term={term} />
        {hasConflict && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-warning-soft bg-warning-soft/50 px-3 py-2 text-sm text-warning-deep">
            <AlertTriangle className="size-4" /> 課表有衝堂，紅色格子為衝突時段。
          </div>
        )}
        {commuteIssues.length > 0 && (
          <div className="mb-3 rounded-md border border-warning-soft bg-warning-soft/50 px-3 py-2 text-warning-deep">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="size-4" /> 跨校區提醒（和平 ↔ 燕巢）
            </div>
            <ul className="mt-1 space-y-0.5 pl-6 text-xs">
              {commuteIssues.map((it, i) => (
                <li key={i} className="list-disc">
                  {WEEKDAY_LABELS[it.weekday]} 第{it.fromPeriod}節（{it.fromCampus}）→ 第{it.toPeriod}節（{it.toCampus}）：
                  {it.gap === 0 ? "緊接著換校區，通勤時間不足" : "中間僅 1 節空堂，留意通勤時間"}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Grid courses={courses} slotMap={slotMap} />
      </div>

      <aside className="space-y-4">
        <TermPicker term={term} setTerm={setPickedTerm} locked={!!lockedTerm} />
        <AddPanel term={term} />
        <SelectedList courses={courses} />
      </aside>
    </div>
  );
}

function Toolbar({
  courses,
  semester,
  term,
}: {
  courses: TimetableCourse[];
  semester: string | null;
  term: string;
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
      <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas-soft px-3 py-1 text-xs font-medium text-body">
        <CalendarRange className="size-3.5" /> {SEMESTER_TERMS[term] ?? term}・跨學年
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => {
            if (!courses.length) return toast("課表是空的，先加入課程吧。");
            const d = new Date();
            const ds = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
            downloadTimetablePng(courses, semLabel(semester), ds);
            toast.success("課表圖片已下載");
          }}
          className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-[color:var(--accent)] transition-colors hover:bg-[var(--accent-soft)]"
          style={{ border: "1px solid var(--accent-line)" }}
        >
          <Download className="size-3.5" /> 下載課表
        </button>
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
  const cellBg = "color-mix(in oklch, var(--ink) 4%, transparent)";
  const headBg = "color-mix(in oklch, var(--ink) 7%, transparent)";
  return (
    <div className="glass overflow-hidden rounded-2xl p-2 sm:p-3">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-center">
          <thead>
            <tr>
              <th className="w-11 rounded-lg py-2 text-xs font-normal text-mute" style={{ background: headBg }}>
                節次
              </th>
              {WEEKDAYS.map((wd) => (
                <th
                  key={wd}
                  className="min-w-[96px] rounded-lg py-2 text-sm font-semibold text-ink"
                  style={{ background: headBg }}
                >
                  {WEEKDAY_LABELS[wd]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => (
              <tr key={p}>
                <td className="rounded-lg py-1 align-middle" style={{ background: headBg }}>
                  <div className="text-sm font-semibold text-body">{p}</div>
                  <div className="text-[10px] leading-tight text-mute">{PERIOD_TIMES[p] ?? ""}</div>
                </td>
                {WEEKDAYS.map((wd) => {
                  const here = slotMap.get(`${wd}-${p}`) ?? [];
                  const conflict = here.length > 1;
                  return (
                    <td
                      key={wd}
                      className="h-14 min-w-[96px] rounded-lg p-1 align-top"
                      style={{ background: cellBg }}
                    >
                      <div className="flex h-full flex-col gap-1">
                        {here.map((c) => (
                          <Link
                            key={c.courseCode + c.syllabusNo}
                            href={`/course/${encodeURIComponent(c.courseKey || c.courseCode)}`}
                            className="block flex-1 rounded-md px-1.5 py-1 text-left leading-tight text-white shadow-sm transition-transform duration-150 hover:scale-[1.04]"
                            style={{
                              backgroundColor: colorFor(c.courseCode),
                              // Conflict marks only THIS period (not the whole course): keep the
                              // course colour for identity, add a red ring so you see exactly
                              // which time slot clashes.
                              ...(conflict
                                ? { boxShadow: "inset 0 0 0 2px var(--error), inset 0 0 0 4px color-mix(in oklch, var(--error) 30%, transparent)" }
                                : {}),
                            }}
                            title={`${c.name}${c.classroom ? ` · ${c.classroom}` : ""}${
                              campusFromRoom(c.campus ?? c.classroom) ? `（${campusFromRoom(c.campus ?? c.classroom)}）` : ""
                            }${conflict ? "　⚠ 此節衝堂" : ""}`}
                          >
                            <span className="line-clamp-2 text-xs font-semibold">
                              {conflict && <span style={{ color: "var(--error)" }}>⚠ </span>}
                              {c.name}
                            </span>
                            {c.classroom && (
                              <span className="mt-0.5 block truncate text-[11px] text-white/85">{c.classroom}</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TermPicker({
  term,
  setTerm,
  locked,
}: {
  term: string;
  setTerm: (t: string) => void;
  locked: boolean;
}) {
  const OPTS: [string, string][] = [
    ["1", "第一學期"],
    ["2", "第二學期"],
    ["3", "暑修"],
  ];
  return (
    <div className="glass rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">選擇學期</h2>
        {locked && <span className="text-xs text-mute">已鎖定・清空課表可改</span>}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {OPTS.map(([v, label]) => {
          const active = term === v;
          return (
            <button
              key={v}
              disabled={locked}
              onClick={() => setTerm(v)}
              className={`rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                active
                  ? ""
                  : "border border-hairline text-body hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
              }`}
              style={active ? { backgroundColor: "var(--accent)", color: "#1b1206" } : undefined}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-mute">搜尋會找此學期所有學年度的課（跨學年，不限特定學年）。</p>
    </div>
  );
}

function AddPanel({ term }: { term: string }) {
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
        const qs = new URLSearchParams({ q, term });
        const res = await fetch(`/api/courses/search?${qs.toString()}`);
        const data = await res.json();
        setItems(data.items ?? []);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [q, term]);

  return (
    <div className="glass rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">加入課程</h2>
        {q.trim() && !loading && <span className="text-xs text-mute">共 {items.length} 門</span>}
      </div>
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
                <span className="block truncate text-mute">
                  {c.teachers.join("、") || "待聘"}
                  {(() => {
                    const campus = c.campus ?? campusFromRoom(c.classroom);
                    return campus ? ` · ${campus}` : "";
                  })()}
                </span>
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
