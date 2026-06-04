import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isAllowedEmail } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

export type CurrentUser = {
  id: string;
  email: string | null;
  displayName: string;
  allowed: boolean;
};

/** Random anonymized handle for first-time profiles, e.g. "綠色的椰子371". */
export function randomDisplayName(): string {
  const colors = ["紅", "橙", "黃", "綠", "藍", "靛", "紫", "青", "棕", "灰"];
  const animals = ["椰子", "石虎", "黑熊", "海豚", "貓頭鷹", "梅花鹿", "穿山甲", "藍鵲", "獼猴", "雲豹"];
  const c = colors[Math.floor(Math.random() * colors.length)];
  const a = animals[Math.floor(Math.random() * animals.length)];
  const n = Math.floor(Math.random() * 900 + 100);
  return `${c}色的${a}${n}`;
}

/** Resolve the signed-in Clerk user + their profile (or null if anonymous). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  const db = createAdminClient();
  const { data: profile } = await db
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    id: userId,
    email,
    displayName: profile?.display_name ?? "同學",
    allowed: isAllowedEmail(email),
  };
}

/**
 * Ensure a profile row exists for the current Clerk user; returns the user +
 * display name. Throws if not signed in or not an NKNU-domain account.
 */
export async function requireAllowedUser(): Promise<{ id: string; displayName: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error("UNAUTHORIZED");
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  if (!isAllowedEmail(email)) throw new Error("FORBIDDEN_DOMAIN");

  const db = createAdminClient();
  const { data: existing } = await db
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return { id: userId, displayName: existing.display_name };

  const displayName = randomDisplayName();
  await db.from("profiles").insert({ user_id: userId, display_name: displayName });
  return { id: userId, displayName };
}
