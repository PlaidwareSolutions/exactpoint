import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import {
  appointments,
  appointmentTechnicians,
  getDb,
  mediaAssets,
  technicianProfiles,
} from "@exactpoint/db";
import { canAccessManagerArea, canAccessTechnicianArea } from "@/lib/authz";
import { getSession } from "@/lib/session";
import { newObjectKey, storage } from "@/lib/storage";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};
const CATEGORIES = new Set(["before", "after", "equipment_label", "other"]);

/** Field photo upload (before/label/after) by the assigned technician or owner. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  const session = await getSession();
  if (!session || !canAccessTechnicianArea(session.user.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const { appointmentId } = await params;
  const db = getDb();

  const [appt] = await db
    .select({ workOrderId: appointments.workOrderId })
    .from(appointments)
    .where(eq(appointments.id, appointmentId));
  if (!appt) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (!canAccessManagerArea(session.user.role)) {
    const [profile] = await db
      .select({ id: technicianProfiles.id })
      .from(technicianProfiles)
      .where(eq(technicianProfiles.userId, session.user.id));
    const [assignment] = profile
      ? await db
          .select({ id: appointmentTechnicians.id })
          .from(appointmentTechnicians)
          .where(
            and(
              eq(appointmentTechnicians.appointmentId, appointmentId),
              eq(appointmentTechnicians.technicianId, profile.id),
            ),
          )
      : [];
    if (!assignment) {
      return NextResponse.json({ error: "Not your job" }, { status: 403 });
    }
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const category = String(form?.get("category") ?? "other");
  if (!(file instanceof File) || !CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) return NextResponse.json({ error: "Unsupported image type." }, { status: 415 });
  if (file.size === 0 || file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Images must be under 10 MB." }, { status: 413 });
  }

  const key = newObjectKey(ext);
  await storage.put(key, Buffer.from(await file.arrayBuffer()), file.type);
  const [asset] = await db
    .insert(mediaAssets)
    .values({
      objectKey: key,
      mimeType: file.type,
      sizeBytes: file.size,
      category: category as "before" | "after" | "equipment_label" | "other",
      uploadedBy: session.user.id,
      workOrderId: appt.workOrderId,
    })
    .returning({ id: mediaAssets.id });
  return NextResponse.json({ id: asset!.id });
}
