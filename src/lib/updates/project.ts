import fs from "node:fs";
import path from "node:path";

/** Standalone server.js changes cwd; Git updates must operate on the source checkout. */
export function updateProjectDirectory(start = process.cwd()): string {
  if (process.env.APP_ROOT) {
    const configured = path.resolve(process.env.APP_ROOT);
    if (!fs.existsSync(path.join(configured, "package.json")) || !fs.existsSync(path.join(configured, ".git"))) {
      throw new Error("APP_ROOT harus menunjuk checkout aplikasi yang memiliki package.json dan .git.");
    }
    return configured;
  }
  let current = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(current, "package.json")) && fs.existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) throw new Error("Checkout Git aplikasi tidak ditemukan. Atur APP_ROOT ke folder sumber aplikasi.");
    current = parent;
  }
}
