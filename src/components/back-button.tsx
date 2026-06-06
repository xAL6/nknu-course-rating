"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Returns to the previous page (preserving the course-list filters the user had
 * selected) via browser history; falls back to a given href on a cold landing.
 */
export function BackButton({ fallback, label }: { fallback: string; label: string }) {
  const router = useRouter();
  return (
    <Button
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      variant="ghost"
      size="sm"
      className="mb-4 gap-1"
    >
      <ArrowLeft className="size-4" /> {label}
    </Button>
  );
}
