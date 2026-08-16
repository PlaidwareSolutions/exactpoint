import Link from "next/link";
import { BUSINESS, EMERGENCY_WORDING } from "@exactpoint/domain";

export const metadata = {
  title: "Contact",
  description: `Reach ExactPoint Appliance & HVAC: call ${BUSINESS.phone}, email, or book service online.`,
};

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">Contact</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <a
          href={BUSINESS.phoneHref}
          className="rounded-xl border border-line bg-white p-6 transition hover:border-point"
        >
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate">Call</h2>
          <p className="mt-1 text-xl font-extrabold text-navy">{BUSINESS.phone}</p>
          <p className="mt-1 text-sm text-slate">Fastest for same-day and urgent service.</p>
        </a>
        <a
          href={`mailto:${BUSINESS.email}`}
          className="rounded-xl border border-line bg-white p-6 transition hover:border-point"
        >
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate">Email</h2>
          <p className="mt-1 break-all text-xl font-extrabold text-navy">{BUSINESS.email}</p>
          <p className="mt-1 text-sm text-slate">We reply during business hours.</p>
        </a>
      </div>
      <div className="mt-6 rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate">Hours</h2>
        <p className="mt-1 font-semibold text-navy">Monday–Saturday, 7:00 AM–7:00 PM</p>
        <p className="text-navy">Sunday: Closed</p>
        <p className="mt-2 text-sm text-slate">{EMERGENCY_WORDING}</p>
      </div>
      <Link
        href="/book"
        className="mt-8 inline-block rounded-xl bg-point px-6 py-3 font-bold text-white transition hover:bg-point-deep"
      >
        Book Service Online
      </Link>
    </section>
  );
}
