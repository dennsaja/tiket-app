import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.MONOLITH_SMOKE_PORT || 3060);
assert(Number.isInteger(port) && port > 0 && port < 65536);
const reservation = createServer();
reservation.listen(port, "127.0.0.1");
await once(reservation, "listening");
await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["scripts/start-app.mjs"], {
  cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(port),
    AUTH_URL: base, NEXTAUTH_URL: base, APP_URL: base,
    AUTH_SECRET: "local-smoke-fixture-only-not-production-123456789",
    NEXTAUTH_SECRET: "local-smoke-fixture-only-not-production-123456789",
    DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/unavailable",
    APP_SERVICE: "frontend", SPLIT_DEPLOY_ENABLED: "true",
    NEXT_PUBLIC_API_ORIGIN: "https://unused-api.example", NEXT_PUBLIC_CDN_ORIGIN: "https://unused-cdn.example",
    AUTH_COOKIE_DOMAIN: ".infinityteknik.net",
  },
});
let output = "";
child.stdout.on("data", data => { output = (output + data).slice(-4000); });
child.stderr.on("data", data => { output = (output + data).slice(-4000); });
async function request(route, init = {}) {
  const url = new URL(route, base);
  assert.equal(url.origin, base, "Smoke requests must stay on the local fixture origin");
  return fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(5000) });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 160; attempt++) {
    if (child.exitCode !== null) throw new Error("Local app exited before becoming ready");
    try { if ((await request("/healthz")).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert(ready, "Local app did not become ready");
  assert.equal((await (await request("/healthz")).json()).service, "monolith");
  const login = await request("/login"); assert.equal(login.status, 200);
  const html = await login.text();
  assert(!/https:\/\/(cdn0|kds-serviceapp)\.infinityteknik\.net/.test(html));
  const assets = [...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map(match => match[1]);
  assert(assets.length > 0, "Login must reference its JS/CSS assets");
  for (const asset of [...new Set(assets)].slice(0, 3)) {
    assert(asset.startsWith("/_next/static/"), "Assets must be same-origin");
    assert.equal((await request(asset)).status, 200);
  }
  const csrf = await request("/api/auth/csrf"); assert.equal(csrf.status, 200);
  assert.equal(typeof (await csrf.json()).csrfToken, "string");
  assert(csrf.headers.getSetCookie().some(cookie => cookie.includes("helpdesk.csrf-token") && !/domain=/i.test(cookie)));
  assert.equal((await request("/api/mobile/auth/me")).status, 401);
  assert.equal((await request("/api/admin/system/update", { method: "POST" })).status, 401);
  assert.equal((await request("/api/tickets", { method: "POST", headers: { origin: "https://evil.example" } })).status, 403);
  assert.equal((await request("/map/satellite.js")).status, 200);
  const download = await request("/download"); assert.equal(download.status, 200);
  assert((await download.text()).includes('href="/downloads/helpdesk-teknisi.apk'));
  const release = await (await request("/downloads/version.json")).json();
  assert.equal(release.apiOrigin, release.frontendOrigin); assert.equal(release.apiOrigin, release.cdnOrigin);
  const apk = await request("/downloads/helpdesk-teknisi.apk", { method: "HEAD" });
  assert.equal(apk.status, 200); assert.equal(Number(apk.headers.get("content-length")), release.fileSizeBytes);
  console.log(JSON.stringify({ passed: true, processCount: 1, health: "monolith", login: 200,
    auth: 200, staticAssets: 200, map: 200, protectedApi: 401, unauthorizedUpdate: 401,
    crossOriginWrite: 403, apkVersion: release.versionName, apkBytes: release.fileSizeBytes }));
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
