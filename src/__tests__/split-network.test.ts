import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const frontend = "https://helpdesk.infinityteknik.net", api = "https://kds-serviceapp.infinityteknik.net", cdn = "https://cdn0.infinityteknik.net";
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_FRONTEND_ORIGIN", frontend); vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", api); vi.stubEnv("NEXT_PUBLIC_CDN_ORIGIN", cdn);
  vi.stubEnv("APP_SERVICE", "backend");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("split service boundary", () => {
  it("expires legacy host-only session chunks without expiring the shared parent cookie or unrelated cookies", async () => {
    const { legacyHostCookieExpirations } = await import("@/lib/network/cookies");
    const expired = legacyHostCookieExpirations("__Secure-authjs.session-token.0=old; __Host-authjs.csrf-token=old; preference=dark", true);
    expect(expired).toHaveLength(2);
    expect(expired.every(cookie => cookie.includes("Max-Age=0") && cookie.includes("Secure") && !cookie.includes("Domain="))).toBe(true);
    expect(expired.some(cookie => cookie.startsWith("preference="))).toBe(false);
  });
  it("answers credential-free preflights without authentication and without wildcard credentials", async () => {
    const { serviceBoundary } = await import("@/lib/network/boundary");
    const response = serviceBoundary(new NextRequest(api + "/api/tickets", { method: "OPTIONS", headers: { origin: frontend, "access-control-request-method": "POST" } }));
    expect(response?.status).toBe(204); expect(response?.headers.get("Access-Control-Allow-Origin")).toBe(frontend);
    expect(response?.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });
  it("rejects an untrusted origin even if it supplies a fake bearer header", async () => {
    const { serviceBoundary } = await import("@/lib/network/boundary");
    const response = serviceBoundary(new NextRequest(api + "/api/tickets", { method: "POST", headers: { origin: "https://other.infinityteknik.net", cookie: "session=fixture", authorization: "Bearer invalid" } }));
    expect(response?.status).toBe(403);
  });
  it("requires an origin for cookie-authenticated mutations, and allows native bearer requests", async () => {
    const { serviceBoundary } = await import("@/lib/network/boundary");
    expect(serviceBoundary(new NextRequest(api + "/api/tickets", { method: "POST", headers: { cookie: "session=fixture" } }))?.status).toBe(403);
    expect(serviceBoundary(new NextRequest(api + "/api/tickets", { method: "POST", headers: { authorization: "Bearer fixture" } }))).toBeNull();
  });
  it("does not render frontend pages on the API service", async () => {
    const { serviceBoundary } = await import("@/lib/network/boundary");
    expect(serviceBoundary(new NextRequest(api + "/dashboard"))?.status).toBe(404);
  });
  it("blocks business handlers on the frontend; legacy bearer traffic rewrites only when enabled", async () => {
    vi.stubEnv("APP_SERVICE", "frontend"); vi.stubEnv("LEGACY_MOBILE_API_BRIDGE", "false"); vi.stubEnv("BACKEND_INTERNAL_ORIGIN", "http://127.0.0.1:3101");
    const { serviceBoundary } = await import("@/lib/network/boundary");
    const request = new NextRequest(frontend + "/api/mobile/tickets?page=2", { headers: { authorization: "Bearer fixture" } });
    expect(serviceBoundary(request)?.status).toBe(404);
    vi.stubEnv("LEGACY_MOBILE_API_BRIDGE", "true");
    expect(serviceBoundary(request)?.headers.get("x-middleware-rewrite")).toBe("http://127.0.0.1:3101/api/mobile/tickets?page=2");
    expect(serviceBoundary(new NextRequest(frontend + "/api/users"))?.status).toBe(404);
  });
  it("separates API and public assets without moving private files onto the CDN", async () => {
    const { apiUrl, assetUrl, resourceUrl } = await import("@/lib/network/origins");
    expect(apiUrl("/api/tickets")).toBe(api + "/api/tickets"); expect(assetUrl("/downloads/helpdesk-teknisi.apk")).toBe(cdn + "/downloads/helpdesk-teknisi.apk");
    expect(resourceUrl("/api/attachments/private-id")).toBe(api + "/api/attachments/private-id");
    expect(resourceUrl("blob:fixture")).toBe("blob:fixture");
  });
  it("sends credentials to the API and keeps Auth.js on its compatibility endpoint", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}")); vi.stubGlobal("fetch", fetch);
    const { apiFetch } = await import("@/lib/network/client");
    await apiFetch("/api/tickets", { method: "POST" });
    expect(fetch).toHaveBeenLastCalledWith(api + "/api/tickets", expect.objectContaining({ credentials: "include", method: "POST" }));
    await apiFetch("/api/auth/session"); expect(fetch).toHaveBeenLastCalledWith("/api/auth/session", {});
  });
  it("cannot initialize or query a database in the frontend process", async () => {
    vi.stubEnv("APP_SERVICE", "frontend"); vi.stubEnv("DATABASE_URL", "");
    const { db, pool } = await import("@/lib/db");
    expect(() => db.query).toThrow("Database access is forbidden"); expect(() => pool.connect).toThrow("Database access is forbidden");
  }, 20000);
});
