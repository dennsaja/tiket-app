import { Pool } from "pg";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS username varchar(50)");
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)");

    const userHash = await bcrypt.hash("12345678", 12);
    const targetAccounts = [
      { username: "uqi", email: "uqi@helpdesk.local", name: "Uqi", role: "agent" },
      { username: "kiky", email: "kiky@helpdesk.local", name: "Kiky", role: "agent" },
      { username: "repan", email: "repan@helpdesk.local", name: "Repan", role: "agent" },
    ];

    for (const acc of targetAccounts) {
      const existing = await client.query(
        "SELECT id FROM users WHERE email = $1 OR username = $2",
        [acc.email, acc.username]
      );
      if (existing.rowCount && existing.rows[0]) {
        await client.query(
          "UPDATE users SET username = $1, email = $2, name = $3, password_hash = $4, role = $5, is_active = true, deleted_at = null, email_verified = COALESCE(email_verified, now()), updated_at = now() WHERE id = $6",
          [acc.username, acc.email, acc.name, userHash, acc.role, existing.rows[0].id]
        );
        console.log(`Updated account: ${acc.username} (${acc.email})`);
      } else {
        await client.query(
          "INSERT INTO users (id, username, email, name, password_hash, role, is_active, email_verified, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, true, now(), now(), now())",
          [randomUUID(), acc.username, acc.email, acc.name, userHash, acc.role]
        );
        console.log(`Created account: ${acc.username} (${acc.email})`);
      }
    }

    await client.query("COMMIT");
    console.log("All accounts created/verified successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Account creation failed:", error.code || error.message);
  process.exitCode = 1;
});
