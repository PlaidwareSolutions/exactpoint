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

test("blocked time renders on the calendar", async ({ page }, testInfo) => {
  await login(page, "info@exactpointrepairs.com", process.env.SEED_OWNER_PASSWORD ?? "");

  // Unique far-future day per run/project so repeated runs never collide.
  const offset = 40 + ((Date.now() + (testInfo.project.name === "iphone" ? 150 : 0)) % 140);
  const day = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
  const ymd = day.toISOString().slice(0, 10);

  await page.goto(`/manager/calendar?date=${ymd}`);
  await page.getByRole("button", { name: "Block time" }).click();
  await page.getByLabel("From").fill(`${ymd}T10:00`);
  await page.getByLabel("To").fill(`${ymd}T12:00`);
  await page.getByLabel("Reason").fill("E2E block test");
  await page.getByRole("button", { name: "Block", exact: true }).click();
  await expect(page.getByText(/Blocked\.|skipped/)).toBeVisible({ timeout: 10_000 });

  await page.goto(`/manager/calendar?date=${ymd}`);
  await expect(page.getByText("Blocked", { exact: true }).first()).toBeVisible();
});
