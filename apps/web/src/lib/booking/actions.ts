"use server";

import { headers } from "next/headers";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  auditLogs,
  customerAddresses,
  customers,
  getDb,
  mediaAssets,
  notifications,
  serviceRequests,
  serviceTypes,
  serviceZones,
  serviceZoneZips,
  toEwktPoint,
} from "@exactpoint/db";
import { BUSINESS } from "@exactpoint/domain";
import { StubAddressProvider, type ValidatedAddress } from "@exactpoint/maps";
import { addressInputSchema, bookingSchema } from "./schema";
import { rateLimit } from "./rate-limit";

/** Google Address Validation replaces the stub in Phase 6 (spec §9, §84). */
const addressProvider = new StubAddressProvider();

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export interface AddressCheckResult {
  ok: boolean;
  confidence?: ValidatedAddress["confidence"];
  standardized?: { street: string; unit?: string; city: string; state: string; zip: string };
  zoneName?: string | null;
  message?: string;
}

export async function validateBookingAddress(input: unknown): Promise<AddressCheckResult> {
  if (!rateLimit(`addr:${await clientIp()}`, 30, 60 * 60 * 1000)) {
    return { ok: false, message: "Too many attempts. Please try again shortly." };
  }
  const parsed = addressInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the address fields." };
  }

  const validated = await addressProvider.validate(parsed.data);
  if (validated.confidence === "unresolved") {
    return {
      ok: false,
      confidence: "unresolved",
      message: "We could not confirm this address. Please review it.",
    };
  }

  const db = getDb();
  const [zoneRow] = await db
    .select({ name: serviceZones.name })
    .from(serviceZoneZips)
    .innerJoin(serviceZones, eq(serviceZoneZips.zoneId, serviceZones.id))
    .where(and(eq(serviceZoneZips.zip, validated.standardized.zip), eq(serviceZones.isActive, true)));

  return {
    ok: true,
    confidence: validated.confidence,
    standardized: validated.standardized,
    zoneName: zoneRow?.name ?? null,
    message: zoneRow
      ? undefined
      : `This address may be outside our normal service area. Please call ${BUSINESS.phone} so we can check availability.`,
  };
}

export type SubmitResult =
  | { ok: true; reference: string }
  | { ok: false; error: string };

export async function submitBooking(input: unknown): Promise<SubmitResult> {
  if (!rateLimit(`book:${await clientIp()}`, 5, 60 * 60 * 1000)) {
    return { ok: false, error: "Too many requests from this connection. Please call us instead." };
  }

  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please review the form and try again.",
    };
  }
  const data = parsed.data;

  // Honeypot tripped: report success, write nothing.
  if (data.company && data.company.length > 0) {
    return { ok: true, reference: "EP-0000" };
  }

  const validated = await addressProvider.validate(data.address);
  if (validated.confidence === "unresolved") {
    return { ok: false, error: "We could not confirm this address. Please review it." };
  }

  const db = getDb();
  try {
    const reference = await db.transaction(async (tx) => {
      const [serviceType] = await tx
        .select({ id: serviceTypes.id })
        .from(serviceTypes)
        .where(eq(serviceTypes.slug, data.serviceTypeSlug));

      const std = validated.standardized;
      const [zoneRow] = await tx
        .select({ id: serviceZoneZips.zoneId })
        .from(serviceZoneZips)
        .where(eq(serviceZoneZips.zip, std.zip));

      // Reuse a customer only on an exact phone+email match; likely duplicates
      // are surfaced to the owner later, never auto-merged (spec §34).
      const phone = data.phone.replace(/[^\d+]/g, "");
      const email = data.email.toLowerCase();
      const [existing] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.phone, phone), eq(customers.email, email)));

      const customerId =
        existing?.id ??
        (
          await tx
            .insert(customers)
            .values({ firstName: data.firstName, lastName: data.lastName, phone, email })
            .returning({ id: customers.id })
        )[0]!.id;

      const [address] = await tx
        .insert(customerAddresses)
        .values({
          customerId,
          enteredAddress: data.address,
          street: std.street,
          unit: std.unit || null,
          city: std.city,
          state: std.state,
          zip: std.zip,
          latitude: validated.latitude,
          longitude: validated.longitude,
          geom:
            validated.latitude != null && validated.longitude != null
              ? toEwktPoint(validated.longitude, validated.latitude)
              : null,
          validationStatus: validated.confidence === "confirmed" ? "validated" : "partial",
          zoneId: zoneRow?.id ?? null,
          zoneSource: zoneRow ? "auto_zip" : null,
        })
        .returning({ id: customerAddresses.id });

      const [request] = await tx
        .insert(serviceRequests)
        .values({
          customerId,
          addressId: address!.id,
          serviceTypeId: serviceType?.id ?? null,
          serviceOther: serviceType ? null : data.serviceOther || data.serviceTypeSlug,
          problemDescription: data.problemDescription,
          equipmentBrand: data.equipmentBrand || null,
          equipmentModel: data.equipmentModel || null,
          equipmentSerial: data.equipmentSerial || null,
          errorCode: data.errorCode || null,
          urgency: data.urgency,
          preferredWindows: data.preferredWindows,
          feeAcknowledged: true,
          source: "web",
        })
        .returning({ id: serviceRequests.id, reference: serviceRequests.reference });

      if (data.photoAssetIds.length > 0) {
        await tx
          .update(mediaAssets)
          .set({ serviceRequestId: request!.id })
          .where(
            and(
              inArray(mediaAssets.id, data.photoAssetIds),
              isNull(mediaAssets.serviceRequestId),
            ),
          );
      }

      await tx.insert(auditLogs).values({
        actorType: "customer",
        action: "service_request.created",
        entityType: "service_request",
        entityId: request!.id,
        newValue: { reference: request!.reference, urgency: data.urgency },
      });

      await tx.insert(notifications).values({
        channel: "email",
        template: "booking_received",
        recipient: email,
        payload: { reference: request!.reference, firstName: data.firstName },
      });

      return request!.reference;
    });

    return { ok: true, reference };
  } catch (err) {
    console.error("[booking] submit failed", err);
    return {
      ok: false,
      error: `Something went wrong saving your request. Please try again or call ${BUSINESS.phone}.`,
    };
  }
}
