import { eq } from "drizzle-orm";
import { getDb, schedulingSettings } from "@exactpoint/db";
import { SchedulingSettingsForm } from "./scheduling-form";

export const metadata = { title: "Scheduling Settings" };
export const dynamic = "force-dynamic";

export default async function SchedulingSettingsPage() {
  const [settings] = await getDb()
    .select()
    .from(schedulingSettings)
    .where(eq(schedulingSettings.id, 1));
  if (!settings) return <p className="text-slate">Settings not seeded.</p>;
  return (
    <SchedulingSettingsForm
      initial={{
        bookingHorizonDays: settings.bookingHorizonDays,
        slotGranularityMinutes: settings.slotGranularityMinutes,
        bufferMinutes: settings.bufferMinutes,
        sameDayCutoff: settings.sameDayCutoff.slice(0, 5),
        holdMinutes: settings.holdMinutes,
        weights: settings.weights as Record<string, number>,
      }}
    />
  );
}
