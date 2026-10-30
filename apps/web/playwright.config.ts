import { config as dotenv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

dotenv({ path: "../../.env" });

// The quote-delivery E2E signs a Resend-style webhook; the server must verify
// it with the same secret. Uses the real one when .env has it, else a test value.
process.env.RESEND_WEBHOOK_SECRET ??= "whsec_ZTJlLXdlYmhvb2stc2VjcmV0LWZvci1wbGF5d3JpZ2h0";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  // Suites share one database and fixture users (e.g. the password-change
  // test rotates a login other suites use) — run files serially.
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm start",
    env: { RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET },
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
