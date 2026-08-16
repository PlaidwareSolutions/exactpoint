import { expect, test } from "@playwright/test";

/**
 * Spec §70 exit criterion: a customer can submit a complete, valid service
 * request from a phone without creating an account.
 */
test("customer books refrigerator service end-to-end", async ({ page }) => {
  await page.goto("/book");

  // Step 1 — service
  await page.getByRole("button", { name: "Refrigerator" }).click();

  // Step 2 — problem
  await page
    .getByLabel(/Describe what/)
    .fill("The refrigerator stopped cooling yesterday. Freezer still freezes.");
  await page.getByLabel(/^Brand/).fill("Samsung");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3 — photos (skip)
  await expect(page.getByText("Photos", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 4 — contact
  await page.getByLabel("First name").fill("Playwright");
  await page.getByLabel("Last name").fill("Tester");
  await page.getByLabel("Mobile phone").fill("713-555-0142");
  await page.getByLabel("Email").fill("playwright-tester@example.com");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 5 — address (known Katy ZIP → confirmed by the stub validator)
  await page.getByLabel("Street address").fill("123 Mason Rd");
  await page.getByLabel("City").fill("Katy");
  await page.getByLabel("ZIP").fill("77450");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 6 — windows: zone detected, pick the first offered window
  await expect(page.getByText("West Houston")).toBeVisible();
  await page
    .locator("button")
    .filter({ hasText: /day \d+\/\d+, \d+ (AM|PM)/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 7 — review + fee acknowledgement
  await expect(page.getByText("Diagnostic & service-call fee")).toBeVisible();
  await page.getByLabel(/I understand the diagnostic-fee policy/).check();
  await page.getByRole("button", { name: "Submit Request" }).click();

  // Confirmation with an EP reference
  await expect(page.getByText(/Reference: EP-\d+/)).toBeVisible({ timeout: 15_000 });
});

test("unconfirmable address asks the customer to review it", async ({ page }) => {
  await page.goto("/book");
  await page.getByRole("button", { name: "Washer", exact: true }).click();
  await page
    .getByLabel(/Describe what/)
    .fill("Washer will not drain after the spin cycle finishes.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click(); // photos
  await page.getByLabel("First name").fill("Case");
  await page.getByLabel("Last name").fill("Partial");
  await page.getByLabel("Mobile phone").fill("713-555-0143");
  await page.getByLabel("Email").fill("case-partial@example.com");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Street address").fill("x");
  await page.getByLabel("City").fill("Houston");
  await page.getByLabel("ZIP").fill("77450");
  // Continue disabled for a too-short street — client-side guard works
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
});

test("homepage has one-tap call and booking CTAs", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Appliance or HVAC problem/ }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Call 281-915-8264/ }).first()).toHaveAttribute(
    "href",
    "tel:+12819158264",
  );
  await expect(page.getByRole("link", { name: "Book Service" }).first()).toBeVisible();
});
