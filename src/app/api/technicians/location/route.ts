import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { technicianLocations, tickets, users, ticketAssignees } from "@/lib/db/schema";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { notificationBus } from "@/lib/notifications/bus";
import { parseCoordinates, resolveCoordinatesAsync } from "@/lib/utils/geo";
import { getMobileUserFromRequest } from "@/lib/auth/mobile";
import { z } from "zod";

const ACTIVE_STATUSES = ["assigned", "accepted", "on_site", "in_progress"] as const;

const locationPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullable().optional(),
  heading: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  battery: z.number().int().min(0).max(100).nullable().optional(),
  activeTicketId: z.string().nullable().optional(),
  deviceTime: z.number().nullable().optional(),
});

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().nonnegative().nullable().optional(),
  heading: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  battery: z.number().int().min(0).max(100).nullable().optional(),
  activeTicketId: z.string().nullable().optional(),
  deviceTime: z.number().nullable().optional(),
  batch: z.array(locationPointSchema).optional(),
});

/** Find the technician's current active ticket (most recently updated) */
async function findActiveTicketId(userId: string): Promise<string | null> {
  const teamRows = await db
    .select({ ticketId: ticketAssignees.ticketId })
    .from(ticketAssignees)
    .where(eq(ticketAssignees.userId, userId))
    .catch(() => [] as { ticketId: string }[]);
  const teamIds = teamRows.map((r) => r.ticketId);

  const [active] = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(
      and(
        isNull(tickets.deletedAt),
        inArray(tickets.status, ACTIVE_STATUSES as any),
        teamIds.length > 0
          ? or(eq(tickets.assigneeId, userId), inArray(tickets.id, teamIds))
          : eq(tickets.assigneeId, userId)
      )
    )
    .orderBy(
      // Prioritise on-site / in-progress work over merely assigned
      sql`CASE ${tickets.status} WHEN 'on_site' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'accepted' THEN 2 ELSE 3 END`,
      desc(tickets.updatedAt)
    )
    .limit(1);

  return active?.id ?? null;
}

// POST /api/technicians/location — technician pushes a GPS ping (single or offline batch)
export async function POST(req: NextRequest) {
  const session = await auth();
  const mobileUser = !session?.user ? await getMobileUserFromRequest(req) : null;
  const currentUser = session?.user || mobileUser;

  if (!currentUser) {
    console.warn(
      `[TECH_LOCATION] 401 Unauthorized - No valid session or Bearer token. Auth header: ${
        req.headers.get("authorization") ? "present" : "missing"
      }`
    );
    return errorResponse("Unauthorized", 401);
  }

  const userRole = (currentUser as any).role;
  if (!["agent", "admin", "noc", "owner"].includes(userRole)) {
    console.warn(`[TECH_LOCATION] 403 Forbidden for role ${userRole} (${currentUser.name})`);
    return errorResponse("Hanya staf teknis yang dapat mengirim lokasi", 403);
  }

  let body: any;
  try { body = await req.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }

  const parsed = locationSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      422
    );
  }

  const userId = currentUser.id!;
  const data = parsed.data;
  const points =
    data.batch && data.batch.length > 0
      ? data.batch
      : data.latitude != null && data.longitude != null
      ? [
          {
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            heading: data.heading,
            speed: data.speed,
            battery: data.battery,
            activeTicketId: data.activeTicketId,
            deviceTime: data.deviceTime,
          },
        ]
      : [];

  if (points.length === 0) {
    return errorResponse("Latitude and longitude required", 422);
  }

  // Sort offline batch chronologically by deviceTime so the latest point is applied last
  const sortedPoints = [...points].sort((a, b) => (a.deviceTime || 0) - (b.deviceTime || 0));
  const latestPoint = sortedPoints[sortedPoints.length - 1];
  const activeTicketId = await findActiveTicketId(userId);
  const now = new Date();

  console.log(
    `[TECH_LOCATION] Ping GPS diterima dari ${currentUser.name} (${currentUser.id}, ${sortedPoints.length} titik)`
  );

  const values = {
    userId,
    latitude: latestPoint.latitude,
    longitude: latestPoint.longitude,
    accuracy: latestPoint.accuracy ?? null,
    heading: latestPoint.heading ?? null,
    speed: latestPoint.speed ?? null,
    battery: latestPoint.battery ?? null,
    isTracking: true,
    activeTicketId,
    updatedAt: now,
  };

  await db
    .insert(technicianLocations)
    .values(values)
    .onConflictDoUpdate({ target: technicianLocations.userId, set: values });

  notificationBus.emitLocation({
    ...values,
    name: currentUser.name || "Teknisi",
    avatarUrl: (currentUser as any).image ?? (currentUser as any).avatarUrl ?? null,
    updatedAt: now.toISOString(),
  });

  return NextResponse.json({
    success: true,
    activeTicketId,
    syncedPoints: sortedPoints.length,
    serverTime: now.toISOString(),
  });
}

