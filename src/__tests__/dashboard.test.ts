import { describe, expect, it } from "vitest";
import { dashboardDateRange, getDashboardPeriod, jakartaDateKey, summarizeStatuses } from "@/lib/utils/dashboard";

describe("Dashboard date filters", () => {
  it("only accepts supported periods", () => {
    expect(getDashboardPeriod("30")).toBe(30);
    expect(getDashboardPeriod(["14", "30"])).toBe(14);
    for (const value of [undefined, "0", "-7", "all", "999"]) expect(getDashboardPeriod(value)).toBe(7);
  });
  it("includes today and six previous Jakarta calendar days across a month boundary", () => {
    const range = dashboardDateRange(7, new Date("2026-10-31T18:00:00Z"));
    expect(range.start.toISOString()).toBe("2026-10-25T17:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-11-01T17:00:00.000Z");
    expect(range.dates).toHaveLength(7);
    expect(range.dates[0]).toBe("2026-10-26");
    expect(range.dates[6]).toBe("2026-11-01");
  });
  it("switches calendar dates at midnight WIB, independently of the host timezone", () => {
    expect(jakartaDateKey(new Date("2026-10-21T16:59:59Z"))).toBe("2026-10-21");
    expect(jakartaDateKey(new Date("2026-10-21T17:00:00Z"))).toBe("2026-10-22");
  });
  it("creates exactly thirty dates across a year boundary", () => {
    const range = dashboardDateRange(30, new Date("2027-01-02T10:00:00Z"));
    expect(range.dates).toHaveLength(30);
    expect(new Set(range.dates).size).toBe(30);
    expect(range.dates[0]).toBe("2026-12-04");
    expect(range.dates[29]).toBe("2027-01-02");
  });
});
describe("Dashboard status distribution", () => {
  it("accounts for every field technician and waiting status without losing tickets", () => {
    const rows = ["open", "reopened", "assigned", "accepted", "on_site", "in_progress", "pending", "waiting_for_user", "waiting_for_third_party", "resolved", "closed", "cancelled"].map((status) => ({ status, count: 2 }));
    const stats = summarizeStatuses(rows);
    expect(stats).toEqual({ total: 24, open: 4, inProgress: 8, pending: 6, resolved: 4, cancelled: 2, resolutionRate: 17 });
    expect(stats.open + stats.inProgress + stats.pending + stats.resolved + stats.cancelled).toBe(stats.total);
  });
  it("handles empty data without reporting a fabricated completion percentage", () => {
    expect(summarizeStatuses([])).toEqual({ total: 0, open: 0, inProgress: 0, pending: 0, resolved: 0, cancelled: 0, resolutionRate: 0 });
  });
});
