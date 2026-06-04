"use client";

import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NavAuth() {
  return (
    <>
      <Show when="signed-out">
        <Button render={<Link href="/sign-in" />} nativeButton={false} size="sm">
          登入
        </Button>
      </Show>
      <Show when="signed-in">
        <UserButton>
          <UserButton.MenuItems>
            <UserButton.Link
              label="個人頁面"
              labelIcon={<UserIcon className="size-4" />}
              href="/me"
            />
          </UserButton.MenuItems>
        </UserButton>
      </Show>
    </>
  );
}
