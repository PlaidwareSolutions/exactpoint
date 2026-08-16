import type { UserRole } from "@exactpoint/domain";

/**
 * Server-side authorization rules. Every protected server operation checks
 * these — UI hiding is never the mechanism.
 */

export function canAccessManagerArea(role: string | null | undefined): role is "owner" {
  return role === "owner";
}

export function canAccessTechnicianArea(
  role: string | null | undefined,
): role is UserRole {
  return role === "owner" || role === "technician";
}
