"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  addTimeOff,
  auditLogs,
  getDb,
  skills,
  technicianAvailability,
  technicianProfiles,
  technicianSkills,
  technicianZonePreferences,
  users,
} from "@exactpoint/db";
import { TIME_OFF_TYPES } from "@exactpoint/domain";
import { auth } from "@/lib/auth";
import { requireOwner } from "@/lib/session";
import type { ActionResult } from "./schedule-actions";

const technicianSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60).default(""),
  mobile: z.string().trim().max(25).optional().or(z.literal("")),
  email: z.email().optional().or(z.literal("")),
  title: z.string().trim().max(60).optional().or(z.literal("")),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#4f46e5"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  maxDailyJobs: z.coerce.number().int().min(1).max(20).optional().or(z.literal("")),
  emergencyAvailable: z.boolean().default(false),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export async function createTechnician(input: unknown): Promise<ActionResult & { id?: string }> {
  const session = await requireOwner();
  const parsed = technicianSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;
  const db = getDb();
  const [tech] = await db
    .insert(technicianProfiles)
    .values({
      firstName: d.firstName,
      lastName: d.lastName,
      mobile: d.mobile || null,
      email: d.email || null,
      title: d.title || null,
      color: d.color,
      startDate: d.startDate || null,
      maxDailyJobs: typeof d.maxDailyJobs === "number" ? d.maxDailyJobs : null,
      emergencyAvailable: d.emergencyAvailable,
      notes: d.notes || null,
    })
    .returning({ id: technicianProfiles.id });
  await db.insert(auditLogs).values({
    actorType: "user",
    actorId: session.user.id,
    action: "technician.created",
    entityType: "technician",
    entityId: tech!.id,
    newValue: { firstName: d.firstName, lastName: d.lastName },
  });
  revalidatePath("/manager/team");
  return { ok: true, id: tech!.id };
}

export async function updateTechnician(
  technicianId: string,
  input: unknown,
): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = technicianSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;
  const db = getDb();
  await db
    .update(technicianProfiles)
    .set({
      firstName: d.firstName,
      lastName: d.lastName,
      mobile: d.mobile || null,
      email: d.email || null,
      title: d.title || null,
      color: d.color,
      startDate: d.startDate || null,
      maxDailyJobs: typeof d.maxDailyJobs === "number" ? d.maxDailyJobs : null,
      emergencyAvailable: d.emergencyAvailable,
      notes: d.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(technicianProfiles.id, technicianId));
  await db.insert(auditLogs).values({
    actorType: "user",
    actorId: session.user.id,
    action: "technician.updated",
    entityType: "technician",
    entityId: technicianId,
  });
  revalidatePath("/manager/team");
  return { ok: true };
}

/** Deactivate/reactivate — never delete (spec §4, Test K). */
export async function setTechnicianActive(
  technicianId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const session = await requireOwner();
  const db = getDb();
  await db
    .update(technicianProfiles)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(technicianProfiles.id, technicianId));
  await db.insert(auditLogs).values({
    actorType: "user",
    actorId: session.user.id,
    action: isActive ? "technician.reactivated" : "technician.deactivated",
    entityType: "technician",
    entityId: technicianId,
  });
  revalidatePath("/manager/team");
  revalidatePath("/manager");
  return { ok: true };
}

export async function setTechnicianSkills(
  technicianId: string,
  skillSlugs: string[],
): Promise<ActionResult> {
  const session = await requireOwner();
  const db = getDb();
  const allSkills = await db.select().from(skills);
  const wanted = allSkills.filter((s) => skillSlugs.includes(s.slug));
  await db.transaction(async (tx) => {
    await tx
      .delete(technicianSkills)
      .where(eq(technicianSkills.technicianId, technicianId));
    if (wanted.length > 0) {
      await tx
        .insert(technicianSkills)
        .values(wanted.map((s) => ({ technicianId, skillId: s.id })));
    }
    await tx.insert(auditLogs).values({
      actorType: "user",
      actorId: session.user.id,
      action: "technician.skills_changed",
      entityType: "technician",
      entityId: technicianId,
      newValue: { skills: wanted.map((s) => s.slug) },
    });
  });
  revalidatePath("/manager/team");
  return { ok: true };
}

const availabilityRowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function setTechnicianAvailability(
  technicianId: string,
  rows: unknown,
): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = z.array(availabilityRowSchema).max(14).safeParse(rows);
  if (!parsed.success) return { ok: false, error: "Invalid availability." };
  for (const row of parsed.data) {
    if (row.endTime <= row.startTime) {
      return { ok: false, error: "End time must be after start time." };
    }
  }
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(technicianAvailability)
      .where(eq(technicianAvailability.technicianId, technicianId));
    if (parsed.data.length > 0) {
      await tx
        .insert(technicianAvailability)
        .values(parsed.data.map((r) => ({ technicianId, ...r })));
    }
    await tx.insert(auditLogs).values({
      actorType: "user",
      actorId: session.user.id,
      action: "technician.availability_changed",
      entityType: "technician",
      entityId: technicianId,
      newValue: { rows: parsed.data },
    });
  });
  revalidatePath("/manager/team");
  return { ok: true };
}

export async function setTechnicianZonePreferences(
  technicianId: string,
  zoneIds: string[],
): Promise<ActionResult> {
  await requireOwner();
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(technicianZonePreferences)
      .where(eq(technicianZonePreferences.technicianId, technicianId));
    const valid = z.array(z.uuid()).max(20).safeParse(zoneIds);
    if (valid.success && valid.data.length > 0) {
      await tx
        .insert(technicianZonePreferences)
        .values(valid.data.map((zoneId) => ({ technicianId, zoneId })));
    }
  });
  revalidatePath("/manager/team");
  return { ok: true };
}

const timeOffSchema = z.object({
  startIso: z.iso.datetime(),
  endIso: z.iso.datetime(),
  type: z.enum(TIME_OFF_TYPES),
  note: z.string().max(300).optional(),
});

export async function addTimeOffAction(
  technicianId: string,
  input: unknown,
): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = timeOffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid time-off input." };
  const start = new Date(parsed.data.startIso);
  const end = new Date(parsed.data.endIso);
  if (end <= start) return { ok: false, error: "End must be after start." };
  const result = await addTimeOff(getDb(), {
    technicianId,
    start,
    end,
    type: parsed.data.type,
    note: parsed.data.note,
    createdBy: session.user.id,
  });
  if (!result.ok) return result;
  revalidatePath("/manager/team");
  revalidatePath("/manager/calendar");
  return { ok: true };
}

/**
 * Creates the technician's login (spec §4 invitation). Until an email
 * provider is configured, the generated one-time password is shown to the
 * owner exactly once to hand over directly.
 */
export async function createTechnicianLogin(
  technicianId: string,
): Promise<ActionResult & { email?: string; temporaryPassword?: string }> {
  const session = await requireOwner();
  const db = getDb();
  const [tech] = await db
    .select()
    .from(technicianProfiles)
    .where(eq(technicianProfiles.id, technicianId));
  if (!tech) return { ok: false, error: "Technician not found." };
  if (tech.userId) return { ok: false, error: "This technician already has a login." };
  if (!tech.email) {
    return { ok: false, error: "Add an email address to the profile first." };
  }
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, tech.email)));
  if (existing) return { ok: false, error: "A login with this email already exists." };

  const temporaryPassword = randomBytes(9).toString("base64url");
  const created = await auth.api.createUser({
    headers: await headers(),
    body: {
      email: tech.email,
      name: `${tech.firstName} ${tech.lastName}`.trim(),
      password: temporaryPassword,
      role: "technician",
    },
  });
  await db
    .update(technicianProfiles)
    .set({ userId: created.user.id, updatedAt: new Date() })
    .where(eq(technicianProfiles.id, technicianId));
  await db.insert(auditLogs).values({
    actorType: "user",
    actorId: session.user.id,
    action: "technician.login_created",
    entityType: "technician",
    entityId: technicianId,
  });
  revalidatePath("/manager/team");
  return { ok: true, email: tech.email, temporaryPassword };
}