// DELETE /api/technicians/location — technician stops sharing location
export async function DELETE(req: NextRequest) {
  const session = await auth();
  const mobileUser = !session?.user ? await getMobileUserFromRequest(req) : null;
  const currentUser = session?.user || mobileUser;

  if (!currentUser) return errorResponse("Unauthorized", 401);

  const userId = currentUser.id!;
  const [row] = await db
    .update(technicianLocations)
    .set({ isTracking: false, updatedAt: new Date() })
    .where(eq(technicianLocations.userId, userId))
    .returning();

  if (row) {
    notificationBus.emitLocation({
      userId,
      name: currentUser.name || "Teknisi",
      avatarUrl: (currentUser as any).image ?? (currentUser as any).avatarUrl ?? null,
      latitude: row.latitude,
      longitude: row.longitude,
      accuracy: row.accuracy,
      heading: row.heading,
      speed: row.speed,
      battery: row.battery,
      isTracking: false,
      activeTicketId: row.activeTicketId,
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  return NextResponse.json({ success: true });
}

// GET /api/technicians/location — monitoring snapshot (NOC / Owner / Admin)
export async function GET() {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (!["noc", "owner", "admin"].includes(userRole)) {
    return errorResponse("Forbidden", 403);
  }

  // All active technicians, with their last known location (if any)
  const techRows = await db
    .select({
      userId: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      phone: users.phone,
      latitude: technicianLocations.latitude,
      longitude: technicianLocations.longitude,
      accuracy: technicianLocations.accuracy,
      heading: technicianLocations.heading,
      speed: technicianLocations.speed,
      battery: technicianLocations.battery,
      isTracking: technicianLocations.isTracking,
      activeTicketId: technicianLocations.activeTicketId,
      updatedAt: technicianLocations.updatedAt,
    })
    .from(users)
    .leftJoin(technicianLocations, eq(technicianLocations.userId, users.id))
    .where(
      and(
        or(eq(users.role, "agent"), eq(technicianLocations.isTracking, true)),
        eq(users.isActive, true),
        isNull(users.deletedAt)
      )
    );

  // Active tickets (to plot customer destinations)
  const ticketRows = await db.query.tickets.findMany({
    where: and(isNull(tickets.deletedAt), inArray(tickets.status, ["open", ...ACTIVE_STATUSES] as any)),
    columns: {
      id: true,
      ticketNumber: true,
      title: true,
      status: true,
      priority: true,
      ticketType: true,
      reporterName: true,
      reporterAddress: true,
      reporterMapUrl: true,
      assigneeId: true,
    },
    with: {
      assignees: { columns: { userId: true, isLead: true } },
    },
    orderBy: [desc(tickets.updatedAt)],
    limit: 200,
  });

  const ticketsWithCoords = await Promise.all(
    ticketRows.map(async (t) => {
      const coords =
        (await resolveCoordinatesAsync(t.reporterMapUrl)) ||
        (await resolveCoordinatesAsync(t.reporterAddress));
      return {
        ...t,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        assigneeIds: Array.from(
          new Set([...(t.assignees?.map((a) => a.userId) ?? []), ...(t.assigneeId ? [t.assigneeId] : [])])
        ),
      };
    })
  );

  return NextResponse.json({
    technicians: techRows.map((r) => ({
      ...r,
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
    })),
    tickets: ticketsWithCoords,
    serverTime: new Date().toISOString(),
  });
}
