import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/** Owner-access round: passwords, phone intake, calendar blocks. */
test.describe.configure({ mode: "serial" });

const TECH_EMAIL = "dev-technician@exactpoint.local";
const TECH_PASSWORD = "dgcQFGpt79SwctaD";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Sign in" }).click();
    try {
      await page.waitForURL(/\/(tech|manager)/, { timeout: 4000 });
      return;
    } catch {
      /* hydration retry */
    }
  }
  throw new Error("login failed");
}

test("technician changes password and back again", async ({ page }) => {
  await login(page, TECH_EMAIL, TECH_PASSWORD);
  await page.goto("/account/password");

  const changeTo = async (from: string, to: string) => {
    await page.getByLabel("Current password").fill(from);
    await page.getByLabel("New password", { exact: true }).fill(to);
    await page.getByLabel("Confirm new password").fill(to);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed")).toBeVisible({ timeout: 10_000 });
  };

  await changeTo(TECH_PASSWORD, "temp-password-e2e-1");
  // Re-login with the new password proves the change took.
  await page.context().clearCookies();
  await login(page, TECH_EMAIL, "temp-password-e2e-1");
  await page.goto("/account/password");
  await changeTo("temp-password-e2e-1", TECH_PASSWORD); // restore for other suites
});

test("forgot-password queues a reset email", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("info@exactpointrepairs.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/a reset link is on its way/)).toBeVisible();

  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const rows = await db.query(
    `SELECT id, payload->>'resetUrl' AS url FROM notifications
     WHERE template = 'password_reset' AND recipient = 'info@exactpointrepairs.com'
     ORDER BY created_at DESC LIMIT 1`,
  );
  expect(rows.rows).toHaveLength(1);
  expect(rows.rows[0].url).toContain("/reset-password");
  await db.query(`DELETE FROM notifications WHERE id = $1`, [rows.rows[0].id]);
  await db.end();
});

