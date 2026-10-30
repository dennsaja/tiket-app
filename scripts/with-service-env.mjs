import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
const [file, command, ...args] = process.argv.slice(2);
if (!file || !command) throw new Error("Usage: node scripts/with-service-env.mjs ENV_FILE EXECUTABLE [ARGS]");
const text = readFileSync(file, "utf8");
const values = dotenv.parse(text);
for (const line of text.split(/\r?\n/)) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(".*")$/);
  if (match) { try { values[match[1]] = JSON.parse(match[2]); } catch {} }
}
const result = spawnSync(command, args, { stdio: "inherit", env: { ...process.env, ...values }, shell: false });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
