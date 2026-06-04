import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/config";
import { randomDisplayName } from "@/lib/auth";

/**
 * OAuth callback: exchange the code for a session, enforce the NKNU email-domain
 * allow-list, and bootstrap a privacy-preserving profile (no email stored).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Only allow same-origin relative paths to prevent open redirects
  // (reject protocol-relative //, backslash, and absolute URLs).
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

  // Domain gate — only NKNU student mail may contribute.
  if (!user || !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/auth?error=domain`);
  }

  // Bootstrap profile on first login (idempotent; never stores the email).
  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) {
    await supabase.from("profiles").insert({
      user_id: user.id,
      display_name: randomDisplayName(),
    });
  }

  return NextResponse.redirect(new URL(next, origin));
}
