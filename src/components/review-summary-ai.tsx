"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { MessageResponse } from "@/components/ai-elements/message";
import { getReviewSummary, type ReviewSummaryResult } from "@/lib/actions";

export function ReviewSummaryAI({
  courseKey,
  teacherKey,
  reviewCount,
}: {
  courseKey: string;
  teacherKey: string;
  reviewCount: number;
}) {
  const [result, setResult] = useState<ReviewSummaryResult | null>(null);
  const [pending, start] = useTransition();

  // Only worth summarizing when there are at least a couple of reviews.
  if (reviewCount < 2) return null;

  function generate() {
    start(async () => {
      try {
        setResult(await getReviewSummary(courseKey, teacherKey));
      } catch {
        setResult({ status: "disabled" });
      }
    });
  }

  return (
    <div className="mt-3 border-t border-hairline pt-3">
      {!result && (
        <button
          onClick={generate}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1 text-xs text-body transition-colors hover:bg-secondary disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {pending ? "AI 摘要產生中…" : "AI 評價摘要"}
        </button>
      )}

      {result?.status === "ok" && (
        <div className="rounded-md bg-canvas-soft p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-violet">
            <Sparkles className="size-3.5" /> AI 評價摘要
            {result.cached ? "" : "（即時產生）"}
          </div>
          <div className="text-sm text-body">
            <MessageResponse>{result.summary}</MessageResponse>
          </div>
        </div>
      )}
      {result?.status === "too_few" && (
        <p className="text-xs text-mute">評價數量不足，暫時無法產生摘要。</p>
      )}
      {result?.status === "disabled" && (
        <p className="text-xs text-mute">AI 摘要尚未啟用（未設定 DEEPSEEK_API_KEY）。</p>
      )}
    </div>
  );
}
