import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

const PROTECTED_ADMIN_PREFIX = "/admin";
const AUTH_PAGES = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await getSession();

  const isAdminRoute = pathname.startsWith(PROTECTED_ADMIN_PREFIX);
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (isAdminRoute && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && session?.role !== "ADMIN" && session?.role !== "PHARMACIST") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isAuthPage && session) {
    const dest = session.role === "ADMIN" || session.role === "PHARMACIST" ? "/admin" : "/account/orders";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/register"],
};
