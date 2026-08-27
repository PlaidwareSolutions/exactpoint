"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  addWorkOrderNote,
  appointmentDetail,
  appointments,
  appointmentTechnicians,
  businessSettings,
  completeAppointment,
  customers,
  enqueueEmail,
  getDb,
  technicianProfiles,
  updateAppointmentStatus,
} from "@exactpoint/db";
import { canAccessManagerArea } from "@/lib/authz";
import { emitJobCompleted, journeyForAppointment } from "@/lib/mhub/events";
import { requireTechnician } from "@/lib/session";

/**
 * Technician-scoped actions (spec §39/§40): a technician may only act on
 * appointments assigned to them; the owner may act on any.
 */
async function authorizeForAppointment(appointmentId: string) {
  const session = await requireTechnician();
  const db = getDb();
  if (canAccessManagerArea(session.user.role)) {
    return { session, db, allowed: true };
  }
  const [profile] = await db
    .select({ id: technicianProfiles.id })
    .from(technicianProfiles)
    .where(eq(technicianProfiles.userId, session.user.id));
  if (!profile) return { session, db, allowed: false };
  const [assignment] = await db
    .select({ id: appointmentTechnicians.id })
    .from(appointmentTechnicians)
    .where(
      and(
        eq(appointmentTechnicians.appointmentId, appointmentId),
        eq(appointmentTechnicians.technicianId, profile.id),
      ),
    );
  return { session, db, allowed: Boolean(assignment) };
}

export type TechActionResult = { ok: true } | { ok: false; error: string };

const FIELD_STATUSES = ["en_route", "arrived", "in_progress"] as const;

const statusSchema = z.object({
  appointmentId: z.uuid(),
  to: z.enum(FIELD_STATUSES),
});

export async function techSetStatus(input: unknown): Promise<TechActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid status." };
  const { session, db, allowed } = await authorizeForAppointment(parsed.data.appointmentId);
  if (!allowed) return { ok: false, error: "This job isn't assigned to you." };
  await updateAppointmentStatus(db, {
    appointmentId: parsed.data.appointmentId,
    to: parsed.data.to,
    actorId: session.user.id,
  });
  revalidatePath("/tech");
  return { ok: true };
}

const completeSchema = z.object({
  appointmentId: z.uuid(),
  issueRepaired: z.string().trim().min(3, "Describe what was repaired").max(300),
  componentRepaired: z.string().trim().max(200).optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function techComplete(input: unknown): Promise<TechActionResult> {
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const { session, db, allowed } = await authorizeForAppointment(parsed.data.appointmentId);
  if (!allowed) return { ok: false, error: "This job isn't assigned to you." };

  const [settings] = await db
    .select({ months: businessSettings.laborWarrantyMonths })
    .from(businessSettings)
    .where(eq(businessSettings.id, 1));
  await completeAppointment(db, {
    appointmentId: parsed.data.appointmentId,
    actorId: session.user.id,
    issueRepaired: parsed.data.issueRepaired,
    componentRepaired: parsed.data.componentRepaired || undefined,
    note: parsed.data.note || undefined,
    warrantyMonths: settings?.months ?? 2,
  });

  const detail = await appointmentDetail(db, parsed.data.appointmentId);
  if (detail) {
    const [customer] = await db
      .select({ email: customers.email, firstName: customers.firstName })
      .from(customers)
      .where(eq(customers.id, detail.customerId));
    if (customer?.email) {
      await enqueueEmail(db, {
        template: "job_complete",
        recipient: customer.email,
        payload: { firstName: customer.firstName },
      });
    }
  }
  const journey = await journeyForAppointment(parsed.data.appointmentId);
  if (journey) {
    emitJobCompleted(journey.leadId, {
      revenueCents: journey.latestInvoiceTotalCents,
      technicianFirstName: journey.technicianFirstName,
      email: journey.customerEmail,
      phone: journey.customerPhone,
    });
  }
  revalidatePath("/tech");
  revalidatePath("/manager");
  return { ok: true };
}

const noteSchema = z.object({
  appointmentId: z.uuid(),
  body: z.string().trim().min(2).max(2000),
});

export async function techAddNote(input: unknown): Promise<TechActionResult> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Note is too short." };
  const { session, db, allowed } = await authorizeForAppointment(parsed.data.appointmentId);
  if (!allowed) return { ok: false, error: "This job isn't assigned to you." };
  const [appt] = await db
    .select({ workOrderId: appointments.workOrderId })
    .from(appointments)
    .where(eq(appointments.id, parsed.data.appointmentId));
  if (!appt) return { ok: false, error: "Job not found." };
  await addWorkOrderNote(db, {
    workOrderId: appt.workOrderId,
    authorId: session.user.id,
    body: parsed.data.body,
  });
  revalidatePath(`/tech/jobs/${parsed.data.appointmentId}`);
  return { ok: true };
}
