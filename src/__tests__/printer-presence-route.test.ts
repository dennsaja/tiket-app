import { beforeEach, expect, it, vi } from "vitest";
import { GET, PUT, DELETE } from "@/app/api/printer/presence/route";

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth }));
beforeEach(() => { auth.mockReset(); });

it("shares an admin's connection with NOC, and removes it after the admin disconnects", async () => {
  const url = "http://localhost/api/printer/presence?host=12345678-abcd-4321-8765-123456789012";
  const admin = { user: { id: "operator", role: "admin" } };
  auth.mockResolvedValue(admin);
  expect((await PUT(new Request(url, { method: "PUT" }))).status).toBe(200);
  auth.mockResolvedValue({ user: { id: "viewer", role: "noc" } });
  expect(await (await GET()).json()).toEqual({ roles: ["admin"] });
  expect((await DELETE(new Request(url, { method: "DELETE" }))).status).toBe(409);
  auth.mockResolvedValue(admin);
  expect(await (await DELETE(new Request(url, { method: "DELETE" }))).json()).toEqual({ roles: [] });
});

it("restricts shared status to signed-in operators", async () => {
  auth.mockResolvedValue(null);
  expect((await GET()).status).toBe(403);
  auth.mockResolvedValue({ user: { id: "reporter", role: "user" } });
  expect((await GET()).status).toBe(403);
});
