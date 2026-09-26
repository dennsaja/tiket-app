import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { departments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { updateDepartmentSchema } from "@/lib/validations";
import { createAuditLog, getClientIp } from "@/lib/audit";

// GET /api/departments/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const { id } = await params;
  const dept = await db.query.departments.findFirst({
    where: eq(departments.id, id),
  });

  if (!dept) return errorResponse("Departemen tidak ditemukan", 404);
  return NextResponse.json(dept);
}

// PUT /api/departments/[id] — Update department (noc & owner)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole !== "noc" && userRole !== "owner") {
    return errorResponse("Forbidden: Akses khusus NOC dan Owner", 403);
  }

  const { id } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = updateDepartmentSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      422
    );
  }

  const existing = await db.query.departments.findFirst({
    where: eq(departments.id, id),
  });

  if (!existing) return errorResponse("Departemen tidak ditemukan", 404);

  const [updated] = await db
    .update(departments)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(departments.id, id))
    .returning();

  await createAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "department_updated",
    targetType: "department",
    targetId: updated.id,
    metadata: { name: updated.name, changes: parsed.data },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(updated);
}

// DELETE /api/departments/[id] — Delete or deactivate department (noc & owner)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole !== "noc" && userRole !== "owner") {
    return errorResponse("Forbidden: Akses khusus NOC dan Owner", 403);
  }

  const { id } = await params;
  const existing = await db.query.departments.findFirst({
    where: eq(departments.id, id),
  });

  if (!existing) return errorResponse("Departemen tidak ditemukan", 404);

  // Soft delete / mark inactive
  const [updated] = await db
    .update(departments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(departments.id, id))
    .returning();

  await createAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "department_updated",
    targetType: "department",
    targetId: id,
    metadata: { name: existing.name, action: "deactivated" },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true, message: "Departemen berhasil dinonaktifkan", department: updated });
}
