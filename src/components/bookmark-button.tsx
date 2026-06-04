"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleBookmark } from "@/lib/actions";

export function BookmarkButton({
  courseId,
  courseCode,
  initial = false,
}: {
  courseId: string;
  courseCode: string;
  initial?: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();

  return (
    <Button
      variant={saved ? "secondary" : "outline"}
      size="sm"
      disabled={pending}
      className="gap-1.5 rounded-full"
      onClick={() =>
        start(async () => {
          try {
            const res = await toggleBookmark(courseId, courseCode);
            setSaved(res.bookmarked);
            toast(res.bookmarked ? "已收藏" : "已取消收藏");
          } catch {
            toast.error("請先以高師大信箱登入。");
          }
        })
      }
    >
      <Bookmark className={`size-4 ${saved ? "fill-current" : ""}`} />
      {saved ? "已收藏" : "收藏"}
    </Button>
  );
}
