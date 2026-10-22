import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ actor: vi.fn(), read: vi.fn(), parse: vi.fn(), save: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth/get-user", () => ({ getAuthUser: mocks.actor }));
vi.mock("@/lib/map/topology-store", () => ({ MAX_TOPOLOGY_BYTES: 10485760, readTopology: mocks.read, readSqliteTopology: mocks.parse, saveTopology: mocks.save }));
vi.mock("@/lib/audit", () => ({ createAuditLog: mocks.audit, getClientIp: () => "127.0.0.1" }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => ({ success: true }) }));
import { GET, POST } from "@/app/api/admin/map/topology/route";
const snapshot = { version: 1, importedAt: "2026-10-22T00:00:00Z", nodes: [{ id: "r", kind: "router", name: "Router", coordinates: [110.85, -6.76], parentIds: [] }], links: [], bounds: [110.85, -6.76, 110.85, -6.76], skipped: 0 };
beforeEach(() => { vi.clearAllMocks(); mocks.actor.mockResolvedValue({ id: "admin", email: "admin@example.test", role: "admin" }); mocks.read.mockResolvedValue(snapshot); mocks.parse.mockResolvedValue(snapshot); });
describe("private topology API", () => {
  it("requires authentication before returning any network coordinates", async () => {
    mocks.actor.mockResolvedValue(null);
    expect((await GET(new NextRequest("https://helpdesk.test/api/admin/map/topology"))).status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("does not expose the full topology to technicians or customers", async () => {
    for (const role of ["agent", "user"]) {
      mocks.actor.mockResolvedValue({ id: "other", role });
      expect((await GET(new NextRequest("https://helpdesk.test/api/admin/map/topology"))).status).toBe(403);
    }
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("returns private non-cacheable data to map administrators", async () => {
    const response = await GET(new NextRequest("https://helpdesk.test/api/admin/map/topology"));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("persists only the sanitized snapshot on successful import", async () => {
    const form = new FormData(); form.append("file", new File(["SQLite bytes"], "topology.db"));
    const response = await POST(new NextRequest("https://helpdesk.test/api/admin/map/topology", { method: "POST", body: form }));
    expect(response.status).toBe(200); expect(mocks.save).toHaveBeenCalledWith(snapshot); expect(mocks.audit).toHaveBeenCalledOnce();
  });
  it("rejects oversized requests before attempting to parse or save them", async () => {
    const response = await POST(new NextRequest("https://helpdesk.test/api/admin/map/topology", { method: "POST", headers: { "content-length": "20000000" } }));
    expect(response.status).toBe(413); expect(mocks.parse).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("keeps the previous topology if a database cannot be read", async () => {
    mocks.parse.mockRejectedValue(new Error("private database details"));
    const form = new FormData(); form.append("file", new File(["invalid"], "topology.db"));
    const response = await POST(new NextRequest("https://helpdesk.test/api/admin/map/topology", { method: "POST", body: form }));
    expect(response.status).toBe(422); expect(JSON.stringify(await response.json())).not.toContain("private database details"); expect(mocks.save).not.toHaveBeenCalled();
  });
});
