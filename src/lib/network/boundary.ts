import { NextRequest, NextResponse } from "next/server";
import { FRONTEND_ORIGIN, API_ORIGIN } from "./origins";
const methods = new Set(["GET", "HEAD", "OPTIONS"]);
export function corsHeaders(request: NextRequest): Record<string, string> {
  const requested = request.headers.get("origin");
  if (!requested || ![FRONTEND_ORIGIN, API_ORIGIN].filter(Boolean).includes(requested)) return {};
  return { "Access-Control-Allow-Origin": requested, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Methods": "GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key, X-Auth-Return-Redirect", "Access-Control-Expose-Headers": "Content-Disposition, Content-Length, Idempotency-Replayed", "Access-Control-Max-Age": "600", Vary: "Origin" };
}
/** Runs before Auth.js so credential-free CORS preflights never redirect to a login page. */
export function serviceBoundary(request: NextRequest): NextResponse | null {
  const role = process.env.APP_SERVICE || "monolith";
  const path = request.nextUrl.pathname;
  if (path === "/healthz") return NextResponse.json({ service: role, ready: true }, { headers: { "Cache-Control": "no-store" } });
  if (role === "frontend" && path.startsWith("/api/") && !path.startsWith("/api/auth/")) {
    const legacyLogin = path === "/api/mobile/auth/login" && request.method === "POST";
    if (process.env.LEGACY_MOBILE_API_BRIDGE === "true" && (request.headers.get("authorization")?.startsWith("Bearer ") || legacyLogin)) {
      const origin = process.env.BACKEND_INTERNAL_ORIGIN || API_ORIGIN;
      if (!origin) return NextResponse.json({ error: "Backend unavailable" }, { status: 503 });
      return NextResponse.rewrite(new URL(path + request.nextUrl.search, origin));
    }
    return NextResponse.json({ error: "Use the backend API domain" }, { status: 404 });
  }
  if (role === "backend" && !path.startsWith("/api/")) return new NextResponse(null, { status: 404 });
  if (!path.startsWith("/api/") || !API_ORIGIN) return null;
  const requested = request.headers.get("origin");
  const allowed = [FRONTEND_ORIGIN, API_ORIGIN].filter(Boolean);
  if (requested && !allowed.includes(requested)) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  if (!methods.has(request.method) && request.headers.has("cookie") && !requested) return NextResponse.json({ error: "Origin required for cookie-authenticated writes" }, { status: 403 });
  if (request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
  return null;
}
