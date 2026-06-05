import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep auth callbacks and API endpoints out of the index.
      disallow: ["/auth", "/api/", "/me"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
