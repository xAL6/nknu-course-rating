import Link from "next/link";
import { Bookmark, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { SEMESTER_TERMS } from "@/lib/config";

export const metadata = { title: "個人頁面" };

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="text-sm text-body">請先登入以查看你的評價與收藏。</p>
        <Button render={<Link href="/auth" />} nativeButton={false} className="mt-4 rounded-full">
          前往登入
        </Button>
      </div>
    );
  }

  const supabase = createAdminClient();
  const [{ data: reviews }, { data: bookmarks }] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, short_comment, created_at, semester_id, courses(course_code, name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookmarks")
      .select("course_id, courses(course_code, name)")
      .eq("user_id", user.id),
  ]);

  const semLabel = (id: string | null) => {
    if (!id) return "";
    const [y, t] = id.split("-");
    return `${y} ${SEMESTER_TERMS[t] ?? t}`;
  };

  return (
    <div className="mx-auto max-w-[900px] px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{user.displayName}</h1>
      {!user.allowed && (
        <p className="mt-1 text-sm text-warning-deep">此帳號非高師大信箱,無法撰寫評價。</p>
      )}

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-medium text-body">
          <MessageSquare className="size-4" /> 我的評價（{reviews?.length ?? 0}）
        </h2>
        <div className="mt-3 space-y-2">
          {(reviews ?? []).length === 0 ? (
            <Empty text="你還沒有撰寫任何評價。" />
          ) : (
            (reviews ?? []).map((r) => {
              const c = r.courses as unknown as { course_code: string; name: string } | null;
              return (
                <Link
                  key={r.id}
                  href={c ? `/course/${encodeURIComponent(c.course_code)}` : "#"}
                  className="elev-1 hover:elev-2 block rounded-md bg-canvas px-4 py-3 transition-shadow"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c?.name}</span>
                    <span className="font-mono text-xs text-mute">{semLabel(r.semester_id)}</span>
                  </div>
                  {r.short_comment && <p className="mt-1 text-sm text-body">{r.short_comment}</p>}
                </Link>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-medium text-body">
          <Bookmark className="size-4" /> 收藏的課程（{bookmarks?.length ?? 0}）
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(bookmarks ?? []).length === 0 ? (
            <Empty text="尚未收藏課程。" />
          ) : (
            (bookmarks ?? []).map((b) => {
              const c = b.courses as unknown as { course_code: string; name: string } | null;
              return (
                <Link
                  key={b.course_id}
                  href={c ? `/course/${encodeURIComponent(c.course_code)}` : "#"}
                  className="elev-1 hover:elev-2 flex items-center gap-2 rounded-md bg-canvas px-4 py-3 transition-shadow"
                >
                  <span className="font-mono text-xs text-mute">{c?.course_code}</span>
                  <span className="truncate font-medium">{c?.name}</span>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg bg-canvas-soft p-6 text-center text-sm text-mute">{text}</div>;
}
