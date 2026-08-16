import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { loadEnv } from "@exactpoint/config";
import { createDb } from "./client";
import { toTstzRange } from "./custom-types";
import { runMigrations } from "./migrate";
import { expireSlotHolds } from "./operations/slot-holds";
import {
  appointments,
  appointmentTechnicians,
  customerAddresses,
  customers,
  scheduleReservations,
  slotHolds,
  technicianProfiles,
  workOrders,
} from "./schema";

/**
 * Integration proof of spec §23/§80: the database itself must reject
 * overlapping reservations for one technician (Tests B and J) while allowing
 * parallel technicians (Test A). Requires TEST_DATABASE_URL; the schema is
 * dropped and rebuilt from migrations, which also proves reproducibility.
 */
const env = loadEnv();
const testUrl = env.TEST_DATABASE_URL;

const EXCLUSION_VIOLATION = "23P01";

const d = (iso: string) => new Date(iso);

describe.skipIf(!testUrl)("schedule reservation integrity (database level)", () => {
  const handle = createDb(testUrl);
  const db = handle.db;
  let techA: string;
  let techB: string;
  let workOrderId: string;

  beforeAll(async () => {
    const admin = new pg.Pool({ connectionString: testUrl, max: 1 });
    await admin.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await admin.end();
    await runMigrations(testUrl);

    const [a] = await db
      .insert(technicianProfiles)
      .values({ firstName: "Tech", lastName: "A" })
      .returning();
    const [b] = await db
      .insert(technicianProfiles)
      .values({ firstName: "Tech", lastName: "B" })
      .returning();
    techA = a!.id;
    techB = b!.id;

    const [customer] = await db
      .insert(customers)
      .values({ firstName: "Test", lastName: "Customer" })
      .returning();
    const [address] = await db
      .insert(customerAddresses)
      .values({
        customerId: customer!.id,
        street: "123 Test St",
        city: "Katy",
        zip: "77450",
      })
      .returning();
    const [workOrder] = await db
      .insert(workOrders)
      .values({ customerId: customer!.id, addressId: address!.id })
      .returning();
    workOrderId = workOrder!.id;
  }, 60_000);

  afterAll(async () => {
    await handle.pool.end();
  });

  /** Full booking chain: appointment → technician assignment, returns assignment id. */
  async function createAssignment(technicianId: string, start: Date, end: Date) {
    const [appointment] = await db
      .insert(appointments)
      .values({
        workOrderId,
        windowStart: start,
        windowEnd: end,
        durationMinutes: (end.getTime() - start.getTime()) / 60_000,
      })
      .returning();
    const [assignment] = await db
      .insert(appointmentTechnicians)
      .values({
        appointmentId: appointment!.id,
        technicianId,
        scheduledStart: start,
        scheduledEnd: end,
      })
      .returning();
    return assignment!.id;
  }

  async function reserve(technicianId: string, assignmentId: string, start: Date, end: Date) {
    await db.insert(scheduleReservations).values({
      technicianId,
      timeRange: toTstzRange(start, end),
      kind: "appointment",
      appointmentTechnicianId: assignmentId,
    });
  }

  it("Test A — two technicians may hold the same time in parallel", async () => {
    const start = d("2026-09-01T15:00:00Z");
    const end = d("2026-09-01T17:00:00Z");
    await reserve(techA, await createAssignment(techA, start, end), start, end);
    await reserve(techB, await createAssignment(techB, start, end), start, end);
  });

  it("Test B — the same technician cannot be double-booked, even overlapping", async () => {
    const assignment = await createAssignment(
      techA,
      d("2026-09-01T16:00:00Z"),
      d("2026-09-01T18:00:00Z"),
    );
    await expect(
      reserve(techA, assignment, d("2026-09-01T16:00:00Z"), d("2026-09-01T18:00:00Z")),
    ).rejects.toMatchObject({ cause: { code: EXCLUSION_VIOLATION } });
  });

  it("touching windows (end == start) do not conflict", async () => {
    const start = d("2026-09-01T17:00:00Z");
    const end = d("2026-09-01T18:30:00Z");
    await reserve(techB, await createAssignment(techB, start, end), start, end);
  });

  it("Test J — concurrent bookings for the last identical slot: exactly one wins", async () => {
    const start = d("2026-09-02T15:00:00Z");
    const end = d("2026-09-02T17:00:00Z");
    const assignment1 = await createAssignment(techA, start, end);
    const assignment2 = await createAssignment(techA, start, end);

    const pool1 = new pg.Pool({ connectionString: testUrl, max: 1 });
    const pool2 = new pg.Pool({ connectionString: testUrl, max: 1 });
    const insertSql = `
      INSERT INTO schedule_reservations (technician_id, time_range, kind, appointment_technician_id)
      VALUES ($1, $2, 'appointment', $3)`;
    const range = toTstzRange(start, end);
    try {
      const results = await Promise.allSettled([
        pool1.query(insertSql, [techA, range, assignment1]),
        pool2.query(insertSql, [techA, range, assignment2]),
      ]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0]!.reason as { code?: string }).code).toBe(EXCLUSION_VIOLATION);
    } finally {
      await pool1.end();
      await pool2.end();
    }
  });

  it("an active slot hold blocks a booking for the same technician and time", async () => {
    const start = d("2026-09-03T15:00:00Z");
    const end = d("2026-09-03T17:00:00Z");
    const [hold] = await db
      .insert(slotHolds)
      .values({
        technicianId: techA,
        timeRange: toTstzRange(start, end),
        sessionKey: "test-session",
        expiresAt: new Date(Date.now() + 5 * 60_000),
      })
      .returning();
    await db.insert(scheduleReservations).values({
      technicianId: techA,
      timeRange: toTstzRange(start, end),
      kind: "hold",
      slotHoldId: hold!.id,
    });

    const assignment = await createAssignment(techA, start, end);
    await expect(reserve(techA, assignment, start, end)).rejects.toMatchObject({
      cause: { code: EXCLUSION_VIOLATION },
    });
  });

  it("expired holds are reaped and the time becomes bookable again", async () => {
    const start = d("2026-09-04T15:00:00Z");
    const end = d("2026-09-04T17:00:00Z");
    const [hold] = await db
      .insert(slotHolds)
      .values({
        technicianId: techA,
        timeRange: toTstzRange(start, end),
        sessionKey: "test-session-2",
        expiresAt: new Date(Date.now() - 60_000), // already expired
      })
      .returning();
    await db.insert(scheduleReservations).values({
      technicianId: techA,
      timeRange: toTstzRange(start, end),
      kind: "hold",
      slotHoldId: hold!.id,
    });

    const expired = await expireSlotHolds(db);
    expect(expired).toBeGreaterThanOrEqual(1);

    // The slot is free again — a real booking now succeeds.
    const assignment = await createAssignment(techA, start, end);
    await reserve(techA, assignment, start, end);
  });

  it("a reservation must reference exactly one source", async () => {
    await expect(
      db.insert(scheduleReservations).values({
        technicianId: techB,
        timeRange: toTstzRange(d("2026-09-05T15:00:00Z"), d("2026-09-05T16:00:00Z")),
        kind: "appointment",
        // no source reference at all → CHECK violation
      }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });
});
