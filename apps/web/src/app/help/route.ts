import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { canAccessTechnicianArea } from "@/lib/authz";
import { getSession } from "@/lib/session";

/**
 * In-app help: serves the canonical owner handbook (docs/handbook.html —
 * the same file published as the shareable artifact) to signed-in team
 * members. One source, three surfaces.
 */
async function loadHandbook(): Promise<string> {
  // cwd is apps/web in dev and on Railway (`pnpm --filter … start`);
  // fall back for a repo-root cwd.
  const candidates = [
    resolve(process.cwd(), "../../docs/handbook.html"),
    resolve(process.cwd(), "docs/handbook.html"),
  ];
  for (const path of candidates) {
    try {
      return await readFile(path, "utf8");
    } catch {
      // try next location
    }
  }
  throw new Error("handbook.html not found");
}

const BACK_BAR = `
<div style="position:sticky;top:0;z-index:10;background:#16233b;padding:0.6rem 1rem;text-align:center">
  <a href="/manager" style="color:#ffffff;font-weight:700;font-size:0.85rem;text-decoration:none">← Back to ExactPoint</a>
</div>`;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !canAccessTechnicianArea(session.user.role)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  try {
    const content = await loadHandbook();
    const backHref = session.user.role === "owner" ? "/manager" : "/tech";
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${BACK_BAR.replace("/manager", backHref)}${content}</html>`;
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch (err) {
    console.error("[help] handbook unavailable", err);
    return NextResponse.redirect(new URL(session.user.role === "owner" ? "/manager" : "/tech", request.url));
  }
}
