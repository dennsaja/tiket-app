import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { updateProjectDirectory } from "@/lib/updates/project";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), spawn: vi.fn(), exec: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/audit", () => ({ createAuditLog: mocks.audit, getClientIp: () => "127.0.0.1" }));
vi.mock("pg", () => ({ Pool: class { query = vi.fn().mockResolvedValue({}); end = vi.fn().mockResolvedValue(undefined); } }));
vi.mock("drizzle-orm/node-postgres/migrator", () => ({ migrate: vi.fn().mockResolvedValue(undefined) }));
vi.mock("child_process", async (importOriginal) => {
  const { promisify } = await import("node:util");
  return { ...await importOriginal<typeof import("child_process")>(), spawn: mocks.spawn, exec: Object.assign(mocks.exec, { [promisify.custom]: async () => ({ stdout: "abcdef123456\n", stderr: "" }) }) };
});
import { GET, POST } from "@/app/api/admin/system/update/route";
import * as releases from "@/lib/updates/latest";
import { migrate } from "drizzle-orm/node-postgres/migrator";
const commands: string[] = [];
let failure = "";
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); commands.length = 0; failure = "";
  vi.stubEnv("APP_ROOT", process.cwd()); vi.stubEnv("SPLIT_DEPLOY_ENABLED", "true");
  mocks.auth.mockResolvedValue({ user: { id: "noc", role: "noc", email: "noc@example.test" } });
  mocks.audit.mockResolvedValue(undefined);
  mocks.spawn.mockImplementation((_shell, args) => {
    const command = String(args.at(-1)); commands.push(command);
    const proc = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill: vi.fn(), unref: vi.fn() });
    void Promise.resolve().then(() => proc.emit("close", failure && command.includes(failure) ? 1 : 0));
    return proc;
  });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); });
describe("GitHub update through the web", () => {
  it("compares the running build and never reports an unverified version as current", async () => {
    const sha = "a".repeat(40);
    const latest = vi.spyOn(releases, "latestRelease").mockResolvedValue({ sha, commitUrl: "" });
    const check = async () => (await GET(new NextRequest("https://helpdesk.test/api/admin/system/update"))).json();
    try {
      vi.stubEnv("HELPDESK_BUILD_COMMIT", "b".repeat(40));
      expect((await check()).hasUpdate).toBe(true);
      vi.stubEnv("HELPDESK_BUILD_COMMIT", sha);
      expect((await check()).hasUpdate).toBe(false);
      vi.stubEnv("HELPDESK_BUILD_COMMIT", "");
      expect((await check()).hasUpdate).toBeNull();
      latest.mockResolvedValue(null);
      vi.stubEnv("HELPDESK_BUILD_COMMIT", sha);
      expect((await check()).hasUpdate).toBeNull();
    } finally { latest.mockRestore(); }
  });
  it("rejects unauthenticated and non-staff users before running any command", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await POST(new NextRequest("https://helpdesk.test/api/admin/system/update", { method: "POST" }))).status).toBe(401);
    mocks.auth.mockResolvedValue({ user: { role: "user" } });
    expect((await POST(new NextRequest("https://helpdesk.test/api/admin/system/update", { method: "POST" }))).status).toBe(403);
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
  it("fetches GitHub, installs locked dependencies and builds one app despite old split flags", async () => {
    const response = await POST(new NextRequest("https://helpdesk.test/api/admin/system/update", { method: "POST" }));
    const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
    expect(commands.some(command => command.includes("fetch origin main"))).toBe(true);
    expect(commands.some(command => command.includes("ci --include=dev"))).toBe(true);
    expect(commands.some(command => command === "npm run build")).toBe(true);
    expect(commands.some(command => /publish-split|clean -fd|reload all|SIGUSR2/.test(command))).toBe(false);
    expect(events.some(event => event.type === "complete")).toBe(true);
    expect(events.some(event => event.type === "restart")).toBe(true);
  });
  it('stops before build/restart if the database migration fails', async () => {
    vi.mocked(migrate).mockRejectedValueOnce(new Error('fixture migration failure'));
    const response = await POST(new NextRequest('https://helpdesk.test/api/admin/system/update', { method: 'POST' }));
    const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
    expect(events.some(event => event.type === 'error')).toBe(true);
    expect(events.some(event => event.type === 'complete' || event.type === 'restart')).toBe(false);
    expect(commands).not.toContain('npm run build');
  });
  it.each([" ci ", "npm run build"])("stops without success/restart when %s fails", async command => {
    failure = command;
    const response = await POST(new NextRequest("https://helpdesk.test/api/admin/system/update", { method: "POST" }));
    const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
    expect(events.some(event => event.type === "error")).toBe(true);
    expect(events.some(event => event.type === "complete" || event.type === "restart")).toBe(false);
  });
});

describe("update checkout discovery", () => {
  it("finds the Git checkout above a standalone working directory", async () => {
    vi.unstubAllEnvs();
    const root = await mkdtemp(path.join(os.tmpdir(), "helpdesk-update-test-"));
    try {
      await mkdir(path.join(root, ".git")); await writeFile(path.join(root, "package.json"), "{}");
      const standalone = path.join(root, ".next", "standalone"); await mkdir(standalone, { recursive: true });
      expect(updateProjectDirectory(standalone)).toBe(root);
    } finally {
      if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + "helpdesk-update-test-")) throw new Error("Unexpected cleanup path");
      await rm(root, { recursive: true, force: true });
    }
  });
  it("fails clearly if APP_ROOT is not a checkout", () => {
    vi.stubEnv("APP_ROOT", path.join(os.tmpdir(), "missing-helpdesk-project"));
    expect(() => updateProjectDirectory()).toThrow("APP_ROOT");
  });
});
