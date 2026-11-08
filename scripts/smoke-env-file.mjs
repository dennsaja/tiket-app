import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const project = fileURLToPath(new URL("../", import.meta.url));
const root = await mkdtemp(path.join(os.tmpdir(), "helpdesk-env-smoke-"));
const standalone = path.join(root, ".next", "standalone");
// Fake configuration only. Never load the developer's or production database.
const env = { ...process.env, HOSTNAME: "127.0.0.1", PORT: "0",
  NODE_PATH: path.join(project, ".next", "standalone", "node_modules") };
for (const key of ["DATABASE_URL", "AUTH_SECRET", "NEXTAUTH_SECRET", "AUTH_URL", "NEXTAUTH_URL", "APP_URL", "APP_ROOT", "NODE_ENV", "__NEXT_PROCESSED_ENV"]) delete env[key];

try {
  await mkdir(standalone, { recursive: true });
  await mkdir(path.join(root, ".next", "static"));
  await mkdir(path.join(root, "public"));
  await writeFile(path.join(root, "package.json"), "{}");
  await writeFile(path.join(root, ".env.local"), [
    "DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:1/unavailable",
    "NEXTAUTH_SECRET=env-file-smoke-fixture-only-not-production-123456789",
  ].join("\n"));
  const actualServer = path.join(project, ".next", "standalone", "server.js");
  await writeFile(path.join(standalone, "server.js"), `require(${JSON.stringify(actualServer)});\n`);
  execFileSync(process.execPath, [path.join(project, "scripts", "prepare-standalone.mjs")], { cwd: root, env, windowsHide: true, stdio: "pipe" });

  for (const [index, entry] of [path.join(project, "scripts", "start-app.mjs"), path.join(standalone, "server.js")].entries()) {
    const port = 3062 + index;
    const reservation = createServer();
    reservation.listen(port, "127.0.0.1");
    await once(reservation, "listening");
    await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
    const base = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, [entry], { cwd: root, env: { ...env, PORT: String(port) }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) stream.on("data", data => { output = (output + data).slice(-4000); });
    const request = (route, init = {}) => fetch(base + route, { ...init, redirect: "manual", signal: AbortSignal.timeout(5000) });
    try {
      let ready = false;
      for (let attempt = 0; attempt < 160; attempt++) {
        if (child.exitCode !== null) throw new Error("App stopped before startup");
        try { if ((await request("/healthz")).ok) { ready = true; break; } } catch {}
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      assert(ready, "Fixture app did not start");
      assert.equal((await request("/login")).status, 200);
      const csrf = await request("/api/auth/csrf");
      assert.equal(csrf.status, 200, "Authentication must initialize using .env.local alone");
      const { csrfToken } = await csrf.json();
      assert.equal(typeof csrfToken, "string");
      const jar = new Map();
      for (const value of csrf.headers.getSetCookie()) {
        const pair = value.split(";")[0];
        jar.set(pair.slice(0, pair.indexOf("=")), pair);
      }
      const cookie = [...jar.values()].join("; ");
      assert([...jar.values()].some(pair => decodeURIComponent(pair.slice(pair.indexOf("=") + 1)).startsWith(csrfToken + "|")), "Returned CSRF token must match the cookie a browser retains");
      const providers = await request("/api/auth/providers");
      assert.equal(providers.status, 200);
      assert.equal((await providers.json()).credentials.type, "credentials");
      assert.equal((await request("/api/auth/session")).status, 200);
      const invalidLogin = await request("/api/auth/callback/credentials", {
        method: "POST", headers: { cookie, origin: base, "X-Auth-Return-Redirect": "1", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken, email: "", password: "", callbackUrl: base + "/dashboard" }),
      });
      assert.equal(invalidLogin.status, 200);
      assert.match((await invalidLogin.json()).url, /error=CredentialsSignin/);
      const health = await request("/api/health");
      assert.equal(health.status, 503, "Fixture DB is intentionally unreachable; route must still initialize");
      assert.equal((await health.json()).services.database, "unhealthy");
      console.log(JSON.stringify({ passed: true, entry: index === 0 ? "npm-start" : "direct-standalone", config: ".env.local", csrf: 200, providers: 200, session: 200, invalidCredentials: "CredentialsSignin", fixtureDatabase: 503 }));
    } catch (error) {
      console.error(output); throw error;
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
        let timer;
        await Promise.race([once(child, "exit"), new Promise(resolve => { timer = setTimeout(resolve, 3000); })]);
        clearTimeout(timer);
      }
    }
  }
} finally {
  if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + "helpdesk-env-smoke-")) throw new Error("Unexpected cleanup path");
  await rm(root, { recursive: true, force: true });
}