test("owner books a phone customer into the assign flow", async ({ page }) => {
  await login(page, "info@exactpointrepairs.com", process.env.SEED_OWNER_PASSWORD ?? "");
  await page.goto("/manager/new-booking");

  const uniquePhone = `713555${String(Date.now()).slice(-4)}`;
  await page.getByLabel("Customer phone").fill(uniquePhone);
  await page.getByLabel("First name").fill("Phone");
  await page.getByLabel("Last name").fill("Intake");
  await page.locator("select").first().selectOption({ label: "Washer" });
  await page.getByLabel("Problem").fill("Called in: washer leaking from the door seal.");
  await page.getByLabel("Street", { exact: true }).fill("123 Mason Rd");
  await page.getByLabel("City").fill("Katy");
  await page.getByLabel("ZIP").fill("77450");
  await page.getByRole("button", { name: /Create booking/ }).click();

  await expect(page).toHaveURL(/\/manager\/requests\//, { timeout: 20_000 });
  await expect(page.getByText("Recommended")).toBeVisible();
  await expect(page.getByText("Phone Intake")).toBeVisible();
});

test("help page serves the handbook to signed-in users only", async ({ page }) => {
  // Signed out → redirected to login.
  await page.goto("/help");
  await expect(page).toHaveURL(/\/login/);

  await login(page, "info@exactpointrepairs.com", process.env.SEED_OWNER_PASSWORD ?? "");
  await page.goto("/help");
  await expect(page.getByText("The ExactPoint Handbook")).toBeVisible();
  await expect(page.getByRole("link", { name: "← Back to ExactPoint" })).toHaveAttribute(
    "href",
    "/manager",
  );
});

test("estimate → approval → invoice → email, end to end", async ({ page }, testInfo) => {
  const email = `billing-e2e-${testInfo.project.name}@example.com`;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  // Reset this project's fixture, then seed customer → work order → appointment.
  await pool.query(
    `WITH c AS (SELECT id FROM customers WHERE email = $1),
     wo AS (SELECT id FROM work_orders WHERE customer_id IN (SELECT id FROM c)),
     appt AS (SELECT id FROM appointments WHERE work_order_id IN (SELECT id FROM wo)),
     est AS (SELECT id FROM estimates WHERE work_order_id IN (SELECT id FROM wo)),
     d0 AS (DELETE FROM notifications WHERE recipient = $1),
     d1 AS (DELETE FROM invoices WHERE work_order_id IN (SELECT id FROM wo)),
     d2 AS (DELETE FROM estimate_items WHERE estimate_id IN (SELECT id FROM est)),
     d3 AS (DELETE FROM estimates WHERE id IN (SELECT id FROM est)),
     d4 AS (DELETE FROM job_status_history WHERE appointment_id IN (SELECT id FROM appt)),
     d5 AS (DELETE FROM appointments WHERE id IN (SELECT id FROM appt)),
     d6 AS (DELETE FROM work_orders WHERE id IN (SELECT id FROM wo)),
     d7 AS (DELETE FROM customer_addresses WHERE customer_id IN (SELECT id FROM c))
     DELETE FROM customers WHERE id IN (SELECT id FROM c)`,
    [email],
  );
  const customer = await pool.query(
    `INSERT INTO customers (first_name, last_name, phone, email)
     VALUES ('Billing', 'Fixture', '7135550177', $1) RETURNING id`,
    [email],
  );
  const address = await pool.query(
    `INSERT INTO customer_addresses (customer_id, street, city, state, zip)
     VALUES ($1, '9 Invoice Ln', 'Katy', 'TX', '77450') RETURNING id`,
    [customer.rows[0].id],
  );
  const wo = await pool.query(
    `INSERT INTO work_orders (customer_id, address_id, status) VALUES ($1, $2, 'scheduled') RETURNING id`,
    [customer.rows[0].id, address.rows[0].id],
  );
  const appt = await pool.query(
    `INSERT INTO appointments (work_order_id, window_start, window_end, duration_minutes, status)
     VALUES ($1, now() + interval '90 days', now() + interval '90 days 3 hours', 90, 'confirmed') RETURNING id`,
    [wo.rows[0].id],
  );
  const appointmentId = appt.rows[0].id;

  await login(page, "info@exactpointrepairs.com", process.env.SEED_OWNER_PASSWORD ?? "");
  await page.goto(`/manager/jobs/${appointmentId}`);

  // Build and save the estimate.
  await page.getByPlaceholder("Description").fill("Drain pump replacement");
  await page.getByLabel("Unit price").fill("185.00");
  await page.getByRole("button", { name: "Save quote" }).click();
  await expect(page.getByRole("button", { name: "Customer approved" })).toBeVisible();

  // Approve → invoice issues with the fee waived.
  await page.getByRole("button", { name: "Customer approved" }).click();
  const invoiceLink = page.getByRole("link", { name: /INV-\d+/ });
  await expect(invoiceLink).toBeVisible({ timeout: 15_000 });

  // Open the invoice → print + email controls present; email it.
  await invoiceLink.click();
  await expect(page.getByRole("button", { name: "Print / Save PDF" })).toBeVisible();
  await page.getByRole("button", { name: "Email invoice to customer" }).click();
  await expect(page.getByText(`Invoice emailed to ${email}`)).toBeVisible({ timeout: 15_000 });

  // The invoice email is queued with the line item and total.
  const queued = await pool.query(
    `SELECT payload FROM notifications WHERE recipient = $1 AND template = 'invoice_issued'`,
    [email],
  );
  expect(queued.rowCount).toBe(1);
  expect(JSON.stringify(queued.rows[0].payload)).toContain("Drain pump replacement");

  // Capture the invoice number for search assertions.
  const invoiceNumber = (await page.locator("text=/INV-\\d+/").first().textContent())?.trim();
  expect(invoiceNumber).toMatch(/^INV-\d+$/);

  // Customer page recalls the job and the invoice (Shams's "recall later" fix).
  await page.goto(`/manager/customers/${customer.rows[0].id}`);
  await expect(page.getByRole("link", { name: new RegExp(invoiceNumber!) })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open job ·/ })).toBeVisible();

  // Global search: by customer name and by invoice number.
  await page.goto("/manager/search?q=Billing");
  await expect(
    page.getByRole("link", { name: /Billing Fixture/ }).first(),
  ).toBeVisible();
  await page.goto(`/manager/search?q=${invoiceNumber}`);
  await expect(page.getByRole("link", { name: new RegExp(invoiceNumber!) })).toBeVisible();

  // Quote-first flow: create a standalone quote from the customer page,
  // save a line, and email it (spec follow-up to Shams's field report).
  await page.goto(`/manager/customers/${customer.rows[0].id}`);
  await page.getByRole("button", { name: "Create quote" }).click();
  await expect(page).toHaveURL(/\/manager\/quotes\//, { timeout: 15_000 });
  await page.getByPlaceholder("Description").fill("Compressor replacement (quote)");
  await page.getByLabel("Unit price").fill("650.00");
  await page.getByRole("button", { name: "Save quote" }).click();
  await page.getByRole("button", { name: "Email quote to customer" }).click();
  await expect(page.getByText("Quote emailed.")).toBeVisible({ timeout: 15_000 });
  const quotedEmail = await pool.query(
    `SELECT payload FROM notifications WHERE recipient = $1 AND template = 'quote_issued'`,
    [email],
  );
  expect(quotedEmail.rowCount).toBe(1);
  expect(JSON.stringify(quotedEmail.rows[0].payload)).toContain("Compressor replacement");

  // Edit customer details and verify persistence.
  await page.goto(`/manager/customers/${customer.rows[0].id}`);
  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByLabel("Last name").fill("Fixture-Edited");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Billing Fixture-Edited/ }),
  ).toBeVisible();
  // Restore for cleanup-by-email consistency (email unchanged; name irrelevant).

  await pool.end();
});

test("blocked time renders on the calendar", async ({ page }, testInfo) => {
  // Remove any prior E2E blocks so the deterministic day is always free.
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  await pool.query(
    `WITH b AS (SELECT id FROM schedule_blocks WHERE reason = 'E2E block test'),
     d AS (DELETE FROM schedule_reservations WHERE block_id IN (SELECT id FROM b))
     DELETE FROM schedule_blocks WHERE id IN (SELECT id FROM b)`,
  );
  await pool.end();

  await login(page, "info@exactpointrepairs.com", process.env.SEED_OWNER_PASSWORD ?? "");

  // Deterministic far-future day per project; cleanup above keeps it free.
  const offset = testInfo.project.name === "iphone" ? 46 : 45;
  const day = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
  const ymd = day.toISOString().slice(0, 10);

  await page.goto(`/manager/calendar?date=${ymd}`);
  await page.getByRole("button", { name: "Block time" }).click();
  await page.getByLabel("From", { exact: true }).fill(`${ymd}T10:00`);
  await page.getByLabel("To", { exact: true }).fill(`${ymd}T12:00`);
  await page.getByLabel("Reason").fill("E2E block test");
  await page.getByRole("button", { name: "Block", exact: true }).click();
  await expect(page.getByText(/Blocked\.|skipped/)).toBeVisible({ timeout: 10_000 });

  await page.goto(`/manager/calendar?date=${ymd}`);
  await expect(page.getByText("Blocked", { exact: true }).first()).toBeVisible();
});
