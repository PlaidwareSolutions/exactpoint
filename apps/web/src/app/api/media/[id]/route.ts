import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, mediaAssets } from "@exactpoint/db";
import { canAccessTechnicianArea } from "@/lib/authz";
import { getSession } from "@/lib/session";
import { storage } from "@/lib/storage";

/** Private job media: owner/technician access only, streamed from storage. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || !canAccessTechnicianArea(session.user.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const { id } = await params;
  const [asset] = await getDb().select().from(mediaAssets).where(eq(mediaAssets.id, id));
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const data = await storage.get(asset.objectKey);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  }
}
