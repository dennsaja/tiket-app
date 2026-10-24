import { Pool } from "pg";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { TICKET_TAXONOMY } from "../src/lib/tickets/taxonomy";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const RESET = "user-requested-production-reset-2026-10-24-v1";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [RESET]);
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username varchar(50)');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)');
    await client.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS ticket_type varchar(50)');
    await client.query(`CREATE TABLE IF NOT EXISTS production_cleanup_archive (
      id text PRIMARY KEY, reason text NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
    if (!(await client.query('SELECT id FROM production_cleanup_archive WHERE reason = $1', [RESET])).rowCount) {
      const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'production_cleanup_archive' ORDER BY tablename")).rows.map(row => row.tablename as string);
      if (tables.some(name => !/^[a-z_]+$/.test(name))) throw new Error("Unexpected table name");
      await client.query(`LOCK TABLE ${tables.map(name => `"${name}"`).join(', ')} IN EXCLUSIVE MODE`);
      const retained = (await client.query("SELECT id FROM users WHERE role IN ('noc','admin','owner') AND is_active = true AND deleted_at IS NULL")).rows;
      if (!retained.length) throw new Error("Reset dibatalkan: tidak ada akun pengelola aktif");
      const snapshot: Record<string, unknown[]> = {};
      for (const table of tables) snapshot[table] = (await client.query(`SELECT * FROM "${table}"`)).rows;
      const archiveId = randomUUID();
      await client.query('INSERT INTO production_cleanup_archive (id,reason,snapshot) VALUES ($1,$2,$3::jsonb)', [archiveId, RESET, JSON.stringify(snapshot)]);
      await client.query('DELETE FROM tickets');
      await client.query('DELETE FROM attachments');
      await client.query('DELETE FROM notifications');
      await client.query('DELETE FROM technician_locations');
      await client.query('DELETE FROM audit_logs');
      await client.query("DELETE FROM kb_articles WHERE author_id IN (SELECT id FROM users WHERE role NOT IN ('noc','admin','owner'))");
      const deleted = await client.query("DELETE FROM users WHERE role NOT IN ('noc','admin','owner')");
      await client.query("DELETE FROM system_settings WHERE key LIKE 'work_report:%' OR key LIKE 'android_config_receipt:%'");
      for (const item of TICKET_TAXONOMY) await client.query('UPDATE categories SET ticket_type = $1 WHERE id = $2 OR name = $3', [item.type, `service-${item.type}`, item.name]);
      console.log(JSON.stringify({ archiveId, ticketsRemoved: snapshot.tickets?.length || 0, usersRemoved: deleted.rowCount }));
    } else console.log('Reset already applied; new tickets and users are preserved.');
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch(error => { console.error('Production preparation failed:', error.code || error.message); process.exitCode = 1; });
