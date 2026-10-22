import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ actor: vi.fn(), all: vi.fn(), single: vi.fn(), find: vi.fn() }));
vi.mock("@/lib/auth/get-user", () => ({ getAuthUser: mocks.actor }));
vi.mock("@/lib/notifications", () => ({ markAllNotificationsRead: mocks.all, markNotificationRead: mocks.single }));
vi.mock("@/lib/db", () => ({ db: { query: { notifications: { findFirst: mocks.find } } } }));
import { POST } from "@/app/api/notifications/route";
import { PATCH } from "@/app/api/notifications/[id]/route";
beforeEach(() => { vi.clearAllMocks(); mocks.actor.mockResolvedValue({ id: "me", role: "agent" }); });
describe("notification read persistence", () => {
  it("persists a bulk acknowledgement for the authenticated account", async () => {
    const response = await POST(new NextRequest("https://helpdesk.test/api/notifications", { method: "POST", body: JSON.stringify({ action: "mark_all_read", userId: "someone-else" }) }));
    expect(response.status).toBe(200); expect(mocks.all).toHaveBeenCalledExactlyOnceWith("me");
  });
  it("rejects unauthenticated bulk requests without changing records", async () => {
    mocks.actor.mockResolvedValue(null);
    expect((await POST(new NextRequest("https://helpdesk.test/api/notifications", { method: "POST" }))).status).toBe(401);
    expect(mocks.all).not.toHaveBeenCalled();
  });
  it("does not acknowledge another account's notification", async () => {
    mocks.find.mockResolvedValue(undefined);
    expect((await PATCH(new NextRequest("https://helpdesk.test/api/notifications/other", { method: "PATCH" }), { params: Promise.resolve({ id: "other" }) })).status).toBe(404);
    expect(mocks.single).not.toHaveBeenCalled();
  });
});
