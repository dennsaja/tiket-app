import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { applicationRoot } from "@/lib/runtime/paths";
import { androidSourceFingerprint } from "@/lib/mobile-console/source-fingerprint";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("persistent files under standalone", () => {
  it("keeps persistent files outside build output even when the working directory changes", async () => {
    vi.stubEnv("APP_ROOT", "");
    const root = await mkdtemp(path.join(os.tmpdir(), "helpdesk-runtime-test-"));
    try {
      await mkdir(path.join(root, ".git")); await writeFile(path.join(root, "package.json"), "{}");
      const build = path.join(root, ".next", "standalone"); await mkdir(build, { recursive: true });
      vi.spyOn(process, "cwd").mockReturnValue(build);
      expect(applicationRoot()).toBe(root);
      const uploads = path.join(applicationRoot(), "uploads"); await mkdir(uploads);
      await writeFile(path.join(uploads, "retained.txt"), "existing upload");
      if (!path.resolve(build).startsWith(path.resolve(root) + path.sep)) throw new Error("Unexpected generated path");
      await rm(build, { recursive: true, force: true });
      expect(await readFile(path.join(uploads, "retained.txt"), "utf8")).toBe("existing upload");
      expect(applicationRoot()).toBe(root);
    } finally {
      vi.restoreAllMocks();
      if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + "helpdesk-runtime-test-")) throw new Error("Unexpected cleanup path");
      await rm(root, { recursive: true, force: true });
    }
  });
  it("finds the actual Android source and APK metadata from a standalone cwd", async () => {
    const root = process.cwd(); vi.stubEnv("APP_ROOT", root);
    vi.spyOn(process, "cwd").mockReturnValue(path.join(root, ".next", "standalone"));
    const release = JSON.parse(await readFile(path.join(applicationRoot(), "public/downloads/version.json"), "utf8"));
    expect(await androidSourceFingerprint()).toBe(release.androidSourceSha256);
  });
  it("rejects an invalid source root before choosing a persistent destination", () => {
    vi.stubEnv("APP_ROOT", path.join(os.tmpdir(), "missing-helpdesk-runtime-root"));
    expect(() => applicationRoot()).toThrow("APP_ROOT");
  });
});
