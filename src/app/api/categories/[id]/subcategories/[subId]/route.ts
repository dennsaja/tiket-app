import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subcategories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { z } from "zod";

const updateSubSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

// PATCH /api/categories/[id]/subcategories/[subId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; subId: string }> }
) {
  const { id, subId } = await params;
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (!["noc", "owner", "admin"].includes(userRole)) {
    return errorResponse("Forbidden", 403);
  }

  let body: any;
  try { body = await req.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }

  const parsed = updateSubSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      422
    );
  }

  const existing = await db.query.subcategories.findFirst({
    where: eq(subcategories.id, subId),
  });
  if (!existing || existing.categoryId !== id) {
    return errorResponse("Subkategori tidak ditemukan", 404);
  }

  const [updated] = await db
    .update(subcategories)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(subcategories.id, subId))
    .returning();

  await createAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "subcategory_updated",
    targetType: "subcategory",
    targetId: subId,
    metadata: { name: updated.name, changes: parsed.data },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(updated);
}

// DELETE /api/categories/[id]/subcategories/[subId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; subId: string }> }
) {
  const { id, subId } = await params;
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (!["noc", "owner", "admin"].includes(userRole)) {
    return errorResponse("Forbidden", 403);
  }

  const existing = await db.query.subcategories.findFirst({
    where: eq(subcategories.id, subId),
  });
  if (!existing || existing.categoryId !== id) {
    return errorResponse("Subkategori tidak ditemukan", 404);
  }

  // Soft delete
  await db
    .update(subcategories)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(subcategories.id, subId));

  await createAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "subcategory_deleted",
    targetType: "subcategory",
    targetId: subId,
    metadata: { name: existing.name, categoryId: id },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true });
}
