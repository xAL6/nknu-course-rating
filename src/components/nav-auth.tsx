"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

export function NavAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ name: string; avatar: string | null } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    async function loadProfile(uid: string) {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", uid)
        .maybeSingle();
      if (data) setProfile({ name: data.display_name as string, avatar: (data.avatar_url as string | null) ?? null });
    }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      if (data.user) loadProfile(data.user.id);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="size-8 animate-pulse rounded-full bg-secondary" />;

  if (!user) {
    return (
      <Button render={<Link href="/auth" />} nativeButton={false} size="sm">
        登入
      </Button>
    );
  }

  const name = profile?.name || "我";

  async function signOut() {
    await createClient().auth.signOut();
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        }
      >
        <Avatar className="size-8">
          {profile?.avatar && <AvatarImage src={profile.avatar} alt="" />}
          <AvatarFallback
            style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
          >
            {name.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem render={<Link href="/me" />}>
          <UserIcon className="size-4" /> 個人頁面
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="size-4" /> 登出
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
