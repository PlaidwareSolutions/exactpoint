"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  auditLogs,
  businessSettings,
  deleteZonePolygon,
  getDb,
  insertZonePolygon,
  schedulingSettings,
  serviceTypes,
  serviceZones,
  serviceZoneZips,
} from "@exactpoint/db";
import { requireOwner } from "@/lib/session";
import type { ActionResult } from "./schedule-actions";

async function audit(actorId: string, action: string, entityType: string, entityId: string, newValue?: unknown) {
  await getDb().insert(auditLogs).values({
    actorType: "user",
    actorId,
    action,
    entityType,
    entityId,
    newValue: newValue ?? null,
  });
}

const businessSchema = z.object({
  phone: z.string().trim().min(7).max(20),
  email: z.email(),
  diagnosticFeeCents: z.coerce.number().int().min(0).max(100_000),
  laborWarrantyMonths: z.coerce.number().int().min(0).max(60),
});

export async function updateBusinessSettings(input: unknown): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const db = getDb();
  await db
    .update(businessSettings)
    .set({ ...parsed.data, updatedAt: new Date(), updatedBy: session.user.id })
    .where(eq(businessSettings.id, 1));
  await audit(session.user.id, "settings.business_updated", "business_settings", "1", parsed.data);
  revalidatePath("/manager/settings");
  return { ok: true };
}

const schedulingSchema = z.object({
  bookingHorizonDays: z.coerce.number().int().min(1).max(60),
  slotGranularityMinutes: z.coerce.number().int().min(15).max(120),
  bufferMinutes: z.coerce.number().int().min(0).max(120),
  sameDayCutoff: z.string().regex(/^\d{2}:\d{2}$/),
  holdMinutes: z.coerce.number().int().min(1).max(60),
  weights: z.record(z.string(), z.coerce.number().min(-100).max(100)),
});

export async function updateSchedulingSettings(input: unknown): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = schedulingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const db = getDb();
  await db
    .update(schedulingSettings)
    .set({ ...parsed.data, updatedAt: new Date(), updatedBy: session.user.id })
    .where(eq(schedulingSettings.id, 1));
  await audit(session.user.id, "settings.scheduling_updated", "scheduling_settings", "1", parsed.data);
  revalidatePath("/manager/settings");
  return { ok: true };
}

const serviceTypeSchema = z.object({
  defaultDurationMinutes: z.coerce.number().int().min(15).max(480),
  isActive: z.boolean(),
});

export async function updateServiceType(
  serviceTypeId: string,
  input: unknown,
): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = serviceTypeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check duration/active values." };
  const db = getDb();
  await db
    .update(serviceTypes)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(serviceTypes.id, serviceTypeId));
  await audit(session.user.id, "settings.service_type_updated", "service_type", serviceTypeId, parsed.data);
  revalidatePath("/manager/settings/services");
  return { ok: true };
}

const zoneSchema = z.object({
  name: z.string().trim().min(2).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  isActive: z.boolean(),
  priority: z.coerce.number().int().min(-10).max(10),
  preferredDays: z.array(z.number().int().min(0).max(6)).max(7),
});

export async function updateZone(zoneId: string, input: unknown): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const db = getDb();
  await db
    .update(serviceZones)
    .set({
      name: parsed.data.name,
      color: parsed.data.color,
      isActive: parsed.data.isActive,
      priority: parsed.data.priority,
      preferredDays: parsed.data.preferredDays,
      updatedAt: new Date(),
    })
    .where(eq(serviceZones.id, zoneId));
  await audit(session.user.id, "settings.zone_updated", "service_zone", zoneId, parsed.data);
  revalidatePath("/manager/settings/zones");
  return { ok: true };
}

export async function addZoneZip(zoneId: string, zip: string): Promise<ActionResult> {
  const session = await requireOwner();
  if (!/^\d{5}$/.test(zip)) return { ok: false, error: "ZIP must be 5 digits." };
  const db = getDb();
  try {
    await db.insert(serviceZoneZips).values({ zoneId, zip });
  } catch {
    return { ok: false, error: "That ZIP is already assigned to a zone." };
  }
  await audit(session.user.id, "settings.zone_zip_added", "service_zone", zoneId, { zip });
  revalidatePath("/manager/settings/zones");
  return { ok: true };
}

export async function removeZoneZip(zoneId: string, zip: string): Promise<ActionResult> {
  const session = await requireOwner();
  const db = getDb();
  await db.delete(serviceZoneZips).where(eq(serviceZoneZips.zip, zip));
  await audit(session.user.id, "settings.zone_zip_removed", "service_zone", zoneId, { zip });
  revalidatePath("/manager/settings/zones");
  return { ok: true };
}

const ringSchema = z
  .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
  .min(4)
  .max(2000);

/** Saves a drawn zone boundary (spec §73); polygon-first classification uses it immediately. */
export async function saveZonePolygon(
  zoneId: string,
  rings: unknown,
): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = z.array(ringSchema).min(1).max(10).safeParse(rings);
  if (!parsed.success) return { ok: false, error: "Invalid polygon." };
  try {
    const id = await insertZonePolygon(getDb(), zoneId, parsed.data as [number, number][][]);
    await audit(session.user.id, "settings.zone_polygon_added", "service_zone", zoneId, {
      polygonId: id,
      points: parsed.data[0]?.length,
    });
  } catch (err) {
    console.error("[zones] polygon save failed", err);
    return { ok: false, error: "Could not save that shape — try redrawing it." };
  }
  revalidatePath("/manager/settings/zones");
  return { ok: true };
}

export async function removeZonePolygon(polygonId: string): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = z.uuid().safeParse(polygonId);
  if (!parsed.success) return { ok: false, error: "Invalid polygon id." };
  await deleteZonePolygon(getDb(), parsed.data);
  await audit(session.user.id, "settings.zone_polygon_removed", "service_zone_polygon", parsed.data);
  revalidatePath("/manager/settings/zones");
  return { ok: true };
}
