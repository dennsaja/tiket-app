import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import dotenv from "dotenv";
let current = {};
for (const file of [".env", ".env.local"]) if (existsSync(file)) Object.assign(current, dotenv.parse(readFileSync(file)));
const secret = current.AUTH_SECRET || current.NEXTAUTH_SECRET;
if (!secret || secret.length < 32 || !current.DATABASE_URL) throw new Error("Existing DATABASE_URL and AUTH_SECRET/NEXTAUTH_SECRET are required; credentials will not be replaced or printed");
const shared = {
  NODE_ENV: "production", NEXT_PUBLIC_FRONTEND_ORIGIN: "https://helpdesk.infinityteknik.net",
  NEXT_PUBLIC_API_ORIGIN: "https://kds-serviceapp.infinityteknik.net", NEXT_PUBLIC_CDN_ORIGIN: "https://cdn0.infinityteknik.net",
  AUTH_URL: "https://helpdesk.infinityteknik.net", NEXTAUTH_URL: "https://helpdesk.infinityteknik.net",
  AUTH_COOKIE_DOMAIN: ".infinityteknik.net", AUTH_SECRET: secret, NEXTAUTH_SECRET: secret,
};
const backend = { ...current, ...shared, APP_SERVICE: "backend", BACKEND_PORT: "3101", APP_URL: shared.NEXT_PUBLIC_FRONTEND_ORIGIN, SPLIT_DEPLOY_ENABLED: "true", SPLIT_DATA_DIR: "/var/lib/helpdesk" };
const { AUTH_SECRET: ignoredSecret, NEXTAUTH_SECRET: ignoredLegacySecret, ...publicSettings } = shared;
const frontend = { ...publicSettings, APP_SERVICE: "frontend", HOSTNAME: "127.0.0.1", PORT: "3100", BACKEND_INTERNAL_ORIGIN: "http://127.0.0.1:3101", AUTH_SECRET: "", NEXTAUTH_SECRET: "", DATABASE_URL: "", LEGACY_MOBILE_API_BRIDGE: "true" };
mkdirSync("/etc/helpdesk", { recursive: true, mode: 0o750 });
for (const [name, values] of Object.entries({ backend, frontend })) {
  const target = "/etc/helpdesk/" + name + ".env";
  if (existsSync(target)) { console.log(name + ".env exists; preserving operator configuration"); continue; }
  for (const value of Object.values(values)) if (/[\r\n\0]/.test(value)) throw new Error("Multiline environment values require manual configuration");
  // No shell evaluation: both systemd and with-service-env load these quoted values as data.
  writeFileSync(target, Object.entries(values).map(([key, value]) => key + "=" + JSON.stringify(value)).join("\n") + "\n", { mode: 0o600 });
  console.log(name + ".env created with existing credentials");
}
