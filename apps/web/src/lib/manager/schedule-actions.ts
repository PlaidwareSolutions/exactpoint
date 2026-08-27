"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  addScheduleBlock,
  enqueueEmail,
  getDb,
  reassignAppointment,
  ScheduleConflictError,
  scheduleAppointment,
  serviceRequests,
  updateAppointmentStatus,
  auditLogs,
} from "@exactpoint/db";
import { APPOINTMENT_STATUSES } from "@exactpoint/domain";
import { validateAssignment, ymdInTimeZone } from "@exactpoint/scheduling";
import { BUSINESS } from "@exactpoint/domain";
import { requireOwner } from "@/lib/session";
import {
  loadTeamContext,
  requiredSkillForServiceType,
  travelFnForLocation,
} from "@/lib/scheduling-server";
import {
  emitAppointmentBooked,
  emitAppointmentCancelled,
  emitJobCompleted,
  emitQualified,
  journeyForAppointment,
} from "@/lib/mhub/events";
import { serviceRequestDetail } from "./queries";

export type ActionResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; error: string };

const assignSchema = z.object({
  requestId: z.uuid(),
  technicianId: z.uuid(),
  startIso: z.iso.datetime(),
  endIso: z.iso.datetime(),
  /** True when the owner overrode the recommendation (audited, spec Test L). */
  override: z.boolean().default(false),
  note: z.string().max(500).optional(),
});

/**
 * Assigns a request to a technician/time — from a recommendation or a manual
 * override. Hard constraints always hold (DB exclusion is the final word);
 * soft concerns come back as warnings.
 */
export async function assignRequest(input: unknown): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid assignment input." };
  const { requestId, technicianId, startIso, endIso, override, note } = parsed.data;

  const detail = await serviceRequestDetail(requestId);
  if (!detail || !detail.address) return { ok: false, error: "Request not found." };

  const start = new Date(startIso);
  const end = new Date(endIso);
  const slug = detail.serviceType?.slug ?? "other";
  const { serviceTypeId, skillSlug, durationMinutes } =
    await requiredSkillForServiceType(slug);

  // Pre-validate for a helpful message; the DB constraint remains the enforcer.
  const team = await loadTeamContext({
    fromYmd: ymdInTimeZone(start, BUSINESS.timezone),
    days: 1,
    includeInactive: true,
  });
  const tech = team.find((t) => t.id === technicianId);
  if (!tech) return { ok: false, error: "Technician not found." };
  const day = tech.days[0];
  const location =
    detail.address.latitude != null && detail.address.longitude != null
      ? { latitude: detail.address.latitude, longitude: detail.address.longitude }
      : null;
  const travelMinutes = await travelFnForLocation(location, team);
  const check = validateAssignment(
    tech,
    day,
    { start, end },
    skillSlug,
    { travelMinutes },
    location,
  );
  if (!check.ok) return { ok: false, error: check.blockers.join(" · ") };

  let createdAppointmentId: string | null = null;
  try {
    const created = await scheduleAppointment(getDb(), {
      serviceRequestId: requestId,
      customerId: detail.request.customerId,
      addressId: detail.address.id,
      serviceTypeId,
      technicianId,
      windowStart: start,
      windowEnd: end,
      scheduledStart: start,
      scheduledEnd: end,
      durationMinutes,
      status: "confirmed",
      actorType: "user",
      actorId: session.user.id,
      decisionNote: override ? `manual override: ${note ?? "no note"}` : note ?? null,
    });
    createdAppointmentId = created.appointmentId;
  } catch (err) {
    if (err instanceof ScheduleConflictError) {
      return { ok: false, error: "That technician was just booked for this time." };
    }
    throw err;
  }

  emitQualified(detail.request.reference);
  if (createdAppointmentId) {
    emitAppointmentBooked(detail.request.reference, createdAppointmentId);
  }

  if (detail.customer?.email) {
    const windowLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: BUSINESS.timezone,
      weekday: "long",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(start);
    await enqueueEmail(getDb(), {
      template: "appointment_confirmed",
      recipient: detail.customer.email,
      payload: {
        firstName: detail.customer.firstName,
        reference: detail.request.reference,
        windowLabel,
      },
    });
  }
  revalidatePath("/manager");
  return { ok: true, warnings: check.warnings };
}

