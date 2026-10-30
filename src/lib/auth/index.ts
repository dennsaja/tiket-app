import type { Session } from "next-auth";
import type { NextRequest } from "next/server";
import { legacyHostCookieExpirations } from "@/lib/network/cookies";

export async function auth(): Promise<Session | null> {
  if (process.env.APP_SERVICE !== "frontend") return (await import("./backend")).auth();
  const { headers } = await import("next/headers");
  const { backendOrigin } = await import("@/lib/network/server");
  const incoming = await headers();
  const response = await fetch(backendOrigin() + "/api/auth/session", {
    headers: { cookie: incoming.get("cookie") || "" }, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return null;
  const session = await response.json();
  return session?.user?.id ? session as Session : null;
}

// Auth.js compatibility endpoint: credentials are processed exclusively by the backend.
async function authHandler(request: NextRequest, method: "GET" | "POST") {
  if (process.env.APP_SERVICE !== "frontend") return (await import("./backend")).handlers[method](request);
  const { backendOrigin } = await import("@/lib/network/server");
  const target = new URL(request.url);
  if (!target.pathname.startsWith("/api/auth/")) return new Response(null, { status: 404 });
  if (Number(request.headers.get("content-length")) > 65536) return new Response(null, { status: 413 });
  const body = method === "POST" ? await request.arrayBuffer() : undefined;
  if (body && body.byteLength > 65536) return new Response(null, { status: 413 });
  const forwarding = new Headers();
  for (const name of ["cookie", "origin", "content-type", "x-auth-return-redirect"]) {
    const value = request.headers.get(name); if (value) forwarding.set(name, value);
  }
  const response = await fetch(backendOrigin() + target.pathname + target.search, {
    method, headers: forwarding, body, cache: "no-store", redirect: "manual",
  });
  const output = new Headers(response.headers);
  output.delete("set-cookie"); output.delete("content-encoding"); output.delete("content-length");
  for (const cookie of response.headers.getSetCookie()) output.append("set-cookie", cookie);
  const parent = process.env.AUTH_COOKIE_DOMAIN?.replace(/^\./, "");
  if (parent && target.hostname !== parent) {
    for (const cookie of legacyHostCookieExpirations(request.headers.get("cookie") || "", process.env.NODE_ENV === "production")) output.append("set-cookie", cookie);
  }
  output.set("Cache-Control", "private, no-store");
  return new Response(response.body, { status: response.status, headers: output });
}
export const handlers = {
  GET: (request: NextRequest) => authHandler(request, "GET"),
  POST: (request: NextRequest) => authHandler(request, "POST"),
};
