import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Protected routes - check for session cookie
  const sessionCookie = request.cookies.get("authjs.session-token")
    || request.cookies.get("__Secure-authjs.session-token");

  if (!sessionCookie) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/meetings/:path*"],
};
