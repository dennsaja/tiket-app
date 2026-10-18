import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  tickets,
  ticketStatusHistory,
  ticketWorkReports,
  ticketMessages,
  auditLogs,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getMobileUserFromRequest } from "@/lib/auth/mobile";
import { notifyStatusChange } from "@/lib/notifications";
import { notificationBus } from "@/lib/notifications/bus";
import { z } from "zod";

const updateSchema = z.object({
  status: z
    .enum([
      "open",
      "assigned",
      "accepted",
      "on_site",
      "in_progress",
      "resolved",
      "pending",
      "waiting_for_user",
      "waiting_for_third_party",
    ])
    .optional(),
  notes: z.string().optional(),
  resolutionSummary: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  distanceMeters: z.number().nullable().optional(),
  updateCustomerCoordinates: z.boolean().optional(),
  odpCoordinateType: z.string().optional(), // "customer" or "odp"
});

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const ticketId = params.id;

  const session = await auth();
  const mobileUser = !session?.user ? await getMobileUserFromRequest(req) : null;
  const currentUser = session?.user || mobileUser;

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = currentUser.id!;
  const userName = currentUser.name || "Teknisi";

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Format data tidak valid: " + parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 422 }
    );
  }

  const existingTicket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });

  if (!existingTicket) {
    return NextResponse.json({ error: "Tiket tidak ditemukan" }, { status: 404 });
  }

  const {
    status: requestedStatus,
    notes,
    resolutionSummary,
    latitude,
    longitude,
    distanceMeters,
    updateCustomerCoordinates,
    odpCoordinateType,
  } = parsed.data;

  const newStatus = requestedStatus || existingTicket.status;
  const oldStatus = existingTicket.status;
  const now = new Date();

  const updatePayload: any = {
    status: newStatus,
    updatedAt: now,
  };

  // FR-11: Technician records/updates customer or ODP coordinates from field
  if (updateCustomerCoordinates && latitude != null && longitude != null) {
    const gmapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const currentSpec =
      existingTicket.specData && typeof existingTicket.specData === "object"
        ? { ...(existingTicket.specData as Record<string, any>) }
        : {};

    if (odpCoordinateType === "odp") {
      currentSpec.odpCoordinates = `${latitude}, ${longitude}`;
      currentSpec.odpMapUrl = gmapsUrl;
      currentSpec.odpUpdatedBy = userName;
      currentSpec.odpUpdatedAt = now.toISOString();
    } else {
      updatePayload.reporterMapUrl = gmapsUrl;
      currentSpec.customerCoordinates = `${latitude}, ${longitude}`;
      currentSpec.customerUpdatedBy = userName;
      currentSpec.customerUpdatedAt = now.toISOString();
    }
    updatePayload.specData = currentSpec;

    await db.insert(ticketMessages).values({
      ticketId,
      authorId: userId,
      type: "internal_note",
      content: `[Mobile GPS] Teknisi ${userName} memperbarui titik koordinat ${
        odpCoordinateType === "odp" ? "ODP / Tiang" : "Lokasi Pelanggan"
      }: ${latitude}, ${longitude}\nLink Maps: ${gmapsUrl}`,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (
    (newStatus === "accepted" || newStatus === "in_progress" || newStatus === "on_site") &&
    !existingTicket.assigneeId
  ) {
    updatePayload.assigneeId = userId;
  }

  if (newStatus === "resolved") {
    updatePayload.resolvedAt = now;
  }

  await db.update(tickets).set(updatePayload).where(eq(tickets.id, ticketId));

  const gpsTag =
    latitude != null && longitude != null && (latitude !== 0 || longitude !== 0)
      ? ` [GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}${
          distanceMeters != null ? ` • Jarak: ${Math.round(distanceMeters)}m` : ""
        }]`
      : "";

  // Log status change history if changed
  if (oldStatus !== newStatus) {
    await db.insert(ticketStatusHistory).values({
      ticketId,
      fromStatus: oldStatus as any,
      toStatus: newStatus as any,
      changedById: userId,
      reason: `${notes || `Status diubah oleh teknisi (${userName})`}${gpsTag}`,
      createdAt: now,
    });

    await db.insert(ticketMessages).values({
      ticketId,
      authorId: userId,
      type: "internal_note",
      content: `[Mobile] Status tiket diperbarui menjadi: ${newStatus.toUpperCase()}${gpsTag}${
        notes ? `\nCatatan: ${notes}` : ""
      }`,
      createdAt: now,
      updatedAt: now,
    });

    await notifyStatusChange(
      ticketId,
      existingTicket.ticketNumber,
      existingTicket.title,
      newStatus,
      existingTicket.requesterId,
      userName,
      userId
    ).catch(() => {});
  }

  // If resolved, record work report
  if (newStatus === "resolved" && (resolutionSummary || notes)) {
    await db.insert(ticketWorkReports).values({
      ticketId,
      technicianId: userId,
      summary: notes || "Pekerjaan lapangan selesai.",
      actionTaken: resolutionSummary || notes || "Perbaikan dan verifikasi teknis di lokasi pelanggan.",
      finalResult: resolutionSummary || "Tuntas",
      createdAt: now,
      updatedAt: now,
    });
  }

  notificationBus.emitSystemEvent({
    action: "ticket_updated",
    ticketId,
    ticketNumber: existingTicket.ticketNumber,
    status: newStatus,
    actorId: userId,
    actorName: userName,
    timestamp: now.toISOString(),
  });

  return NextResponse.json({
    success: true,
    ticket: {
      id: ticketId,
      status: newStatus,
      reporterMapUrl: updatePayload.reporterMapUrl ?? existingTicket.reporterMapUrl,
      latitude: updateCustomerCoordinates && odpCoordinateType !== "odp" ? latitude : undefined,
      longitude: updateCustomerCoordinates && odpCoordinateType !== "odp" ? longitude : undefined,
      updatedAt: now.toISOString(),
    },
  });
}
