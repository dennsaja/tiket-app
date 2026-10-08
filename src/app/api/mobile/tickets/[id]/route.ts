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
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum([
    "open",
    "assigned",
    "accepted",
    "on_site",
    "in_progress",
    "resolved",
    "pending",
  ]),
  notes: z.string().optional(),
  resolutionSummary: z.string().optional(),
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

  const { status: newStatus, notes, resolutionSummary } = parsed.data;
  const oldStatus = existingTicket.status;
  const now = new Date();

  // Prepare updates
  const updatePayload: any = {
    status: newStatus,
    updatedAt: now,
  };

  if (newStatus === "resolved") {
    updatePayload.resolvedAt = now;
  }

  await db.update(tickets).set(updatePayload).where(eq(tickets.id, ticketId));

  // Log status change history if changed
  if (oldStatus !== newStatus) {
    await db.insert(ticketStatusHistory).values({
      ticketId,
      fromStatus: oldStatus as any,
      toStatus: newStatus as any,
      changedById: userId,
      reason: notes || `Status diubah dari aplikasi mobile teknisi (${userName})`,
      createdAt: now,
    });

    // Record internal message
    await db.insert(ticketMessages).values({
      ticketId,
      authorId: userId,
      type: "internal_note",
      content: `[Mobile] Status tiket diperbarui menjadi: ${newStatus.toUpperCase()}${
        notes ? `\nCatatan: ${notes}` : ""
      }`,
      createdAt: now,
      updatedAt: now,
    });
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

  return NextResponse.json({
    success: true,
    ticket: {
      id: ticketId,
      status: newStatus,
      updatedAt: now.toISOString(),
    },
  });
}
