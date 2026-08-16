"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  auditLogs,
  customerAddresses,
  customers,
  getDb,
  serviceRequests,
  serviceTypes,
  toEwktPoint,
} from "@exactpoint/db";
import { requireOwner } from "@/lib/session";
import { checkAddress, type AddressCheck } from "@/lib/address-check";
import { addressInputSchema } from "@/lib/booking/schema";

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export interface CustomerMatch {
  id: string;
  name: string;
  email: string | null;
  addresses: { id: string; label: string }[];
}

/** Phone-first lookup for the intake form (spec §34 — surface, never merge). */
export async function findCustomerByPhone(phone: string): Promise<CustomerMatch[]> {
  await requireOwner();
  const normalized = normalizePhone(String(phone));
  if (normalized.length < 7) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(customers)
    .where(eq(customers.phone, normalized))
    .limit(5);
  const result: CustomerMatch[] = [];
  for (const c of rows) {
    const addresses = await db
      .select({
        id: customerAddresses.id,
        street: customerAddresses.street,
        city: customerAddresses.city,
        zip: customerAddresses.zip,
      })
      .from(customerAddresses)
      .where(eq(customerAddresses.customerId, c.id));
    result.push({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      addresses: addresses.map((a) => ({
        id: a.id,
        label: `${a.street}, ${a.city} ${a.zip}`,
      })),
    });
  }
  return result;
}

export async function checkIntakeAddress(input: unknown): Promise<AddressCheck> {
  await requireOwner();
  return checkAddress(input);
}

const intakeSchema = z.object({
  existingCustomerId: z.uuid().optional(),
  existingAddressId: z.uuid().optional(),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60).default(""),
  phone: z.string().trim().regex(/^[\d\s().+-]{7,20}$/, "Enter a valid phone number"),
  email: z.email().optional().or(z.literal("")),
  serviceTypeSlug: z.string().trim().min(1).max(60),
  serviceOther: z.string().trim().max(120).optional().or(z.literal("")),
  problemDescription: z.string().trim().min(5, "Describe the problem").max(2000),
  urgency: z.enum(["normal", "emergency"]).default("normal"),
  address: addressInputSchema.optional(),
});

export type IntakeResult =
  | { ok: true; requestId: string; reference: string }
  | { ok: false; error: string };

/**
 * Phone-intake booking (owner takes the call): creates or reuses the
 * customer, records the request with source "phone", and hands off to the
 * existing recommendation/assign flow on the request page.
 */
export async function createPhoneBooking(input: unknown): Promise<IntakeResult> {
  const session = await requireOwner();
  const parsed = intakeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const data = parsed.data;
  if (!data.existingAddressId && !data.address) {
    return { ok: false, error: "Provide a service address." };
  }

  let addressCheck: AddressCheck | null = null;
  if (!data.existingAddressId) {
    addressCheck = await checkAddress(data.address);
    if (!addressCheck.ok) {
      return { ok: false, error: addressCheck.message ?? "Address could not be confirmed." };
    }
  }

  const db = getDb();
  try {
    const result = await db.transaction(async (tx) => {
      let customerId = data.existingCustomerId ?? null;
      if (!customerId) {
        const [created] = await tx
          .insert(customers)
          .values({
            firstName: data.firstName,
            lastName: data.lastName,
            phone: normalizePhone(data.phone),
            email: data.email ? data.email.toLowerCase() : null,
          })
          .returning({ id: customers.id });
        customerId = created!.id;
      }

      let addressId = data.existingAddressId ?? null;
      if (!addressId) {
        const std = addressCheck!.standardized!;
        const [addr] = await tx
          .insert(customerAddresses)
          .values({
            customerId,
            enteredAddress: data.address,
            street: std.street,
            unit: std.unit || null,
            city: std.city,
            state: std.state,
            zip: std.zip,
            latitude: addressCheck!.latitude,
            longitude: addressCheck!.longitude,
            geom:
              addressCheck!.latitude != null && addressCheck!.longitude != null
                ? toEwktPoint(addressCheck!.longitude, addressCheck!.latitude)
                : null,
            validationStatus: addressCheck!.confidence === "confirmed" ? "validated" : "partial",
            zoneId: addressCheck!.zoneId ?? null,
            zoneSource: addressCheck!.zoneId ? "auto_zip" : null,
          })
          .returning({ id: customerAddresses.id });
        addressId = addr!.id;
      }

      const [serviceType] = await tx
        .select({ id: serviceTypes.id })
        .from(serviceTypes)
        .where(eq(serviceTypes.slug, data.serviceTypeSlug));

      const [request] = await tx
        .insert(serviceRequests)
        .values({
          customerId,
          addressId,
          serviceTypeId: serviceType?.id ?? null,
          serviceOther: serviceType ? null : data.serviceOther || data.serviceTypeSlug,
          problemDescription: data.problemDescription,
          urgency: data.urgency,
          feeAcknowledged: true, // stated verbally during the call
          source: "phone",
        })
        .returning({ id: serviceRequests.id, reference: serviceRequests.reference });

      await tx.insert(auditLogs).values({
        actorType: "user",
        actorId: session.user.id,
        action: "service_request.created_phone",
        entityType: "service_request",
        entityId: request!.id,
        newValue: { reference: request!.reference, urgency: data.urgency },
      });

      return { requestId: request!.id, reference: request!.reference };
    });
    return { ok: true, ...result };
  } catch (err) {
    console.error("[intake] create failed", err);
    return { ok: false, error: "Could not save the booking — try again." };
  }
}
