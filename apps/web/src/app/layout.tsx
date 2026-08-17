import type { Metadata } from "next";
import { BUSINESS } from "@exactpoint/domain";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${BUSINESS.domain}`),
  title: {
    default: `${BUSINESS.displayName} — Serving Greater Houston`,
    template: `%s | ${BUSINESS.shortName}`,
  },
  description: `Appliance repair and HVAC service across Greater Houston. Same-day and emergency service may be available. Call ${BUSINESS.phone}.`,
  openGraph: {
    type: "website",
    siteName: BUSINESS.displayName,
    title: `${BUSINESS.displayName} — Serving Greater Houston`,
    description: `Appliance repair and HVAC service across Greater Houston. Same-day and emergency service may be available. Call ${BUSINESS.phone}.`,
    url: `https://${BUSINESS.domain}`,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "ExactPoint Appliance & HVAC — Serving Greater Houston",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BUSINESS.displayName} — Serving Greater Houston`,
    description: `Appliance repair and HVAC service across Greater Houston. Call ${BUSINESS.phone}.`,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
