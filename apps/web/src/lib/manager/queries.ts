import { and, asc, count, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import {
  appointments,
  appointmentTechnicians,
  customerAddresses,
  customers,
  getDb,
  mediaAssets,
  serviceRequests,
  serviceTypes,
  serviceZones,
  technicianProfiles,
  workOrders,
} from "@exactpoint/db";
import { BUSINESS } from "@exactpoint/domain";
import { addDays, ymdInTimeZone, zonedTimeToUtc } from "@exactpoint/scheduling";

export function dayRangeUtc(ymd: string): { start: Date; end: Date } {
  return {
    start: zonedTimeToUtc(ymd, "00:00", BUSINESS.timezone),
    end: zonedTimeToUtc(addDays(ymd, 1), "00:00", BUSINESS.timezone),
  };
}

export function todayYmd(): string {
  return ymdInTimeZone(new Date(), BUSINESS.timezone);
}

/** Appointments with assignment + customer + geo context for one day. */
export async function appointmentsForDay(ymd: string) {
  const db = getDb();
  const { start, end } = dayRangeUtc(ymd);
  return db
    .select({
      appointmentId: appointments.id,
      status: appointments.status,
      windowStart: appointments.windowStart,
      windowEnd: appointments.windowEnd,
      durationMinutes: appointments.durationMinutes,
      scheduledStart: appointmentTechnicians.scheduledStart,
      scheduledEnd: appointmentTechnicians.scheduledEnd,
      technicianId: appointmentTechnicians.technicianId,
      assignmentStatus: appointmentTechnicians.status,
      customerFirst: customers.firstName,
      customerLast: customers.lastName,
      city: customerAddresses.city,
      zoneId: customerAddresses.zoneId,
      zoneName: serviceZones.name,
      latitude: customerAddresses.latitude,
      longitude: customerAddresses.longitude,
      serviceName: serviceTypes.name,
      workOrderId: workOrders.id,
    })
    .from(appointments)
    .innerJoin(workOrders, eq(appointments.workOrderId, workOrders.id))
    .innerJoin(customers, eq(workOrders.customerId, customers.id))
    .innerJoin(customerAddresses, eq(workOrders.addressId, customerAddresses.id))
    .leftJoin(serviceZones, eq(customerAddresses.zoneId, serviceZones.id))
    .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
    .leftJoin(
      appointmentTechnicians,
      eq(appointmentTechnicians.appointmentId, appointments.id),
    )
    .where(and(gte(appointments.windowStart, start), lt(appointments.windowStart, end)))
    .orderBy(asc(appointments.windowStart));
}

export async function activeTechnicians() {
  const db = getDb();
  return db
    .select()
    .from(technicianProfiles)
    .orderBy(desc(technicianProfiles.isActive), asc(technicianProfiles.firstName));
}

export interface RequestListFilters {
  status?: "new" | "reviewed" | "converted" | "declined" | "spam";
}

export async function listServiceRequests(filters: RequestListFilters = {}) {
  const db = getDb();
  return db
    .select({
      id: serviceRequests.id,
      reference: serviceRequests.reference,
      createdAt: serviceRequests.createdAt,
      status: serviceRequests.status,
      urgency: serviceRequests.urgency,
      problem: serviceRequests.problemDescription,
      serviceName: serviceTypes.name,
      serviceOther: serviceRequests.serviceOther,
      customerFirst: customers.firstName,
      customerLast: customers.lastName,
      city: customerAddresses.city,
      zoneName: serviceZones.name,
    })
    .from(serviceRequests)
    .innerJoin(customers, eq(serviceRequests.customerId, customers.id))
    .innerJoin(customerAddresses, eq(serviceRequests.addressId, customerAddresses.id))
    .leftJoin(serviceZones, eq(customerAddresses.zoneId, serviceZones.id))
    .leftJoin(serviceTypes, eq(serviceRequests.serviceTypeId, serviceTypes.id))
    .where(filters.status ? eq(serviceRequests.status, filters.status) : undefined)
    .orderBy(desc(serviceRequests.createdAt))
    .limit(100);
}

export async function serviceRequestDetail(id: string) {
  const db = getDb();
  const [request] = await db
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.id, id));
  if (!request) return null;
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, request.customerId));
  const [address] = await db
    .select({
      id: customerAddresses.id,
      street: customerAddresses.street,
      unit: customerAddresses.unit,
      city: customerAddresses.city,
      state: customerAddresses.state,
      zip: customerAddresses.zip,
      latitude: customerAddresses.latitude,
      longitude: customerAddresses.longitude,
      zoneId: customerAddresses.zoneId,
      validationStatus: customerAddresses.validationStatus,
      zoneName: serviceZones.name,
    })
    .from(customerAddresses)
    .leftJoin(serviceZones, eq(customerAddresses.zoneId, serviceZones.id))
    .where(eq(customerAddresses.id, request.addressId));
  const [serviceType] = request.serviceTypeId
    ? await db.select().from(serviceTypes).where(eq(serviceTypes.id, request.serviceTypeId))
    : [];
  const photos = await db
    .select({ id: mediaAssets.id, mimeType: mediaAssets.mimeType })
    .from(mediaAssets)
    .where(eq(mediaAssets.serviceRequestId, id));
  const relatedWorkOrders = await db
    .select({ id: workOrders.id, status: workOrders.status })
    .from(workOrders)
    .where(eq(workOrders.serviceRequestId, id));
  return { request, customer, address, serviceType, photos, relatedWorkOrders };
}

