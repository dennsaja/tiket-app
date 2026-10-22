import { Pool } from "pg";
import dotenv from "dotenv";
import { prepareWorkspace } from "../src/lib/production/prepare-workspace";
dotenv.config({ path: ".env.local", quiet: true }); dotenv.config({ path: ".env", quiet: true });
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 });
  try { console.log(JSON.stringify(await prepareWorkspace(pool))); } finally { await pool.end(); }
}
main().catch(error => { console.error("Persiapan workspace gagal:", error.code || error.message); process.exitCode = 1; });
