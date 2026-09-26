import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { desc, count, and, ilike, eq, gte, lte } from "drizzle-orm";
import { errorResponse, paginatedResponse } from "@/lib/api/helpers";

// GET /api/admin/audit-logs (admin only)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole !== "admin") return errorResponse("Forbidden", 403);

  const searchParams = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(100, parseInt(searchParams.get("perPage") || "25"));
  const offset = (page - 1) * perPage;
  const actorEmail = searchParams.get("actorEmail");
  const action = searchParams.get("action");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const conditions: any[] = [];
  if (actorEmail) conditions.push(ilike(auditLogs.actorEmail, `%${actorEmail}%`));
  if (action) conditions.push(eq(auditLogs.action, action as any));
  if (dateFrom) conditions.push(gte(auditLogs.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(auditLogs.createdAt, new Date(dateTo)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, [{ total }]] = await Promise.all([
    db.query.auditLogs.findMany({
      where,
      with: {
        actor: { columns: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: [desc(auditLogs.createdAt)],
      limit: perPage,
      offset,
    }),
    db.select({ total: count() }).from(auditLogs).where(where),
  ]);

  return paginatedResponse(logs, Number(total), page, perPage);
}
