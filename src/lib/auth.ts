import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/config";

export type CurrentUser = {
  id: string;
  email: string | null;
  displayName: string;
  allowed: boolean;
};

/** Resolve the signed-in Supabase user + their profile (or null if anonymous). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    displayName: profile?.display_name ?? "同學",
    allowed: isAllowedEmail(user.email),
  };
}
