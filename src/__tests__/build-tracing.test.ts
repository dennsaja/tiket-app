import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../next.config";

const require = createRequire(import.meta.url);
const { TraceEntryPointsPlugin } = require("next/dist/build/webpack/plugins/next-trace-entrypoints-plugin");
const picomatch = require("next/dist/compiled/picomatch");

describe("production build file boundaries", () => {
  it("excludes actual emulator/private paths on Windows and POSIX before Next copies files", () => {
    const plugin = new TraceEntryPointsPlugin({ rootDir: process.cwd(), traceIgnores: ["**/original-ignore/**"] });
    const webpackConfig = { plugins: [plugin] };
    config.webpack!(webpackConfig, { dev: false, nextRuntime: "nodejs" } as never);
    const ignored = picomatch(plugin.traceIgnores, { dot: true, contains: true });
    for (const root of ["D:\\antigravity\\tiket-app", "/srv/tiket-app"]) {
      const join = root.startsWith("D:") ? path.win32.join : path.posix.join;
      for (const file of ["android-technician/.test-device/HelpdeskUI.avd/userdata-qemu.img", "motion/technician-bumper/public/movie.mp4", ".env.local", "uploads/private.png", ".next/standalone/server.js", "original-ignore/file"]) {
        expect(ignored(join(root, file)), file).toBe(true);
      }
      for (const file of ["node_modules/sql.js/dist/sql-wasm.wasm", ".next/server/app/api/tickets/route.js", "src/lib/printing/adapter.ts"]) {
        expect(ignored(join(root, file)), file).toBe(false);
      }
    }
  });
  it("covers global server and route traces, and leaves development and edge builds alone", () => {
    expect(config.turbopack).toEqual({});
    const entries = config.outputFileTracingExcludes!;
    for (const target of ["next-server", "/api/admin/backup/restore", "/tickets/one"]) {
      expect(Object.keys(entries).some(glob => picomatch(glob, { dot: true, contains: true })(target))).toBe(true);
    }
    const ordinary = { plugins: [] };
    expect(config.webpack!(ordinary, { dev: true, nextRuntime: "nodejs" } as never)).toBe(ordinary);
    expect(config.webpack!(ordinary, { dev: false, nextRuntime: "edge" } as never)).toBe(ordinary);
  });
});
