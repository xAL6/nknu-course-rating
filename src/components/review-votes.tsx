"use client";

import { useState, useTransition } from "react";
import { ThumbsUp, Sparkle } from "lucide-react";
import { toast } from "sonner";
import { voteReview } from "@/lib/actions";

export function ReviewVotes({
  reviewId,
  courseCode,
  likeCount,
  usefulCount,
}: {
  reviewId: string;
  courseCode: string;
  likeCount: number;
  usefulCount: number;
}) {
  const [pending, start] = useTransition();
  const [counts, setCounts] = useState({ like: likeCount, useful: usefulCount });

  function vote(kind: "like" | "useful") {
    start(async () => {
      try {
        const res = await voteReview(reviewId, kind, courseCode);
        setCounts((c) => ({ ...c, [kind]: c[kind] + (res.voted ? 1 : -1) }));
      } catch {
        toast.error("請先以高師大信箱登入。");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => vote("like")}
        disabled={pending}
        className="flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-xs text-body transition-colors hover:bg-secondary disabled:opacity-50"
      >
        <ThumbsUp className="size-3" /> {counts.like}
      </button>
      <button
        onClick={() => vote("useful")}
        disabled={pending}
        className="flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-xs text-body transition-colors hover:bg-secondary disabled:opacity-50"
      >
        <Sparkle className="size-3" /> 實用 {counts.useful}
      </button>
    </div>
  );
}
