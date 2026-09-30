import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getSecretKey } from "@/lib/auth/session";

const PUBLIC_ROUTES = ["/login", "/register", "/api/auth/login", "/api/auth/register", "/api/health"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const token = request.cookies.get("auth_session")?.value;

  let isValidSession = false;
  if (token) {
    try {
      const key = getSecretKey();
      await jwtVerify(token, key);
      isValidSession = true;
    } catch {
      isValidSession = false;
    }
  }

  // Redirect unauthenticated user trying to access protected dashboard routes
  if (!isValidSession && !isPublicRoute && pathname !== "/") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated user away from login/register to dashboard
  if (isValidSession && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
