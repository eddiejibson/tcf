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
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();
  if (pathname.startsWith("/_next") || pathname.startsWith("/images") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("tcf_session")?.value;
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
