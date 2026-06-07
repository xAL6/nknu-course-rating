"use client";

import { useState, useTransition } from "react";
import { ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { voteReview } from "@/lib/actions";

export function ReviewVotes({
  reviewId,
  courseKey,
  likeCount,
}: {
  reviewId: string;
  courseKey: string;
  likeCount: number;
}) {
  const [pending, start] = useTransition();
  const [like, setLike] = useState(likeCount);
  const [liked, setLiked] = useState(false);

  function vote() {
    start(async () => {
      try {
        const res = await voteReview(reviewId, "like", courseKey);
        setLiked(res.voted);
        setLike((n) => n + (res.voted ? 1 : -1));
      } catch {
        toast.error("請先以高師大信箱登入。");
      }
    });
  }

  return (
    <button
      onClick={vote}
      disabled={pending}
      aria-pressed={liked}
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
      style={
        liked
          ? { borderColor: "var(--accent-line)", backgroundColor: "var(--accent-soft)", color: "var(--accent)" }
          : { borderColor: "var(--hairline)" }
      }
    >
      <ThumbsUp className={`size-4 ${liked ? "fill-current" : ""}`} /> {like}
    </button>
  );
}
