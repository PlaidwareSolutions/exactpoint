import { createHmac, timingSafeEqual } from "node:crypto";
import { loadEnv } from "@exactpoint/config";

/**
 * Signed slot tokens keep technician ids opaque to the public booking client
 * and make offered slots tamper-proof.
 */
export interface SlotClaim {
  technicianId: string;
  start: string; // ISO instant
  end: string;
  exp: number; // epoch ms
}

function secret(): string {
  const s = loadEnv().BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET required for slot tokens");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueSlotToken(claim: Omit<SlotClaim, "exp">, ttlMinutes = 30): string {
  const full: SlotClaim = { ...claim, exp: Date.now() + ttlMinutes * 60_000 };
  const payload = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySlotToken(token: string): SlotClaim | null {
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString()) as SlotClaim;
    if (claim.exp < Date.now()) return null;
    return claim;
  } catch {
    return null;
  }
}
