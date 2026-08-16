import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@exactpoint/config",
    "@exactpoint/db",
    "@exactpoint/domain",
    "@exactpoint/maps",
    "@exactpoint/notifications",
    "@exactpoint/scheduling",
    "@exactpoint/ui",
  ],
  serverExternalPackages: ["pg"],
};

export default nextConfig;
