import { eq } from "drizzle-orm";
import { businessSettings, getDb } from "@exactpoint/db";
import { BusinessSettingsForm } from "./business-form";

export const metadata = { title: "Business Settings" };
export const dynamic = "force-dynamic";

export default async function BusinessSettingsPage() {
  const [settings] = await getDb()
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.id, 1));
  if (!settings) return <p className="text-slate">Settings not seeded.</p>;
  return (
    <BusinessSettingsForm
      initial={{
        phone: settings.phone,
        email: settings.email,
        diagnosticFeeCents: settings.diagnosticFeeCents,
        laborWarrantyMonths: settings.laborWarrantyMonths,
        legalName: settings.legalName,
        timezone: settings.timezone,
      }}
    />
  );
}
