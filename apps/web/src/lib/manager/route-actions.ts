"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auditLogs, dailyRoutes, getDb, routeStops } from "@exactpoint/db";
import { requireOwner } from "@/lib/session";
import type { ActionResult } from "./schedule-actions";

const acceptSchema = z.object({
  technicianId: z.uuid(),
  routeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  order: z
    .array(z.object({ appointmentId: z.uuid(), travelMinutesFromPrevious: z.number().int().min(0).nullable() }))
    .min(1)
    .max(30),
  totalTravelMinutes: z.number().int().min(0),
});

/**
 * Accept Optimization (spec §16/§75): persists the recommended stop order as
 * the technician's plan of record. Confirmed appointment windows are never
 * changed here — only the visit sequence.
 */
export async function acceptRoute(input: unknown): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid route." };
  const { technicianId, routeDate, order, totalTravelMinutes } = parsed.data;

  const db = getDb();
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: dailyRoutes.id })
      .from(dailyRoutes)
      .where(and(eq(dailyRoutes.technicianId, technicianId), eq(dailyRoutes.routeDate, routeDate)));
    let routeId = existing?.id;
    if (routeId) {
      await tx.delete(routeStops).where(eq(routeStops.routeId, routeId));
      await tx
        .update(dailyRoutes)
        .set({ status: "approved", totalTravelMinutes, updatedAt: new Date() })
        .where(eq(dailyRoutes.id, routeId));
    } else {
      const [created] = await tx
        .insert(dailyRoutes)
        .values({ technicianId, routeDate, status: "approved", totalTravelMinutes })
        .returning({ id: dailyRoutes.id });
      routeId = created!.id;
    }
    await tx.insert(routeStops).values(
      order.map((stop, i) => ({
        routeId: routeId!,
        appointmentId: stop.appointmentId,
        sequence: i + 1,
        travelMinutesFromPrevious: stop.travelMinutesFromPrevious,
      })),
    );
    await tx.insert(auditLogs).values({
      actorType: "user",
      actorId: session.user.id,
      action: "route.optimization_accepted",
      entityType: "daily_route",
      entityId: routeId!,
      newValue: { technicianId, routeDate, stops: order.length, totalTravelMinutes },
    });
  });
  revalidatePath("/manager/routes");
  return { ok: true };
}
