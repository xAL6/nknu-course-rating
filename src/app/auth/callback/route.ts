import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail, randomDisplayName } from "@/lib/config";

/**
 * OAuth callback: exchange the code for a session, enforce the NKNU email-domain
 * allow-list, and bootstrap a privacy-preserving profile (no email stored).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Only allow same-origin relative paths (prevent open redirects).
  const rawNext = searchParams.get("next") ?? "/";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\")
      ? rawNext
      : "/";

  if (!code) return NextResponse.redirect(`${origin}/auth?error=auth`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/auth?error=auth`);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/auth?error=domain`);
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) {
    await supabase.from("profiles").insert({ user_id: user.id, display_name: randomDisplayName() });
    // First sign-in → onboarding so they can pick a name + avatar.
    return NextResponse.redirect(new URL("/me?welcome=1", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
