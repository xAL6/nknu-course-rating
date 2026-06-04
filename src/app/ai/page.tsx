import { AiChat } from "@/components/ai-chat";

export const metadata = { title: "AI 課程助手" };

export default function AiPage() {
  const enabled = !!process.env.DEEPSEEK_API_KEY;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {!enabled && (
        <div className="mb-4 rounded-md border border-warning-soft bg-warning-soft/50 px-4 py-3 text-sm text-warning-deep">
          AI 助手尚未啟用。將 <code className="font-mono">DEEPSEEK_API_KEY</code>{" "}
          設定到環境變數後即可使用(介面已就緒)。
        </div>
      )}
      <AiChat />
    </div>
  );
}
