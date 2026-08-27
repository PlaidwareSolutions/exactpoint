import { cookies } from "next/headers";
import { loadEnv } from "@exactpoint/config";
import { verifyAttribution, type CapturedAttribution } from "@exactpoint/mhub";
import { MHUB_ATTR_COOKIE } from "./attribution-edge";

/**
 * Server-action side of first-touch attribution: reads the signed cookie the
 * middleware set on the visitor's first landing, for attaching to the lead
 * event. Best-effort — never throws into a booking.
 */
export async function readBookingAttribution(): Promise<CapturedAttribution | null> {
  try {
    const secret = loadEnv().BETTER_AUTH_SECRET;
    if (!secret) return null;
    const jar = await cookies();
    return verifyAttribution(jar.get(MHUB_ATTR_COOKIE)?.value, secret);
  } catch {
    return null;
  }
}
