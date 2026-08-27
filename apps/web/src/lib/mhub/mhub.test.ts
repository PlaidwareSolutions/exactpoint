import { describe, expect, it } from "vitest";
import { filterAttrs, signAttribution, verifyAttribution } from "@exactpoint/mhub";
import { deriveAttributionFromParams, hasValidAttributionCookie, signAttributionEdge } from "./attribution-edge";
import { toE164, toPackServiceType, toPackZone } from "./mapping";

describe("pack-key mapping", () => {
  it("maps appliance slugs to <type>_repair", () => {
    expect(toPackServiceType("refrigerator")).toBe("refrigerator_repair");
    expect(toPackServiceType("stove_range")).toBe("range_repair");
    expect(toPackServiceType("ice_maker")).toBe("ice_maker_repair");
  });
  it("keeps hvac slugs as-is", () => {
    expect(toPackServiceType("ac_repair")).toBe("ac_repair");
    expect(toPackServiceType("hvac_maintenance")).toBe("hvac_maintenance");
  });
  it("falls back to other", () => {
    expect(toPackServiceType("garage-door")).toBe("other");
    expect(toPackServiceType(null)).toBe("other");
  });
  it("prefixes zones", () => {
    expect(toPackZone("west")).toBe("zone_west");
    expect(toPackZone(null)).toBeUndefined();
  });
});

describe("toE164", () => {
  it("adds +1 to bare 10-digit US numbers", () => {
    expect(toE164("7135550100")).toBe("+17135550100");
    expect(toE164("(713) 555-0100")).toBe("+17135550100");
  });
  it("handles 1-prefixed and already-E164 numbers", () => {
    expect(toE164("17135550100")).toBe("+17135550100");
    expect(toE164("+17135550100")).toBe("+17135550100");
  });
  it("returns undefined for unusable input", () => {
    expect(toE164("555")).toBeUndefined();
    expect(toE164(null)).toBeUndefined();
  });
});

describe("attribution cookie compatibility (edge signer vs node SDK)", () => {
  const secret = "test-secret-for-attribution-cookies";

  it("edge-signed cookies verify with the SDK's verifyAttribution", async () => {
    const captured = deriveAttributionFromParams(
      new URLSearchParams("utm_source=google&utm_medium=cpc&utm_campaign=summer"),
      null,
    );
    expect(captured).not.toBeNull();
    const cookie = await signAttributionEdge(captured!, secret);
    const verified = verifyAttribution(cookie, secret);
    expect(verified).toEqual(captured);
    expect(verified?.channel).toBe("google_ads");
  });

  it("SDK-signed cookies pass the edge validity check", async () => {
    const data = { source: "facebook", channel: "meta", landed_at: new Date().toISOString() };
    const cookie = signAttribution(data, secret);
    expect(await hasValidAttributionCookie(cookie, secret)).toBe(true);
  });

  it("rejects tampered cookies on both sides", async () => {
    const captured = deriveAttributionFromParams(new URLSearchParams("gclid=abc"), null);
    const cookie = await signAttributionEdge(captured!, secret);
    const tampered = cookie.replace(/.$/, (c) => (c === "0" ? "1" : "0"));
    expect(verifyAttribution(tampered, secret)).toBeNull();
    expect(await hasValidAttributionCookie(tampered, secret)).toBe(false);
  });

  it("derives referrer-based attribution like the SDK", () => {
    const captured = deriveAttributionFromParams(
      new URLSearchParams(),
      "https://www.google.com/search?q=appliance+repair",
    );
    expect(captured?.source).toBe("google");
    expect(captured?.channel).toBe("google_organic");
    expect(deriveAttributionFromParams(new URLSearchParams(), null)).toBeNull();
  });
});

describe("PII allowlist expectations", () => {
  it("passes the sanctioned transients only when allowlisted", () => {
    const attrs = {
      service_type: "ac_repair",
      caller_e164: "+17135550100",
      contact_email: "x@plaidware.com",
      contact_phone: "+17135550100",
      technician: "Alex",
      customer_name: "should be stripped",
    };
    const withAllowlist = filterAttrs(attrs, ["technician", "contact_email", "contact_phone"]);
    expect(Object.keys(withAllowlist.clean).sort()).toEqual([
      "caller_e164",
      "contact_email",
      "contact_phone",
      "service_type",
      "technician",
    ]);
    expect(withAllowlist.stripped).toEqual(["customer_name"]);

    // Without the allowlist the SDK strips the review-request transients —
    // this is why the client must allowlist contact_email/contact_phone.
    const withoutAllowlist = filterAttrs(attrs, []);
    expect(withoutAllowlist.stripped).toContain("contact_email");
    expect(withoutAllowlist.stripped).toContain("contact_phone");
  });
});
