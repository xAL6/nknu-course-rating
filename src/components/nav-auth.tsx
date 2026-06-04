"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NavAuth() {
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button size="sm">登入</Button>
        </SignInButton>
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
