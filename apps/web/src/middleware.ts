import { NextResponse, type NextRequest } from "next/server";
import {
  deriveAttributionFromParams,
  hasValidAttributionCookie,
  MHUB_ATTR_COOKIE,
  MHUB_ATTR_MAX_AGE_SECONDS,
  signAttributionEdge,
} from "@/lib/mhub/attribution-edge";

/**
 * First-touch marketing attribution (MHub): on a visitor's first landing on a
 * public page, derive source/campaign from utm/gclid/fbclid/referrer and set a
 * signed httpOnly cookie. First touch wins — never overwritten. Booking
 * actions attach it to the MHub lead event.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next();
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) return response;
  try {
    const existing = request.cookies.get(MHUB_ATTR_COOKIE)?.value;
    if (existing && (await hasValidAttributionCookie(existing, secret))) return response;
    const captured = deriveAttributionFromParams(
      request.nextUrl.searchParams,
      request.headers.get("referer"),
    );
    if (captured) {
      response.cookies.set(MHUB_ATTR_COOKIE, await signAttributionEdge(captured, secret), {
        httpOnly: true,
        sameSite: "lax",
        maxAge: MHUB_ATTR_MAX_AGE_SECONDS,
      });
    }
  } catch {
    // attribution must never break the site
  }
  return response;
}

export const config = {
  // Public site + booking only; skip app areas, auth pages, APIs, and assets.
  matcher: [
    "/((?!api|_next|manager|tech|account|help|login|forgot-password|reset-password|.*\\..*).*)",
  ],
};
