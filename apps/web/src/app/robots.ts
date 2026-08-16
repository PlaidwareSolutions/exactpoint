import type { MetadataRoute } from "next";
import { BUSINESS } from "@exactpoint/domain";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/manager", "/tech", "/login", "/api/"],
    },
    sitemap: `https://${BUSINESS.domain}/sitemap.xml`,
  };
}
