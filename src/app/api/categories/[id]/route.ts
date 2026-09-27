import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { categories, subcategories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { z } from "zod";

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

const createSubcategorySchema = z.object({
  name: z.string().min(1).max(100),
});

// PATCH /api/categories/[id] — edit category
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (!["noc", "owner", "admin"].includes(userRole)) {
    return errorResponse("Forbidden", 403);
  }

  let body: any;
  try { body = await req.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }

  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      422
    );
  }

  const existing = await db.query.categories.findFirst({
    where: eq(categories.id, params.id),
  });
  if (!existing) return errorResponse("Kategori tidak ditemukan", 404);

  const [updated] = await db
    .update(categories)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(categories.id, params.id))
    .returning();

  await createAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "category_updated",
    targetType: "category",
    targetId: params.id,
    metadata: { name: updated.name, changes: parsed.data },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(updated);
}

// DELETE /api/categories/[id] — delete or deactivate category
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (!["noc", "owner", "admin"].includes(userRole)) {
    return errorResponse("Forbidden", 403);
  }

  const existing = await db.query.categories.findFirst({
    where: eq(categories.id, params.id),
    with: { subcategories: true },
  });
  if (!existing) return errorResponse("Kategori tidak ditemukan", 404);

  // Soft delete — deactivate instead of hard delete to preserve ticket references
  await db
    .update(categories)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(categories.id, params.id));

  // Also deactivate all subcategories
  await db
    .update(subcategories)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(subcategories.categoryId, params.id));

  await createAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "category_deleted",
    targetType: "category",
    targetId: params.id,
    metadata: { name: existing.name },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true });
}

// POST /api/categories/[id] — add subcategory to category
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (!["noc", "owner", "admin"].includes(userRole)) {
    return errorResponse("Forbidden", 403);
  }

  let body: any;
  try { body = await req.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }

  const parsed = createSubcategorySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      422
    );
  }

  const existing = await db.query.categories.findFirst({
    where: eq(categories.id, params.id),
  });
  if (!existing) return errorResponse("Kategori tidak ditemukan", 404);

  const [sub] = await db
    .insert(subcategories)
    .values({ name: parsed.data.name, categoryId: params.id })
    .returning();

  await createAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "subcategory_created",
    targetType: "subcategory",
    targetId: sub.id,
    metadata: { name: sub.name, categoryId: params.id },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(sub, { status: 201 });
}
