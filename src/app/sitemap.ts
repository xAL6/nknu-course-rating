import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/courses";
import { listTeachers } from "@/lib/data/teachers";

export const revalidate = 86400; // rebuild at most once a day

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/courses",
    "/teachers",
    "/timetable",
    "/leaderboard",
    "/ai",
    "/about",
    "/guidelines",
    "/privacy",
  ].map((p) => ({ url: `${BASE}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 }));

  if (!isSupabaseConfigured()) return staticRoutes;

  // All logical courses (paged past the 1000-row cap).
  const supabase = await createClient();
  const courses: MetadataRoute.Sitemap = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .rpc("sitemap_courses")
      .range(from, from + PAGE - 1);
    const batch = (data ?? []) as { course_key: string }[];
    for (const c of batch) {
      courses.push({
        url: `${BASE}/course/${encodeURIComponent(c.course_key)}`,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    if (batch.length < PAGE) break;
  }

  // Teachers.
  const teachers = (await listTeachers()).map((t) => ({
    url: `${BASE}/teacher/${encodeURIComponent(t.name)}`,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...courses, ...teachers];
}
