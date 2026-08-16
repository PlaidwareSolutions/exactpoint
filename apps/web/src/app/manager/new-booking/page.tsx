import { asc, eq } from "drizzle-orm";
import { getDb, serviceCategories, serviceTypes } from "@exactpoint/db";
import { IntakeForm } from "./intake-form";

export const metadata = { title: "New Booking" };
export const dynamic = "force-dynamic";

/** Phone intake: the owner books a calling customer directly. */
export default async function NewBookingPage() {
  const rows = await getDb()
    .select({
      slug: serviceTypes.slug,
      name: serviceTypes.name,
      category: serviceCategories.slug,
    })
    .from(serviceTypes)
    .innerJoin(serviceCategories, eq(serviceTypes.categoryId, serviceCategories.id))
    .where(eq(serviceTypes.isActive, true))
    .orderBy(asc(serviceTypes.sortOrder));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">New Booking (phone)</h1>
      <p className="text-sm text-slate">
        For customers calling in. Start with the phone number — repeat
        customers and their addresses are found automatically. The request then
        goes straight to scheduling recommendations.
      </p>
      <IntakeForm
        services={[...rows, { slug: "other", name: "Other", category: "other" }]}
      />
    </div>
  );
}
