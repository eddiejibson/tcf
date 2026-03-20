import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = [
  "/",
  "/gallery",
  "/price-lists",
  "/invoice-builder",
  "/login",
  "/verify",
  "/api/auth",
  "/api/booking",
  "/api/price-lists",
  "/api/webhooks",
  "/apply",
  "/api/applications",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/images") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("tcf_session")?.value;

  // If user is on /login or /verify and already has a valid session, redirect to dashboard
  if (pathname === "/login" || pathname === "/verify") {
    if (token) {
      try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        const dest = payload.role === "ADMIN" ? "/admin/shipments" : "/shipments";
        return NextResponse.redirect(new URL(dest, request.url));
      } catch {
        // Token is invalid/expired — clear it and show login page
        const response = NextResponse.next();
        response.cookies.delete("tcf_session");
        return response;
      }
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("to", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    if ((pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) && payload.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/shipments", request.url));
    }

    return NextResponse.next();
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("to", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("tcf_session");
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|.*\\..*).*)"],
};
