import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ExternalLink, MapPin, Users, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingSummaryBars } from "@/components/rating-summary";
import { EnrollmentBadge } from "@/components/enrollment-badge";
import { TagChips } from "@/components/tag-chips";
import { ReviewVotes } from "@/components/review-votes";
import { ReviewComments } from "@/components/review-comments";
import { ReviewSummaryAI } from "@/components/review-summary-ai";
import { AddToTimetable } from "@/components/add-to-timetable";
import { BackButton } from "@/components/back-button";
import { BookmarkButton } from "@/components/bookmark-button";
import { formatSlots } from "@/lib/schedule";
import { SEMESTER_TERMS, RATING_DIMENSIONS } from "@/lib/config";
import { getCourse, getCourseSibling } from "@/lib/data/courses";
import { getReviews, getTeacherSummaries } from "@/lib/data/reviews";
import { avgFillRate } from "@/lib/enrollment";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Offering } from "@/lib/data/types";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const course = await getCourse(decodeURIComponent(code));
  if (!course) return { title: "課程" };
  const title = `${course.name}（${course.courseCode}）`;
  const teachers = course.teachers.slice(0, 4).join("、");
  const description = `高師大「${course.name}」課程評價與開課紀錄${teachers ? `・授課教師：${teachers}` : ""}。看看學長姐怎麼說。`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary", title, description },
  };
}

const semLabel = (id: string) => {
  const [y, t] = id.split("-");
  return `${y} ${SEMESTER_TERMS[t] ?? t}`;
};

