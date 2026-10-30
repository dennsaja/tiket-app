import NextAuth from "next-auth";
import type { Session } from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent, NextMiddleware } from "next/server";
import { serviceBoundary, corsHeaders } from "@/lib/network/boundary";
import { FRONTEND_ORIGIN, API_ORIGIN } from "@/lib/network/origins";

const { auth } = NextAuth(authConfig);

/**
 * Construct public redirect URLs respecting Cloudflare Tunnel / Reverse Proxy headers (x-forwarded-host, x-forwarded-proto)
 */
function getPublicUrl(targetPath: string, req: any): URL {
  if (FRONTEND_ORIGIN) return new URL(targetPath, FRONTEND_ORIGIN);
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || (req.url.startsWith("https") ? "https" : "http");

  if (forwardedHost) {
    return new URL(targetPath, `${forwardedProto}://${forwardedHost}`);
  }

  const url = req.nextUrl.clone();
  url.pathname = targetPath;
  url.search = "";
  return url;
}

const enforceAccess = (req: NextRequest & { auth: Session | null }) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Allow mobile requests with Authorization Bearer header
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return NextResponse.next();
  }

  // Public routes that don't require session auth
  const publicRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/api/health",
    "/api/auth",
    "/api/mobile",
    "/api/technicians/location",
    "/mobile-auth",
    "/download",
    "/downloads",
  ];

  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Allow public routes
  if (isPublicRoute) {
    // Redirect logged-in users away from auth pages
    if (session?.user && (pathname === "/login" || pathname === "/register")) {
      return NextResponse.redirect(getPublicUrl("/dashboard", req));
    }
    return NextResponse.next();
  }

  // Require auth for protected routes
  if (!session?.user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = getPublicUrl("/login", req);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based route protection
  const userRole = (session.user as any).role;
  const isNoc = userRole === "noc";
  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin";
  const canAccessAdmin = isNoc || isOwner || isAdmin;

  // System updates route protection (NOC, Owner, Admin allowed)
  if (pathname.startsWith("/admin/updates") && !canAccessAdmin) {
    return NextResponse.redirect(getPublicUrl("/dashboard", req));
  }
  if (pathname.startsWith("/api/admin/system/update") && !canAccessAdmin) {
    return NextResponse.json({ error: "Forbidden: Hanya Administrator yang dapat melakukan pembaruan sistem" }, { status: 403 });
  }

  // Admin panel routes (NOC, Owner allowed; /admin/map allowed for Admin as well)
  if (pathname.startsWith("/admin/map") && !(isNoc || isOwner || userRole === "admin")) {
    return NextResponse.redirect(getPublicUrl("/dashboard", req));
  }
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/map") && !canAccessAdmin) {
    return NextResponse.redirect(getPublicUrl("/dashboard", req));
  }

  // Admin API routes (NOC and Owner allowed)
  if (pathname.startsWith("/api/admin") && !canAccessAdmin) {
    return NextResponse.json({ error: "Forbidden: Akses ditolak" }, { status: 403 });
  }

  // Ticket creation route protection (Strictly restricted to NOC, Owner, Admin)
  const canCreateTicket = isNoc || isOwner || userRole === "admin";
  if (pathname === "/tickets/new" && !canCreateTicket) {
    return NextResponse.redirect(getPublicUrl("/tickets", req));
  }

  return NextResponse.next();
};
const authenticate = auth(enforceAccess);

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  const boundary = serviceBoundary(req);
  let response: Response;
  if (boundary) response = boundary;
  else if (process.env.APP_SERVICE === "frontend") {
    let session: Session | null = null;
    if (!req.nextUrl.pathname.startsWith("/api/auth/") && /authjs\.session-token/.test(req.headers.get("cookie") || "")) {
      try {
        const target = process.env.BACKEND_INTERNAL_ORIGIN || API_ORIGIN;
        const result = await fetch(target + "/api/auth/session", { headers: { cookie: req.headers.get("cookie") || "" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (!result.ok) throw new Error("Backend unavailable");
        const identity = await result.json(); session = identity?.user?.id ? identity : null;
      } catch { return NextResponse.json({ error: "Backend belum dapat dihubungi." }, { status: 503 }); }
    }
    response = enforceAccess(Object.assign(req, { auth: session }));
  } else response = await (authenticate as unknown as NextMiddleware)(req, event) || NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    for (const [key, value] of Object.entries(corsHeaders(req))) {
      if (key === "Vary") { if (!response.headers.get("Vary")?.includes("Origin")) response.headers.append(key, value); }
      else response.headers.set(key, value);
    }
  }
  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)",
  ],
};
