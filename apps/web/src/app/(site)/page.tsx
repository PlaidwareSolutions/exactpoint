import Link from "next/link";
import { BUSINESS, EMERGENCY_WORDING } from "@exactpoint/domain";
import { HOME_WORK_PREVIEW } from "@/content/gallery";
import { APPLIANCE_SERVICES, HVAC_SERVICES } from "@/content/services";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-point">
            Serving Greater Houston
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">
            Appliance or HVAC problem? We can help.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/80">
            Residential and commercial — homes, restaurants, coffee shops, and
            small businesses. Diagnosis first, a clear quote second — and the
            $80 service-call fee is waived when you approve the repair.
            Same-day and emergency service may be available.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/book"
              className="rounded-xl bg-point px-7 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-point-deep"
            >
              Book Service
            </Link>
            <a
              href={BUSINESS.phoneHref}
              className="rounded-xl border border-white/30 px-7 py-3.5 text-base font-bold text-white transition hover:bg-white/10"
            >
              Call {BUSINESS.phone}
            </a>
          </div>
          <p className="mt-6 text-sm text-white/60">
            Monday–Saturday 7 AM–7 PM · Sunday closed
          </p>
        </div>
      </section>

      {/* Fee & warranty strip */}
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-navy">
              Licensed &amp; insured
            </h2>
            <p className="mt-1 text-sm text-slate">
              Licensed, registered, and insured — with over 10 years of
              experience in the trade.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-navy">
              $80 diagnostic — waived
            </h2>
            <p className="mt-1 text-sm text-slate">
              The service-call fee applies only if you decline the quoted
              repair. Approve it, and the fee is waived.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-navy">
              2-month labor warranty
            </h2>
            <p className="mt-1 text-sm text-slate">
              Every repair we perform is backed by a two-month warranty on the
              specific work done.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-navy">
              Homes &amp; businesses
            </h2>
            <p className="mt-1 text-sm text-slate">
              Residential and commercial — all major appliance brands, gas and
              electric, from kitchens to coffee shops.
            </p>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">
          What can we fix for you?
        </h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {APPLIANCE_SERVICES.map((s) => (
            <Link
              key={s.slug}
              href={`/appliance-repair/${s.slug}`}
              className="group rounded-xl border border-line bg-white p-5 transition hover:border-point"
            >
              <h3 className="font-bold text-navy group-hover:text-point">{s.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-slate">{s.intro}</p>
            </Link>
          ))}
          {HVAC_SERVICES.map((s) => (
            <Link
              key={s.slug}
              href={`/hvac/${s.slug}`}
              className="group rounded-xl border border-line bg-white p-5 transition hover:border-point"
            >
              <h3 className="font-bold text-navy group-hover:text-point">{s.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-slate">{s.intro}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Real work */}
      <section className="bg-navy">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
              Real jobs, real photos
            </h2>
            <Link href="/our-work" className="shrink-0 text-sm font-bold text-point hover:underline">
              See Our Work →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {HOME_WORK_PREVIEW.map((photo) => (
              <Link key={photo.src} href="/our-work" className="overflow-hidden rounded-xl">
                <img
                  src={photo.src}
                  alt={photo.alt}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition duration-300 hover:scale-[1.03]"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">How it works</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            <li>
              <p className="text-sm font-bold uppercase tracking-wider text-point">Step 1</p>
              <h3 className="mt-1 font-bold text-navy">Tell us the problem</h3>
              <p className="mt-1 text-sm text-slate">
                Book online in about two minutes or call us. Photos of the
                appliance and its label help us come prepared.
              </p>
            </li>
            <li>
              <p className="text-sm font-bold uppercase tracking-wider text-point">Step 2</p>
              <h3 className="mt-1 font-bold text-navy">We diagnose &amp; quote</h3>
              <p className="mt-1 text-sm text-slate">
                A technician diagnoses the issue at your home and gives you a
                clear repair quote before any work begins.
              </p>
            </li>
            <li>
              <p className="text-sm font-bold uppercase tracking-wider text-point">Step 3</p>
              <h3 className="mt-1 font-bold text-navy">You decide</h3>
              <p className="mt-1 text-sm text-slate">
                Approve the quote and the $80 diagnostic fee is waived — you pay
                only the repair, backed by our 2-month labor warranty.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* Emergency + areas */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="rounded-2xl bg-navy p-8 text-white sm:p-10">
          <h2 className="text-xl font-extrabold sm:text-2xl">
            Need help today?
          </h2>
          <p className="mt-2 max-w-2xl text-white/80">{EMERGENCY_WORDING}</p>
          <p className="mt-4 text-sm text-white/60">
            Serving Katy, Cypress, Sugar Land, Pearland, Spring, Humble, and
            communities across Greater Houston —{" "}
            <Link href="/service-areas" className="underline hover:text-point">
              see all service areas
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
