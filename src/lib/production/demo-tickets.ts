import type { Pool } from "pg";
import { randomUUID } from "node:crypto";

// Exact signatures from the original seed; genuine tickets with a similar title do not match.
export const DEMO_TICKET_SIGNATURES = [
  ["Cannot connect to VPN after recent update", "After the latest Windows update on my laptop, I can no longer connect to the company VPN. I get error code 619. I have tried restarting the VPN client and the computer but the issue persists."],
  ["Printer not printing in color", "The office printer on the 3rd floor is not printing in color anymore. Only printing in black and white. We need this fixed urgently for a presentation tomorrow."],
  ["Invoice discrepancy for December", "We received an invoice for December that doesn't match the agreed-upon pricing. The invoice shows $1,500 but our contract says $1,200. Please review and correct."],
  ["Request for additional software license", "We need an additional Adobe Creative Suite license for our new marketing team member starting next Monday. Please provide the license key."],
  ["System outage - production database unreachable", "CRITICAL: The production database is completely unreachable since 14:30 UTC. All production services are down. Immediate assistance required."],
] as const;

export async function cleanupDemoTickets(pool: Pool, apply = false) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('helpdesk-demo-cleanup-v1'))");
    const { rows: candidates } = await client.query(`
      SELECT t.* FROM tickets t JOIN users u ON u.id = t.requester_id
      WHERE lower(u.email) = 'user@helpdesk.local' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements($1::jsonb) signature
        WHERE t.title = signature->>0 AND t.description = signature->>1
      ) FOR UPDATE OF t`, [JSON.stringify(DEMO_TICKET_SIGNATURES)]);
    if (!apply || candidates.length === 0) {
      await client.query("ROLLBACK");
      return { matched: candidates.length, deleted: 0, tickets: candidates.map(t => ({ id: t.id, number: t.ticket_number, title: t.title })) };
    }
    const ids = candidates.map(t => t.id);
    const related: Record<string, unknown[]> = {};
    const { rows: references } = await client.query(`
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.constraint_schema = kcu.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'tickets' AND ccu.column_name = 'id' AND tc.table_schema = 'public'`);
    for (const ref of references) {
      if (!/^[a-z_]+$/.test(ref.table_name) || !/^[a-z_]+$/.test(ref.column_name)) throw new Error("Unexpected relation identifier");
      related[ref.table_name] = (await client.query(`SELECT * FROM "${ref.table_name}" WHERE "${ref.column_name}" = ANY($1::text[])`, [ids])).rows;
    }
    if (related.attachments) related.attachments = (await client.query("SELECT * FROM attachments WHERE ticket_id = ANY($1::text[]) OR message_id IN (SELECT id FROM ticket_messages WHERE ticket_id = ANY($1::text[]))", [ids])).rows;
    await client.query(`CREATE TABLE IF NOT EXISTS production_cleanup_archive (
      id text PRIMARY KEY, reason text NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
    const archiveId = randomUUID();
    await client.query("INSERT INTO production_cleanup_archive (id,reason,snapshot) VALUES ($1,$2,$3::jsonb)", [archiveId, "Remove exact legacy seed demo tickets", JSON.stringify({ tickets: candidates, related })]);
    const deleted = await client.query("DELETE FROM tickets WHERE id = ANY($1::text[]) RETURNING id", [ids]);
    await client.query("COMMIT");
    return { matched: candidates.length, deleted: deleted.rowCount, archiveId };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
