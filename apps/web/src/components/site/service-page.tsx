import Link from "next/link";
import { BUSINESS } from "@exactpoint/domain";
import type { ServiceContent } from "@/content/services";

/** Shared template for every service page (spec §43). */
export function ServicePage({ service }: { service: ServiceContent }) {
  return (
    <>
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-point">
            {service.category === "hvac" ? "HVAC Service" : "Appliance Repair"}
          </p>
          <h1 className="mt-2 max-w-2xl text-3xl font-extrabold sm:text-4xl">
            {service.title}
          </h1>
          <p className="mt-4 max-w-2xl text-white/80">{service.intro}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/book?service=${service.bookingSlug}`}
              className="rounded-xl bg-point px-6 py-3 font-bold text-white transition hover:bg-point-deep"
            >
              Book {service.name}
            </Link>
            <a
              href={BUSINESS.phoneHref}
              className="rounded-xl border border-white/30 px-6 py-3 font-bold transition hover:bg-white/10"
            >
              Call {BUSINESS.phone}
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
          <div>
            <h2 className="text-xl font-extrabold text-navy">
              Common problems we handle
            </h2>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {service.symptoms.map((symptom) => (
                <li
                  key={symptom}
                  className="flex items-start gap-2.5 rounded-lg border border-line bg-white px-4 py-3 text-sm text-navy"
                >
                  <span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full bg-point" />
                  {symptom}
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-2xl text-sm text-slate">
              Not seeing your problem here? Book anyway and describe what&apos;s
              happening — the diagnostic visit is exactly for that.
            </p>
          </div>
          <aside className="h-fit rounded-2xl border border-line bg-white p-6">
            <h2 className="font-extrabold text-navy">Straight-forward pricing</h2>
            <p className="mt-2 text-sm text-slate">
              An <strong className="text-navy">$80 diagnostic/service-call fee</strong>{" "}
              applies when we diagnose the problem and you decide not to proceed.
            </p>
            <p className="mt-2 text-sm text-slate">
              Approve the quoted repair and the fee is{" "}
              <strong className="text-navy">waived</strong> — you pay only the
              agreed repair amount, backed by a 2-month labor warranty.
            </p>
            <Link
              href="/policies/service-warranty"
              className="mt-4 inline-block text-sm font-semibold text-point hover:underline"
            >
              Service &amp; warranty policy →
            </Link>
          </aside>
        </div>
      </section>
    </>
  );
}