export default async function CoursePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const courseKey = decodeURIComponent(code);
  const course = await getCourse(courseKey);
  if (!course) notFound();

  const [reviews, teacherSummaries, sibling] = await Promise.all([
    getReviews(courseKey),
    getTeacherSummaries(courseKey),
    getCourseSibling(course),
  ]);
  const summaryByTk = new Map(teacherSummaries.map((s) => [s.teacherKey, s.summary]));

  // Group offerings into (course, teacher) sections — the rateable unit.
  const sectionMap = new Map<string, Offering[]>();
  for (const o of course.offerings) {
    const k = o.teacherKey || "";
    const arr = sectionMap.get(k) ?? [];
    arr.push(o);
    sectionMap.set(k, arr);
  }
  const sections = [...sectionMap.entries()]
    .map(([tk, offs]) => ({
      teacherKey: tk,
      teachers: tk ? tk.split("、") : [],
      offerings: offs.sort((a, b) => b.semesterId.localeCompare(a.semesterId)),
      summary: summaryByTk.get(tk) ?? null,
    }))
    .sort((a, b) => b.offerings[0].semesterId.localeCompare(a.offerings[0].semesterId));

  // Bookmark state
  const bookmarkCourseId = course.offerings[0]?.id;
  let bookmarked = false;
  const user = await getCurrentUser();
  if (user && bookmarkCourseId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("bookmarks")
      .select("course_id")
      .eq("user_id", user.id)
      .eq("course_id", bookmarkCourseId)
      .maybeSingle();
    bookmarked = !!data;
  }

  const reviewsByTk = new Map<string, typeof reviews>();
  for (const r of reviews) {
    const arr = reviewsByTk.get(r.teacherKey) ?? [];
    arr.push(r);
    reviewsByTk.set(r.teacherKey, arr);
  }

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-10">
      <BackButton fallback="/courses" label="返回課程列表" />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-mute">
        <span>{course.courseCode}</span>
        {course.credits != null && <span>· {course.credits} 學分</span>}
        {course.offerings.some((o) => o.category === "Y") && (
          <Badge variant="outline" title="學年課，需上下學期連修">
            學年課
          </Badge>
        )}
        {course.departments.map((d) => (
          <Badge key={d} variant="secondary">
            {d}
          </Badge>
        ))}
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{course.name}</h1>
      {course.nameEn && <p className="mt-1 text-body">{course.nameEn}</p>}
      {sibling && (
        <Link
          href={`/course/${encodeURIComponent(sibling.courseKey)}`}
          className="mt-2 inline-flex items-center gap-1 text-sm text-link hover:underline"
        >
          {sibling.relation === "prev" && <ArrowLeft className="size-3.5" />}
          {sibling.relation === "next" ? "下學期" : "上學期"}：{sibling.name}
          {sibling.relation === "next" && <ArrowRight className="size-3.5" />}
        </Link>
      )}
      {bookmarkCourseId && (
        <div className="mt-4">
          <BookmarkButton courseId={bookmarkCourseId} courseKey={course.courseKey} initial={bookmarked} />
        </div>
      )}

      {/* Per-teacher sections */}
      <section className="mt-8">
        <h2 className="text-sm font-medium tracking-tight text-body">
          授課教師與評分（{sections.length} 組）
        </h2>
        <div className="mt-3 space-y-4">
          {sections.map((sec) => {
            const tReviews = reviewsByTk.get(sec.teacherKey) ?? [];
            const enroll = avgFillRate(sec.offerings);
            return (
              <div key={sec.teacherKey || "tbd"} className="glass rounded-2xl p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-base font-semibold">
                    {sec.teachers.length
                      ? sec.teachers.map((t, i) => (
                          <span key={t}>
                            {i > 0 && "、"}
                            <Link href={`/teacher/${encodeURIComponent(t)}`} className="hover:text-link hover:underline">
                              {t}
                            </Link>
                          </span>
                        ))
                      : "待聘 / 未定"}
                  </div>
                  <Button
                    render={
                      <Link
                        href={`/submit?course=${encodeURIComponent(course.courseKey)}&t=${encodeURIComponent(sec.teacherKey)}`}
                      />
                    }
                    nativeButton={false}
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                  >
                    撰寫評價
                  </Button>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <RatingSummaryBars summary={sec.summary} />
                  {sec.summary && sec.summary.reviewCount > 0 && (
                    <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-secondary/40 px-5 py-3 text-center">
                      <span className="text-2xl font-semibold tabular-nums text-ink">{sec.summary.reviewCount}</span>
                      <span className="text-xs text-mute">則評價</span>
                    </div>
                  )}
                </div>

                {enroll.rate != null && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mute">
                    <span>搶課熱度</span>
                    <EnrollmentBadge rate={enroll.rate} />
                    <span>· 歷年 {enroll.sample} 學期平均</span>
                  </div>
                )}
                {sec.summary && Object.keys(sec.summary.tagCounts).length > 0 && (
                  <TagChips counts={sec.summary.tagCounts} max={8} className="mt-3" />
                )}

                <ReviewSummaryAI
                  courseKey={course.courseKey}
                  teacherKey={sec.teacherKey}
                  reviewCount={sec.summary?.reviewCount ?? 0}
                />

                {/* This teacher's offerings */}
                <div className="mt-5 border-t border-hairline pt-4">
                  <h3 className="mb-2.5 text-sm font-semibold text-body">歷年開課紀錄</h3>
                  <div className="space-y-1.5">
                  {sec.offerings.map((o) => (
                    <div
                      key={o.syllabusNo ?? `${o.semesterId}-${o.classCode}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute"
                    >
                      <span className="font-mono">{semLabel(o.semesterId)}</span>
                      <span className="font-mono text-body">{o.courseCode}</span>
                      {o.courseType && <span>{o.courseType}</span>}
                      {o.category === "Y" && <span className="text-link">學年</span>}
                      {o.className && <span>{o.className}</span>}
                      <span>{o.dayNight === "N" ? "進修" : "日間"}</span>
                      <span className="text-body">{formatSlots(o.slots)}</span>
                      {o.classroom && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />
                          {o.campus ? `${o.campus}・` : ""}
                          {o.classroom}
                        </span>
                      )}
                      {o.enrollCap != null && (
                        <span className="flex items-center gap-1">
                          <Users className="size-3" />
                          {o.enrollCount}/{o.enrollCap}
                        </span>
                      )}
                      <EnrollmentBadge count={o.enrollCount} cap={o.enrollCap} />
                      <div className="ml-auto flex items-center gap-3">
                        {o.syllabusUrl && (
                          <a href={o.syllabusUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-link hover:underline">
                            大綱 <ExternalLink className="size-3" />
                          </a>
                        )}
                        <AddToTimetable
                          course={{
                            courseCode: course.courseCode,
                            courseKey: course.courseKey,
                            syllabusNo: o.syllabusNo,
                            name: course.name,
                            teachers: o.teachers,
                            classroom: o.classroom,
                            semesterId: o.semesterId,
                            slots: o.slots,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  </div>
                </div>

                {/* This teacher's reviews */}
                {tReviews.length > 0 && (
                  <div className="mt-6 border-t border-hairline pt-5">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-body">
                      <MessageSquare className="size-4" /> 學生評價 · {tReviews.length} 則
                    </h3>
                    <div className="mt-4 space-y-4">
                      {tReviews.map((r) => (
                        <article
                          key={r.id}
                          className="rounded-xl border border-hairline bg-secondary/40 p-4 sm:p-5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-body"
                                aria-hidden
                              >
                                {r.displayName.slice(0, 1)}
                              </span>
                              <div className="leading-tight">
                                <div className="text-sm font-medium text-ink">{r.displayName}</div>
                                {r.semesterId && (
                                  <div className="font-mono text-xs text-mute">{semLabel(r.semesterId)} 修課</div>
                                )}
                              </div>
                            </div>
                            <ReviewVotes reviewId={r.id} courseKey={course.courseKey} likeCount={r.likeCount} usefulCount={r.usefulCount} />
                          </div>

                          <div className="mt-3.5 flex flex-wrap gap-2">
                            {RATING_DIMENSIONS.map((d) => {
                              const v = r[d.key] as number | null;
                              return (
                                <span
                                  key={d.key}
                                  className="inline-flex items-baseline gap-1.5 rounded-md bg-background/50 px-2.5 py-1"
                                >
                                  <span className="text-xs text-mute">{d.label}</span>
                                  <span className="font-mono text-sm font-semibold" style={{ color: d.color }}>
                                    {v ?? "—"}
                                  </span>
                                </span>
                              );
                            })}
                          </div>

                          {r.tags.length > 0 && <TagChips tags={r.tags} className="mt-3" />}
                          {r.shortComment && (
                            <p className="mt-3.5 text-[15px] font-semibold leading-snug text-ink">{r.shortComment}</p>
                          )}
                          {r.body && (
                            <p className="mt-1.5 text-[15px] leading-relaxed whitespace-pre-wrap text-body">{r.body}</p>
                          )}
                          <ReviewComments
                            reviewId={r.id}
                            courseKey={course.courseKey}
                            initial={r.comments}
                            canComment={!!user?.allowed}
                          />
                        </article>
                      ))}
                    </div>
                  </div>
                )}
                {tReviews.length === 0 && (
                  <p className="mt-4 flex items-center gap-1.5 border-t border-hairline pt-4 text-sm text-mute">
                    <MessageSquare className="size-4" /> 這位老師的版本尚無評價,成為第一個分享的人。
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
