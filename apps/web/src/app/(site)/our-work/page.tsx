import Link from "next/link";
import { WORK_GALLERY } from "@/content/gallery";

export const metadata = {
  title: "Our Work",
  description:
    "Real ExactPoint repairs across Greater Houston — refrigerators, washers and dryers, cooking appliances, and HVAC.",
};

/** Every photo here is a real ExactPoint job (spec §49 — nothing fabricated). */
export default function OurWorkPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">Our Work</h1>
      <p className="mt-3 max-w-2xl text-slate">
        Real jobs, photographed by our technicians — the appliances and systems
        Greater Houston trusts us with every week.
      </p>

      <div className="mt-10 space-y-14">
        {WORK_GALLERY.map((category) => (
          <div key={category.slug} id={category.slug}>
            <h2 className="text-xl font-extrabold text-navy">{category.title}</h2>
            <p className="mt-1 text-sm text-slate">{category.blurb}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {category.photos.map((photo) => (
                <a
                  key={photo.src}
                  href={photo.src}
                  target="_blank"
                  rel="noreferrer"
                  className={`group overflow-hidden rounded-xl border border-line bg-white ${
                    photo.feature ? "col-span-2 row-span-2" : ""
                  }`}
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-14 rounded-2xl bg-navy p-8 text-white">
        <h2 className="text-xl font-extrabold">Your appliance could be next</h2>
        <p className="mt-2 max-w-xl text-white/80">
          Diagnosis first, a clear quote second — and the $80 service-call fee
          is waived when you approve the repair.
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
