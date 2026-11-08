import { cp, access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// A single-origin standalone server must carry its own public files and chunks.
const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const server = path.join(standalone, "server.js");
await access(server);
await cp(new URL("./load-runtime-env.cjs", import.meta.url), path.join(standalone, "load-runtime-env.cjs"));
// Existing systemd installations invoke this entry directly, bypassing npm start.
const bootstrap = "require('./load-runtime-env.cjs')(__dirname);\n";
const source = await readFile(server, "utf8");
if (!source.startsWith(bootstrap)) await writeFile(server, bootstrap + source);
for (const [source, destination] of [["public", ".next/standalone/public"], [".next/static", ".next/standalone/.next/static"]]) {
  await cp(path.join(root, source), path.join(root, destination), { recursive: true, force: true });
}
console.log("Standalone siap: halaman, API, aset publik, dan unduhan APK satu origin.");
