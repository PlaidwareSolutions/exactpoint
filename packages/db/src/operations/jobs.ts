import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  appointments,
  appointmentTechnicians,
  auditLogs,
  customerAddresses,
  customers,
  jobStatusHistory,
  mediaAssets,
  notifications,
  serviceTypes,
  technicianProfiles,
  warranties,
  workOrderNotes,
  workOrders,
} from "../schema";

/**
 * Completes a visit: appointment + work order close out, and the labor
 * warranty is recorded for the specific repair performed (spec §41, §77).
 */
export async function completeAppointment(
  db: Database,
  input: {
    appointmentId: string;
    actorId: string | null;
    issueRepaired: string;
    componentRepaired?: string;
    note?: string;
    warrantyMonths: number;
  },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [appt] = await tx
      .select({ status: appointments.status, workOrderId: appointments.workOrderId })
      .from(appointments)
      .where(eq(appointments.id, input.appointmentId));
    if (!appt) throw new Error("Appointment not found");

    await tx
      .update(appointments)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(appointments.id, input.appointmentId));
    await tx
      .update(workOrders)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(workOrders.id, appt.workOrderId));

    const [assignment] = await tx
      .select({ technicianId: appointmentTechnicians.technicianId })
      .from(appointmentTechnicians)
      .where(eq(appointmentTechnicians.appointmentId, input.appointmentId));

    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + input.warrantyMonths);
    await tx.insert(warranties).values({
      workOrderId: appt.workOrderId,
      technicianId: assignment?.technicianId ?? null,
      issueRepaired: input.issueRepaired,
      componentRepaired: input.componentRepaired ?? null,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      notes: input.note ?? null,
    });

    await tx.insert(jobStatusHistory).values({
      appointmentId: input.appointmentId,
      fromStatus: appt.status,
      toStatus: "completed",
      changedBy: input.actorId,
      note: input.note ?? null,
    });
    await tx.insert(auditLogs).values({
      actorType: input.actorId ? "user" : "system",
      actorId: input.actorId,
      action: "appointment.completed",
      entityType: "appointment",
      entityId: input.appointmentId,
      newValue: {
        issueRepaired: input.issueRepaired,
        componentRepaired: input.componentRepaired ?? null,
        warrantyMonths: input.warrantyMonths,
      },
    });
  });
}

export async function addWorkOrderNote(
  db: Database,
  input: { workOrderId: string; authorId: string | null; body: string },
): Promise<void> {
  await db.insert(workOrderNotes).values({
    workOrderId: input.workOrderId,
    authorId: input.authorId,
    body: input.body,
  });
}

/** Active warranties → "Possible Warranty Callback" flag (spec §41). */
export async function activeWarrantiesForCustomer(db: Database, customerId: string) {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .select({
      id: warranties.id,
      issueRepaired: warranties.issueRepaired,
      componentRepaired: warranties.componentRepaired,
      endDate: warranties.endDate,
      workOrderId: warranties.workOrderId,
    })
    .from(warranties)
    .innerJoin(workOrders, eq(warranties.workOrderId, workOrders.id))
    .where(and(eq(workOrders.customerId, customerId), gte(warranties.endDate, today)));
}

