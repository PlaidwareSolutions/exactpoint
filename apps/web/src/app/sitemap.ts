import type { MetadataRoute } from "next";
import { BUSINESS } from "@exactpoint/domain";
import { APPLIANCE_SERVICES, HVAC_SERVICES } from "@/content/services";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = `https://${BUSINESS.domain}`;
  const staticPaths = [
    "",
    "/appliance-repair",
    "/hvac",
    "/about",
    "/our-work",
    "/service-areas",
    "/contact",
    "/book",
    "/policies/service-warranty",
    "/policies/privacy",
  ];
  return [
    ...staticPaths.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const })),
    ...APPLIANCE_SERVICES.map((s) => ({
      url: `${base}/appliance-repair/${s.slug}`,
      changeFrequency: "weekly" as const,
    })),
    ...HVAC_SERVICES.map((s) => ({
      url: `${base}/hvac/${s.slug}`,
      changeFrequency: "weekly" as const,
    })),
  ];
}
