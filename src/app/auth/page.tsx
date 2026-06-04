"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_EMAIL_DOMAINS, SITE_NAME } from "@/lib/config";

function AuthInner() {
  const params = useSearchParams();
  const error = params.get("error");

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <GraduationCap className="size-6" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">登入 {SITE_NAME}</h1>
      <p className="mt-2 text-sm text-body">
        使用高師大學校信箱登入，即可撰寫評價、收藏課程與排課。
      </p>

      {error === "domain" && (
        <div className="mt-5 w-full rounded-md border border-error-soft bg-error-soft/40 px-4 py-3 text-sm text-error-deep">
          僅限高師大學生信箱（{ALLOWED_EMAIL_DOMAINS.join("、")}）登入。
        </div>
      )}
      {error === "auth" && (
        <div className="mt-5 w-full rounded-md border border-error-soft bg-error-soft/40 px-4 py-3 text-sm text-error-deep">
          登入失敗，請再試一次。
        </div>
      )}

      <Button onClick={signInWithGoogle} size="lg" className="mt-6 w-full gap-2 rounded-full">
        <GoogleIcon /> 使用 Google 登入
      </Button>

      <p className="mt-6 text-xs text-mute">
        我們只儲存登入識別碼，不會保存你的信箱位址。
      </p>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthInner />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="currentColor"
        d="M21.35 11.1H12v3.2h5.35c-.23 1.4-1.6 4.1-5.35 4.1a5.9 5.9 0 0 1 0-11.8c1.68 0 2.8.72 3.44 1.33l2.35-2.27C16.4 3.6 14.4 2.7 12 2.7a9.3 9.3 0 1 0 0 18.6c5.37 0 8.92-3.77 8.92-9.08 0-.61-.07-1.08-.17-1.52z"
      />
    </svg>
  );
}
