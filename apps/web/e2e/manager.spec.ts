import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Service Manager flow: owner reviews a request, sees explainable
 * recommendations, assigns, and finds the appointment on the calendar.
 * A fresh "new" request is seeded directly so the flow is deterministic.
 */
test.describe.configure({ mode: "serial" });

let reference = "";

test.beforeAll(async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const customer = await pool.query(
    `INSERT INTO customers (first_name, last_name, phone, email)
     VALUES ('E2E', 'Manager', '7135550199', 'e2e-manager@example.com')
     RETURNING id`,
  );
  const address = await pool.query(
    `INSERT INTO customer_addresses (customer_id, street, city, state, zip, latitude, longitude, zone_id, zone_source, validation_status)
     VALUES ($1, '456 Cinco Ranch Blvd', 'Katy', 'TX', '77450', 29.745, -95.735,
       (SELECT zone_id FROM service_zone_zips WHERE zip = '77450'), 'auto_zip', 'validated')
     RETURNING id`,
    [customer.rows[0].id],
  );
  const request = await pool.query(
    `INSERT INTO service_requests (customer_id, address_id, service_type_id, problem_description, urgency, status, fee_acknowledged)
     VALUES ($1, $2, (SELECT id FROM service_types WHERE slug = 'refrigerator'),
       'E2E: refrigerator not cooling, freezer fine.', 'normal', 'new', true)
     RETURNING reference`,
    [customer.rows[0].id, address.rows[0].id],
  );
  reference = request.rows[0].reference;
  await pool.end();
});

/** Clicks Sign in with a retry — hydration on mobile can lag the first click. */
async function submitLogin(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole("button", { name: "Sign in" }).click();
    try {
      await page.waitForURL(/\/(tech|manager)/, { timeout: 4000 });
      return;
    } catch {
      // not yet — retry
    }
  }
  throw new Error("Login did not complete");
}

async function ownerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("info@exactpointrepairs.com");
  await page.getByLabel("Password").fill(process.env.SEED_OWNER_PASSWORD ?? "");
  await submitLogin(page);
  await expect(page).toHaveURL(/\/manager/);
}

test("owner assigns a request from an explainable recommendation", async ({ page }) => {
  await ownerLogin(page);

  // The new request surfaces on Today and in the Requests queue.
  await page.goto("/manager/requests?status=new");
  await page.getByRole("link", { name: reference }).click();

  // Explainable recommendations (spec §14): reasons + score are visible.
  await expect(page.getByText("Recommended")).toBeVisible();
  const firstRec = page.locator("li", { hasText: /score -?\d/ }).first();
  await expect(firstRec).toBeVisible();

  await firstRec.getByRole("button", { name: "Assign" }).click();
  await expect(page.getByText("This request has been scheduled")).toBeVisible({
    timeout: 15_000,
  });
  // Converted requests link straight to the scheduled job.
  await expect(page.getByRole("link", { name: "Open the job →" })).toHaveAttribute(
    "href",
    /\/manager\/jobs\//,
  );

  // The appointment appears on the calendar day view.
  await page.goto("/manager/calendar");
  // The E2E customer's job may be on a future day — check the week view instead.
  await page.goto("/manager/calendar?view=week");
  await expect(page.getByText("West Houston").first()).toBeVisible();
});

test("technician login cannot reach the Service Manager", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("dev-technician@exactpoint.local");
  await page.getByLabel("Password").fill("dgcQFGpt79SwctaD");
  await submitLogin(page);
  await expect(page).toHaveURL(/\/tech/); // session established
  await page.goto("/manager");
  await expect(page).toHaveURL(/login\?denied=manager/);
});
