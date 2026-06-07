import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviewForm } from "@/components/review-form";
import { getCourse } from "@/lib/data/courses";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "撰寫評價" };

type SP = { [k: string]: string | string[] | undefined };

export default async function SubmitPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const code = Array.isArray(sp.course) ? sp.course[0] : sp.course;
  const teacherKey = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  if (!code) notFound();

  const course = await getCourse(decodeURIComponent(code));
  if (!course) notFound();

  // Scope the review to the chosen teacher's offerings (the rateable unit).
  const offerings = teacherKey
    ? course.offerings.filter((o) => o.teacherKey === teacherKey)
    : course.offerings;

  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <Button render={<Link href={`/course/${encodeURIComponent(course.courseKey)}`} />} nativeButton={false} variant="ghost" size="sm" className="mb-4 gap-1">
        <ArrowLeft className="size-4" /> 返回課程
      </Button>

      <div className="font-mono text-xs text-mute">{course.courseCode}</div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">撰寫評價・{course.name}</h1>

      {!user ? (
        <div className="glass mt-8 rounded-lg p-8 text-center">
          <p className="text-sm text-body">請先以高師大信箱登入才能撰寫評價。</p>
          <Button render={<Link href="/auth" />} nativeButton={false} className="mt-4 rounded-full">
            前往登入
          </Button>
        </div>
      ) : !user.allowed ? (
        <div className="mt-8 rounded-lg border border-error-soft bg-error-soft/40 p-8 text-center text-sm text-error-deep">
          你的帳號不是高師大學生信箱，無法撰寫評價。
        </div>
      ) : (
        <div className="mt-8">
          <ReviewForm courseKey={course.courseKey} offerings={offerings.length ? offerings : course.offerings} />
        </div>
      )}
    </div>
  );
}
