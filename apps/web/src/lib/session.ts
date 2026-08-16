import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type Session } from "./auth";
import { canAccessManagerArea, canAccessTechnicianArea } from "./authz";

export async function getSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Owner-only areas (Service Manager, settings, team). */
export async function requireOwner(): Promise<Session> {
  const session = await requireSession();
  if (!canAccessManagerArea(session.user.role)) redirect("/login?denied=manager");
  return session;
}

/** Technician areas (owner has access too). */
export async function requireTechnician(): Promise<Session> {
  const session = await requireSession();
  if (!canAccessTechnicianArea(session.user.role)) redirect("/login?denied=tech");
  return session;
}
