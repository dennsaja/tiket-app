import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

const frontendOnly = process.env.APP_SERVICE === "frontend";
if (!connectionString && !frontendOnly) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Connection pool — tune for LXC environment
const pool: Pool = frontendOnly ? new Proxy({} as Pool, { get() { throw new Error("Database access is forbidden in the frontend service"); } }) : new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = frontendOnly ? new Proxy({} as ReturnType<typeof createDatabase>, { get() { throw new Error("Database access is forbidden in the frontend service"); } }) : createDatabase();
function createDatabase() { return drizzle(pool, { schema }); }

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    return true;
  } catch {
    return false;
  }
}

export { pool };
