import type { MetadataRoute } from "next";
import { BUSINESS } from "@exactpoint/domain";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BUSINESS.shortName} Technician`,
    short_name: BUSINESS.shortName,
    description: "ExactPoint field-service app for technicians.",
    start_url: "/tech",
    display: "standalone",
    background_color: "#f4f6f9",
    theme_color: "#16233b",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
