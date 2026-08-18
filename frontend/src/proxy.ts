import { NextResponse, type NextRequest } from "next/server";

/**
  * Route gate for the merchant dashboard. (Next.js proxy convention — previously middleware.) The auth source of truth is the HttpOnly session
 * cookie (set by the backend) — here we only check the non-sensitive `qm.signedin` marker
 * the client sets right after a successful login; the API layer still enforces the real
 * credential on every call, so this is UX gating, not a security boundary.
 */
export function proxy(request: NextRequest) {
  const signedIn = request.cookies.get("qm.signedin")?.value === "1";
  if (!signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
