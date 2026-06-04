import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export const metadata = { title: "登入中…" };

/** Finalizes the Google OAuth redirect (handles new-user sign-up transfer). */
export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-mute">
      登入中…
      <AuthenticateWithRedirectCallback signInForceRedirectUrl="/" signUpForceRedirectUrl="/" />
    </div>
  );
}
