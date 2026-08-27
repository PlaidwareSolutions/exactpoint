import path from "node:path";
import { loadEnv } from "@exactpoint/config";
import { MhubClient } from "@exactpoint/mhub";

/**
 * Env-gated MHub singleton, mirroring the other provider integrations:
 * without MHUB_EVENTS_KEY the platform runs exactly as before (getMhub()
 * returns null and every emit helper no-ops).
 */

const globalRef = globalThis as typeof globalThis & { __mhubClient?: MhubClient | null };

export function getMhub(): MhubClient | null {
  if (globalRef.__mhubClient !== undefined) return globalRef.__mhubClient;
  const env = loadEnv();
  if (!env.MHUB_EVENTS_KEY) {
    globalRef.__mhubClient = null;
    return null;
  }
  globalRef.__mhubClient = new MhubClient({
    apiKey: env.MHUB_EVENTS_KEY,
    baseUrl: env.MHUB_BASE_URL ?? "https://mhub-web-staging.up.railway.app/api/v1",
    persistPath: path.join(process.cwd(), ".mhub-queue.json"),
    // contact_email / contact_phone are MHub-transient (call matching and
    // review requests; never stored server-side) but match the SDK's baseline
    // PII token, so they must be allowlisted or they never leave this app.
    piiAllowlist: ["technician", "contact_email", "contact_phone"],
    onWarning: (message, detail) =>
      detail === undefined ? console.warn("[mhub]", message) : console.warn("[mhub]", message, detail),
  });
  return globalRef.__mhubClient;
}
