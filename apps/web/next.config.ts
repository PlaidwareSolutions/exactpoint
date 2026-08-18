import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Browsers remember to always use HTTPS for this domain.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
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
