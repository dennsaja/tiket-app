import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { cleanupDemoTickets, DEMO_TICKET_SIGNATURES } from "@/lib/production/demo-tickets";

function database(options: { empty?: boolean; failArchive?: boolean } = {}) {
  const candidate = { id: "legacy-demo", ticket_number: 7, title: DEMO_TICKET_SIGNATURES[0][0] };
  const query = vi.fn(async (sql: string, _parameters?: unknown[]) => {
    if (sql.includes("SELECT t.* FROM tickets")) return { rows: options.empty ? [] : [candidate] };
    if (sql.includes("information_schema.table_constraints")) return { rows: [{ table_name: "ticket_messages", column_name: "ticket_id" }, { table_name: "attachments", column_name: "ticket_id" }] };
    if (sql.startsWith("INSERT INTO production_cleanup_archive") && options.failArchive) throw new Error("Archive unavailable");
    if (sql.startsWith("DELETE FROM tickets")) return { rows: [{ id: candidate.id }], rowCount: 1 };
    if (sql.startsWith("SELECT *")) return { rows: [{ id: "related-demo-row" }] };
    return { rows: [] };
  });
  const release = vi.fn();
  return { pool: { connect: async () => ({ query, release }) } as unknown as Pool, query, release };
}

describe("legacy demo cleanup", () => {
  it("defaults to inspection and requires the exact seed owner, title and description", async () => {
    const { pool, query, release } = database();
    expect(await cleanupDemoTickets(pool)).toMatchObject({ matched: 1, deleted: 0 });
    const selection = query.mock.calls.find(([sql]) => sql.includes("SELECT t.* FROM tickets"))!;
    expect(selection[0]).toContain("lower(u.email) = 'user@helpdesk.local'");
    expect(selection[0]).toContain("t.title = signature->>0 AND t.description = signature->>1");
    expect(JSON.parse(selection[1]?.[0] as string)).toEqual(DEMO_TICKET_SIGNATURES);
    expect(query.mock.calls.some(([sql]) => sql.startsWith("DELETE"))).toBe(false);
    expect(query).toHaveBeenCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalledOnce();
  });
  it("archives related data before deleting only the matched IDs in one transaction", async () => {
    const { pool, query } = database();
    expect(await cleanupDemoTickets(pool, true)).toMatchObject({ matched: 1, deleted: 1, archiveId: expect.any(String) });
    const calls = query.mock.calls;
    const archive = calls.findIndex(([sql]) => sql.startsWith("INSERT INTO production_cleanup_archive"));
    const deletion = calls.findIndex(([sql]) => sql.startsWith("DELETE FROM tickets"));
    expect(archive).toBeGreaterThan(0);
    expect(deletion).toBeGreaterThan(archive);
    expect(calls[deletion][1]).toEqual([["legacy-demo"]]);
    const snapshot = JSON.parse(calls[archive][1]?.[2] as string);
    expect(snapshot.related.ticket_messages).toHaveLength(1);
    expect(snapshot.related.attachments).toHaveLength(1);
    expect(calls.some(([sql]) => sql.includes("message_id IN (SELECT id FROM ticket_messages"))).toBe(true);
    expect(calls.at(-1)?.[0]).toBe("COMMIT");
  });
  it("rolls back without deleting if the recovery archive cannot be saved", async () => {
    const { pool, query, release } = database({ failArchive: true });
    await expect(cleanupDemoTickets(pool, true)).rejects.toThrow("Archive unavailable");
    expect(query.mock.calls.some(([sql]) => sql.startsWith("DELETE"))).toBe(false);
    expect(query).toHaveBeenCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalledOnce();
  });
  it("can run repeatedly without touching other tickets when no seed tickets match", async () => {
    const { pool, query } = database({ empty: true });
    expect(await cleanupDemoTickets(pool, true)).toMatchObject({ matched: 0, deleted: 0 });
    expect(query.mock.calls.some(([sql]) => /^(DELETE|INSERT|CREATE)/.test(sql))).toBe(false);
  });
});
