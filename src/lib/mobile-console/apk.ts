import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { eq, sql, like, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { notificationBus } from "@/lib/notifications/bus";
import { androidSourceFingerprint } from "./source-fingerprint";

const key = "android_apk_publication_v1";
export const releaseDirectory = path.join(process.cwd(), "uploads", "mobile-releases");
export interface ApkRelease {
  revision: string; versionCode: number; versionName: string; sha256: string;
  fileSizeBytes: number; releaseNotes: string; publishedAt: string; downloadPath: string;
  androidSourceSha256: string;
  apiOrigin?: string;
  frontendOrigin?: string;
  cdnOrigin?: string;
}
export async function publishedApk(): Promise<ApkRelease | null> {
  const row = await db.query.systemSettings.findFirst({ where: eq(systemSettings.key, key) });
  return row?.value ? JSON.parse(row.value) : null;
}
export async function availableApk() {
  const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), "public/downloads/version.json"), "utf8"));
  if (!Number.isSafeInteger(manifest.versionCode) || manifest.versionCode < 1 || !/^\d+\.\d+\.\d+$/.test(manifest.versionName) || !/^[a-f0-9]{64}$/.test(manifest.sha256)) throw new Error("Metadata APK tidak valid");
  return manifest as Omit<ApkRelease, "revision" | "publishedAt" | "downloadPath">;
}
export async function pushApk() {
  const manifest = await availableApk();
  if (manifest.apiOrigin) {
    if (process.env.APP_SERVICE !== "backend" || process.env.NEXT_PUBLIC_API_ORIGIN !== manifest.apiOrigin) throw new Error("Aktifkan layanan backend pada domain baru sebelum mengirim APK ini ke tim.");
    try {
      const response = await fetch(manifest.apiOrigin + "/healthz", { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
      const health = await response.json();
      if (!response.ok || health.service !== "backend" || !health.ready) throw new Error("Backend not ready");
      if (manifest.cdnOrigin) {
        const cdnResponse = await fetch(manifest.cdnOrigin + "/downloads/version.json", { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
        const cdn = await cdnResponse.json();
        if (!cdnResponse.ok || cdn.sha256 !== manifest.sha256) throw new Error("CDN release differs");
      }
    } catch { throw new Error("Domain API/CDN belum aktif atau rilis CDN belum sama. Selesaikan aktivasi domain sebelum Push update APK."); }
  }
  if (!manifest.androidSourceSha256 || manifest.androidSourceSha256 !== await androidSourceFingerprint()) throw new Error("Kode Android di repository belum sesuai APK. Build APK terbaru dan sertakan dalam rilis sebelum menekan Push update.");
  const bytes = await fs.readFile(path.join(process.cwd(), "public/downloads/helpdesk-teknisi.apk"));
  if (bytes.length !== manifest.fileSizeBytes || createHash("sha256").update(bytes).digest("hex") !== manifest.sha256) throw new Error("APK tidak cocok dengan metadata rilis. Perbarui web dan APK dari repository yang sama.");
  await fs.mkdir(releaseDirectory, { recursive: true });
  const target = path.join(releaseDirectory, manifest.sha256 + ".apk");
  const temporary = target + "." + randomUUID();
  await fs.writeFile(temporary, bytes, { mode: 0o600 });
  await fs.rename(temporary, target).catch(async error => { await fs.unlink(temporary).catch(() => {}); if (!(await fs.stat(target).catch(() => null))) throw error; });
  const release: ApkRelease = { ...manifest, revision: randomUUID(), publishedAt: new Date().toISOString(), downloadPath: "/api/mobile/releases/" + manifest.sha256 };
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
    await tx.insert(systemSettings).values({ key, value: JSON.stringify(release) }).onConflictDoUpdate({ target: systemSettings.key, set: { value: JSON.stringify(release), updatedAt: new Date() } });
  });
  notificationBus.emitMobileConfig(Date.now());
  return release;
}
export async function apkReceipts() {
  const rows = await db.select({ value: systemSettings.value }).from(systemSettings).where(like(systemSettings.key, "android_apk_receipt:%")).orderBy(desc(systemSettings.updatedAt)).limit(250);
  return rows.flatMap(row => { try { return row.value ? [JSON.parse(row.value)] : []; } catch { return []; } });
}
