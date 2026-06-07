import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingSummaryBars } from "@/components/rating-summary";
import { EnrollmentBadge } from "@/components/enrollment-badge";
import { TagChips } from "@/components/tag-chips";
import { ReviewVotes } from "@/components/review-votes";
import { ReviewComments } from "@/components/review-comments";
import { ReviewSummaryAI } from "@/components/review-summary-ai";
import { OfferingHistory } from "@/components/offering-history";
import { BackButton } from "@/components/back-button";
import { SEMESTER_TERMS, RATING_DIMENSIONS } from "@/lib/config";
import { getCourse, getCourseSibling } from "@/lib/data/courses";
import { getReviews, getTeacherSummaries } from "@/lib/data/reviews";
import { avgFillRate } from "@/lib/enrollment";
import { getCurrentUser } from "@/lib/auth";
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

// ISO timestamp -> 2025/03/14 (deterministic; avoids server/client locale drift)
const fmtDate = (iso: string) => iso.slice(0, 10).replace(/-/g, "/");

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

  const user = await getCurrentUser();

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
                <OfferingHistory
                  offerings={sec.offerings}
                  course={{ courseCode: course.courseCode, courseKey: course.courseKey, name: course.name }}
                />

                {/* This teacher's reviews */}
                {tReviews.length > 0 && (
                  <div className="mt-7 border-t border-hairline pt-6">
                    <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-body">
                      <MessageSquare className="size-4" style={{ color: "var(--accent)" }} /> 學生評價
                      <span className="text-mute">{tReviews.length}</span>
                    </h3>
                    <div className="mt-5 space-y-5">
                      {tReviews.map((r) => (
                        <article
                          key={r.id}
                          className="rounded-2xl border border-[var(--glass-border)] bg-[color-mix(in_oklch,var(--card)_55%,transparent)] p-5 sm:p-6"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold"
                                style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
                                aria-hidden
                              >
                                {r.displayName.slice(0, 1)}
                              </span>
                              <div className="min-w-0 leading-tight">
                                <div className="truncate text-sm font-semibold text-ink">{r.displayName}</div>
                                <div className="mt-0.5 text-xs text-mute">
                                  {r.semesterId && `${semLabel(r.semesterId)} 修課`}
                                  {r.semesterId && " · "}
                                  {fmtDate(r.createdAt)}
                                </div>
                              </div>
                            </div>
                            <ReviewVotes reviewId={r.id} courseKey={course.courseKey} likeCount={r.likeCount} usefulCount={r.usefulCount} />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {RATING_DIMENSIONS.map((d) => {
                              const v = r[d.key] as number | null;
                              return (
                                <span
                                  key={d.key}
                                  className="inline-flex items-baseline gap-1.5 rounded-lg border border-hairline bg-[color-mix(in_oklch,var(--ink)_4%,transparent)] px-3 py-1.5"
                                >
                                  <span className="text-xs text-mute">{d.label}</span>
                                  <span className="font-mono text-sm font-bold" style={{ color: d.color }}>
                                    {v ?? "—"}
                                  </span>
                                </span>
                              );
                            })}
                          </div>

                          {r.tags.length > 0 && <TagChips tags={r.tags} className="mt-3.5" />}
                          {(() => {
                            const comment = [r.shortComment, r.body].filter(Boolean).join("\n");
                            return comment ? (
                              <p className="mt-4 text-[15px] leading-[1.75] whitespace-pre-wrap text-body sm:text-base">{comment}</p>
                            ) : null;
                          })()}
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
