import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const project = process.cwd();
const managed = ["DATABASE_URL", "AUTH_SECRET", "NEXTAUTH_SECRET", "APP_ROOT", "APP_SERVICE", "SPLIT_DEPLOY_ENABLED", "NODE_ENV", "__NEXT_PROCESSED_ENV"];

async function fixture(run: (root: string, env: NodeJS.ProcessEnv) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "helpdesk-startup-test-"));
  try {
    await mkdir(path.join(root, ".next", "standalone"), { recursive: true });
    await mkdir(path.join(root, ".next", "static"), { recursive: true });
    await mkdir(path.join(root, "public"));
    await writeFile(path.join(root, "package.json"), "{}");
    await writeFile(path.join(root, ".env"), "DATABASE_URL=fixture-default\nNEXTAUTH_SECRET=fixture-secret-from-file\n");
    await writeFile(path.join(root, ".env.production"), "DATABASE_URL=fixture-production\n");
    await writeFile(path.join(root, ".env.local"), "DATABASE_URL=fixture-local\n");
    await writeFile(path.join(root, ".next", "standalone", "server.js"), `
      process.env.NODE_ENV = 'production';
      process.chdir(__dirname);
      console.log(JSON.stringify({ database: process.env.DATABASE_URL, secret: process.env.NEXTAUTH_SECRET,
        root: process.env.APP_ROOT, mode: process.env.NODE_ENV, service: process.env.APP_SERVICE }));
    `);
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_PATH: path.join(project, "node_modules") };
    for (const key of managed) delete env[key];
    await run(root, env);
  } finally {
    if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + "helpdesk-startup-test-")) throw new Error("Unexpected cleanup path");
    await rm(root, { recursive: true, force: true });
  }
}

function execute(script: string, root: string, env: NodeJS.ProcessEnv) {
  return execFileSync(process.execPath, [script], { cwd: root, env, encoding: "utf8", windowsHide: true });
}

describe("production startup environment", () => {
  it("loads checkout build functions when launched by a standalone server", async () => fixture(async (root, env) => {
    await writeFile(path.join(root, "next.config.js"), "module.exports = { generateBuildId: async () => 'checkout-build' };");
    const script = `
      const load = require('next/dist/server/config').default;
      const { PHASE_PRODUCTION_BUILD } = require('next/constants');
      load(PHASE_PRODUCTION_BUILD, process.cwd()).then(async config => {
        console.log(await config.generateBuildId());
      });
    `;
    const output = execFileSync(process.execPath, ["--require", path.join(project, "scripts/build-env.cjs"), "-e", script], {
      cwd: root, env: { ...env, NODE_ENV: "production", __NEXT_PRIVATE_STANDALONE_CONFIG: '{"output":"standalone"}' },
      encoding: "utf8", windowsHide: true,
    });
    expect(output.trim()).toBe("checkout-build");
  }), 30000);

  it("loads the checkout env before npm start changes the working directory", async () => fixture(async (root, env) => {
    const actual = JSON.parse(execute(path.join(project, "scripts/start-app.mjs"), root, env));
    expect(actual).toMatchObject({ database: "fixture-local", secret: "fixture-secret-from-file", root, mode: "production", service: "monolith" });
  }), 15000);

  it("preserves service environment values over files and uses production file precedence", async () => fixture(async (root, env) => {
    await writeFile(path.join(root, ".env.production.local"), "DATABASE_URL=fixture-production-local\n");
    const script = path.join(project, "scripts/start-app.mjs");
    expect(JSON.parse(execute(script, root, env)).database).toBe("fixture-production-local");
    expect(JSON.parse(execute(script, root, { ...env, DATABASE_URL: "fixture-exported" })).database).toBe("fixture-exported");
  }), 15000);

  it("supports existing services that launch standalone/server.js directly without copying secrets", async () => fixture(async (root, env) => {
    const prepare = path.join(project, "scripts/prepare-standalone.mjs");
    execute(prepare, root, env);
    execute(prepare, root, env);
    const standalone = path.join(root, ".next", "standalone");
    const entry = path.join(standalone, "server.js");
    const actual = JSON.parse(execute(entry, standalone, env));
    expect(actual).toMatchObject({ database: "fixture-local", secret: "fixture-secret-from-file", root, service: "monolith" });
    expect((await readFile(entry, "utf8")).match(/require\('\.\/load-runtime-env\.cjs'\)/g)).toHaveLength(1);
    await expect(readFile(path.join(standalone, ".env.local"))).rejects.toMatchObject({ code: "ENOENT" });
  }), 15000);
});
