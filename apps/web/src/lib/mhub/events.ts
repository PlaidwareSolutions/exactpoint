import { desc, eq } from "drizzle-orm";
import {
  appointments,
  appointmentTechnicians,
  customerAddresses,
  customers,
  estimates,
  getDb,
  serviceRequests,
  serviceZones,
  technicianProfiles,
  workOrders,
} from "@exactpoint/db";
import type { CapturedAttribution } from "@exactpoint/mhub";
import { getMhub } from "./client";
import { toE164, toPackServiceType, toPackZone } from "./mapping";

/**
 * MHub funnel emissions. Every helper is fire-and-forget and exception-proof:
 * marketing telemetry must never break a booking, an assignment, or a payment.
 *
 * externalLeadId is the journey's stable id — the service request reference
 * (EP-####) when one exists, else WO-<work order id> for quote-first drafts.
 * Idempotency keys are deterministic so an action retried by the user cannot
 * double-count a stage.
 *
 * PII policy: attrs never carry names, emails, phones, addresses, or notes
 * except the sanctioned transients caller_e164 / contact_email / contact_phone
 * (consumed by MHub for call matching and review requests, never stored) and
 * technician (first name, allowlisted). The SDK strips violations client-side.
 */

type StageKey =
  | "lead"
  | "qualified"
  | "appointment_booked"
  | "appointment_cancelled"
  | "job_completed"
  | "repair_declined";

function emit(
  stage: StageKey,
  externalLeadId: string,
  idempotencyKey: string,
  attrs?: Record<string, unknown>,
): void {
  try {
    getMhub()?.emit(stage, { externalLeadId, idempotencyKey, attrs });
  } catch (err) {
    console.warn("[mhub] emit failed", err);
  }
}

export function emitLead(input: {
  leadId: string;
  serviceTypeSlug?: string | null;
  zoneSlug?: string | null;
  phone?: string | null;
  email?: string | null;
  attribution?: CapturedAttribution | null;
  source?: "web" | "phone";
}): void {
  const phoneE164 = toE164(input.phone);
  emit("lead", input.leadId, `${input.leadId}:lead`, {
    ...(input.attribution ?? (input.source === "phone" ? { source: "phone", channel: "phone" } : {})),
    service_type: toPackServiceType(input.serviceTypeSlug),
    zone: toPackZone(input.zoneSlug),
    caller_e164: phoneE164,
    contact_email: input.email || undefined,
    contact_phone: phoneE164,
  });
}

export function emitQualified(leadId: string): void {
  emit("qualified", leadId, `${leadId}:qualified`);
}

export function emitAppointmentBooked(leadId: string, appointmentId: string): void {
  emit("appointment_booked", leadId, `${leadId}:appointment_booked:${appointmentId}`);
}

export function emitAppointmentCancelled(
  leadId: string,
  appointmentId: string,
  reason: "cancelled" | "customer_declined" | "no_show",
): void {
  emit("appointment_cancelled", leadId, `${leadId}:appointment_cancelled:${appointmentId}`, {
    reason,
  });
}

export function emitRepairDeclined(leadId: string, estimateId: string): void {
  emit("repair_declined", leadId, `${leadId}:repair_declined:${estimateId}`);
}

/**
 * Completion marker — deliberately carries NO revenue. MHub sums
 * revenue_cents additively across a lead's events, so revenue rides only on
 * the per-payment emits (emitJobRevenue); this one contributes the
 * completion timestamp, technician, and review-request contacts. Technician
 * and owner completing the same job dedupe on the shared key.
 */
export function emitJobCompleted(
  leadId: string,
  input: {
    technicianFirstName?: string | null;
    email?: string | null;
    phone?: string | null;
  },
): void {
  emit("job_completed", leadId, `${leadId}:job_completed`, {
    technician: input.technicianFirstName ?? undefined,
    contact_email: input.email || undefined,
    contact_phone: toE164(input.phone),
  });
}

/**
 * One revenue increment per paid invoice — the invoice id in the key means a
 * re-recorded payment dedupes while a second invoice on the same job adds.
 * Never send a running total: MHub sums across events.
 */
