import fs from "node:fs";
import path from "node:path";

/** Persistent application files belong to the checkout, never a replaceable build. */
export function applicationRoot(): string {
  if (process.env.APP_ROOT) {
    const root = path.resolve(process.env.APP_ROOT);
    if (!fs.existsSync(path.join(root, "package.json"))) throw new Error("APP_ROOT bukan folder sumber aplikasi.");
    return root;
  }
  const workingDirectory = process.cwd();
  let candidate = workingDirectory;
  while (true) {
    if (fs.existsSync(path.join(candidate, "package.json")) && fs.existsSync(path.join(candidate, ".git"))) return candidate;
    const parent = path.dirname(candidate);
    if (parent === candidate) return workingDirectory;
    candidate = parent;
  }
}