/**
 * The unassigned queue (spec §22) plus Test K's flag: future assignments
 * held by deactivated technicians.
 */
export async function unassignedWork() {
  const db = getDb();
  const newRequests = await listServiceRequests({ status: "new" });

  const orphanedFuture = await db
    .select({
      appointmentId: appointments.id,
      windowStart: appointments.windowStart,
      technicianFirst: technicianProfiles.firstName,
      technicianLast: technicianProfiles.lastName,
      customerFirst: customers.firstName,
      customerLast: customers.lastName,
      serviceName: serviceTypes.name,
    })
    .from(appointmentTechnicians)
    .innerJoin(appointments, eq(appointmentTechnicians.appointmentId, appointments.id))
    .innerJoin(
      technicianProfiles,
      eq(appointmentTechnicians.technicianId, technicianProfiles.id),
    )
    .innerJoin(workOrders, eq(appointments.workOrderId, workOrders.id))
    .innerJoin(customers, eq(workOrders.customerId, customers.id))
    .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
    .where(
      and(
        eq(technicianProfiles.isActive, false),
        gte(appointments.windowStart, new Date()),
        inArray(appointmentTechnicians.status, ["assigned", "accepted"]),
        inArray(appointments.status, [
          "requested",
          "pending_confirmation",
          "confirmed",
          "assigned",
        ]),
      ),
    );

  const unassignedAppointments = await db
    .select({
      appointmentId: appointments.id,
      windowStart: appointments.windowStart,
      customerFirst: customers.firstName,
      customerLast: customers.lastName,
      serviceName: serviceTypes.name,
    })
    .from(appointments)
    .innerJoin(workOrders, eq(appointments.workOrderId, workOrders.id))
    .innerJoin(customers, eq(workOrders.customerId, customers.id))
    .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
    .leftJoin(
      appointmentTechnicians,
      eq(appointmentTechnicians.appointmentId, appointments.id),
    )
    .where(
      and(
        isNull(appointmentTechnicians.id),
        gte(appointments.windowStart, new Date()),
        inArray(appointments.status, ["requested", "pending_confirmation", "confirmed"]),
      ),
    );

  return { newRequests, orphanedFuture, unassignedAppointments };
}

/** §19 area view: appointments per zone per day over the coming week. */
export async function zoneDayMatrix(fromYmd: string, days: number) {
  const db = getDb();
  const start = dayRangeUtc(fromYmd).start;
  const end = dayRangeUtc(addDays(fromYmd, days - 1)).end;
  const rows = await db
    .select({
      zoneName: sql<string>`coalesce(${serviceZones.name}, 'Unzoned')`,
      day: sql<string>`to_char(${appointments.windowStart} AT TIME ZONE ${BUSINESS.timezone}, 'YYYY-MM-DD')`,
      total: count(),
    })
    .from(appointments)
    .innerJoin(workOrders, eq(appointments.workOrderId, workOrders.id))
    .innerJoin(customerAddresses, eq(workOrders.addressId, customerAddresses.id))
    .leftJoin(serviceZones, eq(customerAddresses.zoneId, serviceZones.id))
    .where(
      and(
        gte(appointments.windowStart, start),
        lt(appointments.windowStart, end),
        inArray(appointments.status, [
          "pending_confirmation",
          "confirmed",
          "assigned",
          "en_route",
          "arrived",
          "in_progress",
        ]),
      ),
    )
    .groupBy(sql`1`, sql`2`);
  return rows;
}
