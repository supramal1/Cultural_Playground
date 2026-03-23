import type { NextConfig } from "next";

const devPort = process.env.PORT || "3000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Use a per-port dist dir in dev to avoid chunk corruption when multiple servers run concurrently.
  distDir:
    process.env.NODE_ENV === "development"
      ? `tmp/cultureagent-next-${devPort}`
      : ".next"
};

export default nextConfig;
