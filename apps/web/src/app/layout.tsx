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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
