import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const origin = "https://helpdesk.infinityteknik.net";
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("APP_SERVICE", "frontend"); vi.stubEnv("SPLIT_DEPLOY_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "https://unused-api.example");
  vi.stubEnv("NEXT_PUBLIC_CDN_ORIGIN", "invalid old configuration");
  vi.stubEnv("AUTH_COOKIE_DOMAIN", ".infinityteknik.net");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("single application", () => {
  it("serves pages and APIs together even with stale service-role settings", async () => {
    const { serviceBoundary } = await import("@/lib/network/boundary");
    for (const role of ["frontend", "backend", "monolith"]) {
      vi.stubEnv("APP_SERVICE", role);
      expect(serviceBoundary(new NextRequest(origin + "/dashboard"))).toBeNull();
      expect(serviceBoundary(new NextRequest(origin + "/api/tickets"))).toBeNull();
    }
    expect(await serviceBoundary(new NextRequest(origin + "/healthz"))!.json()).toMatchObject({ service: "monolith", ready: true });
  });
  it("keeps private attachments, API calls and assets relative to the current origin", async () => {
    const { apiUrl, assetUrl, resourceUrl } = await import("@/lib/network/origins");
    expect(apiUrl("/api/tickets")).toBe("/api/tickets");
    expect(assetUrl("/_next/static/chunk.js")).toBe("/_next/static/chunk.js");
    expect(resourceUrl("/api/attachments/private-id")).toBe("/api/attachments/private-id");
    expect(assetUrl("/downloads/helpdesk-teknisi.apk")).toBe("/downloads/helpdesk-teknisi.apk");
    expect(resourceUrl("blob:fixture")).toBe("blob:fixture");
  });
  it("uses the same origin for login and business requests without cross-domain credentials", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}")); vi.stubGlobal("fetch", fetch);
    const { apiFetch } = await import("@/lib/network/client");
    await apiFetch("/api/tickets", { method: "POST" });
    expect(fetch).toHaveBeenLastCalledWith("/api/tickets", { method: "POST" });
    await apiFetch("/api/auth/session"); expect(fetch).toHaveBeenLastCalledWith("/api/auth/session", undefined);
  });
  it("retains origin checks and permits native Bearer requests without browser cookies", async () => {
    const { serviceBoundary } = await import("@/lib/network/boundary");
    expect(serviceBoundary(new NextRequest(origin + "/api/tickets", { method: "POST", headers: { origin: "https://evil.example", cookie: "session=fixture", authorization: "Bearer invalid" } }))?.status).toBe(403);
    expect(serviceBoundary(new NextRequest(origin + "/api/tickets", { method: "POST", headers: { cookie: "session=fixture" } }))?.status).toBe(403);
    expect(serviceBoundary(new NextRequest(origin + "/api/tickets", { method: "POST", headers: { origin, cookie: "session=fixture" } }))).toBeNull();
    expect(serviceBoundary(new NextRequest(origin + "/api/tickets", { method: "POST", headers: { authorization: "Bearer fixture" } }))).toBeNull();
    const preflight = serviceBoundary(new NextRequest(origin + "/api/tickets", { method: "OPTIONS", headers: { origin } }));
    expect(preflight?.status).toBe(204); expect(preflight?.headers.has("access-control-allow-origin")).toBe(false);
  });
  it("accepts the public origin forwarded by the existing HTTPS proxy", async () => {
    const { serviceBoundary } = await import("@/lib/network/boundary");
    expect(serviceBoundary(new NextRequest("http://127.0.0.1:3000/api/tickets", { method: "POST", headers: { origin, cookie: "session=fixture", "x-forwarded-host": "helpdesk.infinityteknik.net", "x-forwarded-proto": "https" } }))).toBeNull();
  });
  it("uses host-only cookies despite old shared-domain settings", async () => {
    const { authConfig } = await import("@/lib/auth/auth.config");
    expect(authConfig.cookies?.sessionToken?.name).toContain("helpdesk.session-token");
    expect(authConfig.cookies?.sessionToken?.options).not.toHaveProperty("domain");
  });
  it("allows public map assets without a browser session while keeping admin pages private", async () => {
    const { authConfig } = await import("@/lib/auth/auth.config");
    const authorized = authConfig.callbacks!.authorized!;
    expect(await authorized({ auth: null, request: new NextRequest(origin + "/map/satellite.html") })).toBe(true);
    expect(await authorized({ auth: null, request: new NextRequest(origin + "/map/satellite.js") })).toBe(true);
    expect(await authorized({ auth: null, request: new NextRequest(origin + "/admin/map") })).toBe(false);
  });
  it("requires a database even when an old frontend role remains configured", async () => {
    vi.stubEnv("DATABASE_URL", "");
    await expect(import("@/lib/db")).rejects.toThrow("DATABASE_URL");
  }, 20000);
});
