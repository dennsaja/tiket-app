import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { TICKET_TAXONOMY } from "../tickets/taxonomy";

const RESET = "helpdesk-sla-reset-2026-10-v1";
/** Runs once: later updates must preserve SLA policies subsequently created by NOC. */
export async function prepareWorkspace(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [RESET]);
    await client.query(`CREATE TABLE IF NOT EXISTS production_cleanup_archive (
      id text PRIMARY KEY, reason text NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
    const applied = await client.query("SELECT id FROM production_cleanup_archive WHERE reason = $1", [RESET]);
    if (applied.rows.length) { await client.query("COMMIT"); return { alreadyApplied: true }; }
    await client.query("LOCK TABLE sla_policies, tickets, sla_events IN SHARE ROW EXCLUSIVE MODE");
    const policies = (await client.query("SELECT * FROM sla_policies")).rows;
    const deadlines = (await client.query(`SELECT id, sla_policy_id, sla_first_response_due, sla_resolution_due, sla_first_response_at, sla_resolved_at
      FROM tickets WHERE sla_policy_id IS NOT NULL OR sla_first_response_due IS NOT NULL OR sla_resolution_due IS NOT NULL OR sla_first_response_at IS NOT NULL OR sla_resolved_at IS NOT NULL`)).rows;
    const archiveId = randomUUID();
    const events = (await client.query("SELECT * FROM sla_events")).rows;
    await client.query("INSERT INTO production_cleanup_archive (id, reason, snapshot) VALUES ($1,$2,$3::jsonb)", [archiveId, RESET, JSON.stringify({ policies, tickets: deadlines, events })]);
    await client.query("UPDATE tickets SET sla_policy_id = NULL, sla_first_response_due = NULL, sla_resolution_due = NULL, sla_first_response_at = NULL, sla_resolved_at = NULL WHERE id = ANY($1::text[])", [deadlines.map(row => row.id)]);
    await client.query("DELETE FROM sla_events");
    await client.query("DELETE FROM sla_policies");
    for (const item of TICKET_TAXONOMY) {
      const categoryId = `service-${item.type}`;
      await client.query("INSERT INTO categories (id,name,description) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING", [categoryId, item.name, "Klasifikasi pekerjaan " + item.name]);
      for (const [index, name] of item.items.entries()) {
        await client.query("INSERT INTO subcategories (id,name,category_id) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING", [`${categoryId}-${index + 1}`, name, categoryId]);
      }
    }
    await client.query("COMMIT");
    return { alreadyApplied: false, policiesRemoved: policies.length, deadlinesCleared: deadlines.length, archiveId, serviceCategories: TICKET_TAXONOMY.length };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
