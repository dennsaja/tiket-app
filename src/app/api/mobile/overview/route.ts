import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const actor = await getAuthUser(req);
  if (!actor || !["owner", "admin", "noc"].includes(actor.role)) return new NextResponse(null, { status: 403 });
  const [stats, performance, priority, daily] = await Promise.all([
    db.execute(sql`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE status NOT IN ('resolved','closed','cancelled'))::int AS active,
      count(*) FILTER (WHERE status IN ('accepted','on_site','in_progress'))::int AS working,
      count(*) FILTER (WHERE status IN ('resolved','closed'))::int AS completed,
      count(*) FILTER (WHERE status NOT IN ('resolved','closed','cancelled') AND sla_resolution_due < now())::int AS overdue
      FROM tickets WHERE deleted_at IS NULL`),
    db.execute(sql`SELECT u.id, u.name, count(DISTINCT t.id)::int AS assigned,
      count(DISTINCT t.id) FILTER (WHERE t.status IN ('resolved','closed'))::int AS completed,
      count(DISTINCT t.id) FILTER (WHERE t.status NOT IN ('resolved','closed','cancelled'))::int AS active
      FROM users u LEFT JOIN (SELECT ticket_id, user_id FROM ticket_assignees UNION SELECT id, assignee_id FROM tickets WHERE assignee_id IS NOT NULL) a ON a.user_id = u.id
      LEFT JOIN tickets t ON t.id = a.ticket_id AND t.deleted_at IS NULL AND t.created_at >= now() - interval '30 days'
      WHERE u.role = 'agent' AND u.is_active = true AND u.deleted_at IS NULL GROUP BY u.id,u.name ORDER BY completed DESC, active DESC, u.name LIMIT 50`),
    db.execute(sql`SELECT priority, count(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND status NOT IN ('resolved','closed','cancelled') GROUP BY priority`),
    db.execute(sql`SELECT to_char(created_at + interval '7 hours','YYYY-MM-DD') AS date, count(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND created_at >= now() - interval '8 days' GROUP BY 1 ORDER BY 1`),
  ]);
  return NextResponse.json({ role: actor.role, stats: stats.rows[0], performance: performance.rows, priorities: priority.rows, daily: daily.rows, updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
}
