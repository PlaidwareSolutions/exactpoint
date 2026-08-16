import Link from "next/link";
import { BUSINESS, EMERGENCY_WORDING } from "@exactpoint/domain";
import { HVAC_SERVICES } from "@/content/services";

export const metadata = {
  title: "HVAC Services",
  description:
    "AC repair, heating repair, and HVAC maintenance across Greater Houston. Diagnosis first, clear quotes, 2-month labor warranty.",
};

export default function HvacPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">
        HVAC Services in Greater Houston
      </h1>
      <p className="mt-3 max-w-2xl text-slate">
        Cooling and heating diagnostics, repair, and maintenance. {EMERGENCY_WORDING}
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {HVAC_SERVICES.map((s) => (
          <Link
            key={s.slug}
            href={`/hvac/${s.slug}`}
            className="group rounded-xl border border-line bg-white p-5 transition hover:border-point"
          >
            <h2 className="font-bold text-navy group-hover:text-point">{s.name}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-slate">{s.intro}</p>
          </Link>
        ))}
      </div>
      <p className="mt-8 text-sm text-slate">
        Not sure what&apos;s wrong? Book an HVAC diagnostic or call{" "}
        <a href={BUSINESS.phoneHref} className="font-semibold text-point">
          {BUSINESS.phone}
        </a>
        .
      </p>
    </section>
  );
}
