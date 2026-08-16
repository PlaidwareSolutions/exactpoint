"use server";

import { headers } from "next/headers";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  auditLogs,
  createSlotHold,
  customerAddresses,
  customers,
  getDb,
  mediaAssets,
  notifications,
  ScheduleConflictError,
  scheduleAppointment,
  serviceRequests,
  serviceTypes,
  serviceZoneZips,
  toEwktPoint,
} from "@exactpoint/db";
import { BUSINESS } from "@exactpoint/domain";
import { addressProvider } from "@/lib/geo";
import { checkAddress, type AddressCheck } from "@/lib/address-check";
import { zonedTimeToUtc } from "@exactpoint/scheduling";
import { loadSchedulingConfig, requiredSkillForServiceType } from "@/lib/scheduling-server";
import { bookingSchema } from "./schema";
import { rateLimit } from "./rate-limit";
import { bookableWindows, type BookableWindow } from "./slots";
import { verifySlotToken } from "./slot-token";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export type AddressCheckResult = AddressCheck;

export async function validateBookingAddress(input: unknown): Promise<AddressCheckResult> {
  if (!rateLimit(`addr:${await clientIp()}`, 30, 60 * 60 * 1000)) {
    return { ok: false, message: "Too many attempts. Please try again shortly." };
  }
  return checkAddress(input);
}

export interface OfferedSlotsResult {
  windows: BookableWindow[];
  engineBacked: boolean;
}

/** Engine-backed windows for the booking UI, after address validation. */
export async function getBookingWindows(input: {
  serviceTypeSlug: string;
  zoneId?: string | null;
  latitude?: number;
  longitude?: number;
  urgency: "normal" | "emergency";
}): Promise<OfferedSlotsResult> {
  if (!rateLimit(`slots:${await clientIp()}`, 30, 60 * 60 * 1000)) {
    return { windows: [], engineBacked: false };
  }
  return bookableWindows({
    serviceTypeSlug: String(input.serviceTypeSlug).slice(0, 60),
    zoneId: input.zoneId ?? null,
    location:
      input.latitude != null && input.longitude != null
        ? { latitude: input.latitude, longitude: input.longitude }
        : null,
    urgency: input.urgency === "emergency" ? "emergency" : "normal",
  });
}

/**
 * Places a short-lived hold on the selected slot while the customer reviews
 * (spec §24). Returns null when the slot was just taken.
 */
export async function holdSelectedSlot(
  slotToken: string,
): Promise<{ holdId: string; expiresAt: string } | null> {
  if (!rateLimit(`hold:${await clientIp()}`, 15, 60 * 60 * 1000)) return null;
  const claim = verifySlotToken(String(slotToken));
  if (!claim) return null;
  const config = await loadSchedulingConfig();
  const hold = await createSlotHold(getDb(), {
    technicianId: claim.technicianId,
    start: new Date(claim.start),
    end: new Date(claim.end),
    sessionKey: `web:${await clientIp()}`,
    holdMinutes: config.holdMinutes,
  });
  return hold ? { holdId: hold.holdId, expiresAt: hold.expiresAt.toISOString() } : null;
}

export type SubmitResult =
  | { ok: true; reference: string; scheduled: boolean }
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
    return { ok: true, reference: "EP-0000", scheduled: false };
  }

  const validated = await addressProvider.validate(data.address);
  if (validated.confidence === "unresolved") {
    return { ok: false, error: "We could not confirm this address. Please review it." };
  }

  const db = getDb();
  try {
    const result = await db.transaction(async (tx) => {
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

      return {
        reference: request!.reference,
        requestId: request!.id,
        customerId,
        addressId: address!.id,
        serviceTypeId: serviceType?.id ?? null,
      };
    });

    // Convert the held slot into a pending appointment (spec §24). The
    // request survives regardless — a lost race degrades to the unassigned
    // queue instead of losing the customer.
    let scheduled = false;
    const claim = data.slotToken ? verifySlotToken(data.slotToken) : null;
    if (claim) {
      try {
        const { durationMinutes } = await requiredSkillForServiceType(data.serviceTypeSlug);
        const picked = data.preferredWindows[0];
        const windowStart = picked
          ? zonedTimeToUtc(picked.date, picked.start, BUSINESS.timezone)
          : new Date(claim.start);
        const windowEnd = picked
          ? zonedTimeToUtc(picked.date, picked.end, BUSINESS.timezone)
          : new Date(claim.end);
        await scheduleAppointment(db, {
          serviceRequestId: result.requestId,
          customerId: result.customerId,
          addressId: result.addressId,
          serviceTypeId: result.serviceTypeId,
          technicianId: claim.technicianId,
          windowStart,
          windowEnd,
          scheduledStart: new Date(claim.start),
          scheduledEnd: new Date(claim.end),
          durationMinutes,
          status: "pending_confirmation",
          holdId: data.holdId ?? null,
          actorType: "customer",
        });
        scheduled = true;
      } catch (err) {
        if (!(err instanceof ScheduleConflictError)) {
          console.error("[booking] scheduling after submit failed", err);
        }
      }
    }

    return { ok: true, reference: result.reference, scheduled };
  } catch (err) {
    console.error("[booking] submit failed", err);
    return {
      ok: false,
      error: `Something went wrong saving your request. Please try again or call ${BUSINESS.phone}.`,
    };
  }
}
