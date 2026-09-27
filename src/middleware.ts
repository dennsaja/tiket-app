import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Public routes that don't require auth
  const publicRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/api/health",
    "/api/auth",
  ];

  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Allow public routes
  if (isPublicRoute) {
    // Redirect logged-in users away from auth pages
    if (session?.user && (pathname === "/login" || pathname === "/register")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Require auth for protected routes
  if (!session?.user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based route protection
  const userRole = (session.user as any).role;
  const isNoc = userRole === "noc";
  const isOwner = userRole === "owner";
  const canAccessAdmin = isNoc || isOwner;

  // System updates route protection (ONLY NOC allowed)
  if (pathname.startsWith("/admin/updates") && !isNoc) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (pathname.startsWith("/api/admin/system/update") && !isNoc) {
    return NextResponse.json({ error: "Forbidden: Hanya NOC Administrator yang dapat melakukan pembaruan sistem" }, { status: 403 });
  }

  // Admin panel routes (NOC and Owner allowed)
  if (pathname.startsWith("/admin") && !canAccessAdmin) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Admin API routes (NOC and Owner allowed)
  if (pathname.startsWith("/api/admin") && !canAccessAdmin) {
    return NextResponse.json({ error: "Forbidden: Akses ditolak" }, { status: 403 });
  }

  // Ticket creation route protection (Strictly restricted to NOC, Owner, Admin)
  const canCreateTicket = isNoc || isOwner || userRole === "admin";
  if (pathname === "/tickets/new" && !canCreateTicket) {
    return NextResponse.redirect(new URL("/tickets", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)",
  ],
};
