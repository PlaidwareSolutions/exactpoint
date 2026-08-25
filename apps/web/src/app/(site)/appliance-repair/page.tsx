import Link from "next/link";
import { APPLIANCE_SERVICES } from "@/content/services";

export const metadata = {
  title: "Appliance Repair",
  description:
    "Refrigerator, washer, dryer, dishwasher, oven, and more — appliance repair across Greater Houston with up-front quotes.",
};

export default function ApplianceRepairPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">
        Appliance Repair in Greater Houston
      </h1>
      <p className="mt-3 max-w-2xl text-slate">
        Residential and commercial appliance repair — all major brands. Pick
        your appliance to see the problems we commonly fix, or book straight
        away and describe the issue.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {APPLIANCE_SERVICES.map((s) => (
          <Link
            key={s.slug}
            href={`/appliance-repair/${s.slug}`}
            className="group rounded-xl border border-line bg-white p-5 transition hover:border-point"
          >
            <h2 className="font-bold text-navy group-hover:text-point">{s.name}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-slate">{s.intro}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
