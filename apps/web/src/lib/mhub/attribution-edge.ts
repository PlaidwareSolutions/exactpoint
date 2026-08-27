import type { CapturedAttribution } from "@exactpoint/mhub";

/**
 * Edge-runtime port of the SDK's attribution capture (the SDK's own
 * middleware.ts imports node:crypto, which Next middleware cannot load).
 * Produces byte-identical cookies — `v1.<base64url json>.<hex hmac-sha256>` —
 * so server actions verify them with the SDK's verifyAttribution unchanged.
 * A unit test asserts that round-trip compatibility.
 */

export const MHUB_ATTR_COOKIE = "mhub_attr";
export const MHUB_ATTR_MAX_AGE_SECONDS = 90 * 24 * 3600;

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

/** Mirrors the SDK's deriveAttribution over URLSearchParams. */
export function deriveAttributionFromParams(
  params: URLSearchParams,
  referrer: string | null,
): CapturedAttribution | null {
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) utm[key] = value;
  }
  const gclid = params.get("gclid") != null;
  const fbclid = params.get("fbclid") != null;

  let source: string | undefined;
  let channel: string | undefined;
  if (utm.utm_source) {
    source = utm.utm_source;
    channel = utm.utm_medium === "cpc" && /google/i.test(utm.utm_source) ? "google_ads" : utm.utm_medium;
  } else if (gclid) {
    source = "google";
    channel = "google_ads";
  } else if (fbclid) {
    source = "facebook";
    channel = "meta";
  } else if (referrer) {
    try {
      const host = new URL(referrer).hostname;
      if (/google\./i.test(host)) [source, channel] = ["google", "google_organic"];
      else if (/facebook\.|instagram\./i.test(host)) [source, channel] = ["facebook", "meta_organic"];
      else if (/bing\./i.test(host)) [source, channel] = ["bing", "bing_organic"];
      else [source, channel] = [host, "referral"];
    } catch {
      return null;
    }
  } else {
    return null; // direct visit with no signal
  }
  return {
    source,
    channel,
    campaign: utm.utm_campaign,
    utm: Object.keys(utm).length > 0 ? utm : undefined,
    landed_at: new Date().toISOString(),
  };
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacHex(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signAttributionEdge(
  data: CapturedAttribution,
  secret: string,
): Promise<string> {
  const payload = base64url(new TextEncoder().encode(JSON.stringify(data)));
  return `v1.${payload}.${await hmacHex(payload, secret)}`;
}

export async function hasValidAttributionCookie(
  cookieValue: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!cookieValue) return false;
  const [version, payload, sig] = cookieValue.split(".");
  if (version !== "v1" || !payload || !sig) return false;
  const expected = await hmacHex(payload, secret);
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
