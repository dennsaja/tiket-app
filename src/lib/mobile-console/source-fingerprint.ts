import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
/** Normalize Windows line endings so a signed Windows build matches its Linux Git checkout. */
export async function androidSourceFingerprint(root = process.cwd()) {
  const files: string[] = [];
  async function walk(relative: string) {
    const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
    for (const entry of entries) {
      const child = relative + "/" + entry.name;
      if (entry.isDirectory()) await walk(child); else if (entry.isFile()) files.push(child);
    }
  }
  await walk("android-technician/app/src/main");
  files.push(...["app/build.gradle", "build.gradle", "settings.gradle", "gradle.properties"].map(file => "android-technician/" + file));
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    let bytes = await fs.readFile(path.join(root, file));
    if (/\.(kt|java|xml|gradle|properties|js|css|html|txt)$/.test(file)) bytes = Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"));
    hash.update(file).update("\0").update(bytes).update("\0");
  }
  return hash.digest("hex");
}
