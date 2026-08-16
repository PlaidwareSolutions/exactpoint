import Link from "next/link";
import { BUSINESS, EMERGENCY_WORDING } from "@exactpoint/domain";
import { LogoBadge } from "@/components/brand/logo";

/** Service-area business: no street address anywhere, ever (spec §48). */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-navy text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoBadge size={36} />
            <span className="text-base font-extrabold tracking-wide">EXACTPOINT</span>
          </div>
          <p className="mt-3 text-sm text-white/70">
            {BUSINESS.legalName}. Appliance repair and HVAC service across{" "}
            {BUSINESS.serviceArea}.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
            Contact
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href={BUSINESS.phoneHref} className="font-semibold hover:text-point">
                {BUSINESS.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${BUSINESS.email}`} className="hover:text-point">
                {BUSINESS.email}
              </a>
            </li>
          </ul>
          <p className="mt-3 text-xs text-white/60">{EMERGENCY_WORDING}</p>
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
            Hours
          </h3>
          <ul className="mt-3 space-y-1 text-sm text-white/85">
            <li>Monday–Saturday: 7:00 AM–7:00 PM</li>
            <li>Sunday: Closed</li>
          </ul>
          <p className="mt-3 text-xs text-white/60">
            Payments accepted: {BUSINESS.paymentMethods.join(", ")}.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
            Company
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/book" className="hover:text-point">Book Service</Link></li>
            <li><Link href="/service-areas" className="hover:text-point">Service Areas</Link></li>
            <li><Link href="/policies/service-warranty" className="hover:text-point">Service &amp; Warranty Policy</Link></li>
            <li><Link href="/policies/privacy" className="hover:text-point">Privacy Policy</Link></li>
            <li>
              <Link href="/login" className="text-white/60 hover:text-point">
                Team Sign-in
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {BUSINESS.legalName}
      </div>
    </footer>
  );
}
