import Link from "next/link";

export const metadata = {
  title: "Our Work",
  description:
    "Real ExactPoint repairs across Greater Houston — refrigerators, laundry, cooking appliances, and HVAC.",
};

/**
 * Gallery ships when the owner supplies real job photos (spec §49).
 * Nothing here may be fabricated or stock-passed-off-as-ours.
 */
export default function OurWorkPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">Our Work</h1>
      <p className="mt-4 text-slate">
        We&apos;re putting together a gallery of real ExactPoint jobs —
        refrigerators brought back to temperature, washers running quiet again,
        cooking appliances repaired, and HVAC systems restored. Photos of our
        actual work will appear here soon.
      </p>
      <p className="mt-3 text-slate">
        In the meantime, the best way to see how we work is to experience it:
        diagnosis first, a clear quote, and your approval before any repair.
      </p>
      <Link
        href="/book"
        className="mt-8 inline-block rounded-xl bg-point px-6 py-3 font-bold text-white transition hover:bg-point-deep"
      >
        Book Service
      </Link>
    </section>
  );
}
