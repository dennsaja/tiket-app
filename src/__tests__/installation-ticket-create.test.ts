import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), category: vi.fn(), insert: vi.fn(), complete: vi.fn(), audit: vi.fn(), classification: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { query: { categories: { findFirst: mocks.category }, users: { findMany: vi.fn().mockResolvedValue([]) }, tickets: { findFirst: mocks.complete } }, insert: mocks.insert } }));
vi.mock("@/lib/audit", () => ({ createAuditLog: mocks.audit, getClientIp: () => "127.0.0.1" }));
vi.mock("@/lib/tickets/validate-classification", () => ({ validateClassification: mocks.classification }));
vi.mock("@/lib/sla", () => ({ applySlaPolicyToTicket: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notifications", () => ({ notifyTicketAssigned: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notifications/bus", () => ({ notificationBus: { emitSystemEvent: vi.fn() } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => ({ success: true }), rateLimitResponse: vi.fn() }));

import { POST } from "@/app/api/tickets/route";
import { tickets } from "@/lib/db/schema";

const base = { categoryId: "installation", title: "Pemasangan pelanggan", description: "Pemasangan layanan baru di lokasi pelanggan." };
let created: Record<string, unknown>;
beforeEach(() => {
  vi.clearAllMocks();
  created = {};
  mocks.auth.mockResolvedValue({ user: { id: "operator", email: "operator@example.test", role: "admin" } });
  mocks.category.mockResolvedValue({ id: "installation", ticketType: "psb", isActive: true });
  mocks.classification.mockResolvedValue(null);
  mocks.audit.mockResolvedValue(undefined);
  mocks.insert.mockImplementation(table => ({ values: (data: Record<string, unknown>) => {
    if (table === tickets) created = { id: "created-ticket", ticketNumber: 501, createdAt: new Date(), ...data };
    return { returning: async () => [created] };
  } }));
  mocks.complete.mockImplementation(async () => created);
});
function request(data: Record<string, unknown>) {
  return new NextRequest("https://helpdesk.test/api/tickets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
}

describe("installation creation and the saved print payload", () => {
  it("rejects a missing customer using the category's type even if the caller claims maintenance", async () => {
    for (const ticketType of ["psb", "pemasangan_cctv"]) {
      mocks.category.mockResolvedValue({ id: "installation", ticketType, isActive: true });
      const response = await POST(request({ ...base, ticketType: "maintenance", reporterName: "  " }));
      expect(response.status).toBe(422);
      expect((await response.json()).error).toContain("Nama pelanggan wajib");
    }
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each(["noc", "owner", "admin"])("saves and returns the exact trimmed label customer for %s", async role => {
    mocks.auth.mockResolvedValue({ user: { id: "operator", email: "operator@example.test", role } });
    const response = await POST(request({ ...base, reporterName: "  PT Sumber Makmur Cabang Selatan  " }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ticketType: "psb", reporterName: "PT Sumber Makmur Cabang Selatan", ticketNumber: 501 });
    expect(created.reporterName).toBe("PT Sumber Makmur Cabang Selatan");
  });
  it("keeps legacy non-installation requests valid when the category sets maintenance", async () => {
    mocks.category.mockResolvedValue({ id: "maintenance", ticketType: "maintenance", isActive: true });
    const response = await POST(request({ ...base, categoryId: "maintenance" }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ticketType: "maintenance", reporterName: null });
  });
  it("denies unauthenticated users and roles without creation access before writing", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await POST(request({ ...base, reporterName: "Budi" }))).status).toBe(401);
    for (const role of ["agent", "user"]) {
      mocks.auth.mockResolvedValue({ user: { id: "viewer", role } });
      expect((await POST(request({ ...base, reporterName: "Budi" }))).status).toBe(403);
    }
    expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.category).not.toHaveBeenCalled();
  });
});
