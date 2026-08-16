import { BUSINESS } from "@exactpoint/domain";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { MobileCallBar } from "@/components/site/mobile-call-bar";

/**
 * LocalBusiness structured data for a service-area business — deliberately
 * no street address anywhere (spec §48). Only verified facts.
 */
const structuredData = {
  "@context": "https://schema.org",
  "@type": "HVACBusiness",
  name: BUSINESS.legalName,
  url: `https://${BUSINESS.domain}`,
  telephone: BUSINESS.phone,
  email: BUSINESS.email,
  image: `https://${BUSINESS.domain}/icon.svg`,
  areaServed: { "@type": "City", name: "Houston", sameAs: "https://en.wikipedia.org/wiki/Houston" },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "07:00",
      closes: "19:00",
    },
  ],
  priceRange: "$$",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteHeader />
      <main className="flex-1 pb-16 sm:pb-0">{children}</main>
      <SiteFooter />
      <MobileCallBar />
    </div>
  );
}
