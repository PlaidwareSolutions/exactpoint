import { test } from "@playwright/test";

/** Visual-verification captures; run with --grep screenshots when needed. */
test("capture key pages", async ({ page }, testInfo) => {
  for (const [name, path] of [
    ["home", "/"],
    ["service", "/appliance-repair/refrigerator"],
    ["book", "/book"],
  ] as const) {
    await page.goto(path);
    await page.waitForTimeout(400);
    await page.screenshot({
      path: testInfo.outputPath(`${name}-${testInfo.project.name}.png`),
      fullPage: name !== "book",
    });
  }
});
