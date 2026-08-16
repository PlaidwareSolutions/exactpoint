import { asc, eq } from "drizzle-orm";
import { getDb, serviceCategories, serviceTypes } from "@exactpoint/db";
import { offeredWindows } from "@/lib/booking/windows";
import { BookingForm, type ServiceOption } from "./booking-form";

export const metadata = {
  title: "Book Service",
  description:
    "Book appliance or HVAC service in Greater Houston. Two minutes online — we confirm your appointment window.",
};

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const db = getDb();
  const rows = await db
    .select({
      slug: serviceTypes.slug,
      name: serviceTypes.name,
      category: serviceCategories.slug,
    })
    .from(serviceTypes)
    .innerJoin(serviceCategories, eq(serviceTypes.categoryId, serviceCategories.id))
    .where(eq(serviceTypes.isActive, true))
    .orderBy(asc(serviceTypes.sortOrder));

  // Public picker (spec §31): appliances individually, one HVAC entry, Other.
  const options: ServiceOption[] = [
    ...rows.filter((r) => r.category === "appliance"),
    { slug: "hvac_diagnostic", name: "HVAC / Air Conditioning", category: "hvac" },
    { slug: "other", name: "Other", category: "other" },
  ];

  const preselect = (await searchParams).service;
  const windows = offeredWindows();

  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-navy">Book Service</h1>
      <p className="mt-2 text-slate">
        Tell us what&apos;s wrong and when works for you — we&apos;ll confirm
        your appointment window.
      </p>
      <div className="mt-8">
        <BookingForm
          services={options}
          windows={windows}
          preselectedService={preselect}
        />
      </div>
    </section>
  );
}
