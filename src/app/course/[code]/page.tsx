import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingSummaryBars } from "@/components/rating-summary";
import { ReviewVotes } from "@/components/review-votes";
import { AddToTimetable } from "@/components/add-to-timetable";
import { BookmarkButton } from "@/components/bookmark-button";
import { formatSlots } from "@/lib/schedule";
import { SEMESTER_TERMS, RATING_DIMENSIONS } from "@/lib/config";
import { getCourse } from "@/lib/data/courses";
import { getReviews, getRatingSummary } from "@/lib/data/reviews";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const course = await getCourse(decodeURIComponent(code));
  return { title: course ? `${course.name}（${course.courseCode}）` : "課程" };
}

export default async function CoursePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const course = await getCourse(decodeURIComponent(code));
  if (!course) notFound();

  const [reviews, summary] = await Promise.all([
    getReviews(course.courseCode),
    getRatingSummary(course.courseCode),
  ]);

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

  const semLabel = (id: string) => {
    const [y, t] = id.split("-");
    return `${y} ${SEMESTER_TERMS[t] ?? t}`;
  };

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10">
      <Button render={<Link href="/courses" />} nativeButton={false} variant="ghost" size="sm" className="mb-4 gap-1">
        <ArrowLeft className="size-4" /> 返回課程列表
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {/* Header */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-mute">
            <span>{course.courseCode}</span>
            {course.credits != null && <span>· {course.credits} 學分</span>}
            {course.departments.map((d) => (
              <Badge key={d} variant="secondary">
                {d}
              </Badge>
            ))}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{course.name}</h1>
          {course.nameEn && <p className="mt-1 text-body">{course.nameEn}</p>}

          {bookmarkCourseId && (
            <div className="mt-4">
              <BookmarkButton
                courseId={bookmarkCourseId}
                courseCode={course.courseCode}
                initial={bookmarked}
              />
            </div>
          )}

          {/* Offerings */}
          <section className="mt-8">
            <h2 className="text-sm font-medium tracking-tight text-body">開課紀錄</h2>
            <div className="mt-3 space-y-2">
              {course.offerings.map((o) => (
                <div
                  key={o.syllabusNo ?? `${o.semesterId}-${o.teachers.join()}`}
                  className="elev-1 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-canvas px-4 py-3 text-sm"
                >
                  <span className="font-mono text-xs text-mute">{semLabel(o.semesterId)}</span>
                  <span className="font-medium">
                    {o.teachers.length
                      ? o.teachers.map((t, i) => (
                          <span key={t}>
                            {i > 0 && "、"}
                            <Link href={`/teacher/${encodeURIComponent(t)}`} className="hover:text-link hover:underline">
                              {t}
                            </Link>
                          </span>
                        ))
                      : "待聘"}
                  </span>
                  {o.courseType && <Badge variant="secondary">{o.courseType}</Badge>}
                  {o.className && <span className="text-mute">{o.className}</span>}
                  {o.dayNight && (
                    <span className="text-mute">{o.dayNight === "N" ? "進修" : "日間"}</span>
                  )}
                  <span className="text-body">{formatSlots(o.slots)}</span>
                  {o.classroom && (
                    <span className="flex items-center gap-1 text-mute">
                      <MapPin className="size-3" />
                      {o.campus ? `${o.campus}・` : ""}
                      {o.classroom}
                    </span>
                  )}
                  {o.enrollCap != null && (
                    <span className="flex items-center gap-1 text-mute">
                      <Users className="size-3" />
                      {o.enrollCount}/{o.enrollCap}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-3">
                    {o.syllabusUrl && (
                      <a
                        href={o.syllabusUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-link hover:underline"
                      >
                        課程大綱 <ExternalLink className="size-3" />
                      </a>
                    )}
                    <AddToTimetable
                      course={{
                        courseCode: course.courseCode,
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
          </section>

          {/* Reviews (Phase 1c) */}
          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">學生評價</h2>
              <Button render={<Link href={`/submit?course=${course.courseCode}`} />} nativeButton={false} size="sm">
                撰寫評價
              </Button>
            </div>
            {reviews.length === 0 ? (
              <div className="mt-4 rounded-lg bg-canvas-soft p-10 text-center text-sm text-mute">
                目前還沒有評價。登入後成為第一位分享這門課心得的人。
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {reviews.map((r) => (
                  <article key={r.id} className="elev-1 rounded-lg bg-canvas p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{r.displayName}</span>
                        {r.semesterId && (
                          <span className="font-mono text-xs text-mute">{semLabel(r.semesterId)}</span>
                        )}
                      </div>
                      <ReviewVotes
                        reviewId={r.id}
                        courseCode={course.courseCode}
                        likeCount={r.likeCount}
                        usefulCount={r.usefulCount}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {RATING_DIMENSIONS.map((d) => {
                        const v = r[d.key] as number | null;
                        return (
                          <span key={d.key} className="text-body">
                            {d.label}
                            <span className="ml-1 font-mono" style={{ color: d.color }}>
                              {v ?? "—"}
                            </span>
                          </span>
                        );
                      })}
                    </div>

                    {r.shortComment && <p className="mt-3 text-sm font-medium">{r.shortComment}</p>}
                    {r.body && <p className="mt-1 text-sm whitespace-pre-wrap text-body">{r.body}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar: rating summary */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="elev-2 rounded-lg bg-canvas p-5">
            <h2 className="text-sm font-medium tracking-tight text-body">綜合評分</h2>
            <div className="mt-4">
              <RatingSummaryBars summary={summary ?? course.summary} />
            </div>
            {summary && summary.reviewCount > 0 && (
              <p className="mt-3 text-xs text-mute">共 {summary.reviewCount} 則評價</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
