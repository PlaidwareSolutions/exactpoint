import { and, eq } from "drizzle-orm";
import type { Database } from "../client";
import { toTstzRange } from "../custom-types";
import {
  appointments,
  appointmentTechnicians,
  auditLogs,
  jobStatusHistory,
  scheduleBlocks,
  scheduleReservations,
  serviceRequests,
  slotHolds,
  technicianProfiles,
  technicianTimeOff,
  workOrders,
} from "../schema";
import type { AppointmentStatus, TimeOffType } from "@exactpoint/domain";

const EXCLUSION_VIOLATION = "23P01";

/** True when the error (or its cause) is the double-booking exclusion. */
export function isReservationConflict(err: unknown): boolean {
  const anyErr = err as { code?: string; cause?: { code?: string } };
  return anyErr?.code === EXCLUSION_VIOLATION || anyErr?.cause?.code === EXCLUSION_VIOLATION;
}

/**
 * Short-lived hold while a customer confirms (spec §24). Returns null when
 * the slot was taken in the meantime — the exclusion constraint arbitrates.
 */
export async function createSlotHold(
  db: Database,
  input: {
    technicianId: string;
    start: Date;
    end: Date;
    sessionKey: string;
    serviceTypeId?: string | null;
    holdMinutes: number;
  },
): Promise<{ holdId: string; expiresAt: Date } | null> {
  const expiresAt = new Date(Date.now() + input.holdMinutes * 60_000);
  try {
    return await db.transaction(async (tx) => {
      const [hold] = await tx
        .insert(slotHolds)
        .values({
          technicianId: input.technicianId,
          timeRange: toTstzRange(input.start, input.end),
          sessionKey: input.sessionKey,
          serviceTypeId: input.serviceTypeId ?? null,
          expiresAt,
        })
        .returning({ id: slotHolds.id });
      await tx.insert(scheduleReservations).values({
        technicianId: input.technicianId,
        timeRange: toTstzRange(input.start, input.end),
        kind: "hold",
        slotHoldId: hold!.id,
      });
      return { holdId: hold!.id, expiresAt };
    });
  } catch (err) {
    if (isReservationConflict(err)) return null;
    throw err;
  }
}

export class ScheduleConflictError extends Error {
  constructor(message = "The technician is no longer available at that time.") {
    super(message);
    this.name = "ScheduleConflictError";
  }
}

export interface ScheduleAppointmentInput {
  serviceRequestId?: string | null;
  workOrderId?: string | null;
  customerId: string;
  addressId: string;
  serviceTypeId?: string | null;
  equipmentId?: string | null;
  technicianId: string;
  windowStart: Date;
  windowEnd: Date;
  scheduledStart: Date;
  scheduledEnd: Date;
  durationMinutes: number;
  status?: AppointmentStatus;
  holdId?: string | null;
  actorType: "user" | "system" | "customer";
  actorId?: string | null;
  decisionNote?: string | null;
}

/**
 * Creates work order → appointment → assignment → reservation atomically.
 * When a hold is supplied its reservation is converted in place, so the slot
 * can never leak between hold and booking. Throws ScheduleConflictError when
 * the slot has been taken (spec §23).
 */
