import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileSettings } from "@/components/profile-settings";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { SEMESTER_TERMS } from "@/lib/config";

export const metadata = { title: "個人頁面" };

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="text-sm text-body">請先登入以查看你的評價。</p>
        <Button render={<Link href="/auth" />} nativeButton={false} className="mt-4 rounded-full">
          前往登入
        </Button>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, short_comment, body, created_at, semester_id, courses(course_code, name, course_key)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const semLabel = (id: string | null) => {
    if (!id) return "";
    const [y, t] = id.split("-");
    return `${y} ${SEMESTER_TERMS[t] ?? t}`;
  };

  return (
    <div className="mx-auto max-w-[900px] px-6 py-10">
      <ProfileSettings
        displayName={user.displayName}
        avatarUrl={user.avatarUrl}
        welcome={welcome === "1"}
      />
      {!user.allowed && (
        <p className="mt-3 text-sm text-warning-deep">此帳號非高師大信箱,無法撰寫評價。</p>
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
              const c = r.courses as unknown as { course_code: string; name: string; course_key: string } | null;
              return (
                <Link
                  key={r.id}
                  href={c ? `/course/${encodeURIComponent(c.course_key)}` : "#"}
                  className="glass-soft glass-interactive block rounded-md px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c?.name}</span>
                    <span className="font-mono text-xs text-mute">{semLabel(r.semester_id)}</span>
                  </div>
                  {(r.body || r.short_comment) && (
                    <p className="mt-1 line-clamp-2 text-sm text-body">{r.body || r.short_comment}</p>
                  )}
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
  return <div className="glass rounded-lg p-6 text-center text-sm text-mute">{text}</div>;
}
