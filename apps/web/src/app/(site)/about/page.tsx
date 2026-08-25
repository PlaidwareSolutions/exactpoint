import Link from "next/link";
import { BUSINESS } from "@exactpoint/domain";

export const metadata = {
  title: "About",
  description:
    "ExactPoint Appliance & HVAC Services — appliance repair and HVAC service across Greater Houston, built on diagnosis-first honesty.",
};

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <div className="grid items-start gap-10 lg:grid-cols-[1fr_20rem]">
        <div>
          <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">
            About ExactPoint
          </h1>
          <div className="mt-6 space-y-4 text-slate">
            <p>
              {BUSINESS.legalName} provides residential and commercial
              appliance repair and HVAC services across Greater Houston —
              from Katy to Baytown, Spring to League City. We&apos;re{" "}
              <strong className="text-navy">
                licensed, registered, and insured
              </strong>
              , with{" "}
              <strong className="text-navy">over 10 years of experience</strong>{" "}
              in the trade.
            </p>
            <p>
              The name is the promise: find the exact point of failure, explain
              it plainly, and quote the fix before any work begins. If you
              approve the repair, the $80 diagnostic fee is waived. If the
              repair isn&apos;t worth it, we&apos;ll tell you that honestly too
              — sometimes replacement is the right answer, and you deserve to
              know.
            </p>
            <p>
              Every repair we perform is backed by a two-month labor warranty
              on the specific work done. We service all major appliance brands,
              gas and electric — and the photos on this page and{" "}
              <Link href="/our-work" className="font-semibold text-point">
                Our Work
              </Link>{" "}
              are our actual jobs, taken by our technicians in Houston homes.
            </p>
            <p>
              We work Monday through Saturday, 7&nbsp;AM to 7&nbsp;PM. Same-day
              and emergency service may be available — call{" "}
              <a href={BUSINESS.phoneHref} className="font-semibold text-point">
                {BUSINESS.phone}
              </a>{" "}
              for the fastest assistance.
            </p>
          </div>
          <div className="mt-8 flex gap-3">
            <Link
              href="/book"
              className="rounded-xl bg-point px-6 py-3 font-bold text-white transition hover:bg-point-deep"
            >
              Book Service
            </Link>
            <Link
              href="/our-work"
              className="rounded-xl border border-line bg-white px-6 py-3 font-bold text-navy transition hover:border-point"
            >
              See Our Work
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          <img
            src="/images/work/hvac-gauges-condenser.jpg"
            alt="Refrigerant manifold gauges connected during an AC service call"
            className="w-full rounded-2xl border border-line object-cover"
          />
          <div className="grid grid-cols-2 gap-3">
            <img
              src="/images/about/hands-on-connector.jpg"
              alt="Hands-on appliance repair work"
              className="aspect-square w-full rounded-xl border border-line object-cover"
            />
            <img
              src="/images/about/gauges-on-floor.jpg"
              alt="Refrigerant gauges and scale during an HVAC diagnostic"
              className="aspect-square w-full rounded-xl border border-line object-cover"
            />
          </div>
          <div className="rounded-xl border border-line bg-white p-4 text-sm">
            <p className="font-bold text-navy">{BUSINESS.credentials}</p>
            <p className="mt-1 text-slate">{BUSINESS.experience} across Greater Houston.</p>
          </div>
          <p className="text-xs text-slate">
            Attic furnaces, July condensers, and everything in between — this
            is the actual work.
          </p>
        </div>
      </div>
    </section>
  );
}
