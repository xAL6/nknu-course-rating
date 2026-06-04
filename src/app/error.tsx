"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">發生了一點問題</h1>
      <p className="mt-2 text-sm text-body">請重新整理,或回到課程列表再試一次。</p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset} variant="outline" className="rounded-full">
          重試
        </Button>
        <Button render={<Link href="/courses" />} nativeButton={false} className="rounded-full">
          回到課程
        </Button>
      </div>
    </div>
  );
}
