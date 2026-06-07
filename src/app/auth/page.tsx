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
    <div className="mx-auto flex min-h-[75vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <GraduationCap className="size-6" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">登入 {SITE_NAME}</h1>
      <p className="mt-2 text-sm text-body">
        使用高師大 Google 學校信箱登入,即可撰寫評價與排課。
      </p>

      {error === "domain" && (
        <div className="mt-5 w-full rounded-md border border-error-soft bg-error-soft/40 px-4 py-3 text-sm text-error-deep">
          僅限高師大學生信箱（{ALLOWED_EMAIL_DOMAINS.join("、")}）登入。
        </div>
      )}
      {error === "auth" && (
        <div className="mt-5 w-full rounded-md border border-error-soft bg-error-soft/40 px-4 py-3 text-sm text-error-deep">
          登入失敗,請再試一次。
        </div>
      )}

      <Button onClick={signInWithGoogle} size="lg" variant="outline" className="mt-8 h-12 w-full gap-2 rounded-full">
        <GoogleIcon /> 以 Google 帳戶登入
      </Button>

      <p className="mt-6 max-w-xs text-xs text-mute">
        撰寫評價僅限高師大學生信箱（{ALLOWED_EMAIL_DOMAINS.join("、")}）。我們只儲存登入識別碼,不會保存你的信箱位址。
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
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
