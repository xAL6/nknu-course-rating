import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/config";

export type CurrentUser = {
  id: string;
  email: string | null;
  displayName: string;
  allowed: boolean;
};

/** Resolve the signed-in user + their profile (or null if anonymous). */
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
    displayName: profile?.display_name ?? (user.user_metadata?.display_name as string) ?? "同學",
    allowed: isAllowedEmail(user.email),
  };
}

/** Random anonymized handle for first-time profiles, e.g. "綠色的椰子371". */
export function randomDisplayName(): string {
  const colors = ["紅", "橙", "黃", "綠", "藍", "靛", "紫", "青", "棕", "灰"];
  const animals = ["椰子", "石虎", "黑熊", "海豚", "貓頭鷹", "梅花鹿", "穿山甲", "藍鵲", "彌猴", "雲豹"];
  const c = colors[Math.floor(Math.random() * colors.length)];
  const a = animals[Math.floor(Math.random() * animals.length)];
  const n = Math.floor(Math.random() * 900 + 100);
  return `${c}色的${a}${n}`;
}