const reassignSchema = z.object({
  appointmentId: z.uuid(),
  technicianId: z.uuid(),
  startIso: z.iso.datetime(),
  durationMinutes: z.number().int().min(15).max(480),
});

/** Drag-and-drop dispatch (spec §21): validate, warn, then move atomically. */
export async function reassignAction(input: unknown): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = reassignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid move." };
  const { appointmentId, technicianId, startIso, durationMinutes } = parsed.data;
  const start = new Date(startIso);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  try {
    await reassignAppointment(getDb(), {
      appointmentId,
      technicianId,
      scheduledStart: start,
      scheduledEnd: end,
      actorId: session.user.id,
    });
  } catch (err) {
    if (err instanceof ScheduleConflictError) {
      return { ok: false, error: "That move double-books the technician." };
    }
    throw err;
  }
  revalidatePath("/manager/calendar");
  return { ok: true };
}

const statusSchema = z.object({
  appointmentId: z.uuid(),
  to: z.enum(APPOINTMENT_STATUSES),
  note: z.string().max(500).optional(),
});

export async function setAppointmentStatus(input: unknown): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid status change." };
  await updateAppointmentStatus(getDb(), {
    appointmentId: parsed.data.appointmentId,
    to: parsed.data.to,
    actorId: session.user.id,
    note: parsed.data.note,
  });
  const to = parsed.data.to;
  if (to === "cancelled" || to === "customer_declined" || to === "no_show" || to === "completed") {
    const journey = await journeyForAppointment(parsed.data.appointmentId);
    if (journey) {
      if (to === "completed") {
        emitJobCompleted(journey.leadId, {
          revenueCents: journey.latestInvoiceTotalCents,
          technicianFirstName: journey.technicianFirstName,
          email: journey.customerEmail,
          phone: journey.customerPhone,
        });
      } else {
        emitAppointmentCancelled(journey.leadId, parsed.data.appointmentId, to);
      }
    }
  }
  revalidatePath("/manager");
  return { ok: true };
}

const blockSchema = z.object({
  technicianId: z.uuid().nullable(), // null = whole company
  startIso: z.iso.datetime(),
  endIso: z.iso.datetime(),
  reason: z.string().max(200).optional(),
});

/** Spec §27 blocks: technician or whole company; conflicts reported back. */
export async function blockTimeAction(
  input: unknown,
): Promise<ActionResult & { conflicts?: number }> {
  const session = await requireOwner();
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid block input." };
  const start = new Date(parsed.data.startIso);
  const end = new Date(parsed.data.endIso);
  if (end <= start) return { ok: false, error: "End must be after start." };
  const result = await addScheduleBlock(getDb(), {
    technicianId: parsed.data.technicianId,
    start,
    end,
    reason: parsed.data.reason,
    createdBy: session.user.id,
  });
  revalidatePath("/manager/calendar");
  if (result.blocked === 0) {
    return {
      ok: false,
      error: "No technician could be blocked — every schedule conflicts with existing appointments.",
    };
  }
  return { ok: true, conflicts: result.conflicts.length };
}

const requestStatusSchema = z.object({
  requestId: z.uuid(),
  to: z.enum(["reviewed", "declined", "spam"]),
});

export async function setRequestStatus(input: unknown): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = requestStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request status." };
  const db = getDb();
  const [updated] = await db
    .update(serviceRequests)
    .set({ status: parsed.data.to })
    .where(eq(serviceRequests.id, parsed.data.requestId))
    .returning({ reference: serviceRequests.reference });
  if (parsed.data.to === "reviewed" && updated) emitQualified(updated.reference);
  await db.insert(auditLogs).values({
    actorType: "user",
    actorId: session.user.id,
    action: "service_request.status_changed",
    entityType: "service_request",
    entityId: parsed.data.requestId,
    newValue: { status: parsed.data.to },
  });
  revalidatePath("/manager/requests");
  return { ok: true };
}
