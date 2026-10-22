import { describe, it, expect, vi } from "vitest";
import { prepareWorkspace } from "@/lib/production/prepare-workspace";
import { TICKET_TAXONOMY, categoryTicketType } from "@/lib/tickets/taxonomy";
function database(applied = false, failDelete = false) {
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith("SELECT id FROM production_cleanup_archive")) return { rows: applied ? [{ id: "previous" }] : [] };
    if (sql === "SELECT * FROM sla_policies") return { rows: [{ id: "old-policy" }] };
    if (sql.startsWith("SELECT id, sla_policy_id")) return { rows: [{ id: "ticket-1", sla_policy_id: "old-policy" }] };
    if (failDelete && sql === "DELETE FROM sla_policies") throw new Error("database unavailable");
    return { rows: [] };
  });
  const release = vi.fn(); return { query, release, pool: { connect: async () => ({ query, release }) } };
}
describe("workspace preparation", () => {
  it("archives policies and deadlines before clearing SLA and commits classification together", async () => {
    const db = database(); const result = await prepareWorkspace(db.pool as any);
    const calls = db.query.mock.calls.map(call => call[0]);
    expect(result).toMatchObject({ policiesRemoved: 1, deadlinesCleared: 1, serviceCategories: 5 });
    expect(calls.findIndex(sql => sql.startsWith("INSERT INTO production_cleanup_archive"))).toBeLessThan(calls.indexOf("DELETE FROM sla_policies"));
    expect(calls.filter(sql => sql.startsWith("INSERT INTO subcategories"))).toHaveLength(26);
    expect(calls.at(-1)).toBe("COMMIT"); expect(db.release).toHaveBeenCalledOnce();
  });
  it("preserves all later NOC policies on subsequent updates", async () => {
    const db = database(true); expect(await prepareWorkspace(db.pool as any)).toEqual({ alreadyApplied: true });
    expect(db.query.mock.calls.some(([sql]) => sql.startsWith("DELETE") || sql.startsWith("UPDATE tickets"))).toBe(false);
  });
  it("rolls back the entire operation if removing SLA fails", async () => {
    const db = database(false, true); await expect(prepareWorkspace(db.pool as any)).rejects.toThrow("database unavailable");
    expect(db.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK"); expect(db.release).toHaveBeenCalledOnce();
  });
  it("covers the five supported ticket types without binding custom categories", () => {
    expect(new Set(TICKET_TAXONOMY.map(item => item.type)).size).toBe(5);
    for (const item of TICKET_TAXONOMY) expect(categoryTicketType({ id: "service-" + item.type })).toBe(item.type);
    expect(categoryTicketType({ id: "custom", name: "Custom" })).toBeNull();
  });
});
