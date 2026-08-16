import Link from "next/link";
import { BUSINESS } from "@exactpoint/domain";
import { LogoLockup } from "@/components/brand/logo";

const NAV = [
  { href: "/appliance-repair", label: "Appliance Repair" },
  { href: "/hvac", label: "HVAC" },
  { href: "/service-areas", label: "Service Areas" },
  { href: "/our-work", label: "Our Work" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="ExactPoint home">
          <LogoLockup />
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-navy lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-point">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a
            href={BUSINESS.phoneHref}
            className="hidden text-sm font-bold text-navy sm:block"
          >
            {BUSINESS.phone}
          </a>
          <Link
            href="/book"
            className="rounded-lg bg-point px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-point-deep"
          >
            Book Service
          </Link>
        </div>
      </div>
    </header>
  );
}
