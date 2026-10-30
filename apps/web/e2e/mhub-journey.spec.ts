import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Live MHub staging journey — deliberately opt-in (MHUB_E2E=1 plus a real
 * MHUB_EVENTS_KEY in the server env) so routine suite runs never emit.
 * BETTER_AUTH_SECRET must be a REAL process env var (not just repo .env):
 * the attribution middleware runs on the edge runtime, which cannot load
 * dotenv — without it the cookie is silently never set. Kill any stale
 * server on :3000 first (reuseExistingServer would keep its env).
 *
 *   lsof -ti :3000 | xargs kill; \
 *   BETTER_AUTH_SECRET=$(grep '^BETTER_AUTH_SECRET=' ../../.env | cut -d= -f2-) \
 *   MHUB_E2E=1 MHUB_DEBUG=1 MHUB_EVENTS_KEY=mhk_… \
 *   pnpm exec playwright test e2e/mhub-journey.spec.ts --project=desktop
 *
 * Journey A: UTM-attributed web booking → owner confirms → quote → approval
 * (invoice) → completion → payment. Journey B: booking → cancellation.
 * EP references are bumped into a 99xxxx range so these test journeys can
 * never collide with production references on the shared MHub tenant.
 */
test.describe.configure({ mode: "serial" });
test.skip(process.env.MHUB_E2E !== "1", "MHub journey is opt-in (set MHUB_E2E=1)");

const QUEUE_FILE = path.resolve(process.cwd(), ".mhub-queue.json");

test.beforeAll(async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  await pool.query(
    "SELECT setval('service_request_ref_seq', GREATEST((SELECT last_value FROM service_request_ref_seq), 990000))",
  );
  await pool.end();
  if (fs.existsSync(QUEUE_FILE)) fs.unlinkSync(QUEUE_FILE);
});

async function ownerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("info@exactpointrepairs.com");
  await page.getByLabel("Password").fill(process.env.SEED_OWNER_PASSWORD ?? "");
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole("button", { name: "Sign in" }).click();
    try {
      await page.waitForURL(/\/manager/, { timeout: 4000 });
      return;
    } catch {
      /* hydration retry */
    }
  }
  throw new Error("Owner login did not complete");
}

async function bookJourney(page: Page, service: string, problem: string): Promise<string> {
  await page.goto("/book?utm_source=google&utm_medium=cpc&utm_campaign=mhub-e2e-journey");
  // The middleware must have set the first-touch cookie — fail fast here
  // rather than emitting an unattributed lead to the shared staging tenant.
  const attrCookie = (await page.context().cookies()).find((c) => c.name === "mhub_attr");
  expect(attrCookie, "mhub_attr cookie missing — is BETTER_AUTH_SECRET in the server env?").toBeTruthy();
  await page.getByRole("button", { name: service, exact: true }).click();
  await page.getByLabel(/Describe what/).fill(problem);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click(); // photos
  await page.getByLabel("First name").fill("Mhub");
  await page.getByLabel("Last name").fill("Journey");
  await page.getByLabel("Mobile phone").fill("713-555-0161");
  await page.getByLabel("Email").fill("solutions@plaidware.com");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Street address").fill("123 Mason Rd");
  await page.getByLabel("City").fill("Katy");
  await page.getByLabel("ZIP").fill("77450");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("West Houston")).toBeVisible();
  await page
    .locator("button")
    .filter({ hasText: /day \d+\/\d+, \d+ (AM|PM)/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/I understand the diagnostic-fee policy/).check();
  await page.getByRole("button", { name: "Submit Request" }).click();
  const refText = await page
    .getByText(/Reference: EP-\d+/)
    .textContent({ timeout: 15_000 });
  const reference = refText!.match(/EP-\d+/)![0];
  console.log(`[mhub-journey] booked ${service} → ${reference}`);
  return reference;
}

/**
 * Owner assigns the request from the top recommendation (emits qualified +
 * appointment_booked), then opens the scheduled job. Works whether or not
 * the customer's slot auto-converted at booking time.
 */
async function assignAndOpenJob(page: Page, reference: string) {
  await page.goto(`/manager/search?q=${reference}`);
  await page.getByRole("link", { name: new RegExp(reference) }).first().click();
  const scheduled = page.getByRole("link", { name: "Open the job →" });
  if (!(await scheduled.isVisible().catch(() => false))) {
    await page
      .locator("li", { hasText: /score -?\d/ })
      .first()
      .getByRole("button", { name: "Assign" })
      .click();
    await expect(page.getByText("This request has been scheduled")).toBeVisible({
      timeout: 15_000,
    });
  }
  await page.getByRole("link", { name: "Open the job →" }).click();
  await page.waitForURL(/\/manager\/jobs\//);
}

test("journey A: attributed booking → quote → invoice → completion → payment", async ({
  page,
}) => {
  const reference = await bookJourney(
    page,
    "Refrigerator",
    "MHub E2E journey: refrigerator not cooling, freezer works fine.",
  );

  await ownerLogin(page);
  await assignAndOpenJob(page, reference);

  // Confirm the appointment if it is still pending (owner-assigned jobs
  // start confirmed, so the button only exists for auto-converted ones).
  const confirmButton = page.getByRole("button", { name: "confirmed", exact: true });
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click();
    await expect(confirmButton).toBeHidden({ timeout: 10_000 });
  }
  await page.getByPlaceholder("Description").fill("Evaporator fan motor replacement");
  await page.getByLabel("Unit price").fill("185.00");
  await page.getByRole("button", { name: "Save quote" }).click();
  await page.getByRole("button", { name: "Customer approved" }).click();
  await expect(page.getByRole("link", { name: /INV-\d+/ })).toBeVisible({ timeout: 15_000 });

  // Complete the job (records warranty, emits job_completed without revenue).
  await page.getByLabel(/what was repaired/).fill("Replaced evaporator fan motor — cooling restored");
  await page.getByRole("button", { name: "Complete job", exact: true }).click();
  await expect(page.getByText("Job completed — warranty recorded above.")).toBeVisible({
    timeout: 10_000,
  });

  // Record the payment in full (emits the revenue increment for this ledger row).
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByTestId("ledger-message")).toContainText("Paid in full", { timeout: 10_000 });
});

test("journey B: attributed booking → cancellation", async ({ page }) => {
  const reference = await bookJourney(
    page,
    "Washer",
    "MHub E2E journey: washer will not drain after the spin cycle.",
  );

  await ownerLogin(page);
  await assignAndOpenJob(page, reference);
  await page.getByRole("button", { name: "cancelled", exact: true }).click();
  await expect(page.getByRole("button", { name: "cancelled", exact: true })).toBeHidden({
    timeout: 10_000,
  });
});

test("the SDK queue drains to MHub staging", async ({ page }) => {
  // Flush interval is 5s; give it two cycles, then check the persisted queue.
  await page.waitForTimeout(12_000);
  const pending = fs.existsSync(QUEUE_FILE)
    ? (JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8")) as unknown[])
    : [];
  console.log(`[mhub-journey] queue after flush window: ${pending.length} pending`);
  expect(pending).toHaveLength(0);
});
