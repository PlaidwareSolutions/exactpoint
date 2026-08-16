import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import {
  addDays,
  weekdayOfYmd,
  ymdInTimeZone,
  zonedTimeToUtc,
  type TechnicianContext,
  type TechnicianDay,
} from "@exactpoint/scheduling";
import type { Database } from "../client";
import {
  appointments,
  appointmentTechnicians,
  customerAddresses,
  scheduleReservations,
  serviceZoneZips,
  skills,
  technicianAvailability,
  technicianProfiles,
  technicianSkills,
  technicianZonePreferences,
  workOrders,
} from "../schema";

/** Parses a PostgreSQL tstzrange literal into instants. */
export function parseTstzRange(range: string): { start: Date; end: Date } | null {
  const match = range.match(/^[[(]"?([^",]+)"?,\s*"?([^")]+)"?[)\]]$/);
  if (!match) return null;
  return { start: new Date(match[1]!), end: new Date(match[2]!) };
}

/**
 * Zone classification (spec §8, §73): polygon containment is canonical;
 * ZIP mapping is the fallback.
 */
export async function classifyZoneForPoint(
  db: Database,
  input: { latitude?: number | null; longitude?: number | null; zip: string },
): Promise<{ zoneId: string; source: "auto_polygon" | "auto_zip" } | null> {
  if (input.latitude != null && input.longitude != null) {
    const result = await db.execute(sql`
      SELECT z.id
      FROM service_zone_polygons p
      JOIN service_zones z ON z.id = p.zone_id AND z.is_active
      WHERE ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326))
      ORDER BY z.priority DESC
      LIMIT 1
    `);
    const row = result.rows[0] as { id?: string } | undefined;
    if (row?.id) return { zoneId: row.id, source: "auto_polygon" };
  }
  const [zipRow] = await db
    .select({ zoneId: serviceZoneZips.zoneId })
    .from(serviceZoneZips)
    .where(eq(serviceZoneZips.zip, input.zip));
  return zipRow ? { zoneId: zipRow.zoneId, source: "auto_zip" } : null;
}

export interface SchedulingContextOptions {
  /** First business-timezone date (YYYY-MM-DD); defaults to today. */
  fromYmd?: string;
  days?: number;
  timezone: string;
  /** When set, marks technicians who completed work for this customer. */
  customerId?: string;
  /** Include inactive technicians (for override validation views). */
  includeInactive?: boolean;
}

export interface LoadedTechnician extends TechnicianContext {
  firstName: string;
  lastName: string;
  color: string | null;
}

/**
 * Loads the team's resolved scheduling picture for the engine: shifts from
 * weekly templates, every reservation (appointments, holds, time off,
 * blocks — company-wide blocks have per-technician reservation rows), and
 * existing jobs with geo context.
 */
