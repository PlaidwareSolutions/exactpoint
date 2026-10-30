import { createHmac } from "node:crypto";
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
  test.setTimeout(180_000); // one long journey: quote → invoice → ledger → receipts → change orders
  const email = `billing-e2e-${testInfo.project.name}@example.com`;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  // Reset this project's fixture, then seed customer → work order → appointment.
  await pool.query(
    `WITH c AS (SELECT id FROM customers WHERE email = $1),
     wo AS (SELECT id FROM work_orders WHERE customer_id IN (SELECT id FROM c)),
     appt AS (SELECT id FROM appointments WHERE work_order_id IN (SELECT id FROM wo)),
     est AS (SELECT id FROM estimates WHERE work_order_id IN (SELECT id FROM wo)),
     inv AS (SELECT id FROM invoices WHERE work_order_id IN (SELECT id FROM wo)),
     d0 AS (DELETE FROM notifications WHERE recipient = $1),
     dp AS (DELETE FROM invoice_payments WHERE invoice_id IN (SELECT id FROM inv)),
     d1 AS (DELETE FROM invoices WHERE id IN (SELECT id FROM inv)),
     d2 AS (DELETE FROM estimate_revisions WHERE estimate_id IN (SELECT id FROM est)),
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

  // Partial payment: $185 + 8.25% tax = $200.26 due. A $100 deposit leaves $100.26.
  await expect(page.getByTestId("balance-due")).toHaveText("$200.26");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByLabel("Amount")).toHaveValue("200.26"); // prefilled with the balance
  await page.getByLabel("Amount").fill("100");
  await page.getByLabel("Method").selectOption("check");
  await page.getByLabel("Reference").fill("1042");
  await page.getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByTestId("ledger-message")).toContainText(/receipt RCT-\d+ · balance \$100\.26/, {
    timeout: 15_000,
  });
  await expect(page.getByTestId("balance-due")).toHaveText("$100.26");
  await expect(page.getByTestId("invoice-status").first()).toHaveText("PARTIALLY PAID");
  // One receipt email per payment, with running totals.
  const receipt1 = await pool.query(
    `SELECT payload FROM notifications WHERE recipient = $1 AND template = 'payment_receipt' ORDER BY created_at`,
    [email],
  );
  expect(receipt1.rowCount).toBe(1);
  expect(receipt1.rows[0].payload).toMatchObject({
    amountLabel: "$100.00",
    methodLabel: "Check",
    paymentReference: "1042",
    paidToDateLabel: "$100.00",
    balanceLabel: "$100.26",
    paidInFull: false,
  });

  // Overpaying is refused with the balance spelled out.
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByLabel("Amount").fill("150");
  await page.getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByTestId("ledger-message")).toContainText("more than the $100.26 balance");

  // Final payment → paid in full; the second receipt says so.
  await page.getByLabel("Amount").fill("100.26");
  await page.getByLabel("Method").selectOption("zelle");
  await page.getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByTestId("ledger-message")).toContainText("Paid in full", { timeout: 15_000 });
  await expect(page.getByTestId("balance-due")).toContainText("paid in full");
  await expect(page.getByRole("button", { name: "Record payment" })).toHaveCount(0);
  const receipts = await pool.query(
    `SELECT payload FROM notifications WHERE recipient = $1 AND template = 'payment_receipt' ORDER BY created_at`,
    [email],
  );
  expect(receipts.rowCount).toBe(2);
  expect(receipts.rows[1].payload).toMatchObject({ paidInFull: true, paidToDateLabel: "$200.26" });

  // Printable receipt per payment; re-sending within a minute never duplicates.
  const receiptLinks = page.getByRole("link", { name: "Print receipt" });
  await expect(receiptLinks).toHaveCount(2);
  await receiptLinks.first().click();
  await expect(page).toHaveURL(/\/receipts\//);
  await expect(page.getByTestId("receipt-number")).toHaveText(/^RCT-\d+$/);
  await expect(page.getByTestId("receipt-balance")).toHaveText("$100.26"); // as issued, not today's
  await page.getByRole("button", { name: "Email receipt to customer" }).click();
  await expect(page.getByText(/not sending twice/)).toBeVisible({ timeout: 15_000 });
  const stillTwo = await pool.query(
    `SELECT id FROM notifications WHERE recipient = $1 AND template = 'payment_receipt'`,
    [email],
  );
  expect(stillTwo.rowCount).toBe(2);
  await page.goBack();
  await expect(page.getByTestId("balance-due")).toBeVisible();

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

  // Invoices list: the paid invoice shows a zero balance; filter chips include "partially paid".
  await page.goto("/manager/invoices?status=paid");
  await expect(page.getByRole("link", { name: "partially paid" })).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(invoiceNumber!) })).toContainText("$0.00");

  // Quote-first flow: create a standalone quote from the customer page,
  // save a line, and email it (spec follow-up to Shams's field report).
  await page.goto(`/manager/customers/${customer.rows[0].id}`);
  await page.getByRole("button", { name: "Create quote" }).click();
  await expect(page).toHaveURL(/\/manager\/quotes\//, { timeout: 15_000 });
  await page.getByPlaceholder("Description").fill("Compressor replacement (quote)");
  await page.getByLabel("Unit price").fill("650.00");
  await page.getByRole("button", { name: "Save quote" }).click();
  await expect(page.getByTestId("revision-label")).toHaveText("Revision 1");
  // Editing before a decision = a new revision; the old one stays in the history.
  await page.getByLabel("Unit price").fill("625.00");
  await page.getByRole("button", { name: "Update quote" }).click();
  await expect(page.getByTestId("revision-label")).toHaveText("Revision 2 of 2", { timeout: 15_000 });
  await expect(page.getByTestId("revision-history")).toContainText("Quote history · 2 revisions");
  await page.getByRole("button", { name: "Email quote to customer" }).click();
  await expect(page.getByText("Quote emailed.")).toBeVisible({ timeout: 15_000 });
  const quotedEmail = await pool.query(
    `SELECT payload FROM notifications WHERE recipient = $1 AND template = 'quote_issued'`,
    [email],
  );
  expect(quotedEmail.rowCount).toBe(1);
  expect(JSON.stringify(quotedEmail.rows[0].payload)).toContain("Compressor replacement");
  expect(quotedEmail.rows[0].payload).toMatchObject({ revision: 2, kind: "quote" });

  // Delivery status: queued → the chip says so and the button is parked until the worker sends it.
  const status = page.getByTestId("quote-email-status");
  await expect(status).toContainText("Sending…", { timeout: 15_000 });
  await expect(status).toContainText(email);
  await expect(page.getByRole("button", { name: "Resend quote" })).toBeDisabled();

  // Simulate the worker: Resend accepted the message.
  const providerId = `e2e-msg-${Date.now()}`;
  await pool.query(
    `UPDATE notifications SET status = 'sent', sent_at = now(), provider_message_id = $2
     WHERE recipient = $1 AND template = 'quote_issued'`,
    [email, providerId],
  );
  await page.reload();
  await expect(status).toContainText("awaiting delivery confirmation", { timeout: 15_000 });

  // A second tap right after a send is a no-op, never a duplicate email.
  await page.getByRole("button", { name: "Resend quote" }).click();
  await expect(page.getByText(/not sending twice/)).toBeVisible({ timeout: 15_000 });
  const stillOne = await pool.query(
    `SELECT id FROM notifications WHERE recipient = $1 AND template = 'quote_issued'`,
    [email],
  );
  expect(stillOne.rowCount).toBe(1);

  // Resend's delivery webhook (signed) flips the chip to Delivered; a forged one is refused.
  const secret = process.env.RESEND_WEBHOOK_SECRET!;
  const body = JSON.stringify({
    type: "email.delivered",
    created_at: new Date().toISOString(),
    data: { email_id: providerId, to: [email], subject: "your quote" },
  });
  const svixId = `msg_e2e_${Date.now()}`;
  const svixTs = String(Math.floor(Date.now() / 1000));
  const signature = `v1,${createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
    .update(`${svixId}.${svixTs}.${body}`)
    .digest("base64")}`;
  const hook = await page.request.post("/api/webhooks/resend", {
    headers: {
      "content-type": "application/json",
      "svix-id": svixId,
      "svix-timestamp": svixTs,
      "svix-signature": signature,
    },
    data: body,
  });
  expect(hook.status()).toBe(200);
  expect(await hook.json()).toEqual({ outcome: "updated" });
  const forged = await page.request.post("/api/webhooks/resend", {
    headers: {
      "content-type": "application/json",
      "svix-id": svixId,
      "svix-timestamp": svixTs,
      "svix-signature": "v1,AAAA",
    },
    data: body,
  });
  expect(forged.status()).toBe(401);
  await page.reload();
  await expect(status).toContainText("Delivered", { timeout: 15_000 });

  // Approve revision 2 → invoice for $625 + tax. Then a change order on site.
  await page.getByRole("button", { name: "Customer approved" }).click();
  await expect(page.getByRole("button", { name: "Create change order" })).toBeVisible({ timeout: 15_000 });
  const quoteInvoice = page.getByRole("link", { name: /INV-\d+/ });
  await expect(quoteInvoice).toBeVisible();
  await page.getByRole("button", { name: "Create change order" }).click();
  await page.getByRole("button", { name: "+ Add line" }).click();
  await page.getByPlaceholder("Description").nth(1).fill("Refrigerant recharge");
  await page.getByLabel("Unit price").nth(1).fill("120.00");
  await page.getByRole("button", { name: "Save change order" }).click();
  await expect(page.getByTestId("change-order-banner")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("revision-label")).toContainText("Change order · revision 3");
  // The customer says no → approved quote and invoice are untouched.
  await page.getByRole("button", { name: "Customer declined change" }).click();
  await expect(page.getByRole("button", { name: "Create change order" })).toBeVisible({ timeout: 15_000 });
  const invoiceAfterDecline = await pool.query(
    `SELECT i.total_cents, i.status FROM invoices i JOIN work_orders w ON w.id = i.work_order_id
     JOIN customers c ON c.id = w.customer_id WHERE c.email = $1 ORDER BY i.created_at DESC LIMIT 1`,
    [email],
  );
  expect(invoiceAfterDecline.rows[0]).toMatchObject({ total_cents: 67656, status: "unpaid" }); // 625 × 1.0825
  // Second change order, approved → invoice rebuilt from revision 4.
  await page.getByRole("button", { name: "Create change order" }).click();
  await page.getByRole("button", { name: "+ Add line" }).click();
  await page.getByPlaceholder("Description").nth(1).fill("Refrigerant recharge");
  await page.getByLabel("Unit price").nth(1).fill("120.00");
  await page.getByRole("button", { name: "Save change order" }).click();
  await page.getByRole("button", { name: "Email change order to customer" }).click();
  await expect(page.getByText("Change order emailed.")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Customer approved change" }).click();
  await expect(page.getByText(/Quote approved \(revision 4\)/)).toBeVisible({ timeout: 15_000 });
  const invoiceAfterApprove = await pool.query(
    `SELECT i.total_cents FROM invoices i JOIN work_orders w ON w.id = i.work_order_id
     JOIN customers c ON c.id = w.customer_id WHERE c.email = $1 ORDER BY i.created_at DESC LIMIT 1`,
    [email],
  );
  expect(invoiceAfterApprove.rows[0].total_cents).toBe(80646); // (625 + 120) × 1.0825
  const changeOrderEmail = await pool.query(
    `SELECT payload FROM notifications WHERE recipient = $1 AND template = 'quote_issued' ORDER BY created_at DESC LIMIT 1`,
    [email],
  );
  expect(changeOrderEmail.rows[0].payload).toMatchObject({ kind: "change_order", revision: 4 });

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
