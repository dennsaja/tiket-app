import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets, ticketAssignees, users } from "@/lib/db/schema";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth/get-user";
import { parseCoordinates, resolveCoordinatesAsync } from "@/lib/utils/geo";

export async function GET(req: NextRequest) {
  const currentUser = await getAuthUser(req);

  if (!currentUser) {
    console.warn(
      `[MOBILE_TICKETS] 401 Unauthorized - No valid session or Bearer token. Auth header: ${
        req.headers.get("authorization") ? "present" : "missing"
      }`
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["agent", "noc", "admin", "owner"].includes(currentUser.role)) {
    return NextResponse.json({ error: "Akses khusus staf helpdesk" }, { status: 403 });
  }

  const userId = currentUser.id!;
  const userRole = (currentUser as any).role;
  console.log(
    `[MOBILE_TICKETS] Berhasil autentikasi: ${currentUser.name} (${userId}, role: ${userRole}) memuat tiket`
  );

  // Find all tickets where technician is primary assignee OR in ticketAssignees team
  const myAssignments = await db
    .select({ ticketId: ticketAssignees.ticketId, isLead: ticketAssignees.isLead })
    .from(ticketAssignees)
    .where(eq(ticketAssignees.userId, userId))
    .catch(() => [] as { ticketId: string; isLead: boolean }[]);

  const assignedMap = new Map(myAssignments.map((a) => [a.ticketId, a.isLead]));
  const assignedIds = Array.from(assignedMap.keys());

  const conditions: any[] = [isNull(tickets.deletedAt)];

  if (userRole === "agent") {
    if (assignedIds.length > 0) {
      conditions.push(or(eq(tickets.assigneeId, userId), inArray(tickets.id, assignedIds)));
    } else {
      conditions.push(eq(tickets.assigneeId, userId));
    }
  }

  const ticketRows = await db.query.tickets.findMany({
    where: and(...conditions),
    columns: {
      id: true,
      ticketNumber: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      ticketType: true,
      reporterName: true,
      reporterPhone: true,
      reporterAddress: true,
      reporterMapUrl: true,
      assigneeId: true,
      specData: true,
      slaFirstResponseDue: true,
      slaResolutionDue: true,
      resolution: true,
      resolvedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      category: { columns: { name: true } }, subcategory: { columns: { name: true } }, department: { columns: { name: true } }, requester: { columns: { name: true } },
      attachments: { columns: { id: true, originalName: true, mimeType: true, size: true }, where: (file, { and, eq, isNull }) => and(isNull(file.messageId), eq(file.isDeleted, false)) },
      assignee: {
        columns: { id: true, name: true, phone: true },
      },
      assignees: {
        columns: { userId: true, isLead: true },
        with: {
          user: { columns: { id: true, name: true, phone: true } },
        },
      },
      statusHistory: {
        columns: {
          id: true,
          fromStatus: true,
          toStatus: true,
          reason: true,
          createdAt: true,
        },
        orderBy: (sh, { asc }) => [asc(sh.createdAt)],
      },
      workReports: {
        columns: {
          id: true,
          summary: true,
          actionTaken: true,
          materialsUsed: true,
          finalResult: true,
          beforePhotos: true,
          afterPhotos: true,
          createdAt: true,
        },
        orderBy: (wr, { desc: d }) => [d(wr.createdAt)],
        limit: 1,
      },
    },
    orderBy: [
      sql`CASE ${tickets.status}
        WHEN 'on_site' THEN 0
        WHEN 'in_progress' THEN 1
        WHEN 'accepted' THEN 2
        WHEN 'assigned' THEN 3
        WHEN 'open' THEN 4
        WHEN 'pending' THEN 5
        WHEN 'resolved' THEN 6
        ELSE 7 END`,
      desc(tickets.updatedAt),
    ],
    limit: 120,
  });

  const formatted = await Promise.all(
    ticketRows.map(async (t) => {
      const coords =
        (await resolveCoordinatesAsync(t.reporterMapUrl)) ||
        (await resolveCoordinatesAsync(t.reporterAddress));
      const isLead = assignedMap.get(t.id) ?? (t.assigneeId === userId);
      const latestReport = t.workReports?.[0] ?? null;

      return {
        id: t.id,
        ticketNumber: t.ticketNumber,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        ticketType: t.ticketType,
        reporterName: t.reporterName,
        reporterPhone: t.reporterPhone,
        reporterAddress: t.reporterAddress,
        reporterMapUrl: t.reporterMapUrl,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        isLead,
        specData: t.specData ?? null,
        category: t.category, subcategory: t.subcategory, department: t.department, requester: t.requester, attachments: t.attachments,
        slaFirstResponseDue: t.slaFirstResponseDue ? t.slaFirstResponseDue.toISOString() : null,
        slaResolutionDue: t.slaResolutionDue ? t.slaResolutionDue.toISOString() : null,
        resolution: t.resolution ?? null,
        resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
        statusHistory: (t.statusHistory || []).map((sh) => ({
          id: sh.id,
          fromStatus: sh.fromStatus,
          toStatus: sh.toStatus,
          reason: sh.reason,
          createdAt: sh.createdAt.toISOString(),
        })),
        latestReport: latestReport
          ? {
              id: latestReport.id,
              summary: latestReport.summary,
              actionTaken: latestReport.actionTaken,
              materialsUsed: latestReport.materialsUsed,
              finalResult: latestReport.finalResult,
              beforePhotos: latestReport.beforePhotos || [],
              afterPhotos: latestReport.afterPhotos || [],
              createdAt: latestReport.createdAt.toISOString(),
            }
          : null,
        assignees:
          t.assignees?.map((a) => ({
            id: a.user?.id,
            name: a.user?.name,
            phone: a.user?.phone,
            isLead: a.isLead,
          })) || [],
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    })
  );

  return NextResponse.json({
    success: true,
    tickets: formatted,
    total: formatted.length,
    serverTime: new Date().toISOString(),
  });
}
