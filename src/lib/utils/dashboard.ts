/** Calendar dates are kept in Jakarta time regardless of the server timezone. */
const DAY = 86_400_000;
export const dashboardPeriods = [7, 14, 30] as const;
export type DashboardPeriod = (typeof dashboardPeriods)[number];

export function getDashboardPeriod(value: string | string[] | undefined): DashboardPeriod {
  const days = Number(Array.isArray(value) ? value[0] : value);
  return dashboardPeriods.includes(days as DashboardPeriod) ? days as DashboardPeriod : 7;
}

export function jakartaDateKey(date: Date): string {
  return new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

export function dashboardDateRange(days: DashboardPeriod, now = new Date()) {
  const endKey = jakartaDateKey(now);
  const today = new Date(endKey + "T00:00:00+07:00");
  const start = new Date(today.getTime() - (days - 1) * DAY);
  return {
    start,
    end: new Date(today.getTime() + DAY),
    dates: Array.from({ length: days }, (_, index) => jakartaDateKey(new Date(start.getTime() + index * DAY))),
  };
}

export function summarizeStatuses(rows: { status: string; count: number }[]) {
  const counts = Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
  const open = (counts.open || 0) + (counts.reopened || 0);
  const inProgress = ["assigned", "accepted", "on_site", "in_progress"].reduce((sum, key) => sum + (counts[key] || 0), 0);
  const pending = ["pending", "waiting_for_user", "waiting_for_third_party"].reduce((sum, key) => sum + (counts[key] || 0), 0);
  const resolved = (counts.resolved || 0) + (counts.closed || 0);
  const cancelled = counts.cancelled || 0;
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return { total, open, inProgress, pending, resolved, cancelled, resolutionRate: total ? Math.round(resolved / total * 100) : 0 };
}
