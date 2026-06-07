"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { addComment } from "@/lib/actions";
import type { Comment } from "@/lib/data/reviews";

export function ReviewComments({
  reviewId,
  courseKey,
  initial,
  canComment,
}: {
  reviewId: string;
  courseKey: string;
  initial: Comment[];
  canComment: boolean;
}) {
  const [comments, setComments] = useState(initial);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const body = text.trim();
    if (!body) return;
    start(async () => {
      try {
        await addComment(reviewId, body, courseKey);
        // Optimistic local append; the server has persisted it.
        setComments((c) => [
          ...c,
          { id: `tmp-${c.length}`, displayName: "你", body, createdAt: new Date(0).toISOString() },
        ]);
        setText("");
      } catch {
        toast.error("請先以高師大信箱登入才能留言。");
      }
    });
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-mute transition-colors hover:text-body"
      >
        <MessageCircle className="size-3.5" />
        {comments.length > 0 ? `${comments.length} 則留言` : "留言"}
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-l-2 border-hairline pl-3">
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="font-medium">{c.displayName}</span>
              <p className="mt-0.5 whitespace-pre-wrap text-body">{c.body}</p>
            </div>
          ))}

          {canComment ? (
            <div className="flex items-start gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
                }}
                rows={2}
                maxLength={2000}
                placeholder="回覆這則評價…（⌘/Ctrl + Enter 送出）"
                className="glass-soft flex-1 resize-none rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-link/30"
              />
              <button
                onClick={submit}
                disabled={pending || !text.trim()}
                className="mt-0.5 flex items-center gap-1 rounded-full bg-ink px-3 py-2 text-xs text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Send className="size-3" /> 送出
              </button>
            </div>
          ) : (
            <p className="text-xs text-mute">登入後即可留言。</p>
          )}
        </div>
      )}
    </div>
  );
}
