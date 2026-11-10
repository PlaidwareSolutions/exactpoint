import { and, eq } from "drizzle-orm";
import { classifyZoneForPoint, getDb, serviceZones } from "@exactpoint/db";
import { BUSINESS } from "@exactpoint/domain";
import type { ValidatedAddress } from "@exactpoint/maps";
import { addressProvider } from "@/lib/geo";
import { addressInputSchema } from "@/lib/booking/schema";

export interface AddressCheck {
  ok: boolean;
  /** The validation provider failed (outage), as opposed to a bad address. */
  unavailable?: boolean;
  confidence?: ValidatedAddress["confidence"];
  standardized?: { street: string; unit?: string; city: string; state: string; zip: string };
  zoneName?: string | null;
  zoneId?: string | null;
  latitude?: number;
  longitude?: number;
  message?: string;
}

/**
 * Shared validate + zone-classify core (spec §9), used by the public booking
 * action (rate-limited wrapper) and the manager's phone-intake form.
 */
export async function checkAddress(input: unknown): Promise<AddressCheck> {
  const parsed = addressInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the address fields." };
  }

  // A vendor outage (e.g. Google 403 when billing lapses) must surface as a
  // clear, recoverable message, never as an unhandled throw that leaves the
  // caller's form stuck on "Saving…".
  let validated: ValidatedAddress;
  try {
    validated = await addressProvider.validate(parsed.data);
  } catch (err) {
    console.error("[address-check] address validation unavailable", err);
    return {
      ok: false,
      unavailable: true,
      message:
        "The address check is temporarily unavailable. Nothing was saved — please try again in a few minutes.",
    };
  }
  if (validated.confidence === "unresolved") {
    return {
      ok: false,
      confidence: "unresolved",
      message: "We could not confirm this address. Please review it.",
    };
  }

  const db = getDb();
  const classified = await classifyZoneForPoint(db, {
    latitude: validated.latitude,
    longitude: validated.longitude,
    zip: validated.standardized.zip,
  });
  const [zoneRow] = classified
    ? await db
        .select({ id: serviceZones.id, name: serviceZones.name })
        .from(serviceZones)
        .where(and(eq(serviceZones.id, classified.zoneId), eq(serviceZones.isActive, true)))
    : [];

  return {
    ok: true,
    confidence: validated.confidence,
    standardized: validated.standardized,
    zoneName: zoneRow?.name ?? null,
    zoneId: zoneRow?.id ?? null,
    latitude: validated.latitude,
    longitude: validated.longitude,
    message: zoneRow
      ? undefined
      : `This address may be outside our normal service area. Please call ${BUSINESS.phone} so we can check availability.`,
  };
}
