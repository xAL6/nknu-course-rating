import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="font-mono text-sm text-mute">404</div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">找不到這個頁面</h1>
      <p className="mt-2 text-sm text-body">這門課或頁面可能不存在,或已經換了學期。</p>
      <Button render={<Link href="/courses" />} nativeButton={false} className="mt-6 rounded-full">
        瀏覽課程
      </Button>
    </div>
  );
}