/** Full job view shared by the manager job page and the technician PWA. */
export async function appointmentDetail(db: Database, appointmentId: string) {
  const [core] = await db
    .select({
      appointmentId: appointments.id,
      status: appointments.status,
      windowStart: appointments.windowStart,
      windowEnd: appointments.windowEnd,
      durationMinutes: appointments.durationMinutes,
      notes: appointments.notes,
      workOrderId: workOrders.id,
      workOrderStatus: workOrders.status,
      serviceRequestId: workOrders.serviceRequestId,
      serviceName: serviceTypes.name,
      customerId: customers.id,
      customerFirst: customers.firstName,
      customerLast: customers.lastName,
      customerPhone: customers.phone,
      street: customerAddresses.street,
      unit: customerAddresses.unit,
      city: customerAddresses.city,
      state: customerAddresses.state,
      zip: customerAddresses.zip,
      latitude: customerAddresses.latitude,
      longitude: customerAddresses.longitude,
    })
    .from(appointments)
    .innerJoin(workOrders, eq(appointments.workOrderId, workOrders.id))
    .innerJoin(customers, eq(workOrders.customerId, customers.id))
    .innerJoin(customerAddresses, eq(workOrders.addressId, customerAddresses.id))
    .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
    .where(eq(appointments.id, appointmentId));
  if (!core) return null;

  const [assignments, noteRows, photoRows, history, requestPhotos, warrantyRows] =
    await Promise.all([
      db
        .select({
          technicianId: appointmentTechnicians.technicianId,
          scheduledStart: appointmentTechnicians.scheduledStart,
          scheduledEnd: appointmentTechnicians.scheduledEnd,
          role: appointmentTechnicians.role,
          firstName: technicianProfiles.firstName,
          lastName: technicianProfiles.lastName,
          color: technicianProfiles.color,
          userId: technicianProfiles.userId,
        })
        .from(appointmentTechnicians)
        .innerJoin(
          technicianProfiles,
          eq(appointmentTechnicians.technicianId, technicianProfiles.id),
        )
        .where(eq(appointmentTechnicians.appointmentId, appointmentId)),
      db
        .select()
        .from(workOrderNotes)
        .where(eq(workOrderNotes.workOrderId, core.workOrderId))
        .orderBy(desc(workOrderNotes.createdAt)),
      db
        .select({ id: mediaAssets.id, category: mediaAssets.category })
        .from(mediaAssets)
        .where(eq(mediaAssets.workOrderId, core.workOrderId)),
      db
        .select()
        .from(jobStatusHistory)
        .where(eq(jobStatusHistory.appointmentId, appointmentId))
        .orderBy(asc(jobStatusHistory.createdAt)),
      core.serviceRequestId
        ? db
            .select({ id: mediaAssets.id, category: mediaAssets.category })
            .from(mediaAssets)
            .where(eq(mediaAssets.serviceRequestId, core.serviceRequestId))
        : Promise.resolve([]),
      db.select().from(warranties).where(eq(warranties.workOrderId, core.workOrderId)),
    ]);

  return {
    ...core,
    assignments,
    notes: noteRows,
    photos: [...photoRows, ...requestPhotos],
    history,
    warranties: warrantyRows,
  };
}

/** Queues an email for the worker to send (spec §57 — never blocks booking). */
export async function enqueueEmail(
  db: Database,
  input: { template: string; recipient: string; payload: Record<string, unknown> },
): Promise<void> {
  await db.insert(notifications).values({
    channel: "email",
    template: input.template,
    recipient: input.recipient,
    payload: input.payload,
  });
}

/** Pending notifications for the worker, oldest first. */
export async function pendingNotifications(db: Database, limit = 20) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.status, "pending"))
    .orderBy(asc(notifications.createdAt))
    .limit(limit);
}

export async function markNotification(
  db: Database,
  id: string,
  outcome: { ok: boolean; error?: string },
): Promise<void> {
  await db
    .update(notifications)
    .set(
      outcome.ok
        ? { status: "sent", sentAt: new Date(), error: null }
        : { status: "failed", error: outcome.error?.slice(0, 500) ?? "unknown" },
    )
    .where(eq(notifications.id, id));
}

/** Appointments assigned to one technician for a business-day range. */
export async function technicianDayJobs(
  db: Database,
  technicianId: string,
  range: { start: Date; end: Date },
) {
  return db
    .select({
      appointmentId: appointments.id,
      status: appointments.status,
      scheduledStart: appointmentTechnicians.scheduledStart,
      scheduledEnd: appointmentTechnicians.scheduledEnd,
      serviceName: serviceTypes.name,
      customerFirst: customers.firstName,
      city: customerAddresses.city,
    })
    .from(appointmentTechnicians)
    .innerJoin(appointments, eq(appointmentTechnicians.appointmentId, appointments.id))
    .innerJoin(workOrders, eq(appointments.workOrderId, workOrders.id))
    .innerJoin(customers, eq(workOrders.customerId, customers.id))
    .innerJoin(customerAddresses, eq(workOrders.addressId, customerAddresses.id))
    .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
    .where(
      and(
        eq(appointmentTechnicians.technicianId, technicianId),
        gte(appointmentTechnicians.scheduledStart, range.start),
        sql`${appointmentTechnicians.scheduledStart} < ${range.end.toISOString()}`,
      ),
    )
    .orderBy(asc(appointmentTechnicians.scheduledStart));
}
