import { cp, access } from "node:fs/promises";
import path from "node:path";

// A single-origin standalone server must carry its own public files and chunks.
const root = process.cwd();
await access(path.join(root, ".next/standalone/server.js"));
for (const [source, destination] of [["public", ".next/standalone/public"], [".next/static", ".next/standalone/.next/static"]]) {
  await cp(path.join(root, source), path.join(root, destination), { recursive: true, force: true });
}
console.log("Standalone siap: halaman, API, aset publik, dan unduhan APK satu origin.");
