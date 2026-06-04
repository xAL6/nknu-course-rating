import { GraduationCap } from "lucide-react";
import { GoogleSignIn } from "@/components/google-sign-in";
import { SITE_NAME, ALLOWED_EMAIL_DOMAINS } from "@/lib/config";

export const metadata = { title: "登入" };

export default function SignInPage() {
  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <GraduationCap className="size-6" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">登入 {SITE_NAME}</h1>
      <p className="mt-2 text-sm text-body">
        使用高師大 Google 學校信箱登入,即可撰寫評價、收藏課程與排課。
      </p>

      <div className="mt-8 w-full">
        <GoogleSignIn />
      </div>

      <p className="mt-6 max-w-xs text-xs text-mute">
        撰寫評價僅限高師大學生信箱（{ALLOWED_EMAIL_DOMAINS.join("、")}）。我們只儲存登入識別碼,不會保存你的信箱位址。
      </p>
    </div>
  );
}