export async function scheduleAppointment(
  db: Database,
  input: ScheduleAppointmentInput,
): Promise<{ workOrderId: string; appointmentId: string; assignmentId: string }> {
  try {
    return await db.transaction(async (tx) => {
      let workOrderId = input.workOrderId ?? null;
      if (!workOrderId) {
        const [wo] = await tx
          .insert(workOrders)
          .values({
            serviceRequestId: input.serviceRequestId ?? null,
            customerId: input.customerId,
            addressId: input.addressId,
            serviceTypeId: input.serviceTypeId ?? null,
            equipmentId: input.equipmentId ?? null,
            status: "scheduled",
          })
          .returning({ id: workOrders.id });
        workOrderId = wo!.id;
      }

      const [appointment] = await tx
        .insert(appointments)
        .values({
          workOrderId,
          windowStart: input.windowStart,
          windowEnd: input.windowEnd,
          durationMinutes: input.durationMinutes,
          status: input.status ?? "confirmed",
        })
        .returning({ id: appointments.id });

      const [assignment] = await tx
        .insert(appointmentTechnicians)
        .values({
          appointmentId: appointment!.id,
          technicianId: input.technicianId,
          scheduledStart: input.scheduledStart,
          scheduledEnd: input.scheduledEnd,
          assignedBy: input.actorType === "user" ? (input.actorId ?? null) : null,
        })
        .returning({ id: appointmentTechnicians.id });

      const range = toTstzRange(input.scheduledStart, input.scheduledEnd);
      let converted = false;
      if (input.holdId) {
        const result = await tx
          .update(scheduleReservations)
          .set({
            kind: "appointment",
            appointmentTechnicianId: assignment!.id,
            slotHoldId: null,
            timeRange: range,
          })
          .where(eq(scheduleReservations.slotHoldId, input.holdId))
          .returning({ id: scheduleReservations.id });
        if (result.length > 0) {
          converted = true;
          await tx
            .update(slotHolds)
            .set({ status: "converted" })
            .where(eq(slotHolds.id, input.holdId));
        }
      }
      if (!converted) {
        await tx.insert(scheduleReservations).values({
          technicianId: input.technicianId,
          timeRange: range,
          kind: "appointment",
          appointmentTechnicianId: assignment!.id,
        });
      }

      if (input.serviceRequestId) {
        await tx
          .update(serviceRequests)
          .set({ status: "converted" })
          .where(eq(serviceRequests.id, input.serviceRequestId));
      }

      await tx.insert(jobStatusHistory).values({
        appointmentId: appointment!.id,
        fromStatus: null,
        toStatus: input.status ?? "confirmed",
        changedBy: input.actorType === "user" ? (input.actorId ?? null) : null,
      });
      await tx.insert(auditLogs).values({
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        action: "appointment.scheduled",
        entityType: "appointment",
        entityId: appointment!.id,
        newValue: {
          technicianId: input.technicianId,
          scheduledStart: input.scheduledStart.toISOString(),
          scheduledEnd: input.scheduledEnd.toISOString(),
          note: input.decisionNote ?? null,
        },
      });

      return {
        workOrderId,
        appointmentId: appointment!.id,
        assignmentId: assignment!.id,
      };
    });
  } catch (err) {
    if (isReservationConflict(err)) throw new ScheduleConflictError();
    throw err;
  }
}

/**
 * Moves an assignment to another technician and/or time. The reservation row
 * moves inside the same transaction, so a conflicting move can never commit.
 */
export async function reassignAppointment(
  db: Database,
  input: {
    appointmentId: string;
    technicianId: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    actorId: string;
  },
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const [assignment] = await tx
        .select()
        .from(appointmentTechnicians)
        .where(eq(appointmentTechnicians.appointmentId, input.appointmentId));
      if (!assignment) throw new Error("Appointment has no technician assignment");

      await tx
        .update(appointmentTechnicians)
        .set({
          technicianId: input.technicianId,
          scheduledStart: input.scheduledStart,
          scheduledEnd: input.scheduledEnd,
          assignedBy: input.actorId,
          assignedAt: new Date(),
        })
        .where(eq(appointmentTechnicians.id, assignment.id));

      await tx
        .update(scheduleReservations)
        .set({
          technicianId: input.technicianId,
          timeRange: toTstzRange(input.scheduledStart, input.scheduledEnd),
        })
        .where(eq(scheduleReservations.appointmentTechnicianId, assignment.id));

      await tx
        .update(appointments)
        .set({
          windowStart: input.scheduledStart,
          windowEnd: input.scheduledEnd,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, input.appointmentId));

      await tx.insert(auditLogs).values({
        actorType: "user",
        actorId: input.actorId,
        action: "appointment.reassigned",
        entityType: "appointment",
        entityId: input.appointmentId,
        oldValue: {
          technicianId: assignment.technicianId,
          scheduledStart: assignment.scheduledStart.toISOString(),
        },
        newValue: {
          technicianId: input.technicianId,
          scheduledStart: input.scheduledStart.toISOString(),
        },
      });
    });
  } catch (err) {
    if (isReservationConflict(err)) throw new ScheduleConflictError();
    throw err;
  }
}

const RELEASING_STATUSES = new Set(["cancelled", "customer_declined", "no_show"]);

