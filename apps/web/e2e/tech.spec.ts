import { expect, test } from "@playwright/test";
import pg from "pg";

/**
 * Technician PWA field flow (spec §39/§77): Today list → job → En Route →
 * Arrived → Start → Complete, which records the labor warranty.
 */
test.describe.configure({ mode: "serial" });

let appointmentId = "";
let workOrderId = "";
let fixtureEmail = "";

function pool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
}

test.beforeAll(async ({}, testInfo) => {
  // Per-project identity and time slot so desktop/iphone runs never collide
  // on the technician's reservation exclusion.
  const offsetHours = testInfo.project.name === "iphone" ? 4 : 1;
  fixtureEmail = `field-flow-${testInfo.project.name}@example.com`;
  const db = pool();
  // Remove any prior fixture run (reservations would otherwise collide).
  await db.query(`
    WITH c AS (SELECT id FROM customers WHERE email = '${fixtureEmail}'),
    wo AS (SELECT id FROM work_orders WHERE customer_id IN (SELECT id FROM c)),
    appt AS (SELECT id FROM appointments WHERE work_order_id IN (SELECT id FROM wo)),
    del_res AS (
      DELETE FROM schedule_reservations WHERE appointment_technician_id IN
        (SELECT id FROM appointment_technicians WHERE appointment_id IN (SELECT id FROM appt))
    ),
    del_at AS (DELETE FROM appointment_technicians WHERE appointment_id IN (SELECT id FROM appt)),
    del_hist AS (DELETE FROM job_status_history WHERE appointment_id IN (SELECT id FROM appt)),
    del_w AS (DELETE FROM warranties WHERE work_order_id IN (SELECT id FROM wo)),
    del_n AS (DELETE FROM work_order_notes WHERE work_order_id IN (SELECT id FROM wo)),
    del_m AS (DELETE FROM media_assets WHERE work_order_id IN (SELECT id FROM wo)),
    del_appt AS (DELETE FROM appointments WHERE id IN (SELECT id FROM appt)),
    del_wo AS (DELETE FROM work_orders WHERE id IN (SELECT id FROM wo)),
    del_addr AS (DELETE FROM customer_addresses WHERE customer_id IN (SELECT id FROM c))
    DELETE FROM customers WHERE id IN (SELECT id FROM c)
  `);
  const tech = await db.query(
    `SELECT tp.id FROM technician_profiles tp
     JOIN users u ON u.id = tp.user_id
     WHERE u.email = 'dev-technician@exactpoint.local'`,
  );
  const techId = tech.rows[0].id;
  const customer = await db.query(
    `INSERT INTO customers (first_name, last_name, phone, email)
     VALUES ('Field', 'Flow', '7135550188', $1) RETURNING id`,
    [fixtureEmail],
  );
  const address = await db.query(
    `INSERT INTO customer_addresses (customer_id, street, city, state, zip, latitude, longitude)
     VALUES ($1, '789 Mason Rd', 'Katy', 'TX', '77450', 29.746, -95.734) RETURNING id`,
    [customer.rows[0].id],
  );
  const wo = await db.query(
    `INSERT INTO work_orders (customer_id, address_id, service_type_id, status)
     VALUES ($1, $2, (SELECT id FROM service_types WHERE slug = 'washer'), 'scheduled') RETURNING id`,
    [customer.rows[0].id, address.rows[0].id],
  );
  workOrderId = wo.rows[0].id;
  // A window later today (project-offset), so it lands on the Tech list.
  const start = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 75 * 60 * 1000);
  const appt = await db.query(
    `INSERT INTO appointments (work_order_id, window_start, window_end, duration_minutes, status)
     VALUES ($1, $2, $3, 75, 'confirmed') RETURNING id`,
    [workOrderId, start.toISOString(), end.toISOString()],
  );
  appointmentId = appt.rows[0].id;
  const assignment = await db.query(
    `INSERT INTO appointment_technicians (appointment_id, technician_id, scheduled_start, scheduled_end)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [appointmentId, techId, start.toISOString(), end.toISOString()],
  );
  await db.query(
    `INSERT INTO schedule_reservations (technician_id, time_range, kind, appointment_technician_id)
     VALUES ($1, tstzrange($2, $3), 'appointment', $4)`,
    [techId, start.toISOString(), end.toISOString(), assignment.rows[0].id],
  );
  await db.end();
});

test("technician works a job from En Route to Complete with warranty", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("dev-technician@exactpoint.local");
  await page.getByLabel("Password").fill("dgcQFGpt79SwctaD");
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Sign in" }).click();
    try {
      await page.waitForURL(/\/tech/, { timeout: 4000 });
      break;
    } catch {
      /* hydration retry */
    }
  }

  // Today list shows the seeded job; open it.
  await page.goto(`/tech/jobs/${appointmentId}`);
  await expect(page.getByRole("link", { name: "Call customer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Navigate" })).toBeVisible();

  await page.getByRole("button", { name: "En route" }).click();
  await expect(page.getByText("status: en route")).toBeVisible();
  await page.getByRole("button", { name: "Arrived" }).click();
  await expect(page.getByText("status: arrived")).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByText("status: in progress")).toBeVisible();

  // Add a diagnosis note.
  await page.getByPlaceholder(/Add a diagnosis/).fill("Drain pump clogged; cleared and tested.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Drain pump clogged; cleared and tested.")).toBeVisible();

  // Complete → warranty.
  await page.getByRole("button", { name: "Complete job…" }).click();
  await page.getByLabel("What was repaired?").fill("Cleared drain pump blockage — washer drains normally");
  await page.getByRole("button", { name: "Complete job", exact: true }).click();
  await expect(page.getByText("status: completed")).toBeVisible({ timeout: 10_000 });

  const db = pool();
  const warranty = await db.query(
    `SELECT issue_repaired, end_date > start_date AS valid FROM warranties WHERE work_order_id = $1`,
    [workOrderId],
  );
  await db.end();
  expect(warranty.rows).toHaveLength(1);
  expect(warranty.rows[0].valid).toBe(true);
});

test("a technician cannot open another technician's job", async ({ page }) => {
  const db = pool();
  // The E2E manager-flow job belongs to Shams (or is unassigned to dev tech).
  const other = await db.query(
    `SELECT at.appointment_id FROM appointment_technicians at
     JOIN technician_profiles tp ON tp.id = at.technician_id
     JOIN users u ON u.id = tp.user_id
     WHERE u.email <> 'dev-technician@exactpoint.local' LIMIT 1`,
  );
  await db.end();
  test.skip(other.rows.length === 0, "no other-technician job present");

  await page.goto("/login");
  await page.getByLabel("Email").fill("dev-technician@exactpoint.local");
  await page.getByLabel("Password").fill("dgcQFGpt79SwctaD");
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Sign in" }).click();
    try {
      await page.waitForURL(/\/tech/, { timeout: 4000 });
      break;
    } catch {
      /* hydration retry */
    }
  }
  await page.goto(`/tech/jobs/${other.rows[0].appointment_id}`);
  await expect(page).toHaveURL(/\/tech$/); // privacy redirect (spec §40)
});
