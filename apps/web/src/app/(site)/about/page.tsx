import Link from "next/link";
import { BUSINESS } from "@exactpoint/domain";

export const metadata = {
  title: "About",
  description:
    "ExactPoint Appliance & HVAC Services — appliance repair and HVAC service across Greater Houston, built on diagnosis-first honesty.",
};

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">
        About ExactPoint
      </h1>
      <div className="mt-6 space-y-4 text-slate">
        <p>
          {BUSINESS.legalName} repairs household appliances and services HVAC
          systems across Greater Houston — from Katy to Baytown, Spring to
          League City.
        </p>
        <p>
          The name is the promise: find the exact point of failure, explain it
          plainly, and quote the fix before any work begins. If you approve the
          repair, the $80 diagnostic fee is waived. If you decide the repair
          isn&apos;t worth it, we&apos;ll tell you that honestly too — sometimes
          replacement is the right answer, and you deserve to know.
        </p>
        <p>
          Every repair we perform is backed by a two-month labor warranty on the
          specific work done. We service all major appliance brands, gas and
          electric.
        </p>
        <p>
          We work Monday through Saturday, 7&nbsp;AM to 7&nbsp;PM. Same-day and
          emergency service may be available — call{" "}
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
          href="/service-areas"
          className="rounded-xl border border-line bg-white px-6 py-3 font-bold text-navy transition hover:border-point"
        >
          Service Areas
        </Link>
      </div>
    </section>
  );
}
