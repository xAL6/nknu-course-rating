import Link from "next/link";
import { AiChat } from "@/components/ai-chat";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "AI 課程助手" };

export default async function AiPage() {
  const enabled = !!process.env.DEEPSEEK_API_KEY;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {!enabled && (
        <div className="mb-4 rounded-md border border-warning-soft bg-warning-soft/50 px-4 py-3 text-sm text-warning-deep">
          AI 助手尚未啟用。將 <code className="font-mono">DEEPSEEK_API_KEY</code>{" "}
          設定到環境變數後即可使用(介面已就緒)。
        </div>
      )}

      {user ? (
        <AiChat />
      ) : (
        <div className="glass mx-auto mt-6 max-w-md rounded-2xl p-10 text-center">
          <h1 className="text-lg font-semibold tracking-tight">先登入才能用 AI 課程助手</h1>
          <p className="mt-2 text-sm text-body">
            用高師大 Google 信箱登入後,就能讓學長幫你找課、比較老師、自動排課。
          </p>
          <Button render={<Link href="/auth" />} nativeButton={false} className="mt-6 rounded-full">
            登入
          </Button>
        </div>
      )}
    </div>
  );
}
