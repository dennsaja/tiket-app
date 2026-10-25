import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { androidSourceFingerprint } from "../src/lib/mobile-console/source-fingerprint";
async function main() {
  const metadata = JSON.parse(await fs.readFile("android-technician/app/build/outputs/apk/release/output-metadata.json", "utf8")).elements[0];
  const gradle = await fs.readFile("android-technician/app/build.gradle", "utf8");
  if (metadata.versionCode !== Number(gradle.match(/versionCode\s+(\d+)/)?.[1]) || metadata.versionName !== gradle.match(/versionName\s+"([^"]+)"/)?.[1]) throw new Error("APK belum dibuild sesuai versi sumber Android");
  const apk = await fs.readFile("android-technician/app/build/outputs/apk/release/app-release.apk");
  await fs.writeFile("public/downloads/helpdesk-teknisi.apk", apk);
  const release = {
    versionCode: metadata.versionCode, versionName: metadata.versionName, minSupportedVersion: 1,
    downloadUrl: "/downloads/helpdesk-teknisi.apk", updatedAt: new Date().toISOString(),
    sha256: createHash("sha256").update(apk).digest("hex"), fileSizeBytes: apk.length,
    androidSourceSha256: await androidSourceFingerprint(),
    releaseNotes: "v3.6.1: Kartu tugas berjalan di beranda teknisi dengan animasi perbaikan kabel 5 detik, judul tiket, dan tombol Lanjutkan tugas. Tampil saat teknisi berada di lokasi atau sedang mengerjakan tiket. Animasi tersedia offline, berhenti saat meninggalkan dasbor, dan memakai gambar diam saat hemat daya atau animasi sistem dinonaktifkan.",
  };
  await fs.writeFile("public/downloads/version.json", JSON.stringify(release, null, 2) + "\n");
  console.log(JSON.stringify(release));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