export function emitJobRevenue(
  leadId: string,
  input: {
    invoiceId: string;
    revenueCents: number;
    technicianFirstName?: string | null;
    email?: string | null;
    phone?: string | null;
  },
): void {
  emit("job_completed", leadId, `${leadId}:job_completed:rev:${input.invoiceId}`, {
    revenue_cents: input.revenueCents,
    technician: input.technicianFirstName ?? undefined,
    contact_email: input.email || undefined,
    contact_phone: toE164(input.phone),
  });
}

/* ---------- journey context lookups (read-only, best-effort) ---------- */

export async function zoneSlugForAddress(addressId: string): Promise<string | null> {
  try {
    const [row] = await getDb()
      .select({ slug: serviceZones.slug })
      .from(customerAddresses)
      .innerJoin(serviceZones, eq(customerAddresses.zoneId, serviceZones.id))
      .where(eq(customerAddresses.id, addressId));
    return row?.slug ?? null;
  } catch {
    return null;
  }
}

export async function leadIdForWorkOrder(workOrderId: string): Promise<string> {
  try {
    const [row] = await getDb()
      .select({ ref: serviceRequests.reference })
      .from(workOrders)
      .leftJoin(serviceRequests, eq(workOrders.serviceRequestId, serviceRequests.id))
      .where(eq(workOrders.id, workOrderId));
    return row?.ref ?? `WO-${workOrderId}`;
  } catch {
    return `WO-${workOrderId}`;
  }
}

export async function leadIdForEstimate(estimateId: string): Promise<string | null> {
  try {
    const [row] = await getDb()
      .select({ workOrderId: estimates.workOrderId })
      .from(estimates)
      .where(eq(estimates.id, estimateId));
    return row ? leadIdForWorkOrder(row.workOrderId) : null;
  } catch {
    return null;
  }
}

export interface AppointmentJourney {
  leadId: string;
  workOrderId: string;
  customerEmail: string | null;
  customerPhone: string | null;
  technicianFirstName: string | null;
}

export async function journeyForAppointment(
  appointmentId: string,
): Promise<AppointmentJourney | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select({
        workOrderId: appointments.workOrderId,
        requestRef: serviceRequests.reference,
        customerEmail: customers.email,
        customerPhone: customers.phone,
      })
      .from(appointments)
      .innerJoin(workOrders, eq(appointments.workOrderId, workOrders.id))
      .innerJoin(customers, eq(workOrders.customerId, customers.id))
      .leftJoin(serviceRequests, eq(workOrders.serviceRequestId, serviceRequests.id))
      .where(eq(appointments.id, appointmentId));
    if (!row) return null;
    const [tech] = await db
      .select({ firstName: technicianProfiles.firstName })
      .from(appointmentTechnicians)
      .innerJoin(
        technicianProfiles,
        eq(appointmentTechnicians.technicianId, technicianProfiles.id),
      )
      .where(eq(appointmentTechnicians.appointmentId, appointmentId))
      .limit(1);
    return {
      leadId: row.requestRef ?? `WO-${row.workOrderId}`,
      workOrderId: row.workOrderId,
      customerEmail: row.customerEmail,
      customerPhone: row.customerPhone,
      technicianFirstName: tech?.firstName ?? null,
    };
  } catch {
    return null;
  }
}

/** Same journey context, entered from a work order (latest appointment wins). */
export async function journeyForWorkOrder(
  workOrderId: string,
): Promise<AppointmentJourney | null> {
  try {
    const [appt] = await getDb()
      .select({ id: appointments.id })
      .from(appointments)
      .where(eq(appointments.workOrderId, workOrderId))
      .orderBy(desc(appointments.createdAt))
      .limit(1);
    if (appt) return journeyForAppointment(appt.id);
    // Quote-first work order with no visit yet.
    const [row] = await getDb()
      .select({
        requestRef: serviceRequests.reference,
        customerEmail: customers.email,
        customerPhone: customers.phone,
      })
      .from(workOrders)
      .innerJoin(customers, eq(workOrders.customerId, customers.id))
      .leftJoin(serviceRequests, eq(workOrders.serviceRequestId, serviceRequests.id))
      .where(eq(workOrders.id, workOrderId));
    if (!row) return null;
    return {
      leadId: row.requestRef ?? `WO-${workOrderId}`,
      workOrderId,
      customerEmail: row.customerEmail,
      customerPhone: row.customerPhone,
      technicianFirstName: null,
    };
  } catch {
    return null;
  }
}