export async function loadSchedulingContext(
  db: Database,
  options: SchedulingContextOptions,
): Promise<LoadedTechnician[]> {
  const { timezone, customerId, includeInactive = false } = options;
  const fromYmd = options.fromYmd ?? ymdInTimeZone(new Date(), timezone);
  const days = options.days ?? 7;
  const rangeStart = zonedTimeToUtc(fromYmd, "00:00", timezone);
  const rangeEnd = zonedTimeToUtc(addDays(fromYmd, days), "00:00", timezone);

  const techs = await db
    .select()
    .from(technicianProfiles)
    .where(includeInactive ? undefined : eq(technicianProfiles.isActive, true));
  if (techs.length === 0) return [];
  const techIds = techs.map((t) => t.id);

  const skillRows = await db
    .select({ technicianId: technicianSkills.technicianId, slug: skills.slug })
    .from(technicianSkills)
    .innerJoin(skills, eq(technicianSkills.skillId, skills.id))
    .where(inArray(technicianSkills.technicianId, techIds));

  const zonePrefRows = await db
    .select()
    .from(technicianZonePreferences)
    .where(inArray(technicianZonePreferences.technicianId, techIds));

  const availabilityRows = await db
    .select()
    .from(technicianAvailability)
    .where(inArray(technicianAvailability.technicianId, techIds));

  const reservationRows = await db
    .select({
      technicianId: scheduleReservations.technicianId,
      timeRange: scheduleReservations.timeRange,
    })
    .from(scheduleReservations)
    .where(
      and(
        inArray(scheduleReservations.technicianId, techIds),
        sql`${scheduleReservations.timeRange} && tstzrange(${rangeStart.toISOString()}, ${rangeEnd.toISOString()})`,
      ),
    );

  const jobRows = await db
    .select({
      technicianId: appointmentTechnicians.technicianId,
      start: appointmentTechnicians.scheduledStart,
      end: appointmentTechnicians.scheduledEnd,
      latitude: customerAddresses.latitude,
      longitude: customerAddresses.longitude,
      zoneId: customerAddresses.zoneId,
    })
    .from(appointmentTechnicians)
    .innerJoin(appointments, eq(appointmentTechnicians.appointmentId, appointments.id))
    .innerJoin(workOrders, eq(appointments.workOrderId, workOrders.id))
    .innerJoin(customerAddresses, eq(workOrders.addressId, customerAddresses.id))
    .where(
      and(
        inArray(appointmentTechnicians.technicianId, techIds),
        inArray(appointmentTechnicians.status, ["assigned", "accepted"]),
        gte(appointmentTechnicians.scheduledEnd, rangeStart),
        lt(appointmentTechnicians.scheduledStart, rangeEnd),
      ),
    );

  const servedRows = customerId
    ? await db
        .selectDistinct({ technicianId: appointmentTechnicians.technicianId })
        .from(appointmentTechnicians)
        .innerJoin(appointments, eq(appointmentTechnicians.appointmentId, appointments.id))
        .innerJoin(workOrders, eq(appointments.workOrderId, workOrders.id))
        .where(
          and(
            eq(workOrders.customerId, customerId),
            eq(appointments.status, "completed"),
          ),
        )
    : [];
  const servedSet = new Set(servedRows.map((r) => r.technicianId));

  const ymds: string[] = [];
  for (let i = 0; i < days; i++) ymds.push(addDays(fromYmd, i));

  return techs.map((tech) => {
    const myAvailability = availabilityRows.filter((a) => a.technicianId === tech.id);
    const myReservations = reservationRows
      .filter((r) => r.technicianId === tech.id)
      .map((r) => parseTstzRange(r.timeRange))
      .filter((r): r is { start: Date; end: Date } => r !== null);
    const myJobs = jobRows.filter((j) => j.technicianId === tech.id);

    const dayList: TechnicianDay[] = ymds.map((ymd) => {
      const weekday = weekdayOfYmd(ymd);
      const windows = myAvailability.filter((a) => a.dayOfWeek === weekday);
      let shift: TechnicianDay["shift"] = null;
      if (windows.length > 0) {
        const startHm = windows.map((w) => w.startTime.slice(0, 5)).sort()[0]!;
        const endHm = windows.map((w) => w.endTime.slice(0, 5)).sort().at(-1)!;
        shift = {
          start: zonedTimeToUtc(ymd, startHm, timezone),
          end: zonedTimeToUtc(ymd, endHm, timezone),
        };
      }
      const dayStart = zonedTimeToUtc(ymd, "00:00", timezone);
      const dayEnd = zonedTimeToUtc(addDays(ymd, 1), "00:00", timezone);
      const inDay = (w: { start: Date; end: Date }) => w.start < dayEnd && dayStart < w.end;
      return {
        date: ymd,
        shift,
        reservations: myReservations
          .filter(inDay)
          .map((r) => ({ technicianId: tech.id, start: r.start, end: r.end })),
        jobs: myJobs
          .filter(inDay)
          .map((j) => ({
            start: j.start,
            end: j.end,
            zoneId: j.zoneId,
            location:
              j.latitude != null && j.longitude != null
                ? { latitude: j.latitude, longitude: j.longitude }
                : null,
          })),
      };
    });

    return {
      id: tech.id,
      isActive: tech.isActive,
      skillSlugs: skillRows.filter((s) => s.technicianId === tech.id).map((s) => s.slug),
      maxDailyJobs: tech.maxDailyJobs,
      emergencyAvailable: tech.emergencyAvailable,
      preferredZoneIds: zonePrefRows
        .filter((z) => z.technicianId === tech.id)
        .map((z) => z.zoneId),
      hasServedCustomer: servedSet.has(tech.id),
      days: dayList,
      firstName: tech.firstName,
      lastName: tech.lastName,
      color: tech.color,
    };
  });
}
