import Link from "next/link";
import { BUSINESS } from "@exactpoint/domain";

export const metadata = {
  title: "Service Areas",
  description:
    "ExactPoint serves Greater Houston: Katy, Cypress, Sugar Land, Pearland, Spring, Humble, Baytown, Clear Lake, and more.",
};

const AREAS: { region: string; communities: string[] }[] = [
  { region: "Central Houston", communities: ["Downtown", "Midtown", "The Heights", "Montrose", "Inner Loop"] },
  { region: "West Houston", communities: ["Katy", "Cinco Ranch", "Energy Corridor", "Memorial", "Westchase"] },
  { region: "Northwest Houston", communities: ["Cypress", "Jersey Village", "Tomball"] },
  { region: "North Houston", communities: ["Spring", "Klein", "The Woodlands area"] },
  { region: "Northeast Houston", communities: ["Humble", "Atascocita", "Kingwood"] },
  { region: "East Houston", communities: ["Channelview", "Baytown"] },
  { region: "Southwest Houston", communities: ["Sugar Land", "Stafford", "Missouri City"] },
  { region: "South Houston", communities: ["Pearland", "South Houston"] },
  { region: "Southeast Houston", communities: ["Pasadena", "Deer Park", "Clear Lake", "League City"] },
];

export default function ServiceAreasPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">
        Serving Greater Houston
      </h1>
      <p className="mt-3 max-w-2xl text-slate">
        ExactPoint covers communities across the Houston metro. Don&apos;t see
        yours listed? Call{" "}
        <a href={BUSINESS.phoneHref} className="font-semibold text-point">
          {BUSINESS.phone}
        </a>{" "}
        — we may still be able to help.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AREAS.map((area) => (
          <div key={area.region} className="rounded-xl border border-line bg-white p-5">
            <h2 className="font-bold text-navy">{area.region}</h2>
            <p className="mt-1 text-sm text-slate">{area.communities.join(" · ")}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 rounded-2xl bg-navy p-8 text-white">
        <h2 className="text-xl font-extrabold">Ready when you are</h2>
        <p className="mt-2 text-white/80">
          Book online and we&apos;ll confirm your appointment window, or call for
          same-day availability.
        </p>
        <Link
          href="/book"
          className="mt-5 inline-block rounded-xl bg-point px-6 py-3 font-bold text-white transition hover:bg-point-deep"
        >
          Book Service
        </Link>
      </div>
    </section>
  );
}
