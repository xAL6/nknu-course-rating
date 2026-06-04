import { SignIn } from "@clerk/nextjs";
import { ALLOWED_EMAIL_DOMAINS } from "@/lib/config";

export const metadata = { title: "登入" };

export default function AuthPage() {
  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md flex-col items-center justify-center px-6 py-10">
      <SignIn />
      <p className="mt-6 max-w-xs text-center text-xs text-mute">
        撰寫評價僅限高師大學生信箱（{ALLOWED_EMAIL_DOMAINS.join("、")}）。我們只儲存登入識別碼,不會保存你的信箱位址。
      </p>
    </div>
  );
}
