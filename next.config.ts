import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Avatar uploads go through a Server Action; the default body cap is 1 MB,
    // which rejected images. Allow up to 3 MB (the action still caps files at 2 MB).
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
