import { NextResponse } from "next/server";
import { getDb, mediaAssets } from "@exactpoint/db";
import { rateLimit } from "@/lib/booking/rate-limit";
import { newObjectKey, storage } from "@/lib/storage";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};
const MAX_BYTES = 10 * 1024 * 1024;

/** Anonymous booking-photo upload: strict MIME/size limits, random keys. */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`photo:${ip}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Please upload a JPEG, PNG, WebP, or HEIC image." },
      { status: 415 },
    );
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Images must be under 10 MB." }, { status: 413 });
  }

  const data = Buffer.from(await file.arrayBuffer());
  const key = newObjectKey(ext);
  await storage.put(key, data, file.type);

  const db = getDb();
  const [asset] = await db
    .insert(mediaAssets)
    .values({
      objectKey: key,
      mimeType: file.type,
      sizeBytes: file.size,
      category: "problem_photo",
    })
    .returning({ id: mediaAssets.id });

  return NextResponse.json({ id: asset!.id });
}
