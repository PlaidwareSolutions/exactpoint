import { test } from "@playwright/test";

/** Visual captures of the Service Manager; run via --grep "manager screens". */
test("manager screens", async ({ page }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("info@exactpointrepairs.com");
  await page.getByLabel("Password").fill(process.env.SEED_OWNER_PASSWORD ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/manager/);

  for (const [name, path] of [
    ["today", "/manager"],
    ["calendar", "/manager/calendar"],
    ["requests", "/manager/requests?status=converted"],
    ["zones", "/manager/settings/zones"],
  ] as const) {
    await page.goto(path);
    await page.waitForTimeout(400);
    await page.screenshot({
      path: testInfo.outputPath(`${name}-${testInfo.project.name}.png`),
      fullPage: false,
    });
  }
});