export async function updateAppointmentStatus(
  db: Database,
  input: { appointmentId: string; to: AppointmentStatus; actorId?: string | null; note?: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [appt] = await tx
      .select({ status: appointments.status })
      .from(appointments)
      .where(eq(appointments.id, input.appointmentId));
    if (!appt) throw new Error("Appointment not found");

    await tx
      .update(appointments)
      .set({ status: input.to, updatedAt: new Date() })
      .where(eq(appointments.id, input.appointmentId));

    if (RELEASING_STATUSES.has(input.to)) {
      // Free the technician's time when the visit will not happen.
      const assignments = await tx
        .select({ id: appointmentTechnicians.id })
        .from(appointmentTechnicians)
        .where(eq(appointmentTechnicians.appointmentId, input.appointmentId));
      for (const a of assignments) {
        await tx
          .delete(scheduleReservations)
          .where(eq(scheduleReservations.appointmentTechnicianId, a.id));
      }
    }

    await tx.insert(jobStatusHistory).values({
      appointmentId: input.appointmentId,
      fromStatus: appt.status,
      toStatus: input.to,
      changedBy: input.actorId ?? null,
      note: input.note ?? null,
    });
    await tx.insert(auditLogs).values({
      actorType: input.actorId ? "user" : "system",
      actorId: input.actorId ?? null,
      action: "appointment.status_changed",
      entityType: "appointment",
      entityId: input.appointmentId,
      oldValue: { status: appt.status },
      newValue: { status: input.to, note: input.note ?? null },
    });
  });
}

/** Personal time off; blocks the calendar at the database level. */
export async function addTimeOff(
  db: Database,
  input: {
    technicianId: string;
    start: Date;
    end: Date;
    type: TimeOffType;
    note?: string;
    createdBy: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.transaction(async (tx) => {
      const [timeOff] = await tx
        .insert(technicianTimeOff)
        .values({
          technicianId: input.technicianId,
          period: toTstzRange(input.start, input.end),
          type: input.type,
          note: input.note ?? null,
          createdBy: input.createdBy,
        })
        .returning({ id: technicianTimeOff.id });
      await tx.insert(scheduleReservations).values({
        technicianId: input.technicianId,
        timeRange: toTstzRange(input.start, input.end),
        kind: "time_off",
        timeOffId: timeOff!.id,
      });
      await tx.insert(auditLogs).values({
        actorType: "user",
        actorId: input.createdBy,
        action: "time_off.added",
        entityType: "technician",
        entityId: input.technicianId,
        newValue: { type: input.type, start: input.start.toISOString(), end: input.end.toISOString() },
      });
    });
    return { ok: true };
  } catch (err) {
    if (isReservationConflict(err)) {
      return {
        ok: false,
        error: "This period overlaps existing appointments. Reassign them first.",
      };
    }
    throw err;
  }
}

/**
 * Operational block (spec §27). technicianId null = company-wide: one
 * reservation per active technician; technicians with conflicting
 * appointments are reported back instead of silently skipped.
 */
export async function addScheduleBlock(
  db: Database,
  input: {
    technicianId: string | null;
    start: Date;
    end: Date;
    reason?: string;
    createdBy: string;
  },
): Promise<{ blocked: number; conflicts: string[] }> {
  const targets = input.technicianId
    ? [{ id: input.technicianId }]
    : await db
        .select({ id: technicianProfiles.id })
        .from(technicianProfiles)
        .where(eq(technicianProfiles.isActive, true));

  const [block] = await db
    .insert(scheduleBlocks)
    .values({
      technicianId: input.technicianId,
      period: toTstzRange(input.start, input.end),
      reason: input.reason ?? null,
      createdBy: input.createdBy,
    })
    .returning({ id: scheduleBlocks.id });

  let blocked = 0;
  const conflicts: string[] = [];
  for (const target of targets) {
    try {
      await db.insert(scheduleReservations).values({
        technicianId: target.id,
        timeRange: toTstzRange(input.start, input.end),
        kind: "block",
        blockId: block!.id,
      });
      blocked++;
    } catch (err) {
      if (isReservationConflict(err)) conflicts.push(target.id);
      else throw err;
    }
  }
  await db.insert(auditLogs).values({
    actorType: "user",
    actorId: input.createdBy,
    action: "schedule_block.added",
    entityType: "schedule_block",
    entityId: block!.id,
    newValue: {
      technicianId: input.technicianId,
      start: input.start.toISOString(),
      end: input.end.toISOString(),
      blocked,
      conflicts,
    },
  });
  return { blocked, conflicts };
}
