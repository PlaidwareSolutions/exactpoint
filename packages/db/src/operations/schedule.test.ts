import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { eq } from "drizzle-orm";
import { loadEnv } from "@exactpoint/config";
import { createDb } from "../client";
import { runMigrations } from "../migrate";
import {
  customerAddresses,
  customers,
  scheduleReservations,
  serviceZones,
  serviceZoneZips,
  slotHolds,
  users,
} from "../schema";
import {
  addTimeOff,
  createSlotHold,
  reassignAppointment,
  ScheduleConflictError,
  scheduleAppointment,
  updateAppointmentStatus,
} from "./schedule";
import { classifyZoneForPoint, loadSchedulingContext } from "./scheduling-context";
import { technicianAvailability, technicianProfiles } from "../schema";

const env = loadEnv();
const testUrl = env.TEST_DATABASE_URL;
const d = (iso: string) => new Date(iso);

describe.skipIf(!testUrl)("scheduling operations (database level)", () => {
  const handle = createDb(testUrl);
  const db = handle.db;
  let techA: string;
  let techB: string;
  let customerId: string;
  let addressId: string;

  beforeAll(async () => {
    const admin = new pg.Pool({ connectionString: testUrl, max: 1 });
    await admin.query(
      "DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;",
    );
    await admin.end();
    await runMigrations(testUrl);

    const [a] = await db
      .insert(technicianProfiles)
      .values({ firstName: "Ops", lastName: "A" })
      .returning();
    const [b] = await db
      .insert(technicianProfiles)
      .values({ firstName: "Ops", lastName: "B" })
      .returning();
    techA = a!.id;
    techB = b!.id;
    // Mon–Sat 7–19 shifts for context loading.
    for (const tech of [techA, techB]) {
      await db.insert(technicianAvailability).values(
        [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          technicianId: tech,
          dayOfWeek,
          startTime: "07:00",
          endTime: "19:00",
        })),
      );
    }

    await db
      .insert(users)
      .values({ id: "owner-test", name: "Owner Test", email: "owner-test@example.com" });

    const [customer] = await db
      .insert(customers)
      .values({ firstName: "Sched", lastName: "Customer" })
      .returning();
    customerId = customer!.id;
    const [address] = await db
      .insert(customerAddresses)
      .values({ customerId, street: "1 Main", city: "Katy", zip: "77450" })
      .returning();
    addressId = address!.id;
  }, 60_000);

  afterAll(async () => {
    await handle.pool.end();
  });

  it("converts a hold into a booked appointment atomically", async () => {
    const start = d("2026-09-08T15:00:00Z");
    const end = d("2026-09-08T16:30:00Z");
    const hold = await createSlotHold(db, {
      technicianId: techA,
      start,
      end,
      sessionKey: "s1",
      holdMinutes: 5,
    });
    expect(hold).not.toBeNull();

    const result = await scheduleAppointment(db, {
      customerId,
      addressId,
      technicianId: techA,
      windowStart: start,
      windowEnd: end,
      scheduledStart: start,
      scheduledEnd: end,
      durationMinutes: 90,
      holdId: hold!.holdId,
      actorType: "customer",
    });

    const [reservation] = await db
      .select()
      .from(scheduleReservations)
      .where(eq(scheduleReservations.appointmentTechnicianId, result.assignmentId));
    expect(reservation?.kind).toBe("appointment");
    expect(reservation?.slotHoldId).toBeNull();
    const [hold2] = await db.select().from(slotHolds).where(eq(slotHolds.id, hold!.holdId));
    expect(hold2?.status).toBe("converted");
  });

  it("a held slot cannot be held twice; scheduling into it fails cleanly", async () => {
    const start = d("2026-09-08T17:00:00Z");
    const end = d("2026-09-08T18:30:00Z");
    const first = await createSlotHold(db, {
      technicianId: techA,
      start,
      end,
      sessionKey: "s2",
      holdMinutes: 5,
    });
    expect(first).not.toBeNull();
    const second = await createSlotHold(db, {
      technicianId: techA,
      start,
      end,
      sessionKey: "s3",
      holdMinutes: 5,
    });
    expect(second).toBeNull();

    await expect(
      scheduleAppointment(db, {
        customerId,
        addressId,
        technicianId: techA,
        windowStart: start,
        windowEnd: end,
        scheduledStart: start,
        scheduledEnd: end,
        durationMinutes: 90,
        actorType: "user",
      }),
    ).rejects.toBeInstanceOf(ScheduleConflictError);
  });

  it("reassignment moves the reservation and rejects conflicting moves", async () => {
    const start = d("2026-09-09T15:00:00Z");
    const end = d("2026-09-09T16:30:00Z");
    const a1 = await scheduleAppointment(db, {
      customerId,
      addressId,
      technicianId: techA,
      windowStart: start,
      windowEnd: end,
      scheduledStart: start,
      scheduledEnd: end,
      durationMinutes: 90,
      actorType: "user",
    });
    // Tech B busy at the same time.
    await scheduleAppointment(db, {
      customerId,
      addressId,
      technicianId: techB,
      windowStart: start,
      windowEnd: end,
      scheduledStart: start,
      scheduledEnd: end,
      durationMinutes: 90,
      actorType: "user",
    });

    // Moving A's appointment onto B (same time) must fail — Test B via move.
    await expect(
      reassignAppointment(db, {
        appointmentId: a1.appointmentId,
        technicianId: techB,
        scheduledStart: start,
        scheduledEnd: end,
        actorId: "owner-test",
      }),
    ).rejects.toBeInstanceOf(ScheduleConflictError);

    // Moving it to B at a later time succeeds and frees A's slot.
    await reassignAppointment(db, {
      appointmentId: a1.appointmentId,
      technicianId: techB,
      scheduledStart: d("2026-09-09T17:00:00Z"),
      scheduledEnd: d("2026-09-09T18:30:00Z"),
      actorId: "owner-test",
    });
    const again = await scheduleAppointment(db, {
      customerId,
      addressId,
      technicianId: techA,
      windowStart: start,
      windowEnd: end,
      scheduledStart: start,
      scheduledEnd: end,
      durationMinutes: 90,
      actorType: "user",
    });
    expect(again.appointmentId).toBeDefined();
  });

  it("cancelling an appointment frees the technician's time", async () => {
    const start = d("2026-09-10T15:00:00Z");
    const end = d("2026-09-10T16:30:00Z");
    const appt = await scheduleAppointment(db, {
      customerId,
      addressId,
      technicianId: techA,
      windowStart: start,
      windowEnd: end,
      scheduledStart: start,
      scheduledEnd: end,
      durationMinutes: 90,
      actorType: "user",
    });
    await updateAppointmentStatus(db, {
      appointmentId: appt.appointmentId,
      to: "cancelled",
      actorId: null,
    });
    const rebook = await scheduleAppointment(db, {
      customerId,
      addressId,
      technicianId: techA,
      windowStart: start,
      windowEnd: end,
      scheduledStart: start,
      scheduledEnd: end,
      durationMinutes: 90,
      actorType: "user",
    });
    expect(rebook.appointmentId).toBeDefined();
  });

  it("Test F path — time off blocks the day at the database level", async () => {
    const result = await addTimeOff(db, {
      technicianId: techB,
      start: d("2026-09-16T00:00:00Z"),
      end: d("2026-09-17T00:00:00Z"),
      type: "vacation",
      createdBy: "owner-test",
    });
    expect(result.ok).toBe(true);

    await expect(
      scheduleAppointment(db, {
        customerId,
        addressId,
        technicianId: techB,
        windowStart: d("2026-09-16T15:00:00Z"),
        windowEnd: d("2026-09-16T16:30:00Z"),
        scheduledStart: d("2026-09-16T15:00:00Z"),
        scheduledEnd: d("2026-09-16T16:30:00Z"),
        durationMinutes: 90,
        actorType: "user",
      }),
    ).rejects.toBeInstanceOf(ScheduleConflictError);

    // …and the loaded context shows the day as reserved for the engine.
    const context = await loadSchedulingContext(db, {
      fromYmd: "2026-09-16",
      days: 1,
      timezone: "America/Chicago",
    });
    const techBDay = context.find((t) => t.id === techB)!.days[0]!;
    expect(techBDay.reservations.length).toBeGreaterThan(0);
  });

  it("classifies a point into a zone by ZIP fallback", async () => {
    const [zone] = await db
      .insert(serviceZones)
      .values({ slug: "west-test", name: "West Test" })
      .returning();
    await db.insert(serviceZoneZips).values({ zoneId: zone!.id, zip: "77450" });
    const result = await classifyZoneForPoint(db, {
      latitude: 29.745,
      longitude: -95.735,
      zip: "77450",
    });
    expect(result).toEqual({ zoneId: zone!.id, source: "auto_zip" });
  });
});
